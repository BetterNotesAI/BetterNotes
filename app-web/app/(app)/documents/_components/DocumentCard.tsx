'use client';

import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  forked_from_id?: string | null;
}

// ── Shared constants ────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-gray-500' },
  generating: { label: 'Generating...', color: 'text-blue-400 animate-pulse' },
  ready: { label: 'Ready', color: 'text-green-500' },
  error: { label: 'Error', color: 'text-red-500' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: 'Compact 3 Columns Landscape',
  clean_3cols_landscape: 'Clean 3 Columns Landscape',
  cornell: 'Cornell Review Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Extended Lecture Notes',
  classic_lecture_notes: 'Classic Lecture Notes',
  long_template: 'Long Document',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Document Details modal ──────────────────────────────────────────────────
function DocumentDetailsModal({
  doc,
  onClose,
}: {
  doc: DocumentItem;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;

  function formatDateLong(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="min-w-0 pr-3">
            <h3 className="text-sm font-semibold text-white leading-snug truncate">{doc.title}</h3>
            <p className="text-xs text-white/40 mt-0.5">Document details</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-white/30 hover:text-white/70 transition-colors p-0.5 rounded-md hover:bg-white/8"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Template</span>
            <span className="text-xs text-white/80 font-medium">{templateLabel}</span>
          </div>
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Status</span>
            <span className={`text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Created</span>
            <span className="text-xs text-white/70">{formatDateLong(doc.created_at)}</span>
          </div>
          {doc.updated_at && (
            <>
              <div className="h-px bg-white/8" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Last modified</span>
                <span className="text-xs text-white/70">{formatDateLong(doc.updated_at)}</span>
              </div>
            </>
          )}
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Document ID</span>
            <span className="text-xs text-white/30 font-mono truncate max-w-[160px]">{doc.id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="w-full px-3 py-2 text-xs text-white/60 hover:text-white/80 rounded-xl hover:bg-white/8 transition-colors border border-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1">Delete document?</h3>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          <span className="text-white/70 font-medium">&quot;{title}&quot;</span> will be permanently deleted.
          This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 rounded-lg hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface FolderOption {
  id: string;
  name: string;
  color: string | null;
}

interface DocumentCardProps {
  doc: DocumentItem;
  onRename: (newTitle: string) => void;
  onStar: (isStarred: boolean) => void;
  onArchive: (archive: boolean) => void;
  onDelete: () => void;
  onNavigate: () => void;
  onOpenHistory?: () => void;
  folders: FolderOption[];
  onMoveToFolder: (folderId: string | null) => void;
  onDuplicate?: () => void | Promise<void>;
  onDownload?: () => void;
  folderBadge?: { name: string; color: string | null };
}

export function DocumentCard({
  doc,
  onRename,
  onStar,
  onArchive,
  onDelete,
  onNavigate,
  onOpenHistory,
  folders,
  onMoveToFolder,
  onDuplicate,
  onDownload,
  folderBadge,
}: DocumentCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const titleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };

  // Focus input when rename mode starts
  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  // Close menu on outside click or scroll
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedButton = menuButtonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setMenuOpen(false);
        setMenuPos(null);
        setShowFolderSubmenu(false);
      }
    }
    function handleScroll() {
      setMenuOpen(false);
      setMenuPos(null);
      setShowFolderSubmenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpen]);

  // After menu renders, measure actual height and shift up if it overflows the viewport
  useLayoutEffect(() => {
    if (!menuOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const overflow = rect.bottom - (window.innerHeight - 8);
    if (overflow > 0) {
      setMenuPos((prev) => prev ? { ...prev, top: Math.max(prev.top - overflow, 8) } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (titleClickTimer.current) {
      // Second click within 300ms — treat as double click → rename
      clearTimeout(titleClickTimer.current);
      titleClickTimer.current = null;
      setRenameValue(doc.title);
      setIsRenaming(true);
    } else {
      // First click — wait to see if a second comes
      titleClickTimer.current = setTimeout(() => {
        titleClickTimer.current = null;
        onNavigate();
      }, 200);
    }
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
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
      setShowFolderSubmenu(false);
      return;
    }
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 192;
      const margin = 8;

      const left = Math.min(
        Math.max(rect.right - menuWidth, margin),
        window.innerWidth - menuWidth - margin
      );

      // Vertical: open below the button — useLayoutEffect will shift up if it overflows
      const top = rect.bottom + 4;

      setMenuPos({ top, left });
    }
    setMenuOpen(true);
  }

  function handleMoveToFolder(folderId: string | null) {
    setMenuOpen(false);
    setShowFolderSubmenu(false);
    onMoveToFolder(folderId);
  }

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    onArchive(!doc.archived_at);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  }

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', doc.id);
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`relative text-left bg-white/10 border border-white/20 rounded-xl p-4
        hover:bg-white/15 hover:border-white/30 backdrop-blur transition-all group cursor-pointer
        ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => {
        if (!isRenaming) onNavigate();
      }}
    >
      {/* Top-right row: folder badge + star — flex so they stay vertically centered */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 max-w-[120px]">
          {folderBadge ? (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: folderBadge.color ?? '#6366f1' }}
            />
          ) : null}
          <span className="text-[10px] text-white/40 truncate">
            {folderBadge ? folderBadge.name : 'none'}
          </span>
        </div>

        {/* Star button */}
        <button
        onClick={handleStarClick}
        className="group/star"
        aria-label={doc.is_starred ? 'Unstar document' : 'Star document'}
        title={doc.is_starred ? 'Remove from starred' : 'Add to starred'}
      >
        {doc.is_starred ? (
          <>
            {/* Filled star — visible by default, preview outline on hover */}
            <svg className="w-4 h-4 text-yellow-400 group-hover/star:hidden transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <svg className="w-4 h-4 text-white/50 hidden group-hover/star:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </>
        ) : (
          /* Outline star — grey, turns yellow on hover */
          <svg className="w-4 h-4 text-white/30 group-hover/star:text-yellow-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        )}
      </button>
      </div>

      {/* Title row */}
      <div className="flex items-start mb-2 pr-28">
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
            className="text-sm font-semibold text-white truncate leading-snug cursor-pointer select-none"
            onClick={handleTitleClick}
          >
            {doc.title}
          </h3>
        )}
      </div>

      {/* Template label + forked badge */}
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-white/50">
          {TEMPLATE_LABELS[doc.template_id] ?? doc.template_id}
        </p>
        {doc.forked_from_id && (
          <span className="text-[10px] text-indigo-400/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-1.5 py-0.5 shrink-0">
            Forked
          </span>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">
            {formatDate(doc.updated_at)}
          </span>

          {/* Three-dot menu — always visible */}
          <div className="-mr-1 flex items-center">
            <button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              className="text-white/30 hover:text-white/80 transition-colors p-0.5 rounded"
              aria-label="More actions"
              title="More actions"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </button>

            {menuOpen && menuPos && typeof window !== 'undefined' && createPortal(
              <div
                ref={menuRef}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9998 }}
                className="w-52 rounded-xl border border-white/15
                  bg-neutral-950/90 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] py-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Grupo 1: Abrir ─────────────────────────────────── */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onNavigate();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/80
                    hover:bg-white/10 hover:text-white transition-colors text-left rounded-lg mx-0"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                  Open
                </button>

                {/* Open in new tab */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    window.open(`/documents/${doc.id}`, '_blank');
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/80
                    hover:bg-white/10 hover:text-white transition-colors text-left rounded-lg mx-0"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Open in new tab
                </button>

                {/* ── Divisor ────────────────────────────────────────── */}
                <div className="h-px bg-white/10 my-1.5 mx-2" />

                {/* ── Grupo 2: Organizar ─────────────────────────────── */}
                {/* Rename */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setRenameValue(doc.title);
                    setIsRenaming(true);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Rename
                </button>

                {/* Move to folder */}
                <button
                  onClick={() => setShowFolderSubmenu(s => !s)}
                  className="flex items-center justify-between gap-2 w-full px-3 py-2 text-xs
                    text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    Move to folder
                  </span>
                  <svg
                    className={`w-3 h-3 shrink-0 text-white/30 transition-transform duration-150 ${showFolderSubmenu ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showFolderSubmenu && (
                  <div className="border-t border-white/10 pt-0.5 pb-0.5">
                    {folders.length === 0 ? (
                      <p className="px-4 py-2 text-xs text-white/30 italic">No folders yet — create one in the panel</p>
                    ) : (
                      <>
                        {folders.map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => handleMoveToFolder(folder.id)}
                            className={`flex items-center gap-2 w-full px-4 py-1.5 text-xs
                              text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left
                              ${doc.folder_id === folder.id ? 'opacity-40 pointer-events-none' : ''}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: folder.color ?? '#6366f1' }}
                            />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        ))}
                        {doc.folder_id !== null && (
                          <button
                            onClick={() => handleMoveToFolder(null)}
                            className="flex items-center gap-2 w-full px-4 py-1.5 text-xs
                              text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 border border-white/30" />
                            <span>No folder</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Star / Unstar */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onStar(!doc.is_starred);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  {doc.is_starred ? (
                    <svg className="w-3.5 h-3.5 shrink-0 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  )}
                  {doc.is_starred ? 'Remove from starred' : 'Add to starred'}
                </button>

                {/* View details */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setShowDetails(true);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  View details
                </button>

                {/* Version history */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    if (onOpenHistory) onOpenHistory();
                    else onNavigate();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Version history
                </button>

                {/* ── Divisor ────────────────────────────────────────── */}
                <div className="h-px bg-white/10 my-1.5 mx-2" />

                {/* ── Grupo 3: Share / Duplicate / Download ──────────── */}
                {/* Share — copy link */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsCopyingLink(true);
                    try {
                      const res = await fetch(`/api/documents/${doc.id}/share`, { method: 'POST' });
                      if (!res.ok) throw new Error('Failed to generate share link');
                      const { token } = await res.json();
                      const url = `${window.location.origin}/share/${token}`;
                      await navigator.clipboard.writeText(url);
                    } catch {
                      const url = `${window.location.origin}/documents/${doc.id}`;
                      await navigator.clipboard.writeText(url).catch(() => {});
                    } finally {
                      setIsCopyingLink(false);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  disabled={isCopyingLink}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                    hover:bg-white/10 hover:text-white transition-colors text-left disabled:opacity-50"
                >
                  {isCopyingLink ? (
                    <span className="w-3.5 h-3.5 shrink-0 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  )}
                  {isCopyingLink ? 'Generating link...' : copiedLink ? 'Copied!' : 'Copy link'}
                </button>

                {/* Duplicate */}
                {onDuplicate && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsDuplicating(true);
                      await onDuplicate();
                      setIsDuplicating(false);
                      setMenuOpen(false);
                    }}
                    disabled={isDuplicating}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                      hover:bg-white/10 hover:text-white transition-colors text-left disabled:opacity-50"
                  >
                    {isDuplicating ? (
                      <span className="w-3.5 h-3.5 shrink-0 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                    )}
                    {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                  </button>
                )}

                {/* Download PDF */}
                {onDownload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDownload();
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
                      hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download PDF
                  </button>
                )}

                {/* ── Divisor ────────────────────────────────────────── */}
                <div className="h-px bg-white/10 my-1.5 mx-2" />

                {/* ── Grupo 4: Acciones destructivas (rojo) ──────────── */}
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-yellow-400/70
                    hover:bg-yellow-500/10 hover:text-yellow-400 transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  {doc.archived_at ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400/70
                    hover:bg-red-500/10 hover:text-red-400 transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal — rendered via portal */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title={doc.title}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Document details modal — rendered via portal */}
      {showDetails && (
        <DocumentDetailsModal
          doc={doc}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
