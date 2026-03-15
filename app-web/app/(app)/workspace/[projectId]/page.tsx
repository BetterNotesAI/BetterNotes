"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    getUsageStatus, incrementMessageCount,
    listProjectFiles, createProjectFolder, deleteProjectFile,
    listOutputFiles, saveOutputFile,
    type Project, type ProjectFileRecord, type UsageStatus
} from "@/lib/api";
import { uploadProjectFile, getProjectFileUrl } from "@/lib/storage";
import dynamic from "next/dynamic";
import FileTree from "@/app/components/FileTree";
const PdfViewer = dynamic(() => import("@/app/components/PdfViewer"), { ssr: false });
import LatexEditor from "@/app/components/LatexEditor";
import InlineEditMenu from "@/app/components/InlineEditMenu";
import PaywallModal from "@/app/components/PaywallModal";
import ChatThinkingBubble from "@/app/components/ChatThinkingBubble";
import ChatMessage from "@/app/components/ChatMessage";
import SlashCommandPicker, { type SlashCommandPickerRef } from "@/app/components/SlashCommandPicker";
import { templates } from "@/lib/templates";
import { useToast } from "@/app/components/Toast";
import { useDialog } from "@/app/components/ConfirmDialog";
import type { User } from "@supabase/supabase-js";

type Msg = { role: "user" | "assistant"; content: string };

/** Local in-memory representation of an output file */
interface OutputEntry {
    filePath: string;
    content: string;
    dirty: boolean;
}

const GENERATE_API_ENDPOINT = "/api/generate-latex";
const FIX_API_ENDPOINT = "/api/fix-latex";
const COMPILE_API_ENDPOINT = "/api/compile";
const COMPILE_PROJECT_API_ENDPOINT = "/api/latex/compile-project";

export default function ProjectWorkspace() {
    const { projectId } = useParams<{ projectId: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const { showConfirm, showPrompt } = useDialog();

    // Auth + project
    const [user, setUser] = useState<User | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // Chat
    const [messages, setMessages] = useState<Msg[]>([
        { role: "assistant", content: "Tell me what you want to create. I'll generate LaTeX + PDF for you." },
    ]);
    const [chatInput, setChatInput] = useState("");
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // Project files (user uploads)
    const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    // ═══ Multi-file output state ═══
    const [outputFiles, setOutputFiles] = useState<OutputEntry[]>([]);
    const [activeOutputPath, setActiveOutputPath] = useState<string>("main.tex");
    const [pdfUrl, setPdfUrl] = useState("");
    const [activeTab, setActiveTab] = useState<"preview" | "latex" | "split">("preview");

    // Split-view resizer
    const [splitRatio, setSplitRatio] = useState(50);
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);

    const onSplitMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        const startX = e.clientX;
        const startRatio = splitRatio;
        const container = splitContainerRef.current;
        if (!container) return;
        const containerWidth = container.getBoundingClientRect().width;

        function onMove(ev: MouseEvent) {
            if (!isDraggingRef.current) return;
            const delta = ev.clientX - startX;
            const newRatio = Math.min(80, Math.max(20, startRatio + (delta / containerWidth) * 100));
            setSplitRatio(newRatio);
        }
        function onUp() {
            isDraggingRef.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [splitRatio]);

    // Panels state (must be declared before callbacks that reference them)
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [chatWidth, setChatWidth] = useState(300);
    const chatResizingRef = useRef(false);
    const [filesCollapsed, setFilesCollapsed] = useState(false);
    const [outputFilesCollapsed, setOutputFilesCollapsed] = useState(false);
    const [filesHeight, setFilesHeight] = useState(192);
    const filesResizingRef = useRef(false);
    const filesPanelRef = useRef<HTMLDivElement | null>(null);

    const onFilesResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        filesResizingRef.current = true;
        const startY = e.clientY;
        const startHeight = filesHeight;
        function onMove(ev: MouseEvent) {
            if (!filesResizingRef.current) return;
            const delta = startY - ev.clientY; // dragging up = bigger
            const newHeight = Math.min(480, Math.max(80, startHeight + delta));
            setFilesHeight(newHeight);
        }
        function onUp() {
            filesResizingRef.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [filesHeight]);

    const onChatStripMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        let dragged = false;
        const startWidth = chatWidth;

        function onMove(ev: MouseEvent) {
            if (Math.abs(ev.clientX - startX) > 3) {
                dragged = true;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
            }
            if (!dragged) return;
            const delta = startX - ev.clientX; // drag left = wider
            setChatWidth(Math.min(520, Math.max(220, startWidth + delta)));
        }
        function onUp() {
            if (!dragged) setChatCollapsed((c) => !c);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [chatWidth]);

    // Status flags
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [compileError, setCompileError] = useState("");
    const [compileLog, setCompileLog] = useState("");
    const sendInFlightRef = useRef(false);

    // Auto-compile flag
    const pendingAutoCompile = useRef(false);

    // Inline edit
    const editorRef = useRef<HTMLTextAreaElement | null>(null);

    // Freemium
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [showPaywallModal, setShowPaywallModal] = useState(false);

    // Slash-command template override (one-shot)
    const slashPickerRef = useRef<SlashCommandPickerRef>(null);
    const [templateOverride, setTemplateOverride] = useState<string | null>(null);
    const selectedTemplate = templateOverride ? templates.find((t) => t.id === templateOverride) ?? null : null;

    // Console panel state
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const downloadRef = useRef<HTMLDivElement | null>(null);
    const [pdfZoom, setPdfZoom] = useState(100);
    const [pdfNumPages, setPdfNumPages] = useState(0);
    const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
    const [pdfTargetPage, setPdfTargetPage] = useState<number | undefined>(undefined);
    const [pageInput, setPageInput] = useState("");

    // ── Derived state ──
    const activeEntry = outputFiles.find((f) => f.filePath === activeOutputPath);
    const activeContent = activeEntry?.content ?? "";
    const mainTex = outputFiles.find((f) => f.filePath === "main.tex");
    const anyDirty = outputFiles.some((f) => f.dirty);
    const busy = () => isSending || isGenerating || isCompiling || isFixing;

    // Close download dropdown on outside click
    useEffect(() => {
        if (!downloadOpen) return;
        function handleClick(e: MouseEvent) {
            if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
                setDownloadOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [downloadOpen]);

    // ── Auth ──
    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) setUsageStatus(await getUsageStatus());
        }).catch(() => {
            setUser(null);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) setUsageStatus(await getUsageStatus());
            else setUsageStatus(null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // ── Load project ──
    useEffect(() => {
        if (!user || !projectId) return;
        setLoading(true);
        async function load() {
            const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
            if (error || !data) { router.push("/projects"); return; }
            setProject(data as Project);
            setLoading(false);
        }
        load();
    }, [user, projectId, router]);

    // ── Load project files (user uploads) ──
    const refreshFiles = useCallback(async () => {
        if (!projectId) return;
        const files = await listProjectFiles(projectId);
        setProjectFiles(files);
    }, [projectId]);

    useEffect(() => { refreshFiles(); }, [refreshFiles]);

    // ── Load saved output files (multi-file) ──
    useEffect(() => {
        if (!projectId) return;
        async function loadOutputs() {
            const outputs = await listOutputFiles(projectId);
            if (outputs.length > 0) {
                setOutputFiles(outputs.map((o) => ({
                    filePath: o.file_path,
                    content: o.content ?? "",
                    dirty: false,
                })));
                // Select main.tex if it exists, otherwise first file
                const main = outputs.find((o) => o.file_path === "main.tex");
                setActiveOutputPath(main ? "main.tex" : outputs[0].file_path);
                if (outputs.some((o) => (o.content ?? "").trim())) pendingAutoCompile.current = true;
            }
        }
        loadOutputs();
    }, [projectId]);

    // Auto-compile when files load with content
    useEffect(() => {
        if (!pendingAutoCompile.current) return;
        const timer = setTimeout(() => {
            if (pendingAutoCompile.current) {
                pendingAutoCompile.current = false;
                saveAndCompile();
            }
        }, 500);
        return () => clearTimeout(timer);
    });

    // ── Scroll chat ──
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // ── Cleanup PDF URL ──
    useEffect(() => {
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ctrl+S / Cmd+S to save and compile
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (outputFiles.some((f) => f.content.trim()) && !busy()) {
                    saveAndCompile();
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // ═══ Output file helpers ═══
    function updateOutputFile(filePath: string, content: string) {
        setOutputFiles((prev) => {
            const existing = prev.find((f) => f.filePath === filePath);
            if (existing) {
                return prev.map((f) => f.filePath === filePath ? { ...f, content, dirty: true } : f);
            }
            return [...prev, { filePath, content, dirty: true }];
        });
    }

    function setOutputFilesFromGeneration(mainContent: string) {
        // If the AI generates a single document, set main.tex
        // Future: parse multi-file responses
        setOutputFiles((prev) => {
            const existing = prev.find((f) => f.filePath === "main.tex");
            if (existing) {
                return prev.map((f) => f.filePath === "main.tex" ? { ...f, content: mainContent, dirty: false } : f);
            }
            return [{ filePath: "main.tex", content: mainContent, dirty: false }, ...prev];
        });
        setActiveOutputPath("main.tex");
    }

    async function addNewOutputFile() {
        const name = await showPrompt({ title: "New File", message: "Enter file name (e.g. preamble.tex, chapters/intro.tex):", placeholder: "preamble.tex", confirmText: "Create" });
        if (!name?.trim()) return;
        const normalized = name.trim().replace(/\\/g, "/");
        const exists = outputFiles.some((f) => f.filePath === normalized);
        if (exists) { toast("File already exists.", "warning"); return; }
        setOutputFiles((prev) => [...prev, { filePath: normalized, content: "", dirty: true }]);
        setActiveOutputPath(normalized);
        setActiveTab("latex");
    }

    async function deleteOutputEntry(filePath: string) {
        if (filePath === "main.tex") { toast("Cannot delete main.tex", "warning"); return; }
        const ok = await showConfirm({ title: "Delete File", message: `Delete output file "${filePath}"?`, variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        setOutputFiles((prev) => prev.filter((f) => f.filePath !== filePath));
        if (activeOutputPath === filePath) setActiveOutputPath("main.tex");
    }

    // ═══ Helpers ═══
    function isTransientAssistantMessageText(text: string): boolean {
        const normalized = (text || "").trim();
        return (
            normalized.startsWith("Working…") ||
            normalized.startsWith("Working...") ||
            normalized.startsWith("Generated. Compiling PDF...")
        );
    }

    function replaceLastWorking(m: Msg[], newText: string): Msg[] {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && isTransientAssistantMessageText(copy[i].content)) {
                copy[i] = { role: "assistant", content: newText };
                break;
            }
        }
        return copy;
    }

    /** Get signed URLs for project image files to inject into AI context */
    async function getProjectImageContext(): Promise<string> {
        const images = projectFiles.filter((f) => {
            if (f.is_folder || !f.mime_type) return false;
            return f.mime_type.startsWith("image/");
        });
        if (images.length === 0) return "";

        const lines: string[] = ["Available project images (use \\includegraphics{figures/<name>}):"];
        for (const img of images) {
            if (img.storage_path) {
                const url = await getProjectFileUrl(img.storage_path);
                if (url) lines.push(`  - ${img.name} → ${url}`);
            }
        }
        return lines.join("\n");
    }

    // ── Freemium gate ──
    const canSendMessage = useCallback(async (): Promise<boolean> => {
        if (!user) { router.push("/login"); return false; }
        if (process.env.NEXT_PUBLIC_DEV_UNLIMITED === "true") return true;
        try {
            const status = await Promise.race<UsageStatus | null>([
                getUsageStatus(),
                new Promise<UsageStatus | null>((resolve) => setTimeout(() => resolve(null), 5000)),
            ]);
            if (status) setUsageStatus(status);
            if (status && typeof status.can_send === "boolean" && !status.can_send) {
                setShowPaywallModal(true);
                return false;
            }
        } catch { /* fail open */ }
        return true;
    }, [user, router]);

    // ═══ Generate ═══
    async function generateLatex(prompt: string, baseLatex?: string) {
        try {
            setIsGenerating(true);
            const payload: Record<string, unknown> = { prompt };
            if (project?.template_id) payload.templateId = project.template_id;
            // Use one-shot template override if set
            if (templateOverride) payload.templateId = templateOverride;
            if (baseLatex?.trim()) payload.baseLatex = baseLatex;

            // Inject image awareness
            const imageCtx = await getProjectImageContext();
            if (imageCtx) payload.prompt = `${prompt}\n\n[System context]\n${imageCtx}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            const r = await fetch(GENERATE_API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const data = await r.json().catch(() => null);
            if (!r.ok) return { ok: false as const, error: data?.error ?? "Failed to generate." };
            if (data.message) return { ok: true as const, message: data.message as string };
            const latex = (data?.latex ?? "").toString();
            if (!latex.trim() && !data.message) return { ok: false as const, error: "Empty response." };
            return { ok: true as const, latex };
        } catch (e: unknown) {
            const err = e as Error;
            return { ok: false as const, error: err?.name === "AbortError" ? "Timeout (180s)." : (err?.message ?? "Generate error") };
        } finally {
            setIsGenerating(false);
        }
    }

    // ═══ Compile (multi-file aware) ═══
    async function compileProject() {
        setCompileError(""); setCompileLog("");
        const texFiles = outputFiles.filter((f) => f.content.trim());
        if (texFiles.length === 0) { setCompileError("No files to compile."); return { ok: false as const }; }

        try {
            setIsCompiling(true);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            // Build files array for the backend
            const filesPayload = texFiles.map((f) => ({
                path: f.filePath,
                content: f.content,
            }));

            // Add project images as binary files (base64)
            const images = projectFiles.filter((f) => !f.is_folder && f.mime_type?.startsWith("image/") && f.storage_path);
            for (const img of images) {
                const url = await getProjectFileUrl(img.storage_path!);
                if (url) {
                    try {
                        const resp = await fetch(url);
                        const buf = await resp.arrayBuffer();
                        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                        filesPayload.push({
                            path: `figures/${img.name}`,
                            content: base64,
                            isBinary: true,
                        } as { path: string; content: string; isBinary?: boolean });
                    } catch { /* skip failed images */ }
                }
            }

            // Use single-file or multi-file endpoint
            const isMultiFile = texFiles.length > 1;
            const endpoint = isMultiFile ? COMPILE_PROJECT_API_ENDPOINT : COMPILE_API_ENDPOINT;
            const body = isMultiFile
                ? { files: filesPayload, mainFile: "main.tex" }
                : { latex: mainTex?.content || texFiles[0].content };

            const r = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const ct = (r.headers.get("content-type") || "").toLowerCase();
            if (r.ok && ct.includes("application/pdf")) {
                const buf = await r.arrayBuffer();
                if (!buf || buf.byteLength === 0) { setCompileError("Empty PDF."); return { ok: false as const }; }
                const blob = new Blob([buf], { type: "application/pdf" });
                setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
                return { ok: true as const };
            }

            const data = await r.json().catch(() => null);
            if (r.ok) {
                const b64 = (data?.pdfBase64 ?? data?.pdf_base64 ?? data?.pdf ?? "").toString();
                if (b64.trim()) {
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/pdf" });
                    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
                    return { ok: true as const };
                }
            }

            const rawErr = (data?.error ?? "Compilation failed.").toString();
            const markerIdx = rawErr.indexOf("----- compiler output -----");
            const message = markerIdx === -1 ? rawErr : rawErr.slice(0, markerIdx).trim();
            const log = markerIdx === -1 ? "" : rawErr.slice(markerIdx + 27).trim();
            setCompileError(message || "Compilation failed.");
            setCompileLog(log || (data?.log ? String(data.log) : ""));
            return { ok: false as const };
        } catch (e: unknown) {
            if ((e as Error)?.name === "AbortError") {
                setCompileError("Compile request timed out (180s).");
                return { ok: false as const };
            }
            setCompileError((e as Error)?.message || "Compile error");
            return { ok: false as const };
        } finally {
            setIsCompiling(false);
        }
    }

    // ═══ Fix with AI ═══
    async function fixWithAI() {
        const current = activeEntry?.content || mainTex?.content;
        if (!current?.trim() || !compileLog.trim()) return;
        setIsFixing(true);
        try {
            const r = await fetch(FIX_API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latex: current, log: compileLog }),
            });
            const data = await r.json().catch(() => null);
            if (!r.ok) throw new Error(data?.error ?? "Fix failed.");
            const fixed = (data?.fixedLatex ?? "").toString();
            if (!fixed.trim()) throw new Error("Empty fix result.");
            updateOutputFile(activeOutputPath, fixed);
            setCompileError(""); setCompileLog("");
            // Recompile after fix
            const comp = await compileProject();
            if (comp.ok) {
                setOutputFiles((prev) => prev.map((f) => ({ ...f, dirty: false })));
                setMessages((m) => [...m, { role: "assistant", content: "Applied AI fix and recompiled successfully." }]);
            }
        } catch (e: unknown) {
            setCompileError((e as Error)?.message ?? "Fix error");
        } finally {
            setIsFixing(false);
        }
    }

    // ═══ Send message ═══
    async function handleSend() {
        const text = chatInput.trim();
        if (!text || busy() || sendInFlightRef.current) return;

        sendInFlightRef.current = true;
        setIsSending(true);
        try {
            const allowed = await canSendMessage();
            if (!allowed) return;

            setChatInput("");
            // Clear one-shot template override after use
            setTemplateOverride(null);
            setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "Working… generating document..." }]);

            const base = mainTex?.content || "";
            const gen = await generateLatex(text, base.trim() || undefined);

            if (!gen.ok) {
                setMessages((m) => replaceLastWorking(m, `Error: ${gen.error}`));
                return;
            }

            if ("message" in gen && gen.message) {
                setMessages((m) => replaceLastWorking(m, gen.message!));
                return;
            }

            const newLatex = ("latex" in gen ? gen.latex : "") || "";
            if (base.trim() && newLatex.trim() === base.trim()) {
                setMessages((m) => replaceLastWorking(m, "No changes detected in the generated LaTeX. Try a more specific edit request."));
                return;
            }
            setOutputFilesFromGeneration(newLatex);
            setActiveTab("preview");
            setMessages((m) => replaceLastWorking(m, "Generated. Compiling PDF..."));

            // Save and compile in parallel
            const compilePromise = compileProject();
            const savePromise = (async () => {
                try {
                    await incrementMessageCount();
                    if (projectId) await saveOutputFile(projectId, "main.tex", newLatex);
                } catch { /* skip */ }
            })();

            const comp = await compilePromise;
            if (comp.ok) {
                setOutputFiles((prev) => prev.map((f) => ({ ...f, dirty: false })));
                setMessages((m) => replaceLastWorking(m, "Done. Preview updated."));
            } else {
                setMessages((m) => replaceLastWorking(m, 'Generated LaTeX, but compilation failed. Use "Fix with AI".'));
            }
            await savePromise;
        } catch (e: unknown) {
            setMessages((m) => replaceLastWorking(m, `Error: ${(e as Error)?.message ?? "Send failed."}`));
        } finally {
            sendInFlightRef.current = false;
            setIsSending(false);
        }
    }

    // ═══ Save & Compile ═══
    async function saveAndCompile() {
        if (outputFiles.length === 0 || busy()) return;
        setCompileError(""); setCompileLog("");

        // Save all dirty output files to DB
        const savePromises = outputFiles.filter((f) => f.dirty).map((f) =>
            saveOutputFile(projectId, f.filePath, f.content)
        );

        const comp = await compileProject();
        if (comp.ok) {
            setOutputFiles((prev) => prev.map((f) => ({ ...f, dirty: false })));
        }
        await Promise.all(savePromises);
    }

    // ═══ Downloads ═══
    function downloadCurrentTex() {
        const content = activeEntry?.content;
        if (!content?.trim()) return;
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = activeOutputPath.split("/").pop() || "main.tex"; a.click();
        URL.revokeObjectURL(url);
    }

    async function downloadZip() {
        const texFiles = outputFiles.filter((f) => f.content.trim());
        if (texFiles.length === 0) return;

        // Simple ZIP implementation (no external library needed)
        // Uses the JSZip-like approach with Blob
        if (texFiles.length === 1) {
            // Just download the single file
            downloadCurrentTex();
            return;
        }

        // For multi-file: create a simple tar-like structure
        // Actually, let's create individual downloads or use a simple concatenated approach
        // Better approach: generate ZIP using browser APIs
        try {
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            for (const f of texFiles) {
                zip.file(f.filePath, f.content);
            }
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${project?.title || "project"}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // Fallback: download each file separately
            for (const f of texFiles) {
                const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = f.filePath.split("/").pop() || "file.tex";
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    }

    function downloadPdf() {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl; a.download = "output.pdf"; a.click();
    }

    // ═══ File operations (project files / uploads) ═══
    async function handleNewFolder(parentId: string | null) {
        const name = await showPrompt({ title: "New Folder", placeholder: "Folder name", confirmText: "Create" });
        if (!name?.trim() || !projectId) return;
        await createProjectFolder(projectId, name.trim(), parentId);
        refreshFiles();
    }

    async function handleUpload(parentId: string | null) {
        const input = document.createElement("input");
        input.type = "file"; input.multiple = true;
        input.accept = ".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.csv,.docx,.tex,.bib,.sty,.cls";
        input.onchange = async () => {
            const selected = Array.from(input.files || []);
            for (const file of selected) {
                await uploadProjectFile(file, projectId, parentId);
            }
            refreshFiles();
        };
        input.click();
    }

    async function handleDeleteFile(file: ProjectFileRecord) {
        await deleteProjectFile(file.id);
        refreshFiles();
    }

    // ── Inline edit actions ──
    function handleInlineAction(action: "change" | "explain" | "delete", text: string) {
        const p = action === "change" ? `Change the following in my LaTeX: "${text}"` :
            action === "explain" ? `Explain this LaTeX code: "${text}"` :
                `Remove the following from my LaTeX: "${text}"`;
        setChatInput(p);
    }

    const canCompile = outputFiles.some((f) => f.content.trim()) && !busy();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-white/40 text-sm">Loading project...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen text-white overflow-hidden">
            {/* ── LEFT/CENTER: Output panel ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between gap-3">
                    {/* Left: Compile */}
                    <button
                        onClick={saveAndCompile}
                        disabled={!canCompile}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${canCompile ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-white/10 text-white/35 cursor-not-allowed"}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                        </svg>
                        {isCompiling ? "Compiling…" : "Compile"}
                    </button>

                    {/* Center: Zoom + Page controls (preview only) */}
                    {activeTab === "preview" && pdfUrl && (
                        <div className="flex items-center gap-2">
                            {/* Zoom */}
                            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-0.5">
                                <button
                                    onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}
                                    className="h-6 w-6 flex items-center justify-center rounded text-white/50 hover:text-white/90 hover:bg-white/10 text-sm font-medium transition-colors"
                                    title="Zoom out"
                                >−</button>
                                <span className="text-xs text-white/40 w-10 text-center tabular-nums">{pdfZoom}%</span>
                                <button
                                    onClick={() => setPdfZoom((z) => Math.min(200, z + 10))}
                                    className="h-6 w-6 flex items-center justify-center rounded text-white/50 hover:text-white/90 hover:bg-white/10 text-sm font-medium transition-colors"
                                    title="Zoom in"
                                >+</button>
                            </div>
                            {/* Page navigation */}
                            {pdfNumPages > 0 && (
                                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-0.5">
                                    <button
                                        onClick={() => { const p = Math.max(1, pdfCurrentPage - 1); setPdfTargetPage(p); }}
                                        className="h-6 w-6 flex items-center justify-center rounded text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
                                        title="Previous page"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                                    </button>
                                    <input
                                        type="text"
                                        value={pageInput || String(pdfCurrentPage)}
                                        onChange={(e) => setPageInput(e.target.value)}
                                        onFocus={(e) => { setPageInput(String(pdfCurrentPage)); e.target.select(); }}
                                        onBlur={() => setPageInput("")}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                const n = parseInt(pageInput, 10);
                                                if (!isNaN(n) && n >= 1 && n <= pdfNumPages) setPdfTargetPage(n);
                                                (e.target as HTMLInputElement).blur();
                                            }
                                            if (e.key === "Escape") { setPageInput(""); (e.target as HTMLInputElement).blur(); }
                                        }}
                                        className="w-7 text-center text-xs text-white/60 bg-transparent outline-none focus:text-white tabular-nums"
                                        title="Go to page"
                                    />
                                    <span className="text-xs text-white/30 tabular-nums">/ {pdfNumPages}</span>
                                    <button
                                        onClick={() => { const p = Math.min(pdfNumPages, pdfCurrentPage + 1); setPdfTargetPage(p); }}
                                        className="h-6 w-6 flex items-center justify-center rounded text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
                                        title="Next page"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right: View tabs + Download */}
                    <div className="flex items-center gap-2">
                        {/* Segmented view control */}
                        <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                            <button
                                onClick={() => setActiveTab("preview")}
                                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${activeTab === "preview" ? "bg-white text-neutral-950 font-medium" : "text-white/50 hover:text-white/80"}`}
                            >Preview</button>
                            <button
                                onClick={() => setActiveTab("latex")}
                                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${activeTab === "latex" ? "bg-white text-neutral-950 font-medium" : "text-white/50 hover:text-white/80"}`}
                            >LaTeX</button>
                            <button
                                onClick={() => setActiveTab("split")}
                                title="Split view"
                                className={`rounded-md px-2 py-1 transition-colors ${activeTab === "split" ? "bg-white text-neutral-950" : "text-white/50 hover:text-white/80"}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 4.5h15a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z" /></svg>
                            </button>
                        </div>

                        {/* Download dropdown */}
                        <div ref={downloadRef} className="relative">
                            <button
                                onClick={() => setDownloadOpen(!downloadOpen)}
                                disabled={!pdfUrl && !activeContent.trim()}
                                className="rounded-lg px-2.5 py-1.5 text-xs border border-white/10 bg-white/[0.04] hover:bg-white/10 disabled:opacity-30 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Download
                                <svg className={`w-3 h-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {downloadOpen && (
                                <div className="absolute right-0 mt-1 w-36 rounded-xl border border-white/15 bg-neutral-900/95 backdrop-blur shadow-xl py-1 z-50">
                                    <button
                                        onClick={() => { downloadPdf(); setDownloadOpen(false); }}
                                        disabled={!pdfUrl}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => { downloadCurrentTex(); setDownloadOpen(false); }}
                                        disabled={!activeContent.trim()}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                                        .tex
                                    </button>
                                    {outputFiles.length > 1 && (
                                        <button
                                            onClick={() => { downloadZip(); setDownloadOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                                        >
                                            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                                            .zip
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 flex min-h-0">
                    {/* Output file tree (visible in LaTeX and Split tabs with multiple files) */}
                    {(activeTab === "latex" || activeTab === "split") && (
                        <div className={`border-r border-white/8 flex flex-col transition-[width] duration-200 overflow-hidden flex-shrink-0 ${outputFilesCollapsed ? "w-8" : "w-48"}`}>
                            {/* Header */}
                            <div
                                className="h-8 flex items-center justify-between px-2 border-b border-white/8 cursor-pointer select-none flex-shrink-0"
                                onClick={() => setOutputFilesCollapsed((c) => !c)}
                            >
                                {!outputFilesCollapsed && (
                                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Output Files</span>
                                )}
                                <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                                    {!outputFilesCollapsed && (
                                        <button onClick={addNewOutputFile} className="h-5 w-5 rounded text-white/25 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="New file">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setOutputFilesCollapsed((c) => !c)}
                                        className="h-5 w-5 rounded text-white/25 hover:text-white/60 hover:bg-white/10 flex items-center justify-center"
                                        title={outputFilesCollapsed ? "Expand" : "Collapse"}
                                    >
                                        <svg className={`h-3 w-3 transition-transform ${outputFilesCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {!outputFilesCollapsed && (
                                <div className="flex-1 overflow-y-auto py-1">
                                    {outputFiles.length === 0 ? (
                                        <div className="px-3 py-3 text-[10px] text-white/20 text-center">No output files yet</div>
                                    ) : (
                                        outputFiles.map((f) => (
                                            <div
                                                key={f.filePath}
                                                className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer ${f.filePath === activeOutputPath ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/70"}`}
                                            >
                                                <button onClick={() => setActiveOutputPath(f.filePath)} className="flex-1 text-left truncate flex items-center gap-1.5">
                                                    <svg className="h-3 w-3 flex-shrink-0 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                    </svg>
                                                    <span className="truncate">{f.filePath}</span>
                                                    {f.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved" />}
                                                </button>
                                                {f.filePath !== "main.tex" && (
                                                    <button onClick={() => deleteOutputEntry(f.filePath)} className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-300 transition-opacity">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {activeTab === "split" ? (
                            /* ── Split view ── */
                            <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
                                {/* Code panel */}
                                <div style={{ width: `${splitRatio}%` }} className="flex flex-col min-w-0">
                                    <div className="h-8 flex items-center px-3 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider flex-shrink-0">LaTeX — {activeOutputPath}</div>
                                    <div className="relative flex-1 h-full">
                                        <LatexEditor
                                            value={activeContent}
                                            onChange={(v) => updateOutputFile(activeOutputPath, v)}
                                            placeholder={`${activeOutputPath} — start typing LaTeX…`}
                                        />
                                    </div>
                                </div>
                                {/* Draggable divider */}
                                <div onMouseDown={onSplitMouseDown} className="w-1.5 bg-white/8 hover:bg-white/20 cursor-col-resize transition-colors flex-shrink-0 relative group">
                                    <div className="absolute inset-y-0 -left-1 -right-1" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                                </div>
                                {/* Preview panel */}
                                <div style={{ width: `${100 - splitRatio}%` }} className="flex flex-col min-w-0">
                                    <div className="h-8 flex items-center px-3 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider flex-shrink-0">Preview</div>
                                    <div className="flex-1 min-h-0">
                                        {pdfUrl ? (
                                            <PdfViewer url={pdfUrl} zoom={pdfZoom} targetPage={pdfTargetPage} onNumPages={setPdfNumPages} onPageChange={setPdfCurrentPage} />
                                        ) : <div className="h-full flex items-center justify-center text-white/30 text-sm">No PDF yet</div>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ── Single panel ── */
                            <div className="flex-1 overflow-hidden relative">
                                {activeTab === "preview" ? (
                                    pdfUrl ? (
                                        <PdfViewer url={pdfUrl} zoom={pdfZoom} targetPage={pdfTargetPage} onNumPages={setPdfNumPages} onPageChange={setPdfCurrentPage} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-white/30 text-sm">
                                            No PDF yet. Send a prompt or compile.
                                        </div>
                                    )
                                ) : (
                                    <div className="relative h-full">
                                        <LatexEditor
                                            value={activeContent}
                                            onChange={(v) => updateOutputFile(activeOutputPath, v)}
                                            placeholder={`${activeOutputPath} — start typing LaTeX…`}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ── Resize + collapse strip ── */}
            <div
                onMouseDown={onChatStripMouseDown}
                className="hidden lg:flex w-3 flex-col items-center justify-center border-x border-white/8 bg-white/[0.02] hover:bg-white/[0.06] cursor-col-resize transition-colors select-none group"
            >
                {/* Collapse indicator pill */}
                <div className="flex flex-col items-center gap-0.5 px-0.5">
                    <div className="w-0.5 h-3 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
                    <svg className={`h-2.5 w-2.5 text-white/30 group-hover:text-white/70 transition-colors transition-transform ${chatCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <div className="w-0.5 h-3 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
                </div>
            </div>

            {/* ── RIGHT COLUMN: Chat + Files ── */}
            <div
                className="flex flex-col bg-white/[0.02] border-l border-white/8 transition-[width] duration-200 overflow-hidden"
                style={{ width: chatCollapsed ? 0 : chatWidth, minWidth: chatCollapsed ? 0 : 220 }}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/8">
                    <div className="text-sm font-semibold truncate">{project?.title || "Project"}</div>
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                    {messages.map((m, idx) => {
                        const showThinkingBubble =
                            m.role === "assistant" &&
                            idx === messages.length - 1 &&
                            isTransientAssistantMessageText(m.content);

                        if (showThinkingBubble) {
                            return (
                                <div key={idx} className="mr-auto max-w-[92%]">
                                    <ChatThinkingBubble text={m.content} />
                                </div>
                            );
                        }

                        return <ChatMessage key={idx} role={m.role} content={m.content} />;
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* File browser — resizable + collapsible */}
                <div ref={filesPanelRef} className="border-t border-white/8 flex flex-col flex-shrink-0" style={{ height: filesCollapsed ? "auto" : filesHeight }}>
                    {/* Drag handle */}
                    {!filesCollapsed && (
                        <div
                            onMouseDown={onFilesResizeMouseDown}
                            className="h-1 cursor-row-resize hover:bg-white/20 transition-colors flex-shrink-0"
                        />
                    )}
                    {/* Header with collapse toggle + action buttons */}
                    <div
                        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none border-b border-white/8"
                        onClick={() => setFilesCollapsed(!filesCollapsed)}
                    >
                        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Project Files</span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleNewFolder(null)} className="h-6 w-6 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="New folder">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                </svg>
                            </button>
                            <button onClick={() => handleUpload(null)} className="h-6 w-6 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="Upload file">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                            </button>
                            <svg className={`h-3 w-3 text-white/25 transition-transform ml-1 ${filesCollapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    {!filesCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <FileTree
                                files={projectFiles}
                                selectedId={selectedFileId}
                                onSelect={(f) => setSelectedFileId(f.id)}
                                onDelete={handleDeleteFile}
                                onNewFolder={handleNewFolder}
                                onUpload={handleUpload}
                                emptyText="No files uploaded yet"
                                showHeader={false}
                            />
                        </div>
                    )}
                </div>

                {/* Chat input */}
                <div className="p-3 border-t border-white/8">
                    {selectedTemplate && (
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 pl-1.5 pr-2 py-1">
                                {selectedTemplate.thumbnailPath && (
                                    <div className="w-5 h-5 rounded-full overflow-hidden border border-emerald-400/30">
                                        <img src={selectedTemplate.thumbnailPath} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <span className="text-[11px] font-medium text-emerald-300">{selectedTemplate.name}</span>
                                <button onClick={() => setTemplateOverride(null)} className="ml-0.5 text-emerald-400/50 hover:text-emerald-300 transition-colors">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 relative">
                        <SlashCommandPicker
                            ref={slashPickerRef}
                            inputValue={chatInput}
                            isPro={usageStatus?.is_paid ?? false}
                            onSelect={(id) => { setTemplateOverride(id); setChatInput(""); }}
                            onProBlocked={() => setShowPaywallModal(true)}
                            onDismiss={() => setChatInput("")}
                        />
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (slashPickerRef.current?.handleKeyDown(e)) return; if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
                            className="h-10 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none placeholder:text-white/35 text-white"
                            placeholder="Type / for templates, or ask BetterNotes…"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!chatInput.trim() || busy()}
                            className={`h-10 rounded-xl px-4 text-sm font-semibold ${chatInput.trim() && !busy()
                                ? "bg-white text-neutral-950 hover:bg-white/90"
                                : "bg-white/15 text-white/40 cursor-not-allowed"
                                }`}
                        >
                            {isSending ? "Sending…" : isGenerating ? "…" : "Send"}
                        </button>
                    </div>
                </div>
            </div>

            <PaywallModal isOpen={showPaywallModal} onClose={() => setShowPaywallModal(false)} remaining={usageStatus?.remaining} resetsAt={usageStatus?.resets_at} />
        </div>
    );
}
