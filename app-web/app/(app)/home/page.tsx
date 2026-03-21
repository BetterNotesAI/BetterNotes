'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentCreationBar, CreateDocumentInput } from '@/app/_components/DocumentCreationBar';

interface RecentDocument {
  id: string;
  title: string;
  template_id: string;
  created_at: string;
  status: string;
}

export default function HomePage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  useEffect(() => {
    fetch('/api/documents?sort=date_desc')
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((data) => setRecentDocs((data.documents ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setIsLoadingDocs(false));
  }, []);

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
        setCreateError(docData?.error ?? 'Failed to create document');
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Home</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Welcome heading */}
          <h2 className="text-3xl font-semibold tracking-tight mb-2">
            What would you like to{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
              create?
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-8">
            Choose a template, describe your content, and get a print-ready PDF in seconds.
          </p>

          {/* Creation bar */}
          <DocumentCreationBar
            onSubmit={handleCreate}
            isLoading={isCreating}
            error={createError}
            placeholder="Describe the document you want to create..."
            autoFocus
          />

          {/* Recent documents */}
          {!isLoadingDocs && recentDocs.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/60">Recent documents</h3>
                <button
                  onClick={() => router.push('/documents')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {recentDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="flex items-center gap-3 w-full text-left rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] px-4 py-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
