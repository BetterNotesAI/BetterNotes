'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface WorkspaceAttachmentsPanelProps {
  documentId: string;
}

// ---------------------------------------------------------------------------
// Helpers (self-contained — no import from AttachmentDropzone to keep
// this component independent of the modal context)
// ---------------------------------------------------------------------------

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
    return `${basePart}\u2026${extPart}`;
  }
  return `${name.slice(0, max - 1)}\u2026`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return (
      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 17h6" />
      </svg>
    );
  }
  // Images and everything else
  return (
    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Compact dropzone — smaller than the modal version (py-3 instead of py-6)
// ---------------------------------------------------------------------------

interface CompactDropzoneProps {
  isDisabled: boolean;
  isUploading: boolean;
  isMaxReached: boolean;
  onFile: (file: File) => void;
}

function CompactDropzone({ isDisabled, isUploading, isMaxReached, onFile }: CompactDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleClick() {
    if (isDisabled) return;
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDisabled) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (isDisabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <>
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Upload attachment"
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg py-3 text-center transition-all select-none
          ${isDisabled
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-50'
            : isDragOver
              ? 'border-indigo-400/60 bg-indigo-500/10 cursor-pointer'
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
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspaceAttachmentsPanel({ documentId }: WorkspaceAttachmentsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [attachments, setAttachments] = useState<WorkspaceAttachment[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track which row is hovered to show the X button
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Load attachments once on mount
  const loadAttachments = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/attachments`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setIsFetching(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Upload: two-step — storage upload then register on document
  async function handleUploadFile(file: File) {
    if (attachments.length >= MAX_ATTACHMENTS || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      // Step 1: upload to storage
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (HTTP ${uploadRes.status})`);
      }

      const { storagePath, name, mimeType, sizeBytes } = await uploadRes.json();

      // Step 2: register on document
      const registerRes = await fetch(`/api/documents/${documentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, name, mimeType, sizeBytes }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json().catch(() => ({}));
        throw new Error(data.error ?? `Register failed (HTTP ${registerRes.status})`);
      }

      const { attachment } = await registerRes.json();
      setAttachments((prev) => [...prev, attachment as WorkspaceAttachment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  // Delete attachment
  async function handleDelete(attachmentId: string) {
    if (deletingId) return;
    setDeletingId(attachmentId);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Delete failed (HTTP ${res.status})`);
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const isMaxReached = attachments.length >= MAX_ATTACHMENTS;
  const count = attachments.length;

  return (
    // shrink-0 so this panel doesn't flex-grow and steal height from ChatPanel
    <div className="shrink-0 border-b border-l border-white/10">
      {/* Header — always visible, 44px tall */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/20 hover:bg-white/[0.04]
          transition-colors duration-150 backdrop-blur-sm"
        aria-expanded={isOpen}
        style={{ minHeight: '44px' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-white/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-xs font-medium text-white/70">
            Attachments
            {isFetching ? (
              <span className="ml-1.5 text-white/30">...</span>
            ) : (
              <span className="ml-1.5 text-white/40">({count})</span>
            )}
          </span>
        </div>

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="bg-black/20 backdrop-blur-sm px-3 pb-3 pt-2 flex flex-col gap-2">

          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between gap-2 bg-red-950/40 border border-red-900/50
              rounded-lg px-3 py-1.5">
              <p className="text-xs text-red-400 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                aria-label="Dismiss error"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Fetching skeleton */}
          {isFetching && (
            <div className="flex items-center gap-2 py-1">
              <span className="w-3.5 h-3.5 border-2 border-white/15 border-t-indigo-400 rounded-full animate-spin shrink-0" />
              <span className="text-xs text-white/30">Loading...</span>
            </div>
          )}

          {/* Attachment list */}
          {!isFetching && attachments.length > 0 && (
            <div className="flex flex-col gap-1">
              {attachments.map((attachment) => {
                const isDeleting = deletingId === attachment.id;
                const isHovered = hoveredId === attachment.id;
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 bg-white/[0.06] border border-white/10
                      rounded-lg px-3 py-1.5 text-xs group"
                    onMouseEnter={() => setHoveredId(attachment.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <FileTypeIcon mimeType={attachment.mimeType} />

                    <span
                      className="flex-1 text-gray-200 truncate min-w-0"
                      title={attachment.name}
                    >
                      {truncateName(attachment.name, 24)}
                    </span>

                    <span className="text-white/35 shrink-0 tabular-nums">
                      {formatBytes(attachment.sizeBytes)}
                    </span>

                    {/* Delete button — visible on row hover or while deleting */}
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={!!deletingId}
                      aria-label={`Remove ${attachment.name}`}
                      className={`shrink-0 ml-0.5 transition-all duration-150
                        ${isHovered || isDeleting ? 'opacity-100' : 'opacity-0'}
                        text-white/40 hover:text-red-400 disabled:cursor-not-allowed`}
                    >
                      {isDeleting ? (
                        <span className="w-3 h-3 border border-white/25 border-t-white/60 rounded-full animate-spin block" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state — only shown after fetch, when list is empty */}
          {!isFetching && attachments.length === 0 && !error && (
            <p className="text-xs text-white/25 py-0.5">No attachments yet.</p>
          )}

          {/* Compact dropzone */}
          <CompactDropzone
            isDisabled={isMaxReached || isUploading || !!deletingId}
            isUploading={isUploading}
            isMaxReached={isMaxReached}
            onFile={handleUploadFile}
          />
        </div>
      )}
    </div>
  );
}
