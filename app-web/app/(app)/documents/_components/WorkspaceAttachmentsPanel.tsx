'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_MB,
} from '@/lib/upload-limits';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttachmentFolder {
  id: string;
  name: string;
  createdAt: string;
}

interface WorkspaceAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  folderId?: string | null;
}

interface WorkspaceAttachmentsPanelProps {
  documentId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_ATTACHMENTS = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 6) {
    const extPart = name.slice(ext);
    const basePart = name.slice(0, max - extPart.length - 1);
    return `${basePart}\u2026${extPart}`;
  }
  return `${name.slice(0, max - 1)}\u2026`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return (
      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 17h6" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Compact dropzone
// ---------------------------------------------------------------------------

interface CompactDropzoneProps {
  isDisabled: boolean;
  isUploading: boolean;
  isMaxReached: boolean;
  onFile: (file: File) => void;
}

function CompactDropzone({ isDisabled, isUploading, isMaxReached, onFile }: CompactDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleClick() {
    if (isDisabled) return;
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Only accept file drags (not attachment row drags)
    if (e.dataTransfer.types.includes('application/x-attachment-id')) return;
    e.preventDefault();
    if (!isDisabled) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.types.includes('application/x-attachment-id')) return;
    e.preventDefault();
    setIsDragOver(false);
    if (isDisabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <>
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Upload attachment"
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg py-3 text-center transition-all select-none
          ${isDisabled
            ? 'border-white/10 bg-white/[0.02] cursor-not-allowed opacity-50'
            : isDragOver
              ? 'border-indigo-400/60 bg-indigo-500/10 cursor-pointer'
              : 'border-white/20 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05] cursor-pointer'
          }`}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin shrink-0" />
            <p className="text-xs text-gray-400">Uploading...</p>
          </div>
        ) : isMaxReached ? (
          <p className="text-xs text-gray-500">Maximum {MAX_ATTACHMENTS} files reached</p>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs text-gray-400">Drop files or click to upload</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Move-to-folder dropdown — rendered in a portal to escape overflow clipping
// ---------------------------------------------------------------------------

interface MoveFolderDropdownProps {
  folders: AttachmentFolder[];
  currentFolderId: string | null | undefined;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}

function MoveFolderDropdown({ folders, currentFolderId, anchorRef, onMove, onClose }: MoveFolderDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  // Calculate position from anchor on mount
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  if (!coords) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 9999 }}
      className="min-w-[150px] bg-neutral-950/95 border border-white/15 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden"
    >
      <button
        onClick={() => onMove(null)}
        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors
          ${currentFolderId == null
            ? 'text-indigo-300 bg-indigo-500/10'
            : 'text-white/60 hover:text-white/90 hover:bg-white/[0.06]'
          }`}
      >
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        No folder
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onMove(folder.id)}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors
            ${currentFolderId === folder.id
              ? 'text-indigo-300 bg-indigo-500/10'
              : 'text-white/60 hover:text-white/90 hover:bg-white/[0.06]'
            }`}
        >
          <svg className="w-3 h-3 shrink-0 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span className="truncate">{folder.name}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Attachment row (draggable)
// ---------------------------------------------------------------------------

interface AttachmentRowProps {
  attachment: WorkspaceAttachment;
  folders: AttachmentFolder[];
  isDeleting: boolean;
  deletingDisabled: boolean;
  isDragging: boolean;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onDragStart: (attachmentId: string) => void;
  onDragEnd: () => void;
}

function AttachmentRow({
  attachment, folders, isDeleting, deletingDisabled, isDragging,
  onDelete, onMove, onDragStart, onDragEnd,
}: AttachmentRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const folderBtnRef = useRef<HTMLButtonElement>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel confirm state after 3s
  useEffect(() => {
    if (confirmDelete) {
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [confirmDelete]);

  // Cancel confirm if mouse leaves the row
  function handleMouseLeave() {
    setIsHovered(false);
    setConfirmDelete(false);
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-attachment-id', attachment.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(attachment.id);
      }}
      onDragEnd={onDragEnd}
      className={`relative flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs group
        cursor-grab active:cursor-grabbing transition-all duration-150 select-none
        ${isDragging
          ? 'opacity-40 border-indigo-400/40 bg-indigo-500/10'
          : 'bg-white/[0.06] border-white/10 hover:border-white/20'
        }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <FileTypeIcon mimeType={attachment.mimeType} />

      <span className="flex-1 text-gray-200 truncate min-w-0" title={attachment.name}>
        {truncateName(attachment.name, 24)}
      </span>

      <span className="text-white/35 shrink-0 tabular-nums">
        {formatBytes(attachment.sizeBytes)}
      </span>

      {/* Move-to-folder button */}
      {folders.length > 0 && (
        <div className="relative shrink-0">
          <button
            ref={folderBtnRef}
            onClick={() => setShowMoveDropdown((v) => !v)}
            aria-label={`Move ${attachment.name} to folder`}
            className={`transition-all duration-150
              ${isHovered || showMoveDropdown ? 'opacity-100' : 'opacity-0'}
              ${showMoveDropdown ? 'text-indigo-400' : 'text-white/30 hover:text-white/60'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </button>
          {showMoveDropdown && (
            <MoveFolderDropdown
              folders={folders}
              currentFolderId={attachment.folderId}
              anchorRef={folderBtnRef}
              onMove={(folderId) => {
                onMove(folderId);
                setShowMoveDropdown(false);
              }}
              onClose={() => setShowMoveDropdown(false)}
            />
          )}
        </div>
      )}

      {/* Separator */}
      {(isHovered || isDeleting) && (
        <span className="shrink-0 w-px h-3 bg-white/15" />
      )}

      {/* Delete button — two-step confirmation */}
      <button
        onClick={handleDeleteClick}
        disabled={deletingDisabled}
        aria-label={confirmDelete ? `Confirm delete ${attachment.name}` : `Remove ${attachment.name}`}
        className={`shrink-0 transition-all duration-150 rounded px-1 py-0.5
          ${isHovered || isDeleting ? 'opacity-100' : 'opacity-0'}
          ${confirmDelete
            ? 'text-red-400 bg-red-500/15 border border-red-500/30 text-[10px] font-medium'
            : 'text-white/40 hover:text-red-400'
          }
          disabled:cursor-not-allowed`}
      >
        {isDeleting ? (
          <span className="w-3 h-3 border border-white/25 border-t-white/60 rounded-full animate-spin block" />
        ) : confirmDelete ? (
          'Delete?'
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder section (collapsible, drop target)
// ---------------------------------------------------------------------------

interface FolderSectionProps {
  folder: AttachmentFolder;
  attachments: WorkspaceAttachment[];
  allFolders: AttachmentFolder[];
  deletingId: string | null;
  draggingId: string | null;
  onDelete: (attachmentId: string) => void;
  onMove: (attachmentId: string, folderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDragStart: (attachmentId: string) => void;
  onDragEnd: () => void;
}

function FolderSection({
  folder, attachments, allFolders, deletingId, draggingId,
  onDelete, onMove, onRenameFolder, onDeleteFolder, onDragStart, onDragEnd,
}: FolderSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (confirmDelete) {
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); };
  }, [confirmDelete]);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(folder.id, trimmed);
    }
    setIsRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); }
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      setConfirmDelete(false);
      onDeleteFolder(folder.id);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('application/x-attachment-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the folder section entirely (not entering a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const attachmentId = e.dataTransfer.getData('application/x-attachment-id');
    if (!attachmentId) return;
    onDragEnd(); // clear draggingId before re-render so new position doesn't inherit drag style
    onMove(attachmentId, folder.id);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border rounded-lg overflow-hidden transition-colors duration-150
        ${isDragOver
          ? 'border-indigo-400/50 bg-indigo-500/10'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}
    >
      {/* Folder header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 group/header"
        onMouseLeave={() => setConfirmDelete(false)}
      >
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          aria-expanded={isOpen}
        >
          <svg
            className={`w-3 h-3 text-white/40 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>

          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-black/30 border border-white/20 rounded px-1.5 py-0.5
                text-xs text-white/80 placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
            />
          ) : (
            <span className="text-xs text-white/60 font-medium truncate">
              {folder.name}
              <span className="ml-1 text-white/30">({attachments.length})</span>
            </span>
          )}
        </button>

        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => { setRenameValue(folder.name); setIsRenaming(true); }}
              aria-label={`Rename folder ${folder.name}`}
              className="p-0.5 text-white/30 hover:text-white/70 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {confirmDelete ? (
              <button
                onClick={handleDeleteClick}
                className="h-5 px-1.5 flex items-center rounded text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Delete?
              </button>
            ) : (
              <button
                onClick={handleDeleteClick}
                aria-label={`Delete folder ${folder.name}`}
                className="p-0.5 text-white/30 hover:text-red-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Folder contents */}
      {isOpen && attachments.length > 0 && (
        <div className="flex flex-col gap-1 px-2.5 pb-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              folders={allFolders}
              isDeleting={deletingId === attachment.id}
              deletingDisabled={!!deletingId}
              isDragging={draggingId === attachment.id}
              onDelete={() => onDelete(attachment.id)}
              onMove={(folderId) => onMove(attachment.id, folderId)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}

      {isOpen && attachments.length === 0 && (
        <p className={`px-2.5 pb-2 text-xs transition-colors ${isDragOver ? 'text-indigo-400/60' : 'text-white/20'}`}>
          {isDragOver ? 'Drop here' : 'Empty folder'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspaceAttachmentsPanel({ documentId }: WorkspaceAttachmentsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [attachments, setAttachments] = useState<WorkspaceAttachment[]>([]);
  const [folders, setFolders] = useState<AttachmentFolder[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [unfiledDragOver, setUnfiledDragOver] = useState(false);

  // Load attachments
  const loadAttachments = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/attachments`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setIsFetching(false);
    }
  }, [documentId]);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/attachment-folders`);
      if (!res.ok) return;
      const data = await res.json();
      setFolders(data.folders ?? []);
    } catch {
      // non-critical
    }
  }, [documentId]);

  useEffect(() => {
    loadAttachments();
    loadFolders();
  }, [loadAttachments, loadFolders]);

  // Create folder
  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) { setIsCreatingFolder(false); return; }
    try {
      const res = await fetch(`/api/documents/${documentId}/attachment-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFolders((prev) => [...prev, data.folder as AttachmentFolder]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  }

  // Rename folder
  async function handleRenameFolder(folderId: string, name: string) {
    const previousName = folders.find((f) => f.id === folderId)?.name ?? name;
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name } : f));
    try {
      const res = await fetch(`/api/documents/${documentId}/attachment-folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name: previousName } : f));
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
      loadFolders();
    }
  }

  // Delete folder
  async function handleDeleteFolder(folderId: string) {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setAttachments((prev) => prev.map((a) => a.folderId === folderId ? { ...a, folderId: null } : a));
    try {
      const res = await fetch(`/api/documents/${documentId}/attachment-folders/${folderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
      loadFolders();
      loadAttachments();
    }
  }

  // Move attachment to folder
  async function handleMoveAttachment(attachmentId: string, folderId: string | null) {
    setAttachments((prev) => prev.map((a) => a.id === attachmentId ? { ...a, folderId } : a));
    try {
      const res = await fetch(`/api/documents/${documentId}/attachments/${attachmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move attachment');
      loadAttachments();
    }
  }

  // Upload
  async function handleUploadFile(file: File) {
    if (attachments.length >= MAX_ATTACHMENTS || isUploading) return;
    const currentTotalBytes = attachments.reduce(
      (acc, a) => acc + (typeof a.sizeBytes === 'number' ? a.sizeBytes : 0),
      0
    );

    if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.`);
      return;
    }

    if (currentTotalBytes + file.size > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
      setError(`Project file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per project.`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (HTTP ${uploadRes.status})`);
      }

      const { storagePath, name, mimeType, sizeBytes } = await uploadRes.json();

      const registerRes = await fetch(`/api/documents/${documentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, name, mimeType, sizeBytes }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json().catch(() => ({}));
        throw new Error(data.error ?? `Register failed (HTTP ${registerRes.status})`);
      }

      const { attachment } = await registerRes.json();
      setAttachments((prev) => [...prev, attachment as WorkspaceAttachment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  // Delete attachment
  async function handleDelete(attachmentId: string) {
    if (deletingId) return;
    setDeletingId(attachmentId);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Delete failed (HTTP ${res.status})`);
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const isMaxReached = attachments.length >= MAX_ATTACHMENTS;
  const count = attachments.length;
  const totalBytes = attachments.reduce((acc, a) => acc + (typeof a.sizeBytes === 'number' ? a.sizeBytes : 0), 0);
  const unfiledAttachments = attachments.filter((a) => !a.folderId);
  const attachmentsByFolder = (folderId: string) => attachments.filter((a) => a.folderId === folderId);

  // Shared drag handlers for AttachmentRow
  const handleDragStart = (attachmentId: string) => setDraggingId(attachmentId);
  const handleDragEnd = () => { setDraggingId(null); setUnfiledDragOver(false); };

  return (
    <div className="shrink-0 border-b border-l border-white/10">
      {/* Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/20 hover:bg-white/[0.04]
          transition-colors duration-150 backdrop-blur-sm"
        aria-expanded={isOpen}
        style={{ minHeight: '44px' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-white/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-xs font-medium text-white/70">
            Attachments
            {isFetching ? (
              <span className="ml-1.5 text-white/30">...</span>
            ) : (
              <span className="ml-1.5 text-white/40">({count})</span>
            )}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="bg-black/20 backdrop-blur-sm px-3 pb-3 pt-2 flex flex-col gap-2">

          {/* New Folder button */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Folder
            </button>
          </div>

          {/* Inline folder creation */}
          {isCreatingFolder && (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
                }}
                placeholder="Folder name..."
                className="flex-1 bg-black/30 border border-white/20 rounded-lg px-2 py-1 text-xs text-white/80
                  placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
              />
              <button onClick={handleCreateFolder} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Add</button>
              <button onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors">✕</button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between gap-2 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">
              <p className="text-xs text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 transition-colors shrink-0" aria-label="Dismiss error">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Fetching skeleton */}
          {isFetching && (
            <div className="flex items-center gap-2 py-1">
              <span className="w-3.5 h-3.5 border-2 border-white/15 border-t-indigo-400 rounded-full animate-spin shrink-0" />
              <span className="text-xs text-white/30">Loading...</span>
            </div>
          )}

          {/* Folder sections */}
          {!isFetching && folders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {folders.map((folder) => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  attachments={attachmentsByFolder(folder.id)}
                  allFolders={folders}
                  deletingId={deletingId}
                  draggingId={draggingId}
                  onDelete={handleDelete}
                  onMove={handleMoveAttachment}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {/* Unfiled attachments — also a drop target */}
          {!isFetching && unfiledAttachments.length > 0 && (
            <div
              className={`flex flex-col gap-1 rounded-lg transition-colors duration-150 ${unfiledDragOver ? 'bg-indigo-500/10' : ''}`}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('application/x-attachment-id')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setUnfiledDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                  setUnfiledDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setUnfiledDragOver(false);
                const attachmentId = e.dataTransfer.getData('application/x-attachment-id');
                if (attachmentId) { handleDragEnd(); handleMoveAttachment(attachmentId, null); }
              }}
            >
              {folders.length > 0 && (
                <p className={`text-xs px-0.5 transition-colors ${unfiledDragOver ? 'text-indigo-400/70' : 'text-white/30'}`}>
                  Documents ({unfiledAttachments.length})
                </p>
              )}
              {unfiledAttachments.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  folders={folders}
                  isDeleting={deletingId === attachment.id}
                  deletingDisabled={!!deletingId}
                  isDragging={draggingId === attachment.id}
                  onDelete={() => handleDelete(attachment.id)}
                  onMove={(folderId) => handleMoveAttachment(attachment.id, folderId)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isFetching && attachments.length === 0 && !error && (
            <p className="text-xs text-white/25 py-0.5">No attachments yet.</p>
          )}

          {/* Compact dropzone */}
          <CompactDropzone
            isDisabled={isMaxReached || isUploading || !!deletingId}
            isUploading={isUploading}
            isMaxReached={isMaxReached}
            onFile={handleUploadFile}
          />
          <p className="text-[10px] text-white/30 px-0.5">
            Total project files: {formatBytes(totalBytes)} / {formatBytes(MAX_PROJECT_TOTAL_UPLOAD_BYTES)} ({MAX_PROJECT_TOTAL_UPLOAD_MB} MB max)
          </p>
        </div>
      )}
    </div>
  );
}
