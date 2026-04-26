'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DocumentCard, type DocumentItem } from './_components/DocumentCard';
import { DocumentFilters } from './_components/DocumentFilters';
import { FolderSectionMenu } from './_components/FolderSectionMenu';
import { ProjectAttachmentsPanel } from './_components/ProjectAttachmentsPanel';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';

type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'template';

interface ProjectFolder {
  id: string;
  name: string;
  color: string | null;
  is_starred: boolean;
  archived_at?: string | null;
  document_count?: number;
  input_count?: number;
}

const ONBOARDING_STEPS = [
  {
    step: '1',
    title: 'Choose a template',
    desc: '4 templates — cheat sheets, notes, and multi-page documents',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    step: '2',
    title: 'Describe the content',
    desc: 'Tell the AI what to fill in — topic, examples, formulas',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    step: '3',
    title: 'Download your PDF',
    desc: 'Print-ready in seconds, refine with follow-up messages',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

function readFolderParam(rawFolder: string | null): string | null {
  const folder = rawFolder?.trim();
  return folder && folder.length > 0 ? folder : null;
}

function NewDocumentWatcher({
  onTrigger,
  onOpenFolder,
}: {
  onTrigger: (folderId: string | null) => void;
  onOpenFolder: (folderId: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const folderId = readFolderParam(searchParams?.get('folder') ?? null);

    if (searchParams?.get('new') === '1') {
      if (folderId) onOpenFolder(folderId);
      onTrigger(folderId);
      router.replace(folderId ? `/documents?folder=${encodeURIComponent(folderId)}` : '/documents', { scroll: false });
      return;
    }

    if (folderId) {
      onOpenFolder(folderId);
    }
  }, [searchParams, router, onTrigger, onOpenFolder]);

  return null;
}

export default function DocumentsPage() {
  const router = useRouter();

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const silentNextLoad = useRef(false);
  const documentLoadSeqRef = useRef(0);
  const documentsRef = useRef<DocumentItem[]>([]);
  documentsRef.current = documents;

  // Filter / sort state
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [filterStarred, setFilterStarred] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // Initialize from localStorage so there's only one loadDocuments call on mount
  const [activeFolderId, setActiveFolderId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const queryFolder = readFolderParam(new URLSearchParams(window.location.search).get('folder'));
    if (queryFolder) {
      localStorage.removeItem('bn_active_folder');
      return queryFolder;
    }
    const pending = localStorage.getItem('bn_active_folder');
    if (pending) { localStorage.removeItem('bn_active_folder'); return pending; }
    return null;
  });

  // Folders for DocumentCard "move to folder" menu
  const [folders, setFolders] = useState<ProjectFolder[]>([]);

  // Create modal state
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Folder pre-selected when opening modal via "New document here"
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
  const [projectAttachmentsOpen, setProjectAttachmentsOpen] = useState(false);

  const handleOpenFolderFromQuery = useCallback((folderId: string) => {
    setActiveFolderId((current) => {
      if (current === folderId) return current;
      setIsLoadingDocs(true);
      return folderId;
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bn_active_folder');
    }
  }, []);

  const handleNewDocumentTrigger = useCallback((folderId: string | null) => {
    setPendingFolderId(folderId);
    setShowNewDocModal(true);
  }, []);

  // Initial load: load folders for card menu + register sidebar events
  useEffect(() => {
    function loadFolders(e?: Event) {
      const detail = (e as CustomEvent<{
        folderId?: string;
        updates?: Partial<ProjectFolder>;
      }> | undefined)?.detail;

      if (detail?.folderId && detail.updates) {
        setFolders((prev) => prev.map((folder) => (
          folder.id === detail.folderId
            ? { ...folder, ...detail.updates }
            : folder
        )));
      }

      fetch('/api/folders', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : { folders: [] })
        .then((data) => setFolders(data.folders ?? []))
        .catch(() => {});
    }

    loadFolders();

    // Handle sidebar folder click when already on /documents (no remount)
    function handleFolderActivate(e: Event) {
      const folderId = (e as CustomEvent<{ folderId: string }>).detail.folderId;
      setIsLoadingDocs(true); // Show spinner immediately in same render batch
      setActiveFolderId(folderId);
      localStorage.removeItem('bn_active_folder');
    }
    // Handle sidebar "All Documents" click — reset folder filter
    function handleFolderReset() {
      if (documentsRef.current.length > 0) {
        silentNextLoad.current = true; // Has docs: smooth silent transition
      } else {
        setIsLoadingDocs(true); // Empty folder: show spinner immediately to avoid empty grouped view flash
      }
      setActiveFolderId(null);
    }
    // Handle sidebar "Create document in folder" action
    function handleCreateDocumentInFolder(e: Event) {
      const folderId = (e as CustomEvent<{ folderId: string }>).detail.folderId;
      if (folderId) setPendingFolderId(folderId);
      setShowNewDocModal(true);
    }
    window.addEventListener('folders:updated', loadFolders);
    window.addEventListener('folder:activate', handleFolderActivate);
    window.addEventListener('folder:reset', handleFolderReset);
    window.addEventListener('folder:create-document', handleCreateDocumentInFolder);
    return () => {
      window.removeEventListener('folders:updated', loadFolders);
      window.removeEventListener('folder:activate', handleFolderActivate);
      window.removeEventListener('folder:reset', handleFolderReset);
      window.removeEventListener('folder:create-document', handleCreateDocumentInFolder);
    };
  }, []);

  // Re-fetch documents whenever filters change
  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, filterStarred, showArchived, activeFolderId]);

  useEffect(() => {
    if (!activeFolderId) setProjectAttachmentsOpen(false);
  }, [activeFolderId]);

  // --- Grouped view helpers (F2-M6.3 + F2-M6.4) ---
  // Only active when no folder filter is applied (All Documents view).
  const groupedView = useMemo(() => {
    if (activeFolderId !== null) return null;

    const visibleDocs = filterStarred
      ? documents.filter((d) => d.is_starred)
      : documents;

    const starred = visibleDocs.filter((d) => d.is_starred);

    // All non-starred docs.
    const nonStarred = filterStarred ? [] : visibleDocs.filter((d) => !d.is_starred);
    const looseDocs = nonStarred.filter((d) => d.folder_id === null);

    // Non-starred docs grouped by folder_id. Folder cards are built from
    // folder metadata below so projects with only input files are still visible.
    const inFolderDocs = nonStarred.filter((d) => d.folder_id !== null);
    const folderMap = new Map<string, DocumentItem[]>();
    for (const doc of inFolderDocs) {
      const fid = doc.folder_id!;
      if (!folderMap.has(fid)) folderMap.set(fid, []);
      folderMap.get(fid)!.push(doc);
    }

    // Separate archived and non-archived folders
    const nonArchivedFolders = folders.filter((f) => !f.archived_at);
    const archivedFolders = showArchived ? folders.filter((f) => !!f.archived_at) : [];
    const starredFolders = nonArchivedFolders.filter((f) => f.is_starred);
    const starredFolderIds = new Set(starredFolders.map((f) => f.id));

    // Project cards: include every non-archived, non-starred folder, even when
    // it only has project-level input files and no generated documents yet.
    const filteredFolderGroups = showArchived
      ? []
      : nonArchivedFolders
        .filter((folder) => !starredFolderIds.has(folder.id))
        .map((folder) => {
          const docs = folderMap.get(folder.id) ?? [];
          return {
            folderId: folder.id,
            folderName: folder.name,
            folderColor: folder.color,
            docs,
            documentCount: folder.document_count ?? docs.length,
            inputCount: folder.input_count ?? 0,
            folder,
          };
        })
        .sort((a, b) => a.folderName.localeCompare(b.folderName));

    return { starred, folderGroups: filteredFolderGroups, looseDocs, visibleDocs, starredFolders, archivedFolders };
  }, [activeFolderId, filterStarred, showArchived, documents, folders]);

  const visibleFolderDocuments = useMemo(
    () => activeFolderId
      ? documents.filter((doc) => doc.folder_id === activeFolderId)
      : documents,
    [activeFolderId, documents]
  );

  function formatFolderCounts(folder: Pick<ProjectFolder, 'document_count' | 'input_count'>, docsFallback = 0) {
    const documentCount = folder.document_count ?? docsFallback;
    const inputCount = folder.input_count ?? 0;
    const parts: string[] = [];
    if (documentCount > 0) parts.push(`${documentCount} document${documentCount === 1 ? '' : 's'}`);
    if (inputCount > 0) parts.push(`${inputCount} file${inputCount === 1 ? '' : 's'}`);
    return parts.length > 0 ? parts.join(' · ') : 'No files yet';
  }

  function updateProjectInputCount(folderId: string, count: number) {
    const currentCount = folders.find((folder) => folder.id === folderId)?.input_count ?? 0;
    if (currentCount === count) return;
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, input_count: count } : folder
    )));
    window.dispatchEvent(new CustomEvent('folders:updated', {
      detail: { folderId, updates: { input_count: count } },
    }));
  }

  function documentHref(doc: DocumentItem): string {
    return doc.folder_id
      ? `/documents/${doc.id}?projectId=${encodeURIComponent(doc.folder_id)}`
      : `/documents/${doc.id}`;
  }

  async function loadDocuments() {
    const requestId = ++documentLoadSeqRef.current;
    const folderIdForRequest = activeFolderId;
    const silent = silentNextLoad.current;
    silentNextLoad.current = false;
    if (!silent) setIsLoadingDocs(true);
    try {
      const params = new URLSearchParams();
      params.set('sort', sortBy);
      if (filterStarred) params.set('starred', 'true');
      if (showArchived) params.set('archived', 'true');
      if (folderIdForRequest) params.set('folder_id', folderIdForRequest);

      const resp = await fetch(`/api/documents?${params}`, { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        if (requestId !== documentLoadSeqRef.current) return;
        const nextDocuments = (data.documents ?? []) as DocumentItem[];
        setDocuments(
          folderIdForRequest
            ? nextDocuments.filter((doc) => doc.folder_id === folderIdForRequest)
            : nextDocuments
        );
      }
    } finally {
      if (requestId === documentLoadSeqRef.current) {
        setIsLoadingDocs(false);
      }
    }
  }

  // --- Document action handlers ---

  async function handleRename(id: string, newTitle: string) {
    const previousDocs = documents;
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d))
    );
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) setDocuments(previousDocs);
  }

  async function handleStar(id: string, isStarred: boolean) {
    const previousDocs = documents;
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_starred: isStarred } : d))
    );
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: isStarred }),
    });
    if (!res.ok) {
      setDocuments(previousDocs);
    }
  }

  async function handleArchive(id: string, archive: boolean) {
    await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived_at: archive ? new Date().toISOString() : null }),
    });
    loadDocuments();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleMoveToFolder(docId: string, folderId: string | null) {
    await fetch(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    });
    loadDocuments();
  }

  async function handleDuplicate(doc: DocumentItem) {
    const resp = await fetch(`/api/documents/${doc.id}/duplicate`, { method: 'POST' });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data?.document?.id) {
        router.push(`/documents/${data.document.id}`);
      } else {
        loadDocuments();
      }
    }
  }

  async function handleDownload(doc: DocumentItem) {
    const resp = await fetch(`/api/documents/${doc.id}`);
    if (!resp.ok) return;
    const data = await resp.json().catch(() => ({}));
    const pdfUrl: string | null = data?.pdfSignedUrl ?? null;
    if (!pdfUrl) return;
    const res = await fetch(pdfUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Folder action handlers (F2-M6.6) ---

  async function handleRenameFolder(folderId: string, newName: string) {
    const previousFolders = folders;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
    );
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      setFolders(previousFolders);
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId, updates: { name: newName } },
      }));
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const previousFolders = folders;
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) {
      setFolders(previousFolders);
    } else {
      window.dispatchEvent(new Event('folders:updated'));
      // If we're currently viewing the deleted folder, go back to All Documents
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
      loadDocuments();
    }
  }

  async function handleStarFolder(folderId: string, isStarred: boolean) {
    const previousFolders = folders;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, is_starred: isStarred } : f))
    );
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: isStarred }),
    });
    if (!res.ok) {
      setFolders(previousFolders);
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId, updates: { is_starred: isStarred } },
      }));
    }
  }

  function handleCreateDocInFolder(folderId: string) {
    setPendingFolderId(folderId);
    setShowNewDocModal(true);
  }

  async function handleChangeFolderColor(folderId: string, newColor: string) {
    const previousFolders = folders;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, color: newColor } : f))
    );
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: newColor }),
    });
    if (!res.ok) {
      setFolders(previousFolders);
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId, updates: { color: newColor } },
      }));
    }
  }

  async function handleDownloadFolder(folderId: string) {
    const res = await fetch(`/api/folders/${folderId}/download`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const folderName = folders.find((f) => f.id === folderId)?.name ?? 'folder';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleArchiveFolder(folderId: string, currentlyArchived: boolean) {
    const archivedAt = currentlyArchived ? null : new Date().toISOString();
    const previousFolders = folders;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, archived_at: archivedAt } : f))
    );
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived_at: archivedAt }),
    });
    if (!res.ok) {
      setFolders(previousFolders);
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId, updates: { archived_at: archivedAt } },
      }));
      // If archiving the currently active folder, navigate back to All Documents
      if (!currentlyArchived && activeFolderId === folderId) {
        setActiveFolderId(null);
      }
    }
  }

  // --- New document modal handlers ---

  function handleCloseModal() {
    setShowNewDocModal(false);
    setCreateError(null);
    setPendingFolderId(null);
  }

  async function handleCreate(data: CreateDocumentInput) {
    setIsCreating(true);
    setCreateError(null);
    try {
      // 1. Upload files to get storagePaths
      const uploadedAttachments: {
        name: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
      }[] = [];

      for (const file of data.files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/attachments/upload', { method: 'POST', body: formData });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCreateError(d?.error ?? 'Upload failed');
          setIsCreating(false);
          return;
        }
        uploadedAttachments.push({
          name: d.name,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          storagePath: d.storagePath,
        });
      }

      // 2. Create document
      const resp = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: data.templateId,
          prompt: data.prompt,
          attachments: uploadedAttachments,
          ...(pendingFolderId ? { folder_id: pendingFolderId } : {}),
        }),
      });
      const docData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setCreateError(docData?.error ?? 'Failed to create document. Please try again.');
        return;
      }
      const query = new URLSearchParams({ prompt: data.prompt });
      if (pendingFolderId) query.set('projectId', pendingFolderId);
      router.push(`/documents/${docData.document.id}?${query.toString()}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  const activeProjectFolder = activeFolderId
    ? folders.find((folder) => folder.id === activeFolderId) ?? null
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent text-white">
      <Suspense fallback={null}>
        <NewDocumentWatcher
          onTrigger={handleNewDocumentTrigger}
          onOpenFolder={handleOpenFolderFromQuery}
        />
      </Suspense>

      {/* Header */}
      <div className={`border-b border-white/10 px-6 flex shrink-0 ${activeFolderId ? 'py-3 items-start' : 'h-14 items-center'}`}>
        {activeFolderId ? (
          /* Breadcrumb when inside a folder */
          <div className="w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => {
                  setIsLoadingDocs(true);
                  setActiveFolderId(null);
                  router.replace('/documents', { scroll: false });
                }}
                className="text-white/50 hover:text-white/80 transition-colors text-sm font-medium shrink-0"
              >
                My Documents
              </button>
              <svg className="w-3.5 h-3.5 text-white/25 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {(() => {
                const activeFolder = folders.find((f) => f.id === activeFolderId);
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    {activeFolder?.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: activeFolder.color }}
                      />
                    )}
                    <h1 className="text-xl font-semibold truncate">
                      {activeFolder?.name ?? 'Folder'}
                    </h1>
                  </div>
                );
              })()}
            </div>
            <button
              onClick={() => router.push(`/projects/${encodeURIComponent(activeFolderId)}`)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-gradient-to-r from-[#b04cff] via-[#7d5cff] to-[#3d7dff]
                hover:from-[#c06bff] hover:via-[#8a6fff] hover:to-[#5290ff]
                text-white text-xs font-semibold transition-all
                shadow-[0_4px_14px_rgba(96,82,255,0.35)] hover:shadow-[0_6px_18px_rgba(85,116,255,0.45)]"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New document
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 w-full">
            <h1 className="text-xl font-semibold">My Documents</h1>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-white/10 hover:bg-white/15 text-white/70 hover:text-white
                text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New document
            </button>
          </div>
        )}
      </div>

      {/* Filters bar */}
      <DocumentFilters
        sortBy={sortBy}
        setSortBy={(v) => { setIsLoadingDocs(true); setSortBy(v); }}
        filterStarred={filterStarred}
        setFilterStarred={(v) => { setIsLoadingDocs(true); setFilterStarred(v); }}
        showArchived={showArchived}
        setShowArchived={(v) => { setIsLoadingDocs(true); setShowArchived(v); }}
        rightAccessory={activeFolderId ? (
          <button
            onClick={() => setProjectAttachmentsOpen((open) => !open)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
              projectAttachmentsOpen
                ? 'bg-indigo-500/18 border-indigo-400/45 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-white'
            }`}
            aria-pressed={projectAttachmentsOpen}
            title="Notebook attachments"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attachments
            {activeProjectFolder && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">
                {activeProjectFolder.input_count ?? 0}
              </span>
            )}
          </button>
        ) : null}
      />

      {/* Documents list */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isLoadingDocs ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : visibleFolderDocuments.length === 0 && !groupedView ? (
            /* Empty states */
            activeFolderId ? (
              /* Folder-filtered view — empty: show header + empty state */
              (() => {
                const activeFolder = folders.find((f) => f.id === activeFolderId);
                return (
                  <div className="space-y-6">
                    {/* Folder header row */}
                    <div className="flex items-center gap-3 min-w-0 group">
                      {activeFolder?.color && (
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: activeFolder.color }}
                        />
                      )}
                      <h2 className="text-base font-semibold text-white truncate">
                        {activeFolder?.name ?? 'Folder'}
                      </h2>
                      <span className="text-xs text-white/30 font-medium shrink-0">0 documents</span>
                      {activeFolder && (
                        <FolderSectionMenu
                          folderName={activeFolder.name}
                          folderColor={activeFolder.color}
                          isStarred={activeFolder.is_starred ?? false}
                          isArchived={!!activeFolder.archived_at}
                          onStar={(isStarred) => handleStarFolder(activeFolderId!, isStarred)}
                          onCreateDocumentInside={() => handleCreateDocInFolder(activeFolderId!)}
                          onRename={(newName) => handleRenameFolder(activeFolderId!, newName)}
                          onDelete={() => handleDeleteFolder(activeFolderId!)}
                          onChangeColor={(color) => handleChangeFolderColor(activeFolderId!, color)}
                          onDownload={() => handleDownloadFolder(activeFolderId!)}
                          onArchive={() => handleArchiveFolder(activeFolderId!, !!activeFolder.archived_at)}
                        />
                      )}
                    </div>
                    {/* Empty state */}
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/12 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <p className="text-white/40 text-sm mb-1">This folder is empty</p>
                      <p className="text-white/25 text-xs mb-4">Create a document here or move existing ones into this folder</p>
                      <button
                        onClick={() => handleCreateDocInFolder(activeFolderId!)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                      >
                        Create first document
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : filterStarred || showArchived ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-white/40 text-sm mb-3">No documents match the current filters.</p>
                <button
                  onClick={() => {
                    setFilterStarred(false);
                    setShowArchived(false);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-white mb-2">Create your first document</h2>
                <p className="text-white/55 text-sm mb-10">Let AI generate a print-ready PDF from your notes.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
                  {ONBOARDING_STEPS.map(({ step, icon, title, desc }) => (
                    <div
                      key={step}
                      className="bg-white/10 border border-white/20 rounded-2xl p-5 text-left backdrop-blur"
                    >
                      <div className="mb-3">{icon}</div>
                      <p className="text-xs text-white/40 font-medium mb-1">Step {step}</p>
                      <p className="text-sm font-semibold text-white mb-1">{title}</p>
                      <p className="text-xs text-white/55">{desc}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowNewDocModal(true)}
                  className="bg-white hover:bg-white/90 text-neutral-950 font-semibold px-6 py-3
                    rounded-xl transition-colors text-sm"
                >
                  Get started
                </button>
              </div>
            )
          ) : groupedView ? (
            /* ── All Documents grouped view (F2-M6.3 + F2-M6.4) ── */
            <div className="space-y-8">

              {/* F2-M6.3 — Starred section: only in Starred view, never in Archived view */}
              {!showArchived && filterStarred && (groupedView.starred.length > 0 || groupedView.starredFolders.length > 0) && <section>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Starred</h2>
                  {(groupedView.starredFolders.length > 0 || groupedView.starred.length > 0) && (
                    <span className="text-[10px] text-white/30 font-medium">
                      {groupedView.starredFolders.length > 0 && `${groupedView.starredFolders.length} folder${groupedView.starredFolders.length !== 1 ? 's' : ''}`}
                      {groupedView.starredFolders.length > 0 && groupedView.starred.length > 0 && ' · '}
                      {groupedView.starred.length > 0 && `${groupedView.starred.length} file${groupedView.starred.length !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
                <>
                  {/* Starred folders — same card format as Folders section */}
                  {groupedView.starredFolders.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {groupedView.starredFolders.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                            border border-white/10 bg-white/[0.04] hover:bg-white/[0.07]
                            transition-colors cursor-pointer group"
                          onClick={() => { setIsLoadingDocs(true); setActiveFolderId(f.id); }}
                          title={`Open folder: ${f.name}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color ?? '#6366f1' }} />
                            <svg className="w-4 h-4 text-white/40 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-white/80 truncate">{f.name}</span>
                              <span className="block text-[11px] text-white/35 truncate">{formatFolderCounts(f)}</span>
                            </span>
                          </div>
                          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                            <FolderSectionMenu
                              folderName={f.name}
                              folderColor={f.color}
                              isStarred={f.is_starred}
                              isArchived={!!f.archived_at}
                              onStar={(isStarred) => handleStarFolder(f.id, isStarred)}
                              onCreateDocumentInside={() => handleCreateDocInFolder(f.id)}
                              onRename={(newName) => handleRenameFolder(f.id, newName)}
                              onDelete={() => handleDeleteFolder(f.id)}
                              onChangeColor={(color) => handleChangeFolderColor(f.id, color)}
                              onDownload={() => handleDownloadFolder(f.id)}
                              onArchive={() => handleArchiveFolder(f.id, !!f.archived_at)}
                            />
                            <button
                              onClick={() => handleStarFolder(f.id, false)}
                              className="p-1 rounded-md hover:bg-white/10 transition-colors group/star"
                              title="Remove from starred"
                            >
                              <svg className="w-4 h-4 text-yellow-400 group-hover/star:hidden" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                              <svg className="w-4 h-4 text-white/50 hidden group-hover/star:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            </button>
                            <span className="p-1">
                              <svg className="w-4 h-4 text-white/25 group-hover:text-white/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Starred documents */}
                  {groupedView.starred.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedView.starred.map((doc) => {
                        const parentFolder = doc.folder_id ? folders.find((f) => f.id === doc.folder_id) : null;
                        return (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          onRename={(newTitle) => handleRename(doc.id, newTitle)}
                          onStar={(isStarred) => handleStar(doc.id, isStarred)}
                          onArchive={(archive) => handleArchive(doc.id, archive)}
                          onDelete={() => handleDelete(doc.id)}
                          onNavigate={() => router.push(documentHref(doc))}
                          onOpenHistory={() => router.push(`/documents/${doc.id}?history=1`)}
                          folders={folders}
                          onMoveToFolder={(folderId) => handleMoveToFolder(doc.id, folderId)}
                          onDuplicate={() => handleDuplicate(doc)}
                          onDownload={() => handleDownload(doc)}
                          folderBadge={parentFolder ? { name: parentFolder.name, color: parentFolder.color } : undefined}
                        />
                        );
                      })}
                    </div>
                  )}
                </>
              </section>}

              {/* F2-M6.4 — Folder sections: alphabetically, in a grid (like document cards) */}
              {groupedView.folderGroups.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Folders</h2>
                    <span className="text-[10px] text-white/30 font-medium">{groupedView.folderGroups.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedView.folderGroups.map(({ folderId: groupFolderId, folderName, folderColor, documentCount, inputCount }) => (
                      <div
                        key={groupFolderId}
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                          border border-white/10 bg-white/[0.04] hover:bg-white/[0.07]
                          transition-colors cursor-pointer group"
                        onClick={() => setActiveFolderId(groupFolderId)}
                        title={`Open folder: ${folderName}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: folderColor ?? '#6366f1' }}
                          />
                          <svg className="w-4 h-4 text-white/40 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                          </svg>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-white/80 truncate">
                              {folderName}
                            </span>
                            <span className="block text-[11px] text-white/35 truncate">
                              {formatFolderCounts({ document_count: documentCount, input_count: inputCount })}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* 3-dots menu */}
                          <FolderSectionMenu
                            folderName={folderName}
                            folderColor={folderColor}
                            isStarred={folders.find((f) => f.id === groupFolderId)?.is_starred ?? false}
                            isArchived={!!folders.find((f) => f.id === groupFolderId)?.archived_at}
                            onStar={(isStarred) => handleStarFolder(groupFolderId, isStarred)}
                            onCreateDocumentInside={() => handleCreateDocInFolder(groupFolderId)}
                            onRename={(newName) => handleRenameFolder(groupFolderId, newName)}
                            onDelete={() => handleDeleteFolder(groupFolderId)}
                            onChangeColor={(color) => handleChangeFolderColor(groupFolderId, color)}
                            onDownload={() => handleDownloadFolder(groupFolderId)}
                            onArchive={() => handleArchiveFolder(groupFolderId, !!folders.find((f) => f.id === groupFolderId)?.archived_at)}
                          />
                          {/* Star toggle */}
                          <button
                            onClick={() => {
                              const starred = folders.find((f) => f.id === groupFolderId)?.is_starred ?? false;
                              handleStarFolder(groupFolderId, !starred);
                            }}
                            className="p-1 rounded-md hover:bg-white/10 transition-colors group/star"
                            title={folders.find((f) => f.id === groupFolderId)?.is_starred ? 'Remove from starred' : 'Add to starred'}
                          >
                            {folders.find((f) => f.id === groupFolderId)?.is_starred ? (
                              <>
                                <svg className="w-4 h-4 text-yellow-400 group-hover/star:hidden" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                                <svg className="w-4 h-4 text-white/50 hidden group-hover/star:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </>
                            ) : (
                              <svg className="w-4 h-4 text-white/30 group-hover/star:text-yellow-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            )}
                          </button>
                          {/* Chevron — same p-1 padding as buttons for alignment */}
                          <span className="p-1">
                            <svg className="w-4 h-4 text-white/25 group-hover:text-white/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Archived folders — shown when showArchived=true */}
              {groupedView.archivedFolders.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-yellow-400/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <h2 className="text-xs font-semibold text-yellow-400/50 uppercase tracking-wider">Archived Folders</h2>
                    <span className="text-[10px] text-white/30 font-medium">{groupedView.archivedFolders.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedView.archivedFolders.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                          border border-yellow-400/10 bg-yellow-400/[0.03] hover:bg-yellow-400/[0.06]
                          transition-colors cursor-pointer group opacity-70 hover:opacity-100"
                        onClick={() => { setIsLoadingDocs(true); setActiveFolderId(f.id); }}
                        title={`Open archived folder: ${f.name}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color ?? '#6366f1' }} />
                          <svg className="w-4 h-4 text-white/40 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                          </svg>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-white/60 truncate">{f.name}</span>
                            <span className="block text-[11px] text-white/30 truncate">{formatFolderCounts(f)}</span>
                          </span>
                        </div>
                        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                          <FolderSectionMenu
                            folderName={f.name}
                            folderColor={f.color}
                            isStarred={f.is_starred}
                            isArchived={true}
                            onStar={(isStarred) => handleStarFolder(f.id, isStarred)}
                            onCreateDocumentInside={() => handleCreateDocInFolder(f.id)}
                            onRename={(newName) => handleRenameFolder(f.id, newName)}
                            onDelete={() => handleDeleteFolder(f.id)}
                            onChangeColor={(color) => handleChangeFolderColor(f.id, color)}
                            onDownload={() => handleDownloadFolder(f.id)}
                            onArchive={() => handleArchiveFolder(f.id, true)}
                          />
                          <span className="p-1">
                            <svg className="w-4 h-4 text-white/25 group-hover:text-white/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* F2-M6.4 — Loose files (no folder) */}
              {groupedView.looseDocs.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Documents</h2>
                    <span className="text-[10px] text-white/30 font-medium">{groupedView.looseDocs.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedView.looseDocs.map((doc) => {
                      const parentFolder = doc.folder_id ? folders.find((f) => f.id === doc.folder_id) : null;
                      return (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        onRename={(newTitle) => handleRename(doc.id, newTitle)}
                        onStar={(isStarred) => handleStar(doc.id, isStarred)}
                        onArchive={(archive) => handleArchive(doc.id, archive)}
                        onDelete={() => handleDelete(doc.id)}
                        onNavigate={() => router.push(documentHref(doc))}
                        onOpenHistory={() => router.push(`/documents/${doc.id}?history=1`)}
                        folders={folders}
                        onMoveToFolder={(folderId) => handleMoveToFolder(doc.id, folderId)}
                        onDuplicate={() => handleDuplicate(doc)}
                        onDownload={() => handleDownload(doc)}
                        folderBadge={parentFolder ? { name: parentFolder.name, color: parentFolder.color } : undefined}
                      />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* All Documents empty state (only shown when there are truly no docs at all) */}
              {groupedView.visibleDocs.length === 0
                && groupedView.folderGroups.length === 0
                && groupedView.starredFolders.length === 0
                && !(showArchived && groupedView.archivedFolders.length > 0) && (
                filterStarred || showArchived ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-white/40 text-sm mb-3">No documents match the current filters.</p>
                    <button
                      onClick={() => { setFilterStarred(false); setShowArchived(false); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <h2 className="text-2xl font-bold text-white mb-2">Create your first document</h2>
                    <p className="text-white/55 text-sm mb-10">Let AI generate a print-ready PDF from your notes.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
                      {ONBOARDING_STEPS.map(({ step, icon, title, desc }) => (
                        <div
                          key={step}
                          className="bg-white/10 border border-white/20 rounded-2xl p-5 text-left backdrop-blur"
                        >
                          <div className="mb-3">{icon}</div>
                          <p className="text-xs text-white/40 font-medium mb-1">Step {step}</p>
                          <p className="text-sm font-semibold text-white mb-1">{title}</p>
                          <p className="text-xs text-white/55">{desc}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowNewDocModal(true)}
                      className="bg-white hover:bg-white/90 text-neutral-950 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
                    >
                      Get started
                    </button>
                  </div>
                )
              )}
            </div>
          ) : (
            /* ── Folder-filtered view ── */
            (() => {
              const activeFolder = folders.find((f) => f.id === activeFolderId);
              return (
                <div className="space-y-6">
                  {/* Folder header row */}
                  <div className="flex items-center gap-3 min-w-0 group">
                    {activeFolder?.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: activeFolder.color }}
                      />
                    )}
                    <h2 className="text-base font-semibold text-white truncate">
                      {activeFolder?.name ?? 'Folder'}
                    </h2>
                    <span className="text-xs text-white/30 font-medium shrink-0">
                      {visibleFolderDocuments.length} {visibleFolderDocuments.length === 1 ? 'document' : 'documents'}
                    </span>
                    {activeFolder && (
                      <FolderSectionMenu
                        folderName={activeFolder.name}
                        folderColor={activeFolder.color}
                        isStarred={activeFolder.is_starred ?? false}
                        isArchived={!!activeFolder.archived_at}
                        onStar={(isStarred) => handleStarFolder(activeFolderId!, isStarred)}
                        onCreateDocumentInside={() => handleCreateDocInFolder(activeFolderId!)}
                        onRename={(newName) => handleRenameFolder(activeFolderId!, newName)}
                        onDelete={() => handleDeleteFolder(activeFolderId!)}
                        onChangeColor={(color) => handleChangeFolderColor(activeFolderId!, color)}
                        onDownload={() => handleDownloadFolder(activeFolderId!)}
                        onArchive={() => handleArchiveFolder(activeFolderId!, !!activeFolder.archived_at)}
                      />
                    )}
                  </div>

                  {/* Documents grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleFolderDocuments.map((doc) => {
                      const parentFolder = doc.folder_id ? folders.find((f) => f.id === doc.folder_id) : null;
                      return (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        onRename={(newTitle) => handleRename(doc.id, newTitle)}
                        onStar={(isStarred) => handleStar(doc.id, isStarred)}
                        onArchive={(archive) => handleArchive(doc.id, archive)}
                        onDelete={() => handleDelete(doc.id)}
                        onNavigate={() => router.push(documentHref(doc))}
                        onOpenHistory={() => router.push(`/documents/${doc.id}?history=1`)}
                        folders={folders}
                        onMoveToFolder={(folderId) => handleMoveToFolder(doc.id, folderId)}
                        onDuplicate={() => handleDuplicate(doc)}
                        onDownload={() => handleDownload(doc)}
                        folderBadge={parentFolder ? { name: parentFolder.name, color: parentFolder.color } : undefined}
                      />
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
      {activeFolderId && projectAttachmentsOpen && (
        <aside className="hidden md:block w-[360px] shrink-0 border-l border-white/10 bg-neutral-950/45">
          <ProjectAttachmentsPanel
            projectId={activeFolderId}
            mode="sidebar"
            onClose={() => setProjectAttachmentsOpen(false)}
            onCountChange={(count) => updateProjectInputCount(activeFolderId, count)}
          />
        </aside>
      )}
      </div>

      {/* New document modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl">
            {/* Close button above bar */}
            <div className="flex justify-end mb-3">
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <DocumentCreationBar
              onSubmit={handleCreate}
              isLoading={isCreating}
              error={createError}
              placeholder="Describe the document you want to create..."
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}
