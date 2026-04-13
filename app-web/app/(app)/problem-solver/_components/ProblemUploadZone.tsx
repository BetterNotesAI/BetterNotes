'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_PROJECT_TOTAL_UPLOAD_BYTES, MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error';

interface Props {
  /** Optional callback when upload completes, in case the parent wants to handle redirect itself */
  onSessionCreated?: (sessionId: string) => void;
}

export function ProblemUploadZone({ onSessionCreated }: Props) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate
      if (file.type !== 'application/pdf') {
        setErrorMsg('Only PDF files are supported.');
        setState('error');
        return;
      }
      if (file.size > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
        setErrorMsg(`File exceeds the ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB limit.`);
        setState('error');
        return;
      }

      setState('uploading');
      setErrorMsg(null);

      try {
        // 1. Create session
        const createRes = await fetch('/api/problem-solver/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: file.name.replace(/\.pdf$/i, '') }),
        });
        if (!createRes.ok) {
          const data = await createRes.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to create session');
        }
        const { session } = await createRes.json();
        const sessionId: string = session.id;

        // 2. Upload PDF
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(
          `/api/problem-solver/sessions/${sessionId}/upload-pdf`,
          { method: 'POST', body: formData }
        );
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to upload PDF');
        }

        // 3. Navigate
        if (onSessionCreated) {
          onSessionCreated(sessionId);
        } else {
          router.push(`/problem-solver/${sessionId}`);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
        setState('error');
      }
    },
    [router, onSessionCreated]
  );

  // Drag handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => (s === 'uploading' ? s : 'dragging'));
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => (s === 'uploading' || s === 'error' ? s : 'idle'));
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (state === 'uploading') return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so re-selecting same file fires onChange
    e.target.value = '';
  };

  const borderColor =
    state === 'dragging'
      ? 'border-orange-400'
      : state === 'error'
      ? 'border-red-500/60'
      : 'border-white/15 hover:border-white/30';

  const bgColor =
    state === 'dragging'
      ? 'bg-orange-500/8'
      : state === 'error'
      ? 'bg-red-500/5'
      : 'bg-white/3 hover:bg-white/5';

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => state !== 'uploading' && inputRef.current?.click()}
      className={`
        relative w-full rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
        flex flex-col items-center justify-center gap-4 py-16 px-8 text-center
        ${borderColor} ${bgColor}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Icon */}
      {state === 'uploading' ? (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-orange-500/15 border border-orange-500/25">
          <svg
            className="w-6 h-6 text-orange-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      ) : state === 'error' ? (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-500/15 border border-red-500/25">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      ) : (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-200
            ${state === 'dragging' ? 'bg-orange-500/20 border border-orange-400/40' : 'bg-orange-500/15 border border-orange-500/25'}`}
        >
          <svg
            className={`w-6 h-6 transition-colors ${state === 'dragging' ? 'text-orange-300' : 'text-orange-400'}`}
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
      )}

      {/* Text */}
      {state === 'uploading' ? (
        <>
          <p className="text-white font-medium">Uploading…</p>
          <p className="text-white/40 text-sm">Creating your problem session</p>
        </>
      ) : state === 'error' ? (
        <>
          <p className="text-red-400 font-medium">{errorMsg}</p>
          <p className="text-white/40 text-sm">Click to try again</p>
        </>
      ) : (
        <>
          <div>
            <p className="text-white font-medium text-base">
              Drop your problem PDF here
            </p>
            <p className="text-white/40 text-sm mt-1">or click to browse</p>
          </div>
          <p className="text-white/25 text-xs">PDF only · max {MAX_PROJECT_TOTAL_UPLOAD_MB} MB</p>
        </>
      )}
    </div>
  );
}
