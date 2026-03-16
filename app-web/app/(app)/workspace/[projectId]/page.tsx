"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    getUsageStatus, incrementMessageCount,
    listProjectFiles, createProjectFolder, deleteProjectFile,
    listOutputFiles, saveOutputFile, initializeMultiFileProject,
    type Project, type ProjectFileRecord, type UsageStatus
} from "@/lib/api";
import { uploadProjectFile, getProjectFileUrl } from "@/lib/storage";
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
import { useWorkspaceAuth } from "./_hooks/useWorkspaceAuth";
import { useResizers } from "./_hooks/useResizers";
import { useProjectFiles } from "./_hooks/useProjectFiles";
import { useOutputFiles } from "./_hooks/useOutputFiles";
import { useLatexActions } from "./_hooks/useLatexActions";

type SurveyQuestion = { id: string; question: string; options: string[] };
type TextMsg   = { role: "user" | "assistant"; content: string };
type SurveyMsg = { role: "survey"; questions: SurveyQuestion[]; originalPrompt: string; answered?: boolean };
type Msg = TextMsg | SurveyMsg;

/** Local in-memory representation of an output file */
interface OutputEntry {
    filePath: string;
    content: string;
    dirty: boolean;
}

const GENERATE_API_ENDPOINT = "/api/generate-latex";
const GENERATE_PROJECT_API_ENDPOINT = "/api/generate-project";
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
    const [authResolved, setAuthResolved] = useState(false);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // Resizers
    const {
        splitRatio, splitContainerRef, onSplitMouseDown,
        chatCollapsed, chatWidth, onChatStripMouseDown,
        filesCollapsed, setFilesCollapsed, filesHeight, filesPanelRef, onFilesResizeMouseDown,
        outputFilesCollapsed, setOutputFilesCollapsed,
    } = useResizers();

    // Project files (user uploads)
    const { projectFiles, refreshFiles, selectedFileId, setSelectedFileId, handleUpload, handleDeleteFile } = useProjectFiles(projectId);

    // Output files (LaTeX multi-file)
    const {
        outputFiles, activeOutputPath, setActiveOutputPath,
        updateOutputFile, setOutputFilesFromGeneration,
        addNewOutputFile, deleteOutputEntry,
        saveAllDirty, markAllClean,
    } = useOutputFiles(projectId);

    // Chat
    const [messages, setMessages] = useState<Msg[]>([
        { role: "assistant", content: "Tell me what you want to create. I'll generate LaTeX + PDF for you." },
    ]);
    const [chatInput, setChatInput] = useState("");
    const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // UI state
    const [activeTab, setActiveTab] = useState<"preview" | "latex" | "split">("preview");
    const [compileErrorMsg, setCompileErrorMsg] = useState("");
    const [compileLogMsg, setCompileLogMsg] = useState("");
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const downloadRef = useRef<HTMLDivElement | null>(null);
    const [pdfZoom, setPdfZoom] = useState(100);
    const [pdfNumPages, setPdfNumPages] = useState(0);
    const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
    const [pdfTargetPage, setPdfTargetPage] = useState<number | undefined>(undefined);
    const [pageInput, setPageInput] = useState("");

    // Slash-command template override (one-shot)
    const slashPickerRef = useRef<SlashCommandPickerRef>(null);
    const [templateOverride, setTemplateOverride] = useState<string | null>(null);
    const selectedTemplate = templateOverride ? templates.find((t) => t.id === templateOverride) ?? null : null;

    // Auto-compile flag
    const pendingAutoCompile = useRef(false);

    // LaTeX actions
    const {
        isGenerating, isCompiling, isFixing, isSending, setIsSending,
        pdfUrl, setPdfUrl, compileError, setCompileError, compileLog, setCompileLog,
        sendInFlightRef, busy, generateLatex, compileProject, fixWithAI,
    } = useLatexActions({
        outputFiles,
        activeOutputPath,
        projectFiles,
        projectId,
        templateOverride,
        projectTemplateId: project?.template_id ?? undefined,
        onCompileSuccess: () => {},
        onCompileError: (msg, log) => { setCompileErrorMsg(msg); setCompileLogMsg(log); },
        clearCompileError: () => { setCompileErrorMsg(""); setCompileLogMsg(""); },
    });

    // Output file tree — tracks which folder nodes are collapsed
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

    // ── Derived state ──
    const activeEntry = outputFiles.find((f) => f.filePath === activeOutputPath);
    const activeContent = activeEntry?.content ?? "";
    const mainTex = outputFiles.find((f) => f.filePath === "main.tex");
    const anyDirty = outputFiles.some((f) => f.dirty);
    const busy = () => isSending || isGenerating || isCompiling || isFixing;
    const isLongTemplate = project?.template_id === "long_template";
    const figuresPrefix = isLongTemplate ? "Figures" : "figures";

    // Tracks the "userId:projectId" combo that has already been successfully loaded.
    // Prevents re-fetching when Supabase fires onAuthStateChange with a new User object
    // reference on token refresh (which would otherwise retrigger the load effect).
    const loadedKeyRef = useRef<string | null>(null);

    // Close download dropdown on outside click
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthResolved(true); // unblock project loading immediately
            if (session?.user) getUsageStatus().then(setUsageStatus);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthResolved(true); // unblock project loading immediately
            if (session?.user) getUsageStatus().then(setUsageStatus);
            else setUsageStatus(null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // ── Load project ──
    const userId = user?.id;
    useEffect(() => {
        if (!authResolved) return;
        if (!user) {
            setLoading(false);
            router.push("/login");
            return;
        }
        if (!projectId) {
            setLoading(false);
            router.push("/projects");
            return;
        }

        // Skip re-fetching if we already successfully loaded this user+project combo.
        // This prevents the loading screen from reappearing when Supabase calls
        // onAuthStateChange with a new User object on token refresh.
        const loadKey = `${user.id}:${projectId}`;
        if (loadedKeyRef.current === loadKey) return;

        setLoading(true);
        let cancelled = false;
        async function load() {
            try {
                const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
                if (cancelled) return;
                if (error || !data) {
                    router.push("/projects");
                    return;
                }
                setProject(data as Project);
                loadedKeyRef.current = loadKey;
            } catch {
                if (!cancelled) router.push("/projects");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [authResolved, user, projectId, router]);

    // Set auto-compile when output files load with content
    useEffect(() => {
        if (!projectId || !project) return;
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
            } else {
                // If no output files exist yet, check if this is a multi-file template and seed scaffold
                const tpl = templates.find((t) => t.id === project?.template_id);
                if (tpl?.isMultiFile && tpl.scaffoldBasePath && tpl.scaffoldFiles) {
                    const seeded = await initializeMultiFileProject(projectId, tpl.scaffoldBasePath, tpl.scaffoldFiles);
                    setOutputFiles(seeded);
                    setActiveOutputPath("main.tex");
                }
            }
        }
        loadOutputs();
    }, [projectId, project]);

    // Auto-compile when files load
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

    // Pick up initial prompt from the start workspace (long template redirect)
    const initialPromptHandled = useRef(false);
    const pendingAutoGenerate = useRef<string | null>(null);
    useEffect(() => {
        if (!projectId || !project || initialPromptHandled.current) return;
        if (!isLongTemplate) return;
        const key = `project_initial_prompt_${projectId}`;
        const initialPrompt = sessionStorage.getItem(key);
        if (!initialPrompt) return;
        sessionStorage.removeItem(key);
        initialPromptHandled.current = true;
        pendingAutoGenerate.current = initialPrompt;
        setChatInput(initialPrompt);
    }, [projectId, project, isLongTemplate]);

    // Auto-generate once scaffold files have loaded and we have a pending prompt
    useEffect(() => {
        if (!pendingAutoGenerate.current || outputFiles.length === 0) return;
        const prompt = pendingAutoGenerate.current;
        pendingAutoGenerate.current = null;
        // handleSend reads chatInput — by this point setChatInput has been applied
        const timer = setTimeout(() => handleSend(), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outputFiles.length]);

    // ── Scroll chat ──
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Cleanup PDF URL
    useEffect(() => {
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ctrl+S to compile
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (outputFiles.some((f) => f.content.trim()) && !busy()) saveAndCompile();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // ═══ Helpers ═══
    function isTransientMsg(text: string) {
        const n = (text || "").trim();
        return n.startsWith("Working…") || n.startsWith("Working...") || n.startsWith("Generated. Compiling PDF...");
    }

    function replaceLastWorking(m: Msg[], replacement: string | SurveyMsg): Msg[] {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
            const msg = copy[i];
            if (msg.role === "assistant" && isTransientAssistantMessageText(msg.content)) {
                copy[i] = typeof replacement === "string"
                    ? { role: "assistant", content: replacement }
                    : replacement;
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

        const lines: string[] = [`Available project images (use \\includegraphics{${figuresPrefix}/<name>}):`];
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

    // ═══ Generate multi-file project (long template) ═══
    async function generateProjectFiles(prompt: string): Promise<
        { ok: true; files: Record<string, string> } |
        { ok: true; message: string } |
        { ok: true; questions: SurveyQuestion[]; originalPrompt: string } |
        { ok: false; error: string }
    > {
        try {
            setIsGenerating(true);
            const payload: Record<string, unknown> = { prompt };

            // Send current files as context for edits
            const existingFiles: Record<string, string> = {};
            for (const f of outputFiles) {
                if (f.content.trim()) existingFiles[f.filePath] = f.content;
            }
            payload.existingFiles = existingFiles;

            // Inject image awareness
            const imageCtx = await getProjectImageContext();
            if (imageCtx) payload.prompt = `${prompt}\n\n[System context]\n${imageCtx}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            const r = await fetch(GENERATE_PROJECT_API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const data = await r.json().catch(() => null);
            if (!r.ok) return { ok: false, error: data?.error ?? "Failed to generate project." };
            if (data.message) return { ok: true, message: data.message as string };
            if (data.questions && Array.isArray(data.questions)) return { ok: true, questions: data.questions as SurveyQuestion[], originalPrompt: prompt };
            if (data.files && typeof data.files === "object") return { ok: true, files: data.files as Record<string, string> };
            return { ok: false, error: "Empty response from project generation." };
        } catch (e: unknown) {
            const err = e as Error;
            return { ok: false, error: err?.name === "AbortError" ? "Timeout (180s)." : (err?.message ?? "Generate error") };
        } finally {
            setIsGenerating(false);
        }
    }

    // ═══ Compile (multi-file aware) ═══
    // Optionally accept files directly to avoid stale-state issues after generation
    async function compileProjectWithFiles(filesOverride?: OutputEntry[]) {
        return _compileProject(filesOverride);
    }
    async function compileProject() {
        return _compileProject();
    }
    async function _compileProject(filesOverride?: OutputEntry[]) {
        setCompileError(""); setCompileLog("");
        const sourceFiles = filesOverride ?? outputFiles;

        // Guard: at least one file must have actual content to compile
        const hasContent = sourceFiles.some((f) => f.content.trim());
        if (!hasContent) { setCompileError("No files to compile."); return { ok: false as const }; }

        try {
            setIsCompiling(true);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            // Build files array for the backend.
            // Include ALL tracked files — even empty ones — so that \input{} references
            // in main.tex (e.g. Chapters/Conclusions.tex) are always present on disk
            // and don't cause a fatal "File not found" LaTeX error.
            const filesPayload = sourceFiles.map((f) => ({
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
                            path: `${figuresPrefix}/${img.name}`,
                            content: base64,
                            isBinary: true,
                        } as { path: string; content: string; isBinary?: boolean });
                    } catch { /* skip failed images */ }
                }
            }

            // Use multi-file endpoint whenever the project tracks more than one file
            const isMultiFile = sourceFiles.length > 1;
            const endpoint = isMultiFile ? COMPILE_PROJECT_API_ENDPOINT : COMPILE_API_ENDPOINT;
            const mainTexContent = sourceFiles.find((f) => f.filePath === "main.tex")?.content;
            const body = isMultiFile
                ? { files: filesPayload, mainFile: "main.tex" }
                : { latex: mainTexContent || filesPayload[0].content };

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

    // ═══ Long-template generation core (shared by handleSend + handleSurveySubmit) ═══
    async function runLongTemplateGeneration(prompt: string) {
        const gen = await generateProjectFiles(prompt);

        if (!gen.ok) {
            setMessages((m) => replaceLastWorking(m, `Error: ${gen.error}`));
            return;
        }

        if ("message" in gen && gen.message) {
            setMessages((m) => replaceLastWorking(m, gen.message));
            return;
        }

        if ("questions" in gen && gen.questions) {
            // Replace "Working…" bubble with interactive survey
            const surveyMsg: SurveyMsg = { role: "survey", questions: gen.questions, originalPrompt: gen.originalPrompt };
            setMessages((m) => replaceLastWorking(m, surveyMsg));
            setSurveyAnswers({});
            return;
        }

        if ("files" in gen && gen.files) {
            const merged = [...outputFiles];
            for (const [filePath, content] of Object.entries(gen.files)) {
                const idx = merged.findIndex((f) => f.filePath === filePath);
                if (idx >= 0) merged[idx] = { ...merged[idx], content, dirty: false };
                else merged.push({ filePath, content, dirty: false });
            }
            setOutputFiles(merged);
            setActiveTab("preview");
            setMessages((m) => replaceLastWorking(m, "Generated. Compiling PDF..."));

            const compilePromise = compileProjectWithFiles(merged);
            const savePromise = (async () => {
                try {
                    await incrementMessageCount();
                    for (const [filePath, content] of Object.entries(gen.files)) {
                        await saveOutputFile(projectId, filePath, content);
                    }
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
        }
    }

    // ═══ Survey submit — called when user answers all questions and clicks Generate ═══
    async function handleSurveySubmit(originalPrompt: string, answers: Record<string, string>, questions: SurveyQuestion[]) {
        if (busy() || sendInFlightRef.current) return;
        sendInFlightRef.current = true;
        setIsSending(true);
        try {
            // Mark survey as answered (readonly)
            setMessages((m) => m.map((msg) =>
                msg.role === "survey" && msg.originalPrompt === originalPrompt
                    ? { ...msg, answered: true }
                    : msg
            ));

            // Build combined prompt from original request + user preferences
            const answerSummary = questions.map((q) => `${q.question}: ${answers[q.id]}`).join(" · ");
            const combinedPrompt = `${originalPrompt}\n\nUser preferences: ${answerSummary}`;

            setMessages((m) => [...m,
                { role: "user", content: answerSummary },
                { role: "assistant", content: "Working… generating document..." },
            ]);

            await runLongTemplateGeneration(combinedPrompt);
        } catch (e: unknown) {
            setMessages((m) => replaceLastWorking(m, `Error: ${(e as Error)?.message ?? "Generation failed."}`));
        } finally {
            sendInFlightRef.current = false;
            setIsSending(false);
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
            setTemplateOverride(null);
            setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "Working… generating document..." }]);

            // ── Long template: multi-file generation ──
            if (isLongTemplate) {
                await runLongTemplateGeneration(text);
                return;
            }

            // ── Single-file generation (existing flow) ──
            const base = mainTex?.content || "";
            const gen = await generateLatex(text, base.trim() || undefined);
            if (!gen.ok) { setMessages((m) => replaceLastWorking(m, `Error: ${gen.error}`)); return; }
            if ("message" in gen && gen.message) { setMessages((m) => replaceLastWorking(m, gen.message!)); return; }
            const newLatex = ("latex" in gen ? gen.latex : "") || "";
            if (base.trim() && newLatex.trim() === base.trim()) {
                setMessages((m) => replaceLastWorking(m, "No changes detected. Try a more specific edit request."));
                return;
            }
            setOutputFilesFromGeneration(newLatex);
            setActiveTab("preview");
            setMessages((m) => replaceLastWorking(m, "Generated. Compiling PDF..."));
            const compilePromise = compileProject();
            const savePromise = (async () => {
                try {
                    await incrementMessageCount();
                    if (projectId) await saveOutputFile(projectId, "main.tex", newLatex);
                } catch { /* skip */ }
            })();
            const comp = await compilePromise;
            if (comp.ok) { markAllClean(); setMessages((m) => replaceLastWorking(m, "Done. Preview updated.")); }
            else setMessages((m) => replaceLastWorking(m, 'Generated LaTeX, but compilation failed. Use "Fix with AI".'));
            await savePromise;
        } catch (e: unknown) {
            setMessages((m) => replaceLastWorking(m, `Error: ${(e as Error)?.message ?? "Send failed."}`));
        } finally {
            sendInFlightRef.current = false;
            setIsSending(false);
        }
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
        if (texFiles.length === 1) { downloadCurrentTex(); return; }
        try {
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            for (const f of texFiles) zip.file(f.filePath, f.content);
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${project?.title || "project"}.zip`; a.click();
            URL.revokeObjectURL(url);
        } catch {
            for (const f of texFiles) {
                const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = f.filePath.split("/").pop() || "file.tex"; a.click();
                URL.revokeObjectURL(url);
            }
        }
    }

    function downloadPdf() {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl; a.download = "output.pdf"; a.click();
    }

    // ── Inline edit ──
    function handleInlineAction(action: "change" | "explain" | "delete", text: string) {
        const p = action === "change" ? `Change the following in my LaTeX: "${text}"` :
            action === "explain" ? `Explain this LaTeX code: "${text}"` :
                `Remove the following from my LaTeX: "${text}"`;
        setChatInput(p);
    }

    // ── New folder (uses prompt dialog) ──
    async function handleNewFolder(parentId: string | null) {
        const name = await showPrompt({ title: "New Folder", placeholder: "Folder name", confirmText: "Create" });
        if (!name?.trim() || !projectId) return;
        const { createProjectFolder } = await import("@/lib/api");
        await createProjectFolder(projectId, name.trim(), parentId);
        refreshFiles();
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
                    {/* Compile button */}
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

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                    {messages.map((m, idx) => {
                        const showThinkingBubble =
                            m.role === "assistant" &&
                            idx === messages.length - 1 &&
                            isTransientAssistantMessageText((m as TextMsg).content);

                        if (showThinkingBubble) {
                            const tm = m as TextMsg;
                            return (
                                <div key={idx} className="mr-auto max-w-[92%]">
                                    <ChatThinkingBubble
                                        text={tm.content}
                                        steps={thinkingProgressSteps}
                                        activeStepIndex={getThinkingStepIndex(tm.content)}
                                    />
                                    <span className="text-xs text-white/30 tabular-nums">/ {pdfNumPages}</span>
                                    <button onClick={() => { const p = Math.min(pdfNumPages, pdfCurrentPage + 1); setPdfTargetPage(p); }} className="h-6 w-6 flex items-center justify-center rounded text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors" title="Next page">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                    </button>
                                </div>
                            );
                        }

                        // ── Survey message ──
                        if (m.role === "survey") {
                            const allAnswered = m.questions.every((q) => surveyAnswers[q.id]);
                            return (
                                <div key={idx} className="mr-auto max-w-[96%] w-full rounded-2xl border border-white/10 bg-black/20 p-3 space-y-3">
                                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">A few quick questions</p>
                                    {m.questions.map((q) => (
                                        <div key={q.id} className="space-y-1.5">
                                            <p className="text-xs text-white/80">{q.question}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {q.options.map((opt) => (
                                                    <button
                                                        key={opt}
                                                        disabled={!!m.answered}
                                                        onClick={() => setSurveyAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                                                            surveyAnswers[q.id] === opt
                                                                ? "bg-white text-black border-white"
                                                                : "bg-white/8 text-white/60 border-white/15 hover:bg-white/15"
                                                        } ${m.answered ? "opacity-40 cursor-default" : "cursor-pointer"}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {!m.answered && (
                                        <button
                                            onClick={() => handleSurveySubmit(m.originalPrompt, surveyAnswers, m.questions)}
                                            disabled={!allAnswered}
                                            className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                                allAnswered
                                                    ? "bg-white text-black hover:bg-white/90"
                                                    : "bg-white/8 text-white/25 cursor-not-allowed"
                                            }`}
                                        >
                                            Generate
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        // ── Text message ──
                        return (
                            <div
                                key={idx}
                                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed border ${m.role === "user"
                                    ? "ml-auto bg-white/10 border-white/15"
                                    : "mr-auto bg-black/20 border-white/8"
                                    }`}
                            >
                                {m.content}
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* File browser (bottom of left column) */}
                <div className="h-48 border-t border-white/8 overflow-hidden">
                    <FileTree
                        files={projectFiles}
                        selectedId={selectedFileId}
                        onSelect={(f) => setSelectedFileId(f.id)}
                        onDelete={handleDeleteFile}
                        onNewFolder={handleNewFolder}
                        onUpload={handleUpload}
                        title="Project Files"
                        emptyText="No files uploaded yet"
                    />
                </div>

                {/* Chat input */}
                <div className="p-3 border-t border-white/8">
                    {user && usageStatus && (
                        <div className="mb-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${usageStatus.remaining > 2 ? "bg-emerald-400" : usageStatus.remaining > 0 ? "bg-amber-400" : "bg-red-400"}`} />
                                <span className="text-white/50">{usageStatus.is_paid ? "Pro" : "Free"}: <span className="text-white/70 font-medium">{usageStatus.remaining}</span>/{usageStatus.free_limit}</span>
                            </div>
                            {!usageStatus.is_paid && usageStatus.remaining <= 2 && (
                                <a href="/pricing" className="text-emerald-400 hover:underline text-[11px]">Upgrade</a>
                            )}
                        </div>
                    )}

                    {/* Right: view tabs + download */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                            {(["preview", "latex", "split"] as const).map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${activeTab === tab ? "bg-white text-neutral-950 font-medium" : "text-white/50 hover:text-white/80"}`}>
                                    {tab === "split" ? (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 4.5h15a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z" /></svg>
                                    ) : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                        {/* Download dropdown */}
                        <div ref={downloadRef} className="relative">
                            <button onClick={() => setDownloadOpen(!downloadOpen)} disabled={!pdfUrl && !activeContent.trim()} className="rounded-lg px-2.5 py-1.5 text-xs border border-white/10 bg-white/[0.04] hover:bg-white/10 disabled:opacity-30 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                Download
                                <svg className={`w-3 h-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {downloadOpen && (
                                <div className="absolute right-0 mt-1 w-36 rounded-xl border border-white/15 bg-neutral-900/95 backdrop-blur shadow-xl py-1 z-50">
                                    <button onClick={() => { downloadPdf(); setDownloadOpen(false); }} disabled={!pdfUrl} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                        PDF
                                    </button>
                                    <button onClick={() => { downloadCurrentTex(); setDownloadOpen(false); }} disabled={!activeContent.trim()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                                        .tex
                                    </button>
                                    {outputFiles.length > 1 && (
                                        <button onClick={() => { downloadZip(); setDownloadOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
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
                    {/* Output file tree */}
                    {(activeTab === "latex" || activeTab === "split") && (
                        <div className={`border-r border-white/8 flex flex-col transition-[width] duration-200 overflow-hidden flex-shrink-0 ${outputFilesCollapsed ? "w-8" : "w-48"}`}>
                            <div className="h-8 flex items-center justify-between px-2 border-b border-white/8 cursor-pointer select-none flex-shrink-0" onClick={() => setOutputFilesCollapsed((c) => !c)}>
                                {!outputFilesCollapsed && <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Output Files</span>}
                                <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                                    {!outputFilesCollapsed && (
                                        <button onClick={() => addNewOutputFile(showPrompt, toast)} className="h-5 w-5 rounded text-white/25 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="New file">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                        </button>
                                    )}
                                    <button onClick={() => setOutputFilesCollapsed((c) => !c)} className="h-5 w-5 rounded text-white/25 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title={outputFilesCollapsed ? "Expand" : "Collapse"}>
                                        <svg className={`h-3 w-3 transition-transform ${outputFilesCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto py-1">
                                {outputFiles.length === 0 ? (
                                    <div className="px-3 py-3 text-[10px] text-white/20 text-center">No output files yet</div>
                                ) : (() => {
                                    const rootFiles = outputFiles.filter(f => !f.filePath.includes('/'));
                                    const folderMap = new Map<string, typeof outputFiles>();
                                    for (const f of outputFiles) {
                                        if (f.filePath.includes('/')) {
                                            const folder = f.filePath.split('/')[0];
                                            if (!folderMap.has(folder)) folderMap.set(folder, []);
                                            folderMap.get(folder)!.push(f);
                                        }
                                    }
                                    const renderFile = (f: OutputEntry, indent: boolean) => (
                                        <div
                                            key={f.filePath}
                                            className={`group flex items-center gap-1.5 ${indent ? 'pl-6 pr-3' : 'px-3'} py-1.5 text-xs cursor-pointer ${f.filePath === activeOutputPath ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/70"}`}
                                        >
                                            <button onClick={() => setActiveOutputPath(f.filePath)} className="flex-1 text-left truncate flex items-center gap-1.5 min-w-0">
                                                <svg className="h-3 w-3 flex-shrink-0 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                                <span className="truncate">{indent ? f.filePath.split('/').slice(1).join('/') : f.filePath}</span>
                                                {f.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved" />}
                                            </button>
                                            {f.filePath !== "main.tex" && (
                                                <button onClick={() => deleteOutputEntry(f.filePath)} className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-300 transition-opacity flex-shrink-0">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    );
                                    return (
                                        <>
                                            {rootFiles.map(f => renderFile(f, false))}
                                            {Array.from(folderMap.entries()).map(([folder, files]) => {
                                                const isCollapsed = collapsedFolders.has(folder);
                                                const hasDirty = files.some(f => f.dirty);
                                                return (
                                                    <div key={folder}>
                                                        <button
                                                            onClick={() => setCollapsedFolders(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(folder)) next.delete(folder); else next.add(folder);
                                                                return next;
                                                            })}
                                                            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/70"
                                                        >
                                                            <svg className={`h-2.5 w-2.5 flex-shrink-0 text-white/30 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                            <svg className="h-3 w-3 flex-shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                                            </svg>
                                                            <span className="truncate flex-1 text-left">{folder}</span>
                                                            {hasDirty && isCollapsed && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Contains unsaved files" />}
                                                        </button>
                                                        {!isCollapsed && files.map(f => renderFile(f, true))}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {activeTab === "split" ? (
                            <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
                                <div style={{ width: `${splitRatio}%` }} className="flex flex-col min-w-0">
                                    <div className="h-8 flex items-center px-3 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider flex-shrink-0">LaTeX — {activeOutputPath}</div>
                                    <div className="relative flex-1 h-full">
                                        <LatexEditor value={activeContent} onChange={(v) => updateOutputFile(activeOutputPath, v)} placeholder={`${activeOutputPath} — start typing LaTeX…`} />
                                    </div>
                                </div>
                                <div onMouseDown={onSplitMouseDown} className="w-1.5 bg-white/8 hover:bg-white/20 cursor-col-resize transition-colors flex-shrink-0 relative group">
                                    <div className="absolute inset-y-0 -left-1 -right-1" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                                </div>
                                <div style={{ width: `${100 - splitRatio}%` }} className="flex flex-col min-w-0">
                                    <div className="h-8 flex items-center px-3 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider flex-shrink-0">Preview</div>
                                    <div className="flex-1 min-h-0">
                                        {pdfUrl ? <PdfViewer url={pdfUrl} zoom={pdfZoom} targetPage={pdfTargetPage} onNumPages={setPdfNumPages} onPageChange={setPdfCurrentPage} /> : <div className="h-full flex items-center justify-center text-white/30 text-sm">No PDF yet</div>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden relative">
                                {activeTab === "preview" ? (
                                    pdfUrl ? <PdfViewer url={pdfUrl} zoom={pdfZoom} targetPage={pdfTargetPage} onNumPages={setPdfNumPages} onPageChange={setPdfCurrentPage} /> : <div className="h-full flex items-center justify-center text-white/30 text-sm">No PDF yet. Send a prompt or compile.</div>
                                ) : (
                                    <div className="relative h-full">
                                        <LatexEditor value={activeContent} onChange={(v) => updateOutputFile(activeOutputPath, v)} placeholder={`${activeOutputPath} — start typing LaTeX…`} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Resize + collapse strip ── */}
            <div onMouseDown={onChatStripMouseDown} className="hidden lg:flex w-3 flex-col items-center justify-center border-x border-white/8 bg-white/[0.02] hover:bg-white/[0.06] cursor-col-resize transition-colors select-none group">
                <div className="flex flex-col items-center gap-0.5 px-0.5">
                    <div className="w-0.5 h-3 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
                    <svg className={`h-2.5 w-2.5 text-white/30 group-hover:text-white/70 transition-colors transition-transform ${chatCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    <div className="w-0.5 h-3 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
                </div>
            </div>

            {/* ── RIGHT COLUMN: Chat + Files ── */}
            <div className="flex flex-col bg-white/[0.02] border-l border-white/8 transition-[width] duration-200 overflow-hidden" style={{ width: chatCollapsed ? 0 : chatWidth, minWidth: chatCollapsed ? 0 : 220 }}>
                <div className="px-4 py-3 border-b border-white/8">
                    <div className="text-sm font-semibold truncate">{project?.title || "Project"}</div>
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                    {messages.map((m, idx) => {
                        const showThinking = m.role === "assistant" && idx === messages.length - 1 && isTransientMsg(m.content);
                        if (showThinking) return <div key={idx} className="mr-auto max-w-[92%]"><ChatThinkingBubble text={m.content} /></div>;
                        return <ChatMessage key={idx} role={m.role} content={m.content} />;
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* File browser */}
                <div ref={filesPanelRef} className="border-t border-white/8 flex flex-col flex-shrink-0" style={{ height: filesCollapsed ? "auto" : filesHeight }}>
                    {!filesCollapsed && <div onMouseDown={onFilesResizeMouseDown} className="h-1 cursor-row-resize hover:bg-white/20 transition-colors flex-shrink-0" />}
                    <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none border-b border-white/8" onClick={() => setFilesCollapsed(!filesCollapsed)}>
                        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Project Files</span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleNewFolder(null)} className="h-6 w-6 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="New folder">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
                            </button>
                            <button onClick={() => handleUpload(null)} className="h-6 w-6 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 flex items-center justify-center" title="Upload file">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                            </button>
                            <svg className={`h-3 w-3 text-white/25 transition-transform ml-1 ${filesCollapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    {!filesCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <FileTree files={projectFiles} selectedId={selectedFileId} onSelect={(f) => setSelectedFileId(f.id)} onDelete={handleDeleteFile} onNewFolder={handleNewFolder} onUpload={handleUpload} emptyText="No files uploaded yet" showHeader={false} />
                        </div>
                    )}
                </div>

                {/* Chat input */}
                <div className="p-3 border-t border-white/8">
                    {selectedTemplate && (
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 pl-1.5 pr-2 py-1">
                                {selectedTemplate.thumbnailPath && <div className="w-5 h-5 rounded-full overflow-hidden border border-emerald-400/30"><img src={selectedTemplate.thumbnailPath} alt="" className="w-full h-full object-cover" /></div>}
                                <span className="text-[11px] font-medium text-emerald-300">{selectedTemplate.name}</span>
                                <button onClick={() => setTemplateOverride(null)} className="ml-0.5 text-emerald-400/50 hover:text-emerald-300 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 relative">
                        <SlashCommandPicker ref={slashPickerRef} inputValue={chatInput} isPro={usageStatus?.is_paid ?? false} onSelect={(id) => { setTemplateOverride(id); setChatInput(""); }} onProBlocked={() => setShowPaywallModal(true)} onDismiss={() => setChatInput("")} />
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (slashPickerRef.current?.handleKeyDown(e)) return; if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
                            className="h-10 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none placeholder:text-white/35 text-white"
                            placeholder="Type / for templates, or ask BetterNotes…"
                        />
                        <button onClick={handleSend} disabled={!chatInput.trim() || busy()} className={`h-10 rounded-xl px-4 text-sm font-semibold ${chatInput.trim() && !busy() ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-white/15 text-white/40 cursor-not-allowed"}`}>
                            {isSending ? "Sending…" : isGenerating ? "…" : "Send"}
                        </button>
                    </div>
                </div>
            </div>

            <PaywallModal isOpen={showPaywallModal} onClose={() => setShowPaywallModal(false)} remaining={usageStatus?.remaining} resetsAt={usageStatus?.resets_at} />
        </div>
    );
}
