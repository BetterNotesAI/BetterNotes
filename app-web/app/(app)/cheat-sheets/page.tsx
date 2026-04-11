'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheatSheetCard, type CheatSheetSession } from './_components/CheatSheetCard';
import { CHEAT_SHEET_TEMPLATE_OPTIONS } from './_components/cheatSheetTemplates';

type DocumentStatus = 'draft' | 'generating' | 'ready' | 'error';

interface DocumentListItem {
  id: string;
  title: string;
  template_id: string;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

const CHEAT_SHEET_TEMPLATE_ID_SET = new Set<string>(CHEAT_SHEET_TEMPLATE_OPTIONS.map((t) => t.id));

function mapDocumentToCheatSheetSession(doc: DocumentListItem): CheatSheetSession {
  const mappedStatus =
    doc.status === 'ready'
      ? 'done'
      : doc.status === 'draft'
      ? 'pending'
      : doc.status;

  return {
    id: doc.id,
    title: doc.title,
    status: mappedStatus,
    language: 'english',
    source_doc_ids: [],
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export default function CheatSheetsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<CheatSheetSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch('/api/documents?sort=date_desc');
        if (!res.ok) return;
        const data = await res.json() as { documents?: DocumentListItem[] };
        const docs = (data.documents ?? [])
          .filter((doc) => CHEAT_SHEET_TEMPLATE_ID_SET.has(doc.template_id))
          .map(mapDocumentToCheatSheetSession);
        setSessions(docs);
      } catch {
        // Non-critical
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, []);

  function handleDelete(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleTitleChange(id: string, newTitle: string) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    try {
      await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/15 border border-indigo-500/20">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold">Cheat Sheets</h1>
        </div>
        <button
          onClick={() => router.push('/cheat-sheets/new')}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 hover:border-indigo-400/40 text-indigo-300 hover:text-indigo-200 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Cheat Sheet
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-white/4 border border-white/8 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25 mb-6">
                <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No cheat sheets yet</h2>
              <p className="text-white/45 text-sm mb-6 max-w-xs">
                Create your first cheat sheet from your documents or pasted content.
              </p>
              <button
                onClick={() => router.push('/cheat-sheets/new')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 hover:text-indigo-200 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Cheat Sheet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <CheatSheetCard
                  key={session.id}
                  session={session}
                  onDelete={handleDelete}
                  onTitleChange={handleTitleChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
