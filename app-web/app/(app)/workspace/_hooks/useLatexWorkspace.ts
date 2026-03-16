import { useState } from "react";

const GENERATE_API_ENDPOINT = "/api/generate-latex";
const FIX_API_ENDPOINT = "/api/fix-latex";
const COMPILE_API_ENDPOINT = "/api/compile";

export function base64ToUint8Array(base64: string) {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export function splitCompilerOutput(err: string): { message: string; log: string } {
    const raw = (err || "").toString();
    const marker = "----- compiler output -----";
    const idx = raw.indexOf(marker);
    if (idx === -1) return { message: raw.trim() || "Compilation failed.", log: "" };
    return { message: raw.slice(0, idx).trim() || "Compilation failed.", log: raw.slice(idx + marker.length).trim() };
}

export function useLatexWorkspace() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string>("");
    const [compileError, setCompileError] = useState<string>("");
    const [compileLog, setCompileLog] = useState<string>("");
    const [fixCandidate, setFixCandidate] = useState<string>("");
    const [showFixModal, setShowFixModal] = useState(false);

    async function generateLatexFromPrompt(
        prompt: string,
        templateId?: string | null,
        baseLatex?: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        files?: any[]
    ): Promise<{ ok: true; latex?: string; message?: string } | { ok: false; error: string }> {
        try {
            setIsGenerating(true);
            const payload: { prompt: string; templateId?: string; baseLatex?: string; files?: unknown[] } = { prompt };
            if (templateId) payload.templateId = templateId;
            if (baseLatex?.trim()) payload.baseLatex = baseLatex;
            if (files && files.length > 0) payload.files = files;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            const r = await fetch(GENERATE_API_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await r.json().catch(() => null);
            if (!r.ok) return { ok: false, error: data?.error ?? "Failed to generate." };
            if (data.message) return { ok: true, message: data.message };
            const latex = (data?.latex ?? "").toString();
            if (!latex.trim() && !data.message) return { ok: false, error: "Model returned empty response." };
            return { ok: true, latex };
        } catch (e: unknown) {
            const err = e as Error;
            if (err.name === "AbortError") return { ok: false, error: "Request timed out (180s)." };
            return { ok: false, error: err?.message ?? "Generate error" };
        } finally {
            setIsGenerating(false);
        }
    }

    async function compileDirect(latex: string): Promise<{ ok: true } | { ok: false; error: string; log?: string }> {
        setCompileError(""); setCompileLog("");
        try {
            setIsCompiling(true);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            const r = await fetch(COMPILE_API_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latex }), signal: controller.signal });
            clearTimeout(timeoutId);
            const ct = (r.headers.get("content-type") || "").toLowerCase();
            if (r.ok) {
                if (ct.includes("application/pdf")) {
                    const buf = await r.arrayBuffer();
                    if (!buf || buf.byteLength === 0) { setCompileError("PDF response empty."); return { ok: false, error: "PDF response empty." }; }
                    const blob = new Blob([buf], { type: "application/pdf" });
                    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
                    return { ok: true };
                }
                const data = await r.json().catch(() => null);
                const pdfBase64 = (data?.pdfBase64 ?? data?.pdf_base64 ?? data?.pdf ?? "").toString();
                if (!pdfBase64.trim()) { const msg = "PDF payload empty."; setCompileError(msg); if (data?.log) setCompileLog(String(data.log)); return { ok: false, error: msg, log: data?.log ?? "" }; }
                const bytes = base64ToUint8Array(pdfBase64);
                const blob = new Blob([bytes], { type: "application/pdf" });
                setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
                return { ok: true };
            }
            const data = await r.json().catch(() => null);
            const { message, log } = splitCompilerOutput((data?.error ?? "Compilation failed.").toString());
            setCompileError(message);
            setCompileLog(log || (data?.log ? String(data.log) : ""));
            return { ok: false, error: message, log: log || (data?.log ? String(data.log) : "") };
        } catch (e: unknown) {
            const err = e as Error;
            if (err?.name === "AbortError") { setCompileError("Compile request timed out (180s)."); return { ok: false, error: "Compile request timed out (180s)." }; }
            setCompileError(err?.message || "Compile error");
            return { ok: false, error: err?.message || "Compile error" };
        } finally {
            setIsCompiling(false);
        }
    }

    async function fixWithAI(savedLatex: string, log: string) {
        if (!savedLatex.trim() || !log.trim()) return;
        setIsFixing(true);
        try {
            const r = await fetch(FIX_API_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latex: savedLatex, log }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) throw new Error(data?.error ?? "Fix failed.");
            const fixed = (data?.fixedLatex ?? "").toString();
            if (!fixed.trim()) throw new Error("Fix endpoint returned empty LaTeX.");
            setFixCandidate(fixed);
            setShowFixModal(true);
        } catch (e: unknown) {
            setCompileError((e as Error)?.message ?? "Fix error");
        } finally {
            setIsFixing(false);
        }
    }

    return {
        isGenerating, isCompiling, isFixing,
        pdfUrl, setPdfUrl,
        compileError, setCompileError,
        compileLog, setCompileLog,
        fixCandidate, showFixModal, setShowFixModal,
        generateLatexFromPrompt,
        compileDirect,
        fixWithAI,
    };
}
