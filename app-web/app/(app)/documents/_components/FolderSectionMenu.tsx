'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

const COLOR_SWATCHES = [
  { label: 'Indigo',   value: '#6366f1' },
  { label: 'Violet',   value: '#8b5cf6' },
  { label: 'Blue',     value: '#3b82f6' },
  { label: 'Cyan',     value: '#06b6d4' },
  { label: 'Emerald',  value: '#10b981' },
  { label: 'Yellow',   value: '#eab308' },
  { label: 'Orange',   value: '#f97316' },
  { label: 'Red',      value: '#ef4444' },
  { label: 'Pink',     value: '#ec4899' },
  { label: 'Slate',    value: '#64748b' },
];

interface FolderSectionMenuProps {
  folderName: string;
  folderColor: string | null;
  isStarred: boolean;
  isArchived?: boolean;
  onStar: (isStarred: boolean) => void;
  onCreateDocumentInside: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onChangeColor: (newColor: string) => void;
  onDownload: () => void;
  onArchive: () => void;
}

// ── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmDeleteFolderModal({
  folderName,
  onConfirm,
  onCancel,
}: {
  folderName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        <h3 className="text-sm font-semibold text-white mb-1">Delete folder?</h3>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          <span className="text-white/70 font-medium">&quot;{folderName}&quot;</span> will be deleted.
          Documents inside will not be deleted — they will become unfiled.
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
            Delete folder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Inline rename input rendered via portal ─────────────────────────────────
function RenameModal({
  initialName,
  onConfirm,
  onCancel,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-3">Rename folder</h3>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm
            text-white placeholder-white/30 outline-none focus:border-indigo-400 mb-4"
          maxLength={80}
          placeholder="Folder name"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 rounded-lg hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500/80 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Rename
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Color picker modal rendered via portal ──────────────────────────────────
function ColorPickerModal({
  currentColor,
  onConfirm,
  onCancel,
}: {
  currentColor: string | null;
  onConfirm: (color: string) => void;
  onCancel: () => void;
}) {
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
        className="w-full max-w-xs bg-neutral-900 border border-white/15 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-4">Change folder color</h3>
        <div className="grid grid-cols-5 gap-2.5">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              title={swatch.label}
              onClick={() => onConfirm(swatch.value)}
              className="w-9 h-9 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40 relative"
              style={{ backgroundColor: swatch.value }}
            >
              {currentColor === swatch.value && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 rounded-lg hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function FolderSectionMenu({
  folderName,
  folderColor,
  isStarred,
  isArchived = false,
  onStar,
  onCreateDocumentInside,
  onRename,
  onDelete,
  onChangeColor,
  onDownload,
  onArchive,
}: FolderSectionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

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

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Estimated menu height (8 items + 4 dividers): ~280px
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight + 8;
      setMenuPos(
        openUpward
          ? { top: rect.top - menuHeight - 4, left: rect.right - 192 }
          : { top: rect.bottom + 4, left: rect.right - 192 }
      );
    }
    setMenuOpen(true);
  }

  async function handleDownloadClick(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      onDownload();
    } finally {
      setIsDownloading(false);
    }
  }

  const menu = menuOpen && menuPos ? createPortal(
    <div
      ref={menuRef}
      style={{ top: menuPos.top, left: menuPos.left, position: 'fixed', zIndex: 9998 }}
      className="w-52 rounded-xl border border-white/15 bg-neutral-950/90 backdrop-blur-xl
        shadow-[0_8px_40px_rgba(0,0,0,0.7)] py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Grupo 1: Crear ─────────────────────────────────── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          onCreateDocumentInside();
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/80
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        New document here
      </button>

      {/* ── Divisor ────────────────────────────────────────── */}
      <div className="h-px bg-white/10 my-1.5 mx-2" />

      {/* ── Grupo 2: Organizar ─────────────────────────────── */}
      {/* Star / Unstar */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          onStar(!isStarred);
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <svg
          className={`w-3.5 h-3.5 shrink-0 ${isStarred ? 'text-yellow-400' : 'text-white/40'}`}
          viewBox="0 0 24 24"
          fill={isStarred ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        {isStarred ? 'Remove from starred' : 'Add to starred'}
      </button>

      {/* Rename */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          setShowRenameModal(true);
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        Rename folder
      </button>

      {/* Change color */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          setShowColorPicker(true);
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <span
          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
          style={{ backgroundColor: folderColor ?? '#6366f1' }}
        />
        Change color
      </button>

      {/* ── Divisor ────────────────────────────────────────── */}
      <div className="h-px bg-white/10 my-1.5 mx-2" />

      {/* ── Grupo 3: Descargar + Compartir ─────────────────── */}
      {/* Download as ZIP (individual PDFs) */}
      <button
        onClick={handleDownloadClick}
        disabled={isDownloading}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left disabled:opacity-50 disabled:cursor-wait"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Download PDFs
      </button>

      {/* Share — disabled */}
      <div
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/40
          cursor-not-allowed opacity-60"
        aria-disabled="true"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Share folder
        <span className="ml-auto text-[10px] font-medium bg-white/10 text-white/40 px-1.5 py-0.5 rounded-md">
          Soon
        </span>
      </div>

      {/* ── Divisor ────────────────────────────────────────── */}
      <div className="h-px bg-white/10 my-1.5 mx-2" />

      {/* ── Grupo 4: Archivo + Eliminar ─────────────────────── */}
      {/* Archive / Unarchive */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          onArchive();
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-yellow-500/80
          hover:bg-yellow-500/10 hover:text-yellow-400 transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        {isArchived ? 'Unarchive folder' : 'Archive folder'}
      </button>

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          setShowDeleteConfirm(true);
        }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400/70
          hover:bg-red-500/10 hover:text-red-400 transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete folder
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger button — visible on hover of parent group */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80
          transition-all p-1 rounded-md hover:bg-white/10"
        aria-label={`More actions for folder ${folderName}`}
        title="More actions"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      </button>

      {/* Portal menu */}
      {menu}

      {/* Modals */}
      {showRenameModal && (
        <RenameModal
          initialName={folderName}
          onConfirm={(newName) => {
            setShowRenameModal(false);
            onRename(newName);
          }}
          onCancel={() => setShowRenameModal(false)}
        />
      )}

      {showColorPicker && (
        <ColorPickerModal
          currentColor={folderColor}
          onConfirm={(color) => {
            setShowColorPicker(false);
            onChangeColor(color);
          }}
          onCancel={() => setShowColorPicker(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDeleteFolderModal
          folderName={folderName}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
