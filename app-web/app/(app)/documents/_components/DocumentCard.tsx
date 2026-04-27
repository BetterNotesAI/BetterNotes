'use client';

import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getTemplateThumbnailSrc } from '@/lib/template-thumbnails';
import { useTranslation } from '@/lib/i18n';

export interface DocumentItem {
  id: string;
  title: string;
  template_id: string;
  status: string;
  is_starred: boolean;
  archived_at: string | null;
  folder_id: string | null;
  section_id?: string | null;
  created_at: string;
  updated_at: string;
  forked_from_id?: string | null;
}

// ── Shared constants ────────────────────────────────────────────────────────
function buildStatusLabels(t: (key: string) => string): Record<string, { label: string; color: string }> {
  return {
    draft: { label: t('documents.card.status.draft'), color: 'text-gray-500' },
    generating: { label: t('documents.card.status.generating'), color: 'text-blue-400 animate-pulse' },
    ready: { label: t('documents.card.status.ready'), color: 'text-green-500' },
    error: { label: t('documents.card.status.error'), color: 'text-red-500' },
  };
}

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

type DocumentKind = 'cheatsheet' | 'problem' | 'notes' | 'exam';

const DOCUMENT_KIND_META: Record<DocumentKind, {
  title: string;
  className: string;
  icon: ReactNode;
}> = {
  cheatsheet: {
    title: 'CheatSheet document',
    className: 'text-cyan-300 bg-cyan-400/15 border-cyan-300/25 shadow-[0_0_18px_rgba(34,211,238,0.14)]',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 5.75h5.5v5.5h-5.5zM13.75 5.75h5.5v5.5h-5.5zM4.75 14.75h5.5v3.5h-5.5zM13.75 14.75h5.5v3.5h-5.5z" />
      </svg>
    ),
  },
  problem: {
    title: 'Problem document',
    className: 'text-amber-300 bg-amber-400/15 border-amber-300/25 shadow-[0_0_18px_rgba(251,191,36,0.13)]',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 5.75h7.5M8.25 18.25h7.5M9.5 5.75l5 12.5M7.25 10h9.5M6.5 14h11" />
      </svg>
    ),
  },
  notes: {
    title: 'Notes document',
    className: 'text-sky-300 bg-sky-400/15 border-sky-300/25 shadow-[0_0_18px_rgba(56,189,248,0.13)]',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 4.75h8.25l2.25 2.25v12.25H6.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.75 4.75v2.5h2.5M9 11h6M9 14h6M9 17h3.25" />
      </svg>
    ),
  },
  exam: {
    title: 'Exam document',
    className: 'text-rose-300 bg-rose-400/15 border-rose-300/25 shadow-[0_0_18px_rgba(251,113,133,0.13)]',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 5.75h6.5M9.5 4.25h5a1.25 1.25 0 0 1 1.25 1.25v1H8.25v-1A1.25 1.25 0 0 1 9.5 4.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 6.5H5.75v13h12.5v-13H17M8.75 12.25l1.75 1.75 4-4M9 17h6" />
      </svg>
    ),
  },
};

const TEMPLATE_THUMBNAIL_IDS = new Set([
  '2cols_portrait',
  'landscape_3col_maths',
  'clean_3cols_landscape',
  'cornell',
  'zettelkasten',
  'academic_paper',
  'lab_report',
  'data_analysis',
  'study_form',
  'lecture_notes',
  'classic_lecture_notes',
]);

function getDocumentKind(templateId: string): DocumentKind {
  if (templateId === 'problem_solving' || templateId.includes('problem')) return 'problem';
  if (templateId === 'exam' || templateId === 'exams' || templateId.includes('exam')) return 'exam';
  if (
    templateId === '2cols_portrait' ||
    templateId === 'landscape_3col_maths' ||
    templateId === 'clean_3cols_landscape' ||
    templateId === 'study_form'
  ) {
    return 'cheatsheet';
  }
  return 'notes';
}

function DocumentVisual({
  templateId,
  kind,
}: {
  templateId: string;
  kind: DocumentKind;
}) {
  const meta = DOCUMENT_KIND_META[kind];
  const thumbnailSrc = TEMPLATE_THUMBNAIL_IDS.has(templateId) && kind !== 'problem' && kind !== 'exam'
    ? getTemplateThumbnailSrc(templateId)
    : null;

  if (thumbnailSrc) {
    return (
      <div
        className="relative w-[58px] h-[74px] shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white/8 shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
        title={meta.title}
        aria-label={meta.title}
      >
        <Image
          src={thumbnailSrc}
          alt=""
          fill
          sizes="58px"
          className="object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-[58px] h-[74px] shrink-0 rounded-lg border flex items-center justify-center ${meta.className}`}
      title={meta.title}
      aria-label={meta.title}
    >
      <span className="scale-[1.65]">{meta.icon}</span>
    </div>
  );
}

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
  const { t } = useTranslation();
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const STATUS_LABELS = buildStatusLabels(t);
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
            <p className="text-xs text-white/40 mt-0.5">{t('documents.card.details.title')}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-white/30 hover:text-white/70 transition-colors p-0.5 rounded-md hover:bg-white/8"
            aria-label={t('documents.card.details.close')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">{t('documents.card.details.template')}</span>
            <span className="text-xs text-white/80 font-medium">{templateLabel}</span>
          </div>
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">{t('documents.card.details.status')}</span>
            <span className={`text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">{t('documents.card.details.created')}</span>
            <span className="text-xs text-white/70">{formatDateLong(doc.created_at)}</span>
          </div>
          {doc.updated_at && (
            <>
              <div className="h-px bg-white/8" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{t('documents.card.details.lastModified')}</span>
                <span className="text-xs text-white/70">{formatDateLong(doc.updated_at)}</span>
              </div>
            </>
          )}
          <div className="h-px bg-white/8" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">{t('documents.card.details.documentId')}</span>
            <span className="text-xs text-white/30 font-mono truncate max-w-[160px]">{doc.id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="w-full px-3 py-2 text-xs text-white/60 hover:text-white/80 rounded-xl hover:bg-white/8 transition-colors border border-white/10"
          >
            {t('documents.card.details.close')}
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
  const { t } = useTranslation();
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
        <h3 className="text-sm font-semibold text-white mb-1">{t('documents.card.delete.title')}</h3>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          {t('documents.card.delete.body', { title })}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 rounded-lg hover:bg-white/8 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
          >
            {t('common.delete')}
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

interface SectionOption {
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
  sections?: SectionOption[];
  onMoveToSection?: (sectionId: string | null) => void;
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
  sections,
  onMoveToSection,
  onDuplicate,
  onDownload,
  folderBadge,
}: DocumentCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const [showSectionSubmenu, setShowSectionSubmenu] = useState(false);
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
  const { t } = useTranslation();

  const STATUS_LABELS = buildStatusLabels(t);
  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: 'text-gray-500' };
  const documentKind = getDocumentKind(doc.template_id);
  const showStatus = doc.status !== 'ready';

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
        setShowSectionSubmenu(false);
      }
    }
    function handleScroll() {
      setMenuOpen(false);
      setMenuPos(null);
      setShowFolderSubmenu(false);
      setShowSectionSubmenu(false);
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
      setShowSectionSubmenu(false);
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
    setShowSectionSubmenu(false);
    onMoveToFolder(folderId);
  }

  function handleMoveToSection(sectionId: string | null) {
    if (!onMoveToSection) return;
    setMenuOpen(false);
    setShowFolderSubmenu(false);
    setShowSectionSubmenu(false);
    onMoveToSection(sectionId);
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
      className={`relative text-left bg-white/10 border border-white/20 rounded-xl px-4 py-3
        hover:bg-white/15 hover:border-white/30 backdrop-blur transition-all group cursor-pointer
        ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => {
        if (!isRenaming) onNavigate();
      }}
    >
      <div className="flex min-h-[78px] gap-3">
        <DocumentVisual templateId={doc.template_id} kind={documentKind} />

        <div className="min-w-0 flex-1 flex flex-col">
          <div className="min-w-0">
            {isRenaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-white bg-white/10 border border-white/30
                  rounded px-1.5 py-0.5 outline-none focus:border-indigo-400 min-w-0 w-full leading-snug"
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

            <div className="mt-1 flex items-center gap-2 min-w-0">
              <p className="text-xs text-white/48 truncate">
                {TEMPLATE_LABELS[doc.template_id] ?? doc.template_id}
              </p>
              {doc.forked_from_id && (
                <span className="text-[10px] text-indigo-300/75 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-1.5 py-0.5 shrink-0">
                  {t('documents.card.forked')}
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                {showStatus && (
                  <span className={`text-xs font-medium shrink-0 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
                {folderBadge && (
                  <div className="flex items-center gap-1.5 min-w-0 max-w-[132px] px-2 py-1 rounded-md bg-white/[0.06] border border-white/10">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: folderBadge.color ?? '#6366f1' }}
                    />
                    <span className="text-[10px] text-white/45 truncate">{folderBadge.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleStarClick}
                  className="group/star p-0.5 rounded hover:bg-white/8 transition-colors"
                  aria-label={doc.is_starred ? t('documents.card.unstarDocument') : t('documents.card.starDocument')}
                  title={doc.is_starred ? t('documents.card.removeFromStarred') : t('documents.card.addToStarred')}
                >
                  {doc.is_starred ? (
                    <>
                      <svg className="w-4 h-4 text-yellow-400 group-hover/star:hidden transition-colors" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      <svg className="w-4 h-4 text-white/50 hidden group-hover/star:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </>
                  ) : (
                    <svg className="w-4 h-4 text-white/30 group-hover/star:text-yellow-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-white/30">
                  {formatDate(doc.updated_at)}
                </span>
                <div className="-mr-1 flex items-center">
                  <button
                    ref={menuButtonRef}
                    onClick={handleMenuToggle}
                    className="text-white/30 hover:text-white/80 transition-colors p-0.5 rounded"
                    aria-label={t('documents.card.moreActions')}
                    title={t('documents.card.moreActions')}
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
                  {t('documents.card.open')}
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
                  {t('documents.card.openNewTab')}
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
                  {t('documents.card.rename')}
                </button>

                {/* Move to folder */}
                <button
                  onClick={() => {
                    setShowFolderSubmenu(s => !s);
                    setShowSectionSubmenu(false);
                  }}
                  className="flex items-center justify-between gap-2 w-full px-3 py-2 text-xs
                    text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    {t('documents.card.moveToFolder')}
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
                      <p className="px-4 py-2 text-xs text-white/30 italic">{t('documents.card.noFoldersYet')}</p>
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
                            <span>{t('documents.card.noFolder')}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {sections && onMoveToSection && (
                  <>
                    <button
                      onClick={() => {
                        setShowSectionSubmenu(s => !s);
                        setShowFolderSubmenu(false);
                      }}
                      className="flex items-center justify-between gap-2 w-full px-3 py-2 text-xs
                        text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h6.75l1.5 1.5h8.25v9a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6.75z" />
                        </svg>
                        {t('documents.card.moveInsideNotebook')}
                      </span>
                      <svg
                        className={`w-3 h-3 shrink-0 text-white/30 transition-transform duration-150 ${showSectionSubmenu ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showSectionSubmenu && (
                      <div className="border-t border-white/10 pt-0.5 pb-0.5">
                        {sections.length === 0 ? (
                          <p className="px-4 py-2 text-xs text-white/30 italic">{t('documents.card.noInternalFolders')}</p>
                        ) : (
                          sections.map(section => (
                            <button
                              key={section.id}
                              onClick={() => handleMoveToSection(section.id)}
                              className={`flex items-center gap-2 w-full px-4 py-1.5 text-xs
                                text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left
                                ${doc.section_id === section.id ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: section.color ?? '#8b5cf6' }}
                              />
                              <span className="truncate">{section.name}</span>
                            </button>
                          ))
                        )}
                        {doc.section_id && (
                          <button
                            onClick={() => handleMoveToSection(null)}
                            className="flex items-center gap-2 w-full px-4 py-1.5 text-xs
                              text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 border border-white/30" />
                            <span>{t('documents.card.unfiled')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </>
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
                  {doc.is_starred ? t('documents.card.removeFromStarred') : t('documents.card.addToStarred')}
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
                  {t('documents.card.viewDetails')}
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
                  {t('documents.card.versionHistory')}
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
                  {isCopyingLink ? t('documents.card.generatingLink') : copiedLink ? t('documents.card.copied') : t('documents.card.copyLink')}
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
                    {isDuplicating ? t('documents.card.duplicating') : t('documents.card.duplicate')}
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
                    {t('documents.card.downloadPdf')}
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
                  {doc.archived_at ? t('documents.card.unarchive') : t('documents.card.archive')}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400/70
                    hover:bg-red-500/10 hover:text-red-400 transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('documents.card.delete')}
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
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
