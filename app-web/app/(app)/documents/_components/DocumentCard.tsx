'use client';

import { useEffect, useRef, useState } from 'react';

export interface DocumentItem {
  id: string;
  title: string;
  template_id: string;
  status: string;
  is_starred: boolean;
  archived_at: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentCardProps {
  doc: DocumentItem;
  onRename: (newTitle: string) => void;
  onStar: (isStarred: boolean) => void;
  onArchive: (archive: boolean) => void;
  onDelete: () => void;
  onNavigate: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-gray-500' },
  generating: { label: 'Generating...', color: 'text-blue-400 animate-pulse' },
  ready: { label: 'Ready', color: 'text-green-500' },
  error: { label: 'Error', color: 'text-red-500' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: '3-Col Landscape',
  cornell: 'Cornell Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Lecture Notes',
  long_template: 'Long Document',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DocumentCard({
  doc,
  onRename,
  onStar,
  onArchive,
  onDelete,
  onNavigate,
}: DocumentCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };

  // Focus input when rename mode starts
  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function handleTitleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setRenameValue(doc.title);
    setIsRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== doc.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setRenameValue(doc.title);
      setIsRenaming(false);
    }
  }

  function handleStarClick(e: React.MouseEvent) {
    e.stopPropagation();
    onStar(!doc.is_starred);
  }

  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((o) => !o);
  }

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    onArchive(!doc.archived_at);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm('Delete this document? This cannot be undone.')) return;
    onDelete();
  }

  return (
    <div
      className="relative text-left bg-white/10 border border-white/20 rounded-xl p-4
        hover:bg-white/15 hover:border-white/30 backdrop-blur transition-all group cursor-pointer"
      onClick={() => {
        if (!isRenaming) onNavigate();
      }}
    >
      {/* Star button — always visible, top-right corner */}
      <button
        onClick={handleStarClick}
        className={`absolute top-3 right-3 transition-colors z-10 ${
          doc.is_starred ? 'text-yellow-400' : 'text-white/30 hover:text-yellow-300'
        }`}
        aria-label={doc.is_starred ? 'Unstar document' : 'Star document'}
        title={doc.is_starred ? 'Remove from starred' : 'Add to starred'}
      >
        {doc.is_starred ? (
          // Filled star
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ) : (
          // Outline star
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        )}
      </button>

      {/* Title row */}
      <div className="flex items-start mb-2 pr-8">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-white bg-white/10 border border-white/30
              rounded px-1.5 py-0.5 outline-none focus:border-indigo-400 w-full leading-snug"
            maxLength={120}
          />
        ) : (
          <h3
            className="text-sm font-semibold text-white truncate leading-snug cursor-text select-none"
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to rename"
          >
            {doc.title}
          </h3>
        )}
      </div>

      {/* Template label */}
      <p className="text-xs text-white/50 mb-3">
        {TEMPLATE_LABELS[doc.template_id] ?? doc.template_id}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">
            {formatDate(doc.updated_at)}
          </span>

          {/* Three-dot menu — visible on hover */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuToggle}
              className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80
                transition-all p-0.5 rounded"
              aria-label="More actions"
              title="More actions"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 bottom-full mb-1 w-36 rounded-xl border border-white/20
                  bg-black/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  {doc.archived_at ? 'Unarchive' : 'Archive'}
                </button>
                <div className="h-px bg-white/10 my-0.5" />
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-300/80
                    hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
