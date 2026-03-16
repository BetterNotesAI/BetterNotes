"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import TemplateCardSelect from "@/app/components/TemplateCardSelect";
import PaywallModal from "@/app/components/PaywallModal";
import PdfPreviewModal from "@/app/components/PdfPreviewModal";
import ChatThinkingBubble from "@/app/components/ChatThinkingBubble";
import SlashCommandPicker, { type SlashCommandPickerRef } from "@/app/components/SlashCommandPicker";
import SaveProjectModal from "@/app/components/SaveProjectModal";
import { templates } from "@/lib/templates";
import { useToast } from "@/app/components/Toast";
import { useDraft } from "./_hooks/useDraft";
import { useLatexWorkspace } from "./_hooks/useLatexWorkspace";
import { useFileAttachments } from "./_hooks/useFileAttachments";
import { useWorkspaceAuthStart } from "./_hooks/useWorkspaceAuthStart";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "start" | "project";

const loadingSteps = [
    "Analyzing your request…",
    "Generating LaTeX content…",
    "Structuring document layout…",
    "Formatting equations and symbols…",
    "Finalizing output…",
];
const INITIAL_MESSAGE: Msg = { role: "assistant", content: 'Tell me what you want. Example: \u201cGenerate a formula sheet from my lecture notes (LaTeX + PDF)\u201d' };

function WorkspaceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const [mode, setMode] = useState<Mode>("start");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<typeof templates[number] | null>(null);
    const [fileError, setFileError] = useState("");

    // Refs for stable callbacks
    const messagesRef = useRef<Msg[]>([INITIAL_MESSAGE]);
    const templateIdRef = useRef<string | null>(null);
    const draftLatexRef = useRef("");
    const savedLatexRef = useRef("");
    const projectIdRef = useRef<string | null>(null);

    // ── Hooks ──
    const draft = useDraft({ selectedTemplateId });
    const latex = useLatexWorkspace();
    const { user, usageStatus, showPaywallModal, setShowPaywallModal, canSendMessage, onMessageSent } = useWorkspaceAuthStart({
        getMessages: () => messagesRef.current,
        getSelectedTemplateId: () => templateIdRef.current,
        getDraftLatex: () => draftLatexRef.current,
        getSavedLatex: () => savedLatexRef.current,
        getCurrentProjectId: () => projectIdRef.current,
        setCurrentProjectId: (id) => { projectIdRef.current = id; setCurrentProjectId(id); },
    });
    const { files, setFiles, handleFileSelect, removeFile, processFilesForPayload } = useFileAttachments(
        () => user,
        () => usageStatus,
        setFileError
    );

    // Keep refs in sync with state (for stable callbacks)
    useEffect(() => { messagesRef.current = draft.messages; }, [draft.messages]);
    useEffect(() => { templateIdRef.current = selectedTemplateId; }, [selectedTemplateId]);
    useEffect(() => { draftLatexRef.current = draft.draftLatex; }, [draft.draftLatex]);
    useEffect(() => { savedLatexRef.current = draft.savedLatex; }, [draft.savedLatex]);
    useEffect(() => { projectIdRef.current = currentProjectId; }, [currentProjectId]);

    // ── URL params (template + auto-send) ──
    const pendingAutoSendRef = useRef<string | null>(null);
    const [startInput, setStartInput] = useState("");
    const [projectInput, setProjectInput] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);
    const slashPickerStartRef = useRef<SlashCommandPickerRef>(null);
    const slashPickerProjectRef = useRef<SlashCommandPickerRef>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const sendInFlightRef = useRef(false);
    const pendingAutoCompile = useRef(false);
    const [isSending, setIsSending] = useState(false);
    const [splitRatio, setSplitRatio] = useState(50);
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        const templateParam = searchParams.get("template");
        if (templateParam && templates.some((t) => t.id === templateParam)) setSelectedTemplateId(templateParam);
        const promptParam = searchParams.get("prompt");
        if (promptParam) { setStartInput(promptParam); pendingAutoSendRef.current = promptParam; }
    }, [searchParams]);

    useEffect(() => {
        if (pendingAutoSendRef.current && startInput === pendingAutoSendRef.current && mode === "start") {
            pendingAutoSendRef.current = null;
            const timer = setTimeout(() => { const btn = document.querySelector("[data-auto-send]") as HTMLButtonElement; btn?.click(); }, 100);
            return () => clearTimeout(timer);
        }
    }, [startInput, mode]);

    // Draft restore + auto-compile
    const restoreDraft = useCallback(() => {
        draft.restoreDraft((restoredDraft) => {
            if (restoredDraft.selectedTemplateId) setSelectedTemplateId(restoredDraft.selectedTemplateId);
            if (restoredDraft.draftLatex.trim() || restoredDraft.savedLatex.trim()) {
                setMode("project");
                pendingAutoCompile.current = true;
            }
        });
    }, [draft]);

    useEffect(() => {
        if (!pendingAutoCompile.current) return;
        const timer = setTimeout(() => { if (pendingAutoCompile.current) { pendingAutoCompile.current = false; saveAndCompile(); } }, 500);
        return () => clearTimeout(timer);
    });

    useEffect(() => {
        if (mode === "project") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [draft.messages, mode]);

    useEffect(() => { return () => { if (latex.pdfUrl) URL.revokeObjectURL(latex.pdfUrl); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (mode === "project" && draft.draftLatex.trim() && !busy()) saveAndCompile(); }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    const onSplitMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        const startX = e.clientX;
        const startRatio = splitRatio;
        const container = splitContainerRef.current;
        if (!container) return;
        const containerWidth = container.getBoundingClientRect().width;
        function onMove(ev: MouseEvent) { if (!isDraggingRef.current) return; setSplitRatio(Math.min(80, Math.max(20, startRatio + ((ev.clientX - startX) / containerWidth) * 100))); }
        function onUp() { isDraggingRef.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [splitRatio]);

    const [activeRightTab, setActiveRightTab] = useState<"preview" | "latex" | "split">("preview");
    const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [selectedTemplateId]);

    function busy() { return isSending || latex.isGenerating || latex.isCompiling || latex.isFixing; }
    function openSaveModal() { if (!draft.draftLatex.trim()) { toast("No LaTeX content to save.", "warning"); return; } setShowSaveModal(true); }

    function isTransientMsg(text: string) {
        const n = (text || "").trim();
        return loadingSteps.includes(n) || n.startsWith("Generated. Compiling PDF...");
    }

    const thinkingProgressSteps = [
        { label: "Thinking...", patterns: [/Analyzing/i, /Tell me what you want/i] },
        { label: "Generating...", patterns: [/Generating/i, /Structuring/i, /Formatting/i, /Finalizing/i] },
        { label: "Compiling...", patterns: [/compiling/i] },
    ];

    function getThinkingStepIndex(content: string) {
        return thinkingProgressSteps.findIndex(s => s.patterns.some(p => p.test(content)));
    }

    function replaceLastWorking(m: Msg[], newText: string) {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && isTransientMsg(copy[i].content)) { copy[i] = { role: "assistant", content: newText }; break; }
        }
        return copy;
    }

    function startLoadingAnimation() {
        let step = 0;
        const interval = setInterval(() => {
            if (step >= loadingSteps.length - 1) { clearInterval(interval); return; }
            step += 1;
            draft.setMessages((m) => replaceLastWorking(m, loadingSteps[step]));
        }, 3000);
        return interval;
    }

    async function saveAndCompile() {
        const toCompile = draft.draftLatex;
        if (!toCompile.trim()) return;
        draft.setSavedLatex(toCompile);
        draft.setDirty(false);
        latex.setCompileError(""); latex.setCompileLog("");
        const res = await latex.compileDirect(toCompile);
        if (res.ok) draft.setCompiledLatex(toCompile);
        return res;
    }

    async function applyFixAndCompile() {
        if (!latex.fixCandidate.trim()) return;
        draft.setDraftLatex(latex.fixCandidate); draft.setSavedLatex(latex.fixCandidate); draft.setDirty(false);
        latex.setShowFixModal(false); latex.setCompileError(""); latex.setCompileLog("");
        const res = await latex.compileDirect(latex.fixCandidate);
        if (res.ok) draft.setCompiledLatex(latex.fixCandidate);
    }

    async function handleGenerationResult(gen: { ok: true; latex?: string; message?: string } | { ok: false; error: string }, previousLatex?: string) {
        if (!gen.ok) return;
        if (gen.message) { draft.setMessages((m) => replaceLastWorking(m, gen.message!)); return; }
        const newLatex = gen.latex || "";
        if (previousLatex && newLatex.trim() === previousLatex.trim()) {
            draft.setMessages((m) => replaceLastWorking(m, "No changes detected in the generated LaTeX. Try a more specific edit request."));
            await onMessageSent(previousLatex);
            return;
        }
        draft.setDraftLatex(newLatex); draft.setSavedLatex(newLatex); draft.setDirty(false);
        setActiveRightTab("preview");
        draft.setMessages((m) => replaceLastWorking(m, "Generated. Compiling PDF..."));
        const [comp] = await Promise.all([latex.compileDirect(newLatex), onMessageSent(newLatex)]);
        if (!comp.ok) draft.setMessages((m) => replaceLastWorking(m, 'Generated LaTeX, but compilation failed. Use \u201cFix with AI\u201d.'));
        else { draft.setCompiledLatex(newLatex); draft.setMessages((m) => replaceLastWorking(m, "Done. Preview updated.")); }
    }

    async function startSend() {
        const text = startInput.trim();
        const hasFiles = files.length > 0;
        if ((!text && !hasFiles) || busy() || sendInFlightRef.current) return;
        let loadingInterval: ReturnType<typeof setInterval> | null = null;
        sendInFlightRef.current = true; setIsSending(true);
        try {
            if (!await canSendMessage()) return;
            setMode("project"); setStartInput(""); setProjectInput("");
            draft.setMessages((m) => [...m, { role: "user", content: text || (hasFiles ? `[Sent ${files.length} file(s)]` : "") }, { role: "assistant", content: loadingSteps[0] }]);
            loadingInterval = startLoadingAnimation();
            const filePayload = await processFilesForPayload(files, user);
            setFiles([]); setFileError("");
            const gen = await latex.generateLatexFromPrompt(text, selectedTemplate?.id, undefined, filePayload);
            if (!gen.ok) { draft.setMessages((m) => replaceLastWorking(m, `Error: ${gen.error}`)); return; }
            await handleGenerationResult(gen);
        } catch (e: unknown) {
            draft.setMessages((m) => replaceLastWorking(m, `Error: ${(e as Error)?.message ?? "Send failed."}`));
        } finally {
            if (loadingInterval) clearInterval(loadingInterval);
            sendInFlightRef.current = false; setIsSending(false);
        }
    }

    async function projectSend() {
        const text = projectInput.trim();
        const hasFiles = files.length > 0;
        if ((!text && !hasFiles) || busy() || sendInFlightRef.current) return;
        let loadingInterval: ReturnType<typeof setInterval> | null = null;
        sendInFlightRef.current = true; setIsSending(true);
        try {
            if (!await canSendMessage()) return;
            setProjectInput("");
            draft.setMessages((m) => [...m, { role: "user", content: text || (hasFiles ? `[Sent ${files.length} file(s)]` : "") }, { role: "assistant", content: loadingSteps[0] }]);
            loadingInterval = startLoadingAnimation();
            const filePayload = await processFilesForPayload(files, user);
            setFiles([]); setFileError("");
            const base = (draft.draftLatex || draft.savedLatex || "").trim();
            const gen = await latex.generateLatexFromPrompt(text, selectedTemplate?.id, base, filePayload);
            if (!gen.ok) { draft.setMessages((m) => replaceLastWorking(m, `Error: ${gen.error}`)); return; }
            await handleGenerationResult(gen, base);
        } catch (e: unknown) {
            draft.setMessages((m) => replaceLastWorking(m, `Error: ${(e as Error)?.message ?? "Send failed."}`));
        } finally {
            if (loadingInterval) clearInterval(loadingInterval);
            sendInFlightRef.current = false; setIsSending(false);
        }
    }

    function downloadTex() {
        const src = draft.savedLatex || draft.draftLatex;
        if (!src.trim()) return;
        const blob = new Blob([src], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "main.tex"; a.click();
        URL.revokeObjectURL(url);
    }

    function downloadPdf() {
        if (!latex.pdfUrl) return;
        const a = document.createElement("a");
        a.href = latex.pdfUrl; a.download = "output.pdf"; a.click();
    }

    // ── File chips shared UI snippet ──
    function FileChips({ size = "sm" }: { size?: "sm" | "lg" }) {
        return (
            <div className={`flex flex-wrap gap-2 ${size === "lg" ? "mt-3" : ""}`}>
                {files.map((f) => (
                    <div key={f.id} className={`group relative flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 pl-2 pr-1 py-1.5 overflow-hidden`}>
                        {f.type === "image" && f.previewUrl ? (
                            <img src={f.previewUrl} alt="preview" className={`${size === "lg" ? "w-8 h-8" : "w-6 h-6"} rounded object-cover border border-white/10`} />
                        ) : (
                            <div className={`${size === "lg" ? "w-8 h-8" : "w-6 h-6"} rounded bg-white/10 flex items-center justify-center text-white/50`}>
                                <span className={`uppercase ${size === "lg" ? "text-[10px]" : "text-[9px]"} font-bold`}>{f.file.name.split(".").pop()?.slice(0, 3)}</span>
                            </div>
                        )}
                        {size === "lg" ? (
                            <div className="flex flex-col min-w-[60px] max-w-[120px]">
                                <span className="text-xs text-white/90 truncate" title={f.file.name}>{f.file.name}</span>
                                <span className="text-[10px] text-white/50">{(f.file.size / 1024).toFixed(0)}KB</span>
                            </div>
                        ) : (
                            <span className="text-xs text-white/90 truncate max-w-[100px]" title={f.file.name}>{f.file.name}</span>
                        )}
                        <button onClick={() => removeFile(f.id)} className={`ml-1 text-white/40 hover:text-red-300 ${size === "lg" ? "p-1 rounded-md hover:bg-white/5" : ""}`}>
                            <svg className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    // ── CompileConsole ──
    const canSaveAndCompile = draft.draftLatex.trim().length > 0 && !busy();

    if (mode === "project") {
        return (
            <main className="min-h-screen text-white">
                <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] min-h-screen">
                    <aside className="border-r border-white/10 bg-white/5 backdrop-blur flex flex-col">
                        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
                            <div><div className="text-sm font-semibold">Project</div><div className="text-xs text-white/60">Chat → LaTeX → PDF</div></div>
                            <button onClick={() => { draft.resetWorkspace(); setMode("start"); }} className="text-xs rounded-xl border border-white/15 bg-white/10 px-2 py-1 hover:bg-white/15">← Back</button>
                        </div>
                        <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
                            {draft.messages.map((m, idx) => {
                                const showThinking = m.role === "assistant" && idx === draft.messages.length - 1 && isTransientMsg(m.content);
                                if (showThinking) return (
                                    <div key={idx} className="mr-auto max-w-[92%]"><ChatThinkingBubble text={m.content} steps={thinkingProgressSteps} activeStepIndex={getThinkingStepIndex(m.content)} /></div>
                                );
                                return (
                                    <div key={idx} className={["max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed border", m.role === "user" ? "ml-auto bg-white/10 border-white/15" : "mr-auto bg-black/20 border-white/10"].join(" ")}>
                                        {m.content}
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Chat input */}
                        <div className="p-4 border-t border-white/10">
                            {user && usageStatus && (
                                <div className="mb-3 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${usageStatus.remaining > 2 ? "bg-emerald-400" : usageStatus.remaining > 0 ? "bg-amber-400" : "bg-red-400"}`} />
                                        <span className="text-white/70">{usageStatus.is_paid ? "Pro" : "Free"}: <span className="text-white font-medium">{usageStatus.remaining}</span>/{usageStatus.free_limit} left</span>
                                    </div>
                                    {!usageStatus.is_paid && usageStatus.remaining <= 2 && <a href="/pricing" className="text-emerald-400 hover:underline">Upgrade</a>}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <button onClick={() => document.getElementById("hidden-file-input-project")?.click()} className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors" title="Attach file">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                </button>
                                <input type="file" id="hidden-file-input-project" multiple className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.csv,.docx" onChange={handleFileSelect} />
                                <div className="flex-1 flex flex-col gap-2">
                                    {fileError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg flex items-center justify-between"><span>{fileError}</span><button onClick={() => setFileError("")}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div>}
                                    {files.length > 0 && <FileChips size="sm" />}
                                    <div className="relative w-full">
                                        <SlashCommandPicker ref={slashPickerProjectRef} inputValue={projectInput} isPro={usageStatus?.is_paid ?? false} onSelect={(id) => { setSelectedTemplateId(id); setProjectInput(""); }} onProBlocked={() => setShowPaywallModal(true)} onDismiss={() => setProjectInput("")} />
                                        <input value={projectInput} onChange={(e) => setProjectInput(e.target.value)} onKeyDown={(e) => { if (slashPickerProjectRef.current?.handleKeyDown(e)) return; if (e.key === "Enter" && !e.shiftKey) projectSend(); }} className="h-10 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none placeholder:text-white/45 text-white" placeholder="Type / for templates, or ask BetterNotes…" />
                                    </div>
                                </div>
                                <button onClick={projectSend} disabled={(projectInput.trim().length === 0 && files.length === 0) || busy()} className={["h-10 rounded-xl px-4 text-sm font-semibold self-end", (projectInput.trim().length > 0 || files.length > 0) && !busy() ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-white/20 text-white/60 cursor-not-allowed"].join(" ")}>
                                    {isSending ? "Sending…" : latex.isGenerating ? "Generating…" : latex.isCompiling ? "Compiling…" : latex.isFixing ? "Fixing…" : "Send"}
                                </button>
                            </div>
                        </div>
                    </aside>

                    <section className="flex flex-col">
                        {/* Toolbar */}
                        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold">Result</div>
                                <div className="text-xs text-white/60">
                                    {!draft.draftLatex ? "Send a prompt to generate LaTeX + PDF." : !latex.pdfUrl ? "No PDF yet — compile to generate the preview." : draft.previewOutdated ? "Preview is outdated — run Compile to update." : "PDF preview is up to date."}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {(["preview", "latex", "split"] as const).map((tab) => (
                                    <button key={tab} onClick={() => setActiveRightTab(tab)} className={["rounded-xl px-3 py-2 text-sm border", activeRightTab === tab ? "bg-white text-neutral-950 border-white" : "bg-white/10 text-white/85 border-white/15 hover:bg-white/15"].join(" ")}>
                                        {tab === "split" ? <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 4.5h15a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z" /></svg> : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                                <div className="w-px h-7 bg-white/10 mx-1" />
                                <button onClick={saveAndCompile} disabled={!canSaveAndCompile} className={["rounded-xl px-3 py-2 text-sm font-semibold", canSaveAndCompile ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-white/20 text-white/60 cursor-not-allowed"].join(" ")}>Compile</button>
                                <div className="w-px h-7 bg-white/10 mx-1" />
                                <button onClick={openSaveModal} disabled={!draft.draftLatex.trim()} className="rounded-xl px-3 py-2 text-sm border border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
                                    <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                                    Save
                                </button>
                                <button onClick={downloadTex} disabled={!draft.draftLatex.trim()} className="rounded-xl px-3 py-2 text-sm border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-40">.tex</button>
                                <button onClick={downloadPdf} disabled={!latex.pdfUrl} className="rounded-xl px-3 py-2 text-sm border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-40">PDF</button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-5 flex flex-col gap-3">
                            {activeRightTab === "split" ? (
                                <div ref={splitContainerRef} className="flex-1 flex rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
                                    <div style={{ width: `${splitRatio}%` }} className="flex flex-col min-w-0">
                                        <div className="px-3 py-1.5 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider">LaTeX</div>
                                        <textarea value={draft.draftLatex} onChange={(e) => { draft.setDraftLatex(e.target.value); draft.setDirty(e.target.value !== draft.savedLatex); }} className="flex-1 w-full bg-transparent p-4 font-mono text-sm outline-none text-white/90 resize-none" placeholder="LaTeX will appear here…" />
                                    </div>
                                    <div onMouseDown={onSplitMouseDown} className="w-1.5 bg-white/8 hover:bg-white/20 cursor-col-resize transition-colors flex-shrink-0 relative group">
                                        <div className="absolute inset-y-0 -left-1 -right-1" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                                    </div>
                                    <div style={{ width: `${100 - splitRatio}%` }} className="flex flex-col min-w-0">
                                        <div className="px-3 py-1.5 border-b border-white/8 text-[10px] text-white/30 font-semibold uppercase tracking-wider">Preview</div>
                                        <div className="flex-1">{latex.pdfUrl ? <iframe title="PDF Preview" src={latex.pdfUrl} className="w-full h-full" /> : <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4"><div className="text-white/30 text-sm">{latex.isGenerating ? "Generating your document…" : latex.isCompiling ? "Compiling PDF…" : "Your PDF preview will appear here"}</div></div>}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
                                    {activeRightTab === "preview" ? (
                                        latex.pdfUrl ? <iframe title="PDF Preview" src={latex.pdfUrl} className="w-full h-full" /> : (
                                            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
                                                <div className="text-white/30 text-sm">{latex.isGenerating ? "Generating your document…" : latex.isCompiling ? "Compiling PDF…" : "Your PDF preview will appear here"}</div>
                                                <div className="text-white/15 text-xs">Send a prompt on the left to get started</div>
                                            </div>
                                        )
                                    ) : (
                                        <textarea value={draft.draftLatex} onChange={(e) => { draft.setDraftLatex(e.target.value); draft.setDirty(e.target.value !== draft.savedLatex); }} className="w-full h-full bg-transparent p-4 font-mono text-sm outline-none text-white/90" placeholder="LaTeX will appear here…" />
                                    )}
                                </div>
                            )}

                            {/* Compile Console */}
                            {(latex.compileError || latex.isCompiling) && (
                                <div className={`rounded-2xl border p-3 transition-all ${latex.compileError ? "border-red-400/20 bg-red-500/10" : "border-amber-400/20 bg-amber-500/10"}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {latex.isCompiling ? <div className="w-4 h-4 border-2 border-amber-300/40 border-t-amber-300 rounded-full animate-spin" /> : <svg className="w-4 h-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                                            <span className={`text-sm font-medium ${latex.compileError ? "text-red-200" : "text-amber-200"}`}>{latex.isCompiling ? "Compiling…" : "Compilation failed"}</span>
                                            {latex.compileError && <span className="text-xs text-red-200/70 max-w-md truncate">{latex.compileError}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {latex.compileError && latex.compileLog.trim() && (
                                                <button onClick={() => latex.fixWithAI(draft.savedLatex, latex.compileLog)} disabled={busy()} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${!busy() ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-white/20 text-white/60 cursor-not-allowed"}`}>{latex.isFixing ? "Fixing…" : "Fix with AI"}</button>
                                            )}
                                            <button onClick={() => { latex.setCompileError(""); latex.setCompileLog(""); }} className="rounded-lg px-2 py-1 text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white/40">Clear</button>
                                        </div>
                                    </div>
                                    {latex.compileLog && <pre className="mt-2 max-h-36 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/60 font-mono">{latex.compileLog}</pre>}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <PaywallModal isOpen={showPaywallModal} onClose={() => setShowPaywallModal(false)} remaining={usageStatus?.remaining} resetsAt={usageStatus?.resets_at} />
                <SaveProjectModal open={showSaveModal} onClose={() => setShowSaveModal(false)} latex={draft.draftLatex} messages={draft.messages} templateId={selectedTemplateId} onSaved={(projectId) => { if (projectId) router.push(`/workspace/${projectId}`); }} />
            </main>
        );
    }

    // ── START mode ──
    return (
        <main className="relative min-h-screen text-white">
            {draft.showRestoreBanner && draft.pendingDraft && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-b border-emerald-400/30 backdrop-blur-sm">
                    <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                            <p className="text-sm font-medium text-white">You have unsaved work</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={draft.dismissDraft} className="px-3 py-1.5 text-xs rounded-lg border border-white/15 bg-white/10 hover:bg-white/15">Start fresh</button>
                            <button onClick={restoreDraft} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium">Restore work</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-5xl px-4 pt-16 pb-44">
                <div className="text-center">
                    <h1 className="mt-6 text-3xl sm:text-5xl font-semibold tracking-tight">What should we build?</h1>
                    <p className="mt-3 text-white/70">Example: &quot;Generate a formula sheet from my lecture notes (LaTeX + PDF)&quot;.</p>
                </div>

                <div className="mt-10 mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                    <div className="flex items-center gap-2 relative">
                        <SlashCommandPicker ref={slashPickerStartRef} inputValue={startInput} isPro={usageStatus?.is_paid ?? false} onSelect={(id) => { setSelectedTemplateId(id); setStartInput(""); }} onProBlocked={() => setShowPaywallModal(true)} onDismiss={() => setStartInput("")} />
                        <input ref={inputRef} value={startInput} onChange={(e) => setStartInput(e.target.value)} onKeyDown={(e) => { if (slashPickerStartRef.current?.handleKeyDown(e)) return; if (e.key === "Enter" && !e.shiftKey) startSend(); }} className="h-10 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 text-sm outline-none placeholder:text-white/45 text-white" placeholder="Type / for templates, or describe what to create…" />
                        <div className="flex items-center gap-1">
                            <button onClick={() => document.getElementById("hidden-file-input-start")?.click()} className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors" title="Attach file">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                            </button>
                            <button data-auto-send onClick={startSend} disabled={(!startInput.trim() && files.length === 0) || busy()} className={["h-10 rounded-xl px-4 text-sm font-semibold", (startInput.trim() || files.length > 0) && !busy() ? "bg-white text-neutral-950" : "bg-white/20 text-white/60 cursor-not-allowed"].join(" ")}>
                                {isSending ? "Sending…" : latex.isGenerating ? "Generating…" : "Send"}
                            </button>
                        </div>
                    </div>
                    <input type="file" id="hidden-file-input-start" multiple className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.md,.csv,.docx" onChange={handleFileSelect} />
                    {fileError && <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-1"><span>{fileError}</span><button onClick={() => setFileError("")}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div>}
                    {files.length > 0 && <FileChips size="lg" />}
                    {selectedTemplateId && (() => {
                        const tmpl = templates.find((t) => t.id === selectedTemplateId);
                        return tmpl ? (
                            <div className="mt-3 flex items-center gap-2">
                                <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 pl-1 pr-2 py-1">
                                    {tmpl.thumbnailPath && <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-400/30"><img src={tmpl.thumbnailPath} alt="" className="w-full h-full object-cover" /></div>}
                                    <span className="text-xs font-medium text-emerald-300">{tmpl.name}</span>
                                    <button onClick={() => setSelectedTemplateId(null)} className="ml-1 text-emerald-400/60 hover:text-emerald-300 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                            </div>
                        ) : null;
                    })()}
                </div>

                <div className="mt-8 mx-auto max-w-4xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Recommended Templates</h2>
                        <Link href="/templates" className="text-sm text-white/70 hover:text-white transition-colors">View all →</Link>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.slice(0, 6).map((t) => (
                            <TemplateCardSelect key={t.id} t={t as never} selected={selectedTemplateId === t.id} onSelect={() => setSelectedTemplateId((curr) => curr === t.id ? null : t.id)} onPreview={() => setPreviewTemplate(t)} userIsPro={usageStatus?.is_paid ?? false} onProBlocked={() => setShowPaywallModal(true)} />
                        ))}
                    </div>
                </div>
            </div>

            <PaywallModal isOpen={showPaywallModal} onClose={() => setShowPaywallModal(false)} remaining={usageStatus?.remaining} resetsAt={usageStatus?.resets_at} />
            <PdfPreviewModal isOpen={previewTemplate !== null} onClose={() => setPreviewTemplate(null)} pdfUrl={previewTemplate?.previewPath ?? ""} title={previewTemplate?.name ?? ""} templateId={previewTemplate?.id} isPro={previewTemplate?.isPro ?? false} userIsPro={usageStatus?.is_paid ?? false} />
            <SaveProjectModal open={showSaveModal} onClose={() => setShowSaveModal(false)} latex={draft.draftLatex} messages={draft.messages} templateId={selectedTemplateId} onSaved={(projectId) => { if (projectId) router.push(`/workspace/${projectId}`); }} />
        </main>
    );
}

function Workspace() {
    return <Suspense fallback={<div className="min-h-screen text-white/60 p-10">Loading workspace...</div>}><WorkspaceContent /></Suspense>;
}

export default Workspace;
