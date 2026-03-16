import { useEffect, useState, useCallback } from "react";
import { listOutputFiles, saveOutputFile } from "@/lib/api";

export interface OutputEntry {
    filePath: string;
    content: string;
    dirty: boolean;
}

type ToastType = "error" | "warning" | "success" | "info" | undefined;
type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

interface ConfirmOptions {
    title: string;
    message?: string;
    variant?: "danger" | "default" | "info";
    confirmText?: string;
    cancelText?: string;
}

export function useOutputFiles(projectId: string) {
    const [outputFiles, setOutputFiles] = useState<OutputEntry[]>([]);
    const [activeOutputPath, setActiveOutputPath] = useState<string>("main.tex");

    // ── Load saved output files ──
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
                const main = outputs.find((o) => o.file_path === "main.tex");
                setActiveOutputPath(main ? "main.tex" : outputs[0].file_path);
            }
        }
        loadOutputs();
    }, [projectId]);

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
        setOutputFiles((prev) => {
            const existing = prev.find((f) => f.filePath === "main.tex");
            if (existing) {
                return prev.map((f) => f.filePath === "main.tex" ? { ...f, content: mainContent, dirty: false } : f);
            }
            return [{ filePath: "main.tex", content: mainContent, dirty: false }, ...prev];
        });
        setActiveOutputPath("main.tex");
    }

    const addNewOutputFile = useCallback(async (showPrompt: (opts: { title: string; message: string; placeholder: string; confirmText: string }) => Promise<string | null>, toast: ToastFn) => {
        const name = await showPrompt({ title: "New File", message: "Enter file name (e.g. preamble.tex, chapters/intro.tex):", placeholder: "preamble.tex", confirmText: "Create" });
        if (!name?.trim()) return;
        const normalized = name.trim().replace(/\\/g, "/");
        const exists = outputFiles.some((f) => f.filePath === normalized);
        if (exists) { toast("File already exists.", "warning"); return; }
        setOutputFiles((prev) => [...prev, { filePath: normalized, content: "", dirty: true }]);
        setActiveOutputPath(normalized);
    }, [outputFiles]);

    const deleteOutputEntry = useCallback(async (filePath: string, showConfirm: (opts: ConfirmOptions) => Promise<boolean>, toast: ToastFn) => {
        if (filePath === "main.tex") { toast("Cannot delete main.tex", "warning"); return; }
        const ok = await showConfirm({ title: "Delete File", message: `Delete output file "${filePath}"?`, variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        setOutputFiles((prev) => prev.filter((f) => f.filePath !== filePath));
        if (activeOutputPath === filePath) setActiveOutputPath("main.tex");
    }, [activeOutputPath]);

    async function saveAllDirty() {
        const dirty = outputFiles.filter((f) => f.dirty);
        await Promise.all(dirty.map((f) => saveOutputFile(projectId, f.filePath, f.content)));
    }

    function markAllClean() {
        setOutputFiles((prev) => prev.map((f) => ({ ...f, dirty: false })));
    }

    return {
        outputFiles,
        setOutputFiles,
        activeOutputPath,
        setActiveOutputPath,
        updateOutputFile,
        setOutputFilesFromGeneration,
        addNewOutputFile,
        deleteOutputEntry,
        saveAllDirty,
        markAllClean,
    };
}
