'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

interface FolderSectionMenuProps {
  folderName: string;
  folderColor: string | null;
  onCreateDocumentInside: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
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

// ── Main component ──────────────────────────────────────────────────────────
export function FolderSectionMenu({
  folderName,
  onCreateDocumentInside,
  onRename,
  onDelete,
}: FolderSectionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
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
      // Position below-left of the button, using viewport coords via portal
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setMenuOpen(true);
  }

  const menu = menuOpen && menuPos ? createPortal(
    <div
      ref={menuRef}
      style={{ top: menuPos.top, left: menuPos.left, position: 'fixed', zIndex: 9998 }}
      className="w-48 rounded-xl border border-white/20 bg-black/80 backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.6)] py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Create document inside */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          onCreateDocumentInside();
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        New document here
      </button>

      <div className="h-px bg-white/10 my-0.5" />

      {/* Rename */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          setShowRenameModal(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70
          hover:bg-white/10 hover:text-white transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        Rename folder
      </button>

      <div className="h-px bg-white/10 my-0.5" />

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(false);
          setShowDeleteConfirm(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-300/80
          hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
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
          transition-all p-1 rounded-lg hover:bg-white/10"
        aria-label={`More actions for folder ${folderName}`}
        title="More actions"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
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
