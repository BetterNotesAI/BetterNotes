import { useEffect, useState, useCallback } from "react";
import { listProjectFiles, createProjectFolder, deleteProjectFile, type ProjectFileRecord } from "@/lib/api";
import { uploadProjectFile } from "@/lib/storage";

export function useProjectFiles(projectId: string) {
    const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    const refreshFiles = useCallback(async () => {
        if (!projectId) return;
        const files = await listProjectFiles(projectId);
        setProjectFiles(files);
    }, [projectId]);

    useEffect(() => { refreshFiles(); }, [refreshFiles]);

    async function handleNewFolder(parentId: string | null) {
        const { showPrompt } = await import("@/app/components/ConfirmDialog").then(m => ({ showPrompt: m.useDialog }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void showPrompt; // resolved via caller — folders created externally via showPrompt
        if (!projectId) return;
        const name = window.prompt("Nombre de carpeta:");
        if (!name?.trim()) return;
        await createProjectFolder(projectId, name.trim(), parentId);
        refreshFiles();
    }

    async function handleUpload(parentId: string | null) {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
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

    return {
        projectFiles,
        refreshFiles,
        selectedFileId,
        setSelectedFileId,
        handleUpload,
        handleDeleteFile,
    };
}
