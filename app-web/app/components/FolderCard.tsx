"use client";

import { useState, useRef, useEffect } from "react";
import { deleteFolder, renameFolder, moveProjectToFolder, type Folder } from "@/lib/api";

interface FolderCardProps {
  folder: Folder;
  projectCount: number;
  onClick: () => void;
  onUpdate: () => void;
}

export default function FolderCard({ folder, projectCount, onClick, onUpdate }: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      await renameFolder(folder.id, trimmed);
      onUpdate();
    }
    setRenaming(false);
  }

  async function handleDelete() {
    await deleteFolder(folder.id);
    setConfirmDelete(false);
    onUpdate();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const projectId = e.dataTransfer.getData("projectId");
    if (!projectId) return;
    await moveProjectToFolder(projectId, folder.id);
    onUpdate();
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragOver(true); }}
        onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false); }}
        onDrop={handleDrop}
        className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-amber-400/60 bg-amber-400/10 scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15"
        }`}
      >
        {/* Cover area */}
        <div
          onClick={onClick}
          className="h-32 rounded-t-2xl overflow-hidden bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent flex items-center justify-center"
        >
          <svg className="h-12 w-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>

        {/* Info */}
        <div className="px-4 py-3" onClick={onClick}>
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={handleRename}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-sm text-white outline-none"
            />
          ) : (
            <h3 className="text-sm font-medium text-white/90 truncate">{folder.name}</h3>
          )}
          <div className="mt-1 text-[11px] text-white/35">
            {projectCount} project{projectCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Kebab menu */}
        <div ref={menuRef} className="absolute top-2 right-2">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="h-7 w-7 rounded-lg bg-black/30 border border-white/10 text-white/40 hover:text-white/80 hover:bg-black/50 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-all"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-xl border border-white/15 bg-neutral-900/95 backdrop-blur shadow-xl py-1 z-50">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setRenameValue(folder.name); setRenaming(true); }}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Rename
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(true); }}
                className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/15 bg-neutral-900 p-5 shadow-2xl max-w-sm w-full mx-4">
            <div className="text-sm font-semibold text-white">Delete folder?</div>
            <div className="mt-2 text-xs text-white/60">
              &ldquo;{folder.name}&rdquo; will be deleted. The projects inside will not be deleted — they will move back to the main view.
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">Cancel</button>
              <button onClick={handleDelete} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
