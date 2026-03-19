'use client';

import { useEffect, useRef, useState } from 'react';

export interface Folder {
  id: string;
  name: string;
  color: string | null;
  document_count: number;
  created_at: string;
}

interface FolderPanelProps {
  folders: Folder[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onFoldersChange: (folders: Folder[]) => void;
  onDropDocument: (docId: string, folderId: string) => void;
}

export function FolderPanel({
  folders,
  activeFolderId,
  onSelectFolder,
  onFoldersChange,
  onDropDocument,
}: FolderPanelProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) newInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) { setIsCreating(false); return; }
    setCreateError(null);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data?.error ?? 'Failed to create folder');
        return;
      }
      const data = await res.json();
      const created: Folder = { ...data.folder, document_count: 0 };
      onFoldersChange([...folders, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setIsCreating(false);
    } catch {
      setCreateError('Something went wrong');
    }
  }

  async function handleRenameFolder(folder: Folder) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === folder.name) return;
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        onFoldersChange(
          folders
            .map((f) => (f.id === folder.id ? { ...f, name } : f))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    } catch {
      // silent — state unchanged, folder name remains as-is
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    if (!confirm(`Delete folder "${folder.name}"? Documents inside will not be deleted.`)) return;
    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' });
      if (res.ok) {
        onFoldersChange(folders.filter((f) => f.id !== folder.id));
        if (activeFolderId === folder.id) onSelectFolder(null);
      }
    } catch {
      // silent
    }
  }

  if (collapsed) {
    return (
      <div className="shrink-0 flex flex-col items-center pt-4 px-2 gap-3
        bg-black/30 backdrop-blur border-r border-white/10 w-10">
        <button
          onClick={() => setCollapsed(false)}
          className="text-white/40 hover:text-white/80 transition-colors"
          title="Expand folders"
          aria-label="Expand folders panel"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 w-52 flex flex-col bg-black/30 backdrop-blur border-r border-white/10 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Folders</span>
        <div className="flex items-center gap-1">
          {/* New folder button */}
          <button
            onClick={() => { setIsCreating(true); setNewFolderName(''); setCreateError(null); }}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded"
            title="New folder"
            aria-label="Create new folder"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(true)}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded"
            title="Collapse panel"
            aria-label="Collapse folders panel"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* "All documents" entry */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg mx-1 transition-colors ${
            activeFolderId === null
              ? 'bg-white/15 text-white font-medium'
              : 'text-white/60 hover:bg-white/8 hover:text-white/80'
          }`}
          style={{ width: 'calc(100% - 8px)' }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="truncate">All documents</span>
        </button>

        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`group flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg mx-1 transition-colors
              cursor-pointer select-none border ${
              dragOverFolderId === folder.id
                ? 'bg-indigo-500/20 border-indigo-400/50 text-white'
                : activeFolderId === folder.id
                ? 'bg-white/15 border-transparent text-white font-medium'
                : 'text-white/60 hover:bg-white/8 hover:text-white/80 border-transparent'
            }`}
            style={{ width: 'calc(100% - 8px)' }}
            onClick={() => { if (renamingId !== folder.id) onSelectFolder(folder.id); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverFolderId(null);
              const docId = e.dataTransfer.getData('text/plain');
              if (docId) onDropDocument(docId, folder.id);
            }}
          >
            {/* Folder color dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: folder.color ?? '#6366f1' }}
            />

            {/* Name / rename input */}
            {renamingId === folder.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameFolder(folder)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder(folder);
                  else if (e.key === 'Escape') setRenamingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-white/10 border border-white/30 rounded px-1 py-0.5
                  text-white outline-none focus:border-indigo-400 text-xs"
                maxLength={80}
              />
            ) : (
              <span
                className="flex-1 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(folder.id);
                  setRenameValue(folder.name);
                }}
                title="Double-click to rename"
              >
                {folder.name}
              </span>
            )}

            {/* Count badge */}
            {renamingId !== folder.id && folder.document_count > 0 && (
              <span className="shrink-0 text-white/30 text-[10px]">{folder.document_count}</span>
            )}

            {/* Delete button — shows on hover */}
            {renamingId !== folder.id && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400
                  transition-all p-0.5 rounded"
                aria-label={`Delete folder ${folder.name}`}
                title="Delete folder"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* New folder input */}
        {isCreating && (
          <div className="px-2 py-1">
            <input
              ref={newInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleCreateFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                else if (e.key === 'Escape') { setIsCreating(false); setNewFolderName(''); }
              }}
              placeholder="Folder name..."
              className="w-full bg-white/10 border border-white/30 rounded-lg px-2 py-1.5
                text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400"
              maxLength={80}
            />
            {createError && (
              <p className="text-[10px] text-red-400 mt-1 px-1">{createError}</p>
            )}
          </div>
        )}

        {folders.length === 0 && !isCreating && (
          <p className="px-3 py-4 text-xs text-white/30 text-center">
            No folders yet.
            <br />
            <button
              onClick={() => setIsCreating(true)}
              className="underline underline-offset-2 hover:text-white/50 transition-colors mt-1"
            >
              Create one
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
