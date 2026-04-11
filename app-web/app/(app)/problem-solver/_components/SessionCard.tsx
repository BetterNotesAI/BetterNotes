'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type SessionStatus = 'pending' | 'solving' | 'done' | 'error';

export interface ProblemSession {
  id: string;
  title: string;
  status: SessionStatus;
  created_at: string;
  pdf_path?: string | null;
  solution_md?: string | null;
  // Publish fields (F4-M1.6)
  is_published?: boolean | null;
  published_at?: string | null;
  university?: string | null;
  degree?: string | null;
  subject?: string | null;
  visibility?: string | null;
  keywords?: string[] | null;
}

interface Props {
  session: ProblemSession;
  onDelete: (id: string) => void;
  onTitleChange?: (id: string, newTitle: string) => void;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { label: string; classes: string; dot: string }> = {
    pending: {
      label: 'Pending',
      classes: 'text-white/50 bg-white/8 border-white/15',
      dot: 'bg-white/40',
    },
    solving: {
      label: 'Solving',
      classes: 'text-orange-300 bg-orange-500/15 border-orange-500/25',
      dot: 'bg-orange-400 animate-pulse',
    },
    done: {
      label: 'Done',
      classes: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
      dot: 'bg-emerald-400',
    },
    error: {
      label: 'Error',
      classes: 'text-red-400 bg-red-500/15 border-red-500/25',
      dot: 'bg-red-400',
    },
  };
  const { label, classes, dot } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ConfirmDeleteModal({
  title,
  deleting,
  onConfirm,
  onCancel,
}: {
  title: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) onCancel();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleting, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => { if (!deleting) onCancel(); }}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1">Delete session?</h3>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          <span className="text-white/70 font-medium">&quot;{title}&quot;</span> will be permanently deleted.
          This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 rounded-lg hover:bg-white/8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting && (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SessionCard({ session, onDelete, onTitleChange }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commitTitle() {
    setEditing(false);
    const trimmed = titleDraft.trim() || session.title;
    setTitleDraft(trimmed);
    if (trimmed !== session.title && onTitleChange) {
      onTitleChange(session.id, trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitTitle();
    if (e.key === 'Escape') {
      setTitleDraft(session.title);
      setEditing(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (deleting) return;
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/problem-solver/sessions/${session.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setShowDeleteConfirm(false);
      onDelete(session.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={() => !editing && router.push(`/problem-solver/${session.id}`)}
      className="group relative text-left bg-white/4 hover:bg-white/7 border border-white/10 hover:border-orange-500/30 rounded-2xl p-5 transition-all duration-200 flex flex-col gap-3 cursor-pointer"
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-transparent opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all duration-150 z-10"
        title="Delete session"
      >
        {deleting ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        )}
      </button>

      {/* Title row */}
      <div className="flex items-start gap-2 pr-6">
        {editing ? (
          <input
            ref={inputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white/10 border border-white/25 rounded-lg px-2 py-0.5 text-sm font-semibold text-white outline-none focus:border-orange-400/50"
          />
        ) : (
          <h3
            onClick={handleTitleClick}
            className="flex-1 text-sm font-semibold text-white group-hover:text-orange-300 transition-colors line-clamp-2 cursor-text"
            title="Click to rename"
          >
            {titleDraft}
          </h3>
        )}
      </div>

      {/* Status + date */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={session.status} />
          {session.is_published && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-emerald-400 bg-emerald-500/15 border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Published
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30">{formatDate(session.created_at)}</span>
      </div>

      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title={titleDraft}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
        />
      )}
    </div>
  );
}
