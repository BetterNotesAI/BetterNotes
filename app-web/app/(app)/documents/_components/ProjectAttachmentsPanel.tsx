'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_MB,
} from '@/lib/upload-limits';

interface ProjectAttachment {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface ProjectAttachmentsPanelProps {
  projectId: string;
  mode?: 'inline' | 'sidebar';
  onClose?: () => void;
  onCountChange?: (count: number) => void;
}

const MAX_ATTACHMENTS = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 6) {
    const extPart = name.slice(ext);
    const basePart = name.slice(0, max - extPart.length - 1);
    return `${basePart}...${extPart}`;
  }
  return `${name.slice(0, max - 3)}...`;
}

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M7 21h10a2 2 0 002-2V9.5L12.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3v6h6M9 14h6M9 17h4" />
      </svg>
    );
  }
  if (mimeType?.includes('word')) {
    return (
      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M7 21h10a2 2 0 002-2V9.5L12.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3v6h6M9 14h6M9 17h6" />
      </svg>
    );
  }
  if (mimeType?.startsWith('image/')) {
    return (
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
          d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-white/45 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M7 21h10a2 2 0 002-2V9.5L12.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3v6h6" />
    </svg>
  );
}

export function ProjectAttachmentsPanel({
  projectId,
  mode = 'inline',
  onClose,
  onCountChange,
}: ProjectAttachmentsPanelProps) {
  const [isOpen, setIsOpen] = useState(mode === 'sidebar');
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const loadAttachments = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(projectId)}/inputs`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const next = Array.isArray(data.inputs) ? data.inputs as ProjectAttachment[] : [];
      setAttachments(next);
      onCountChangeRef.current?.(next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setIsFetching(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  async function handleUpload(file: File) {
    if (isUploading || deletingId) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      setError(`Maximum ${MAX_ATTACHMENTS} attachments reached.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.`);
      return;
    }

    const currentTotalBytes = attachments.reduce((acc, item) => acc + (item.sizeBytes ?? 0), 0);
    if (currentTotalBytes + file.size > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
      setError(`Notebook file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per notebook.`);
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: formData });
      const uploaded = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploaded.error ?? `Upload failed (HTTP ${uploadRes.status})`);

      const registerRes = await fetch(`/api/folders/${encodeURIComponent(projectId)}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploaded),
      });
      const registered = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) throw new Error(registered.error ?? `Register failed (HTTP ${registerRes.status})`);

      const nextAttachment = registered.input as ProjectAttachment;
      setAttachments((prev) => {
        const next = [...prev, nextAttachment];
        onCountChangeRef.current?.(next.length);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(attachmentId: string) {
    if (deletingId) return;
    setDeletingId(attachmentId);
    setError(null);
    try {
      const res = await fetch(
        `/api/folders/${encodeURIComponent(projectId)}/inputs/${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Delete failed (HTTP ${res.status})`);

      setAttachments((prev) => {
        const next = prev.filter((attachment) => attachment.id !== attachmentId);
        onCountChangeRef.current?.(next.length);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  const count = attachments.length;
  const totalBytes = attachments.reduce((acc, item) => acc + (item.sizeBytes ?? 0), 0);
  const bodyVisible = mode === 'sidebar' || isOpen;
  const isMaxReached = count >= MAX_ATTACHMENTS;

  return (
    <div className={`${mode === 'sidebar' ? 'h-full flex flex-col bg-black/24' : 'shrink-0 border-b border-l border-white/10'}`}>
      <div
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/20 hover:bg-white/[0.04]
          transition-colors duration-150 backdrop-blur-sm"
        style={{ minHeight: '44px' }}
      >
        <button
          onClick={() => mode === 'inline' && setIsOpen((value) => !value)}
          className="flex items-center gap-2 min-w-0 text-left"
          aria-expanded={bodyVisible}
        >
          <svg className="w-3.5 h-3.5 text-white/55 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-xs font-medium text-white/75 truncate">
            Notebook attachments
            {isFetching ? (
              <span className="ml-1.5 text-white/35">...</span>
            ) : (
              <span className="ml-1.5 text-white/45">({count})</span>
            )}
          </span>
        </button>
        {mode === 'sidebar' && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/45 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close notebook attachments"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="rounded-md p-1 text-white/40 hover:text-white/75 hover:bg-white/10 transition-colors"
            aria-label={bodyVisible ? 'Collapse notebook attachments' : 'Expand notebook attachments'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {bodyVisible ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              )}
            </svg>
          </button>
        )}
      </div>

      {bodyVisible && (
        <div className={`${mode === 'sidebar' ? 'flex-1 overflow-y-auto' : ''} bg-black/20 backdrop-blur-sm px-3 pb-3 pt-2 flex flex-col gap-2`}>
          {error && (
            <div className="flex items-center justify-between gap-2 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 transition-colors shrink-0" aria-label="Dismiss error">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {isFetching ? (
            <div className="flex items-center gap-2 py-1">
              <span className="w-3.5 h-3.5 border-2 border-white/15 border-t-indigo-400 rounded-full animate-spin shrink-0" />
              <span className="text-xs text-white/35">Loading...</span>
            </div>
          ) : attachments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs
                    bg-white/[0.06] border-white/10 hover:border-white/20 transition-colors"
                >
                  <FileTypeIcon mimeType={attachment.mimeType} />
                  <span className="flex-1 text-gray-200 truncate min-w-0" title={attachment.name}>
                    {truncateName(attachment.name, 28)}
                  </span>
                  <span className="text-white/35 shrink-0 tabular-nums">
                    {formatBytes(attachment.sizeBytes ?? 0)}
                  </span>
                  <button
                    onClick={() => void handleDelete(attachment.id)}
                    disabled={!!deletingId}
                    className="opacity-0 group-hover:opacity-100 text-white/35 hover:text-red-400 transition-all disabled:cursor-not-allowed"
                    aria-label={`Delete ${attachment.name}`}
                  >
                    {deletingId === attachment.id ? (
                      <span className="w-3 h-3 border border-white/25 border-t-white/60 rounded-full animate-spin block" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/28 py-0.5">No notebook attachments yet.</p>
          )}

          <div
            role="button"
            tabIndex={isMaxReached || isUploading || !!deletingId ? -1 : 0}
            onClick={() => {
              if (!isMaxReached && !isUploading && !deletingId) fileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isMaxReached && !isUploading && !deletingId) {
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg py-3 text-center transition-all select-none
              ${isMaxReached || isUploading || !!deletingId
                ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-50'
                : 'border-white/20 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05] cursor-pointer'
              }`}
          >
            {isUploading ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin shrink-0" />
                <p className="text-xs text-gray-400">Uploading...</p>
              </div>
            ) : isMaxReached ? (
              <p className="text-xs text-gray-500">Maximum {MAX_ATTACHMENTS} files reached</p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs text-gray-400">Drop files or click to upload</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <p className="text-[10px] text-white/30 px-0.5">
            Total notebook files: {formatBytes(totalBytes)} / {formatBytes(MAX_PROJECT_TOTAL_UPLOAD_BYTES)} ({MAX_PROJECT_TOTAL_UPLOAD_MB} MB max)
          </p>
        </div>
      )}
    </div>
  );
}
