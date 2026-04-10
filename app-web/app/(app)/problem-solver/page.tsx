'use client';

import { useEffect, useState } from 'react';
import { ProblemUploadZone } from './_components/ProblemUploadZone';
import { SessionCard, type ProblemSession } from './_components/SessionCard';

export default function ProblemSolverPage() {
  const [sessions, setSessions] = useState<ProblemSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/problem-solver/sessions');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load sessions');
        }
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, []);

  // F4-M1.7 — sort: 'solving' first, then by created_at DESC
  const sortedSessions = [...sessions].sort((a, b) => {
    const aIsSolving = a.status === 'solving' ? 0 : 1;
    const bIsSolving = b.status === 'solving' ? 0 : 1;
    if (aIsSolving !== bIsSolving) return aIsSolving - bIsSolving;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  function handleDelete(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleTitleChange(id: string, newTitle: string) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    try {
      await fetch(`/api/problem-solver/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch {
      // Silently ignore — title already updated optimistically
    }
  }

  const hasSessions = sessions.length > 0;

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Problem Solver</h1>
            {!isLoading && hasSessions && (
              <p className="text-xs text-white/40 mt-0.5">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {hasSessions && (
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/90
                hover:bg-orange-500/95 text-white font-medium text-sm transition-all duration-200
                border border-orange-300/20 shadow-sm shadow-orange-500/5 hover:shadow-md hover:shadow-orange-500/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Problem
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Loading skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-5 h-36" />
              ))}
            </div>
          )}

          {/* Error */}
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

          {/* F4-M1.7 — Empty state: improved with direct upload zone */}
          {!isLoading && !error && !hasSessions && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-full max-w-lg">
                <div className="mb-8 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-orange-500/15 border border-orange-500/25 mb-5 mx-auto">
                    <svg
                      className="w-8 h-8 text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.98 14.98 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">No problems yet</h2>
                  <p className="text-white/45 text-sm max-w-xs mx-auto">
                    Upload a problem PDF and let AI solve it step by step.
                  </p>
                </div>
                <ProblemUploadZone />
              </div>
            </div>
          )}

          {/* Sessions list */}
          {!isLoading && !error && hasSessions && (
            <>
              {/* Inline upload zone (toggled) */}
              {showUpload && (
                <div className="mb-8">
                  <ProblemUploadZone />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onDelete={handleDelete}
                    onTitleChange={handleTitleChange}
                  />
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
