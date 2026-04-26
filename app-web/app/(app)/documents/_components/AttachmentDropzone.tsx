'use client';

import { useRef, useState } from 'react';
import { LocalAttachment } from '../_types';
import { MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';

interface AttachmentDropzoneProps {
  attachments: LocalAttachment[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (index: number) => void;
  isUploading: boolean;
  error: string | null;
}

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
    return `${basePart}…${extPart}`;
  }
  return `${name.slice(0, max - 1)}…`;
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
  // Image types
  return (
    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function AttachmentDropzone({
  attachments,
  onAdd,
  onRemove,
  isUploading,
  error,
}: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isMaxReached = attachments.length >= 3;
  const isDisabled = isMaxReached || isUploading;

  async function processFile(file: File) {
    await onAdd(file);
  }

  function handleClick() {
    if (isDisabled) return;
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected after removal
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
    if (file) processFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Upload attachment"
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all select-none
          ${isDisabled
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-60'
            : isDragOver
              ? 'border-indigo-400/60 bg-indigo-500/10 cursor-pointer'
              : 'border-white/20 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05] cursor-pointer'
          }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="w-5 h-5 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-xs text-gray-400">Uploading...</p>
          </div>
        ) : isMaxReached ? (
          <div className="py-2">
            <p className="text-xs text-gray-500">Maximum 3 files reached</p>
          </div>
        ) : (
          <div className="py-2">
            <svg
              className="w-6 h-6 text-gray-600 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-300">Drop files here or click to upload</p>
            <p className="text-xs text-gray-600 mt-1">
              PDF, DOCX, JPG, PNG, WEBP · Up to {MAX_PROJECT_TOTAL_UPLOAD_MB}MB total per notebook · Up to 3 files
            </p>
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

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-white/[0.08] border border-white/15 rounded-lg px-3 py-2 text-xs"
            >
              <FileTypeIcon mimeType={attachment.mimeType} />
              <span className="flex-1 text-gray-200 truncate" title={attachment.name}>
                {truncateName(attachment.name, 20)}
              </span>
              <span className="text-gray-500 shrink-0">{formatBytes(attachment.sizeBytes)}</span>
              <button
                onClick={() => onRemove(index)}
                aria-label={`Remove ${attachment.name}`}
                className="text-gray-500 hover:text-gray-200 transition-colors shrink-0 ml-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
