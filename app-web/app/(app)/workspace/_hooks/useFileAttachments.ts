import { useState } from "react";

type FileType = "image" | "text" | "document";

export interface FileAttachment {
    id: string;
    file: File;
    type: FileType;
    previewUrl?: string;
}

export function useFileAttachments(
    getUser: () => { id: string } | null,
    getUsageStatus: () => { is_paid?: boolean } | null,
    setFileError: (err: string) => void
) {
    const [files, setFiles] = useState<FileAttachment[]>([]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length === 0) return;
        const user = getUser();
        const usage = getUsageStatus();
        const isPro = usage?.is_paid;
        const isAuth = !!user;
        const limit = isPro ? 5 : isAuth ? 2 : 1;

        if (files.length + selected.length > limit) {
            setFileError(`You can only upload ${limit} files on your ${isPro ? "Pro" : isAuth ? "Free" : "Guest"} plan.`);
            e.target.value = "";
            return;
        }

        const newFiles: FileAttachment[] = [];
        let error = "";

        for (const file of selected) {
            if (file.size > 10 * 1024 * 1024) { error = `File "${file.name}" exceeds 10MB limit.`; break; }
            if (file.type.startsWith("video/")) { error = "Video files are not allowed. Only Images and Documents (PDF, DOCX, TXT)."; break; }
            let type: FileType = "document";
            if (file.type.startsWith("image/")) type = "image";
            else if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".csv")) type = "text";
            newFiles.push({ id: Math.random().toString(36).slice(2), file, type, previewUrl: type === "image" ? URL.createObjectURL(file) : undefined });
        }

        if (error) { setFileError(error); e.target.value = ""; return; }
        setFileError("");
        setFiles((prev) => [...prev, ...newFiles]);
        e.target.value = "";
    };

    const removeFile = (id: string) => {
        setFiles((prev) => {
            const target = prev.find((f) => f.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((f) => f.id !== id);
        });
    };

    async function processFilesForPayload(currentFiles: FileAttachment[], user: { id: string } | null) {
        if (currentFiles.length === 0) return [];
        const processed = await Promise.all(currentFiles.map(async (f) => {
            if (user) {
                const { uploadFileToStorage } = await import("@/lib/storage");
                const publicUrl = await uploadFileToStorage(f.file, user.id);
                if (publicUrl) return { type: f.type, url: publicUrl, name: f.file.name, mimeType: f.file.type || undefined };
                console.warn("Upload failed, falling back to base64");
            }
            const { fileToBase64 } = await import("@/lib/storage");
            const b64 = await fileToBase64(f.file);
            return { type: f.type, data: b64, name: f.file.name, mimeType: f.file.type || undefined };
        }));
        return processed;
    }

    return { files, setFiles, handleFileSelect, removeFile, processFilesForPayload };
}
