'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PublishedDocument {
  id: string;
  title: string;
  template_id: string;
  published_at: string;
  university: string | null;
  degree: string | null;
  subject: string | null;
  visibility: string;
  keywords: string[];
  view_count: number;
  like_count: number;
  user_liked: boolean;
  is_own: boolean;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HeartIcon({ className, filled }: { className?: string; filled: boolean }) {
  return filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3v4.5m0 0a3 3 0 100 6 3 3 0 000-6zm0 0V21M16.5 3v4.5m0 0a3 3 0 100 6 3 3 0 000-6zm0 0V9m0 5.25V21" />
    </svg>
  );
}

function DocumentCard({
  doc,
  onOpen,
  onLikeToggle,
  onFork,
}: {
  doc: PublishedDocument;
  onOpen: () => void;
  onLikeToggle: (id: string) => void;
  onFork: (id: string) => Promise<void>;
}) {
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;
  const isPublic = doc.visibility === 'public';
  const [isLiking, setIsLiking] = useState(false);
  const [isForking, setIsForking] = useState(false);

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try {
      await onLikeToggle(doc.id);
    } finally {
      setIsLiking(false);
    }
  }

  async function handleFork(e: React.MouseEvent) {
    e.stopPropagation();
    if (isForking) return;
    setIsForking(true);
    try {
      await onFork(doc.id);
    } finally {
      setIsForking(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      className="group cursor-pointer text-left bg-white/4 hover:bg-white/7 border border-white/10 hover:border-white/20
        rounded-2xl p-5 transition-all duration-200 flex flex-col gap-3"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 flex-1">
          {doc.title}
        </h3>
        {isPublic && (
          <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
            Public
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="space-y-1">
        {doc.subject && (
          <p className="text-xs text-white/60 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="truncate">{doc.subject}</span>
          </p>
        )}
        {doc.university && (
          <p className="text-xs text-white/40 truncate">
            {doc.university}{doc.degree ? ` · ${doc.degree}` : ''}
          </p>
        )}
      </div>

      {/* Keywords */}
      {doc.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doc.keywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              className="text-[10px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-2 py-0.5"
            >
              {kw}
            </span>
          ))}
          {doc.keywords.length > 4 && (
            <span className="text-[10px] text-white/30">+{doc.keywords.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer: template + date on left, stats on right */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">{templateLabel}</span>
          <span className="text-[10px] text-white/30">{formatDate(doc.published_at)}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          {/* View count */}
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <EyeIcon className="w-3 h-3" />
            {doc.view_count}
          </span>

          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            aria-label={doc.user_liked ? 'Unlike document' : 'Like document'}
            className={`flex items-center gap-1 text-[10px] transition-colors rounded px-1 py-0.5
              ${doc.user_liked
                ? 'text-pink-400 hover:text-pink-300'
                : 'text-white/30 hover:text-pink-400'
              }
              disabled:opacity-50`}
          >
            <HeartIcon className="w-3.5 h-3.5" filled={doc.user_liked} />
            {doc.like_count}
          </button>

          {/* Fork button — only visible on other people's documents */}
          {!doc.is_own && (
            <button
              onClick={handleFork}
              disabled={isForking}
              aria-label="Fork document"
              title="Fork to my documents"
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-indigo-400
                transition-colors rounded px-1 py-0.5 disabled:opacity-50"
            >
              {isForking ? (
                <span className="w-3 h-3 border border-white/20 border-t-indigo-400 rounded-full animate-spin" />
              ) : (
                <ForkIcon className="w-3.5 h-3.5" />
              )}
              Fork
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyStudiesPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<PublishedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPublished() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/documents/published');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load published documents');
        }
        const data = await res.json();
        setDocuments(data.documents ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    loadPublished();
  }, []);

  // Optimistic like toggle: flip state immediately, call API, revert on error
  const handleLikeToggle = useCallback(async (documentId: string) => {
    // Optimistic update
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? {
              ...doc,
              user_liked: !doc.user_liked,
              like_count: doc.user_liked ? doc.like_count - 1 : doc.like_count + 1,
            }
          : doc
      )
    );

    try {
      const res = await fetch(`/api/documents/${documentId}/like`, { method: 'POST' });
      const data = await res.json(); // parse first so we can read error details
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      // Sync with server's authoritative count
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, user_liked: data.liked, like_count: data.like_count }
            : doc
        )
      );
    } catch (err) {
      // Log so we can see the real error in the browser console
      console.error('[Like toggle failed]', err);
      // Revert optimistic update
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                user_liked: !doc.user_liked,
                like_count: doc.user_liked ? doc.like_count - 1 : doc.like_count + 1,
              }
            : doc
        )
      );
    }
  }, []);

  // Fork a document — creates a copy in the user's All Documents then navigates there
  const handleFork = useCallback(async (documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/fork`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.push(`/documents/${data.document_id}`);
    } catch (err) {
      console.error('[Fork failed]', err);
    }
  }, [router]);

  // Track view when navigating to a document
  const handleOpen = useCallback(async (doc: PublishedDocument) => {
    router.push(`/documents/${doc.id}`);
    // Fire-and-forget view tracking (non-blocking)
    fetch(`/api/documents/${doc.id}/view`, { method: 'POST' }).catch(() => {});
  }, [router]);

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">My Studies</h1>
            {!isLoading && documents.length > 0 && (
              <p className="text-xs text-white/40 mt-0.5">
                {documents.length} published document{documents.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-5 h-44" />
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex items-center justify-center py-20 text-center">
              <div className="space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-white/50 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-pink-500/15 border border-pink-500/25 mb-6">
                <svg
                  className="w-7 h-7 text-pink-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No published documents yet</h2>
              <p className="text-white/50 text-sm mb-6 max-w-sm">
                Open any document and click the{' '}
                <span className="text-indigo-400 font-medium">Publish</span> button in the header
                to add it to your studies.
              </p>
              <button
                onClick={() => router.push('/documents')}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
              >
                Browse my documents
              </button>
            </div>
          )}

          {/* Document grid */}
          {!isLoading && !error && documents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => handleOpen(doc)}
                  onLikeToggle={handleLikeToggle}
                  onFork={handleFork}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
