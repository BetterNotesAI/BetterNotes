'use client';

import { useEffect, useState } from 'react';
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

function DocumentCard({ doc, onOpen }: { doc: PublishedDocument; onOpen: () => void }) {
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;
  const isPublic = doc.visibility === 'public';

  return (
    <button
      onClick={onOpen}
      className="group text-left bg-white/4 hover:bg-white/7 border border-white/10 hover:border-white/20
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
          <p className="text-xs text-white/40 truncate">{doc.university}{doc.degree ? ` · ${doc.degree}` : ''}</p>
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/6">
        <span className="text-[10px] text-white/30">{templateLabel}</span>
        <span className="text-[10px] text-white/30">{formatDate(doc.published_at)}</span>
      </div>
    </button>
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
                  onOpen={() => router.push(`/documents/${doc.id}`)}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
