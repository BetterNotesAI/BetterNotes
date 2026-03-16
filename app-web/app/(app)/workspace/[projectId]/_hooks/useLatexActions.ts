import { useRef, useState, useCallback } from "react";
import { getProjectFileUrl } from "@/lib/storage";
import type { ProjectFileRecord } from "@/lib/api";
import type { OutputEntry } from "./useOutputFiles";

const GENERATE_API_ENDPOINT = "/api/generate-latex";
const FIX_API_ENDPOINT = "/api/fix-latex";
const COMPILE_API_ENDPOINT = "/api/compile";
const COMPILE_PROJECT_API_ENDPOINT = "/api/latex/compile-project";

interface UseLatexActionsParams {
    outputFiles: OutputEntry[];
    activeOutputPath: string;
    projectFiles: ProjectFileRecord[];
    projectId: string;
    templateOverride: string | null;
    projectTemplateId?: string;
    onCompileSuccess: (pdfUrl: string) => void;
    onCompileError: (message: string, log: string) => void;
    clearCompileError: () => void;
}

export function useLatexActions({
    outputFiles,
    activeOutputPath,
    projectFiles,
    projectId,
    templateOverride,
    projectTemplateId,
    onCompileSuccess,
    onCompileError,
    clearCompileError,
}: UseLatexActionsParams) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [pdfUrl, setPdfUrl] = useState("");
    const [compileError, setCompileError] = useState("");
    const [compileLog, setCompileLog] = useState("");
    const sendInFlightRef = useRef(false);

    const busy = useCallback(() => isSending || isGenerating || isCompiling || isFixing, [isSending, isGenerating, isCompiling, isFixing]);

    /** Get signed URLs for project image files to inject into AI context */
    async function getProjectImageContext(): Promise<string> {
        const images = projectFiles.filter((f) => {
            if (f.is_folder || !f.mime_type) return false;
            return f.mime_type.startsWith("image/");
        });
        if (images.length === 0) return "";
        const lines: string[] = ["Available project images (use \\includegraphics{figures/<name>>):"];
        for (const img of images) {
            if (img.storage_path) {
                const url = await getProjectFileUrl(img.storage_path);
                if (url) lines.push(`  - ${img.name} → ${url}`);
            }
        }
        return lines.join("\n");
    }

    async function generateLatex(prompt: string, baseLatex?: string) {
        try {
            setIsGenerating(true);
            const payload: Record<string, unknown> = { prompt };
            if (projectTemplateId) payload.templateId = projectTemplateId;
            if (templateOverride) payload.templateId = templateOverride;
            if (baseLatex?.trim()) payload.baseLatex = baseLatex;

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

    async function compileProject(): Promise<{ ok: boolean }> {
        setCompileError(""); setCompileLog("");
        clearCompileError();
        const texFiles = outputFiles.filter((f) => f.content.trim());
        if (texFiles.length === 0) { setCompileError("No files to compile."); return { ok: false }; }

        try {
            setIsCompiling(true);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            const filesPayload = texFiles.map((f) => ({ path: f.filePath, content: f.content }));

            // Add project images as base64
            const images = projectFiles.filter((f) => !f.is_folder && f.mime_type?.startsWith("image/") && f.storage_path);
            for (const img of images) {
                const url = await getProjectFileUrl(img.storage_path!);
                if (url) {
                    try {
                        const resp = await fetch(url);
                        const buf = await resp.arrayBuffer();
                        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                        filesPayload.push({ path: `figures/${img.name}`, content: base64, isBinary: true } as { path: string; content: string; isBinary?: boolean });
                    } catch { /* skip */ }
                }
            }

            const mainTex = outputFiles.find((f) => f.filePath === "main.tex");
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
                if (!buf || buf.byteLength === 0) { onCompileError("Empty PDF.", ""); return { ok: false }; }
                const blob = new Blob([buf], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
                onCompileSuccess(url);
                return { ok: true };
            }

            const data = await r.json().catch(() => null);
            if (r.ok) {
                const b64 = (data?.pdfBase64 ?? data?.pdf_base64 ?? data?.pdf ?? "").toString();
                if (b64.trim()) {
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/pdf" });
                    const url = URL.createObjectURL(blob);
                    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
                    onCompileSuccess(url);
                    return { ok: true };
                }
            }

            const rawErr = (data?.error ?? "Compilation failed.").toString();
            const markerIdx = rawErr.indexOf("----- compiler output -----");
            const message = markerIdx === -1 ? rawErr : rawErr.slice(0, markerIdx).trim();
            const log = markerIdx === -1 ? "" : rawErr.slice(markerIdx + 27).trim();
            const finalMsg = message || "Compilation failed.";
            const finalLog = log || (data?.log ? String(data.log) : "");
            setCompileError(finalMsg);
            setCompileLog(finalLog);
            onCompileError(finalMsg, finalLog);
            return { ok: false };
        } catch (e: unknown) {
            const msg = (e as Error)?.name === "AbortError" ? "Compile request timed out (180s)." : ((e as Error)?.message || "Compile error");
            setCompileError(msg);
            onCompileError(msg, "");
            return { ok: false };
        } finally {
            setIsCompiling(false);
        }
    }

    async function fixWithAI(activeContent: string, log: string, onFixed: (fixedLatex: string) => void) {
        const current = activeContent;
        if (!current?.trim() || !log.trim()) return;
        setIsFixing(true);
        try {
            const r = await fetch(FIX_API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latex: current, log }),
            });
            const data = await r.json().catch(() => null);
            if (!r.ok) throw new Error(data?.error ?? "Fix failed.");
            const fixed = (data?.fixedLatex ?? "").toString();
            if (!fixed.trim()) throw new Error("Empty fix result.");
            onFixed(fixed);
        } catch (e: unknown) {
            setCompileError((e as Error)?.message ?? "Fix error");
        } finally {
            setIsFixing(false);
        }
    }

    return {
        isGenerating,
        isCompiling,
        isFixing,
        isSending,
        setIsSending,
        pdfUrl,
        setPdfUrl,
        compileError,
        setCompileError,
        compileLog,
        setCompileLog,
        sendInFlightRef,
        busy,
        generateLatex,
        compileProject,
        fixWithAI,
    };
}
