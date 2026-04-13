'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProblemUploadZone } from './_components/ProblemUploadZone';
import { SessionCard, type ProblemSession } from './_components/SessionCard';

export default function ProblemSolverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('projectId')?.trim() || null;
  const isProjectMode = !!projectId;

  const [sessions, setSessions] = useState<ProblemSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setIsLoading(true);
        setError(null);
        const url = projectId
          ? `/api/problem-solver/sessions?folder_id=${encodeURIComponent(projectId)}`
          : '/api/problem-solver/sessions';
        const res = await fetch(url);
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
  }, [projectId]);

  const solvedSessions = sessions.filter((session) => session.status === 'done');
  const sortedSessions = [...solvedSessions].sort((a, b) => {
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

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0 flex items-center gap-3">
        {isProjectMode && (
          <button
            onClick={() => router.push(`/projects/${encodeURIComponent(projectId!)}`)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
            title="Back to project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-xl font-semibold">Problem Solver</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight mb-2">
              What problem would you like to{' '}
              <span className="bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
                solve?
              </span>
            </h2>
            <p className="text-white/50 text-sm">
              Upload your problem PDF and get a clear, step-by-step solution in seconds.
            </p>
          </div>

          <div className="mb-10">
            <ProblemUploadZone projectId={projectId} />
          </div>

          {!isProjectMode && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white/60">Previous solved problems</h2>
              {!isLoading && !error && solvedSessions.length > 0 && (
                <span className="text-xs text-white/35">
                  {solvedSessions.length} total
                </span>
              )}
            </div>

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-5 h-36" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs text-white/60 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && solvedSessions.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/50">
                No solved problems yet.
              </div>
            )}

            {!isLoading && !error && solvedSessions.length > 0 && (
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
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
