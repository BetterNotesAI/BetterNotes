'use client';

import { useCallback, useRef, useState } from 'react';
import {
  MAX_PROJECT_TOTAL_UPLOAD_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_MB,
} from '@/lib/upload-limits';

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
}

export function ProblemSolverPanel({ file, onFileChange, onError, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (next: File) => {
      const isPdf =
        next.type === 'application/pdf' || next.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        onError('Only PDF files are supported.');
        return;
      }
      if (next.size > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
        onError(`File exceeds the ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB limit.`);
        return;
      }
      onError(null);
      onFileChange(next);
    },
    [onError, onFileChange]
  );

  return (
    <div className="mt-6">
      <label className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
        Problem PDF <span className="text-white/35 normal-case font-normal tracking-normal">— required</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0];
          if (next) handleFile(next);
          e.target.value = '';
        }}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-orange-500/15 border border-orange-500/25">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/90 truncate">{file.name}</p>
              <p className="text-[11px] text-white/45">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFileChange(null)}
            className="shrink-0 text-xs text-white/50 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (disabled) return;
            const next = e.dataTransfer.files[0];
            if (next) handleFile(next);
          }}
          className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-200
            flex flex-col items-center justify-center gap-3 py-10 px-6 text-center
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${
              isDragging
                ? 'border-orange-400 bg-orange-500/8'
                : 'border-white/20 bg-white/[0.03] hover:border-white/35 hover:bg-white/[0.05]'
            }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
              isDragging
                ? 'bg-orange-500/20 border-orange-400/40'
                : 'bg-orange-500/15 border-orange-500/25'
            }`}
          >
            <svg
              className={`w-6 h-6 ${isDragging ? 'text-orange-300' : 'text-orange-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-white/90 font-medium text-sm">Drop your problem PDF here</p>
            <p className="text-white/45 text-xs mt-0.5">or click to browse</p>
          </div>
          <p className="text-white/30 text-[11px]">
            PDF only · max {MAX_PROJECT_TOTAL_UPLOAD_MB} MB
          </p>
        </div>
      )}
    </div>
  );
}
