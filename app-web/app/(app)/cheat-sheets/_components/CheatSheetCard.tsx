'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CheatSheetStatus = 'pending' | 'generating' | 'done' | 'error';

export interface CheatSheetSession {
  id: string;
  title: string;
  status: CheatSheetStatus;
  subject?: string | null;
  language: string;
  source_doc_ids: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  session: CheatSheetSession;
  onDelete: (id: string) => void;
  onTitleChange?: (id: string, newTitle: string) => void;
}

function StatusBadge({ status }: { status: CheatSheetStatus }) {
  const map: Record<CheatSheetStatus, { label: string; classes: string; dot: string }> = {
    pending: {
      label: 'Pending',
      classes: 'text-white/50 bg-white/8 border-white/15',
      dot: 'bg-white/40',
    },
    generating: {
      label: 'Generating',
      classes: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
      dot: 'bg-indigo-400 animate-pulse',
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

export function CheatSheetCard({ session, onDelete, onTitleChange }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title);
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    try {
      await fetch(`/api/cheat-sheets/sessions/${session.id}`, { method: 'DELETE' });
      onDelete(session.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={() => !editing && router.push(`/cheat-sheets/${session.id}`)}
      className="group relative text-left bg-white/4 hover:bg-white/7 border border-white/10 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-200 flex flex-col gap-3 cursor-pointer"
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-transparent opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all duration-150 z-10"
        title="Delete cheat sheet"
      >
        {deleting ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        )}
      </button>

      {/* Icon + title */}
      <div className="flex items-start gap-3 pr-6">
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/15 border border-indigo-500/20 mt-0.5">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white/10 border border-white/25 rounded-lg px-2 py-0.5 text-sm font-semibold text-white outline-none focus:border-indigo-400/50"
            />
          ) : (
            <h3
              onClick={handleTitleClick}
              className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 cursor-text"
              title="Click to rename"
            >
              {titleDraft}
            </h3>
          )}
          {session.subject && (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">{session.subject}</p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={session.status} />
          {session.source_doc_ids.length > 0 && (
            <span className="text-[10px] text-white/30">
              {session.source_doc_ids.length} doc{session.source_doc_ids.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30">{formatDate(session.created_at)}</span>
      </div>
    </div>
  );
}
