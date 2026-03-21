'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DocumentCard, type DocumentItem } from './_components/DocumentCard';
import { DocumentFilters } from './_components/DocumentFilters';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';

type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'template';

const ONBOARDING_STEPS = [
  {
    step: '1',
    title: 'Choose a template',
    desc: '10 academic templates — cheat sheets, notes, problem sets',
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

function NewDocumentWatcher({ onTrigger }: { onTrigger: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      onTrigger();
      router.replace('/documents', { scroll: false });
    }
  }, [searchParams, router, onTrigger]);
  return null;
}

export default function DocumentsPage() {
  const router = useRouter();

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Filter / sort state
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [filterStarred, setFilterStarred] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Folders for DocumentCard "move to folder" menu
  const [folders, setFolders] = useState<{ id: string; name: string; color: string | null }[]>([]);

  // Create modal state
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Initial load: read active folder from localStorage (set by sidebar) + load folders for card menu
  useEffect(() => {
    const pendingFolder = localStorage.getItem('bn_active_folder');
    if (pendingFolder) {
      setActiveFolderId(pendingFolder);
      localStorage.removeItem('bn_active_folder');
    }

    fetch('/api/folders')
      .then((r) => r.ok ? r.json() : { folders: [] })
      .then((data) => setFolders(data.folders ?? []))
      .catch(() => {});

    // Handle sidebar folder click when already on /documents (no remount)
    function handleFolderActivate(e: Event) {
      const folderId = (e as CustomEvent<{ folderId: string }>).detail.folderId;
      setActiveFolderId(folderId);
      localStorage.removeItem('bn_active_folder');
    }
    window.addEventListener('folder:activate', handleFolderActivate);
    return () => window.removeEventListener('folder:activate', handleFolderActivate);
  }, []);

  // Re-fetch documents whenever filters change
  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, filterStarred, showArchived, activeFolderId]);

  async function loadDocuments() {
    setIsLoadingDocs(true);
    try {
      const params = new URLSearchParams();
      params.set('sort', sortBy);
      if (filterStarred) params.set('starred', 'true');
      if (showArchived) params.set('archived', 'true');
      if (activeFolderId) params.set('folder_id', activeFolderId);

      const resp = await fetch(`/api/documents?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(data.documents ?? []);
      }
    } finally {
      setIsLoadingDocs(false);
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
    } else if (filterStarred) {
      loadDocuments();
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

  // --- New document modal handlers ---

  function handleCloseModal() {
    setShowNewDocModal(false);
    setCreateError(null);
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
          attachments: uploadedAttachments,
        }),
      });
      const docData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setCreateError(docData?.error ?? 'Failed to create document. Please try again.');
        return;
      }
      router.push(`/documents/${docData.document.id}?prompt=${encodeURIComponent(data.prompt)}`);
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent text-white">
      <Suspense fallback={null}>
        <NewDocumentWatcher onTrigger={() => setShowNewDocModal(true)} />
      </Suspense>

      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">My Documents</h1>
      </div>

      {/* Filters bar */}
      <DocumentFilters
        sortBy={sortBy}
        setSortBy={setSortBy}
        filterStarred={filterStarred}
        setFilterStarred={setFilterStarred}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
      />

      {/* Documents list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isLoadingDocs ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            filterStarred || showArchived || activeFolderId ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-white/40 text-sm mb-3">No documents match the current filters.</p>
                <button
                  onClick={() => {
                    setFilterStarred(false);
                    setShowArchived(false);
                    setActiveFolderId(null);
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onRename={(newTitle) => handleRename(doc.id, newTitle)}
                  onStar={(isStarred) => handleStar(doc.id, isStarred)}
                  onArchive={(archive) => handleArchive(doc.id, archive)}
                  onDelete={() => handleDelete(doc.id)}
                  onNavigate={() => router.push(`/documents/${doc.id}`)}
                  folders={folders}
                  onMoveToFolder={(folderId) => handleMoveToFolder(doc.id, folderId)}
                />
              ))}
            </div>
          )}
        </div>
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
