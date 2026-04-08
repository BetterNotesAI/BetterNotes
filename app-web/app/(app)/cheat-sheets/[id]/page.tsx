'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheatSheetPanel } from '../_components/CheatSheetPanel';
import { CheatSheetInlineChat } from '../_components/CheatSheetInlineChat';
import type { CheatSheetSession, CheatSheetStatus } from '../_components/CheatSheetCard';

interface SelectedContextItem {
  id: string;
  text: string;
}

function StatusBadge({ status }: { status: CheatSheetStatus }) {
  const map: Record<CheatSheetStatus, { label: string; classes: string; dot: string }> = {
    pending: {
      label: 'Pending',
      classes: 'text-white/50 bg-white/8 border-white/15',
      dot: 'bg-white/40',
    },
    generating: {
      label: 'Generating',
      classes: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
      dot: 'bg-indigo-400 animate-pulse',
    },
    done: {
      label: 'Done',
      classes: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
      dot: 'bg-emerald-400',
    },
    error: {
      label: 'Error',
      classes: 'text-red-400 bg-red-500/15 border-red-500/25',
      dot: 'bg-red-400',
    },
  };
  const { label, classes, dot } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function CheatSheetSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? '';
  const router = useRouter();

  const [session, setSession] = useState<CheatSheetSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Content streaming
  const [streamedMd, setStreamedMd] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline chat contexts
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([]);

  // ---------------------------------------------------------------------------
  // Load session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadSession() {
      try {
        setIsLoadingSession(true);
        setLoadError(null);
        const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? 'Failed to load session');
        }
        const data = await res.json() as { session: CheatSheetSession & { content_md?: string } };
        const s = data.session;
        setSession(s);
        setTitleDraft(s.title);
        if (s.content_md) setStreamedMd(s.content_md);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingSession(false);
      }
    }
    loadSession();
  }, [sessionId]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ---------------------------------------------------------------------------
  // Generate with AI (SSE streaming)
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!session) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsStreaming(true);
    setStreamedMd('');
    setSession((prev) => prev ? { ...prev, status: 'generating' } : prev);

    try {
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Generate request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              if (parsed.done === true) {
                setIsStreaming(false);
                setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
                return;
              } else if (typeof parsed.chunk === 'string') {
                setStreamedMd((prev) => (prev ?? '') + parsed.chunk);
              } else if (typeof parsed.error === 'string') {
                setIsStreaming(false);
                setSession((prev) => prev ? { ...prev, status: 'error' } : prev);
                return;
              }
            } catch {
              // Non-JSON event, ignore
            }
          }
        }
      }

      setIsStreaming(false);
      setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsStreaming(false);
      setSession((prev) => prev ? { ...prev, status: 'error' } : prev);
    }
  }, [session, sessionId]);

  // ---------------------------------------------------------------------------
  // Title editing
  // ---------------------------------------------------------------------------

  function startEditTitle() {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim() || (session?.title ?? '');
    setTitleDraft(trimmed);
    setSession((prev) => prev ? { ...prev, title: trimmed } : prev);
    try {
      await fetch(`/api/cheat-sheets/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoadingSession) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white">
        <div className="border-b border-white/10 px-6 py-4 shrink-0 animate-pulse">
          <div className="h-5 w-48 bg-white/8 rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{loadError ?? 'Session not found'}</p>
        <button
          onClick={() => router.push('/cheat-sheets')}
          className="text-xs text-white/50 hover:text-white underline"
        >
          Back to Cheat Sheets
        </button>
      </div>
    );
  }

  const activeStatus = session.status;
  const displayMd = streamedMd ?? null;

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b border-white/10 px-6 py-3 shrink-0 flex items-center justify-between gap-4">
        {/* Left: back + title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/cheat-sheets')}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(session.title);
                  setEditingTitle(false);
                }
              }}
              className="bg-white/10 border border-white/25 rounded-lg px-2.5 py-1 text-sm font-semibold
                text-white outline-none focus:border-indigo-400/50 min-w-0 w-64"
            />
          ) : (
            <button
              onClick={startEditTitle}
              className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors truncate max-w-xs"
              title="Click to rename"
            >
              {titleDraft}
            </button>
          )}

          <StatusBadge status={activeStatus} />

          {session.subject && (
            <span className="hidden sm:block text-[11px] text-white/30 truncate max-w-[120px]">
              {session.subject}
            </span>
          )}
        </div>

        {/* Right: Generate button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15
              hover:border-indigo-500/40 bg-white/4 hover:bg-indigo-500/10 text-white/60
              hover:text-indigo-300 text-xs font-medium transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <>
                <div className="w-3 h-3 border border-indigo-400/50 border-t-indigo-300 rounded-full animate-spin" />
                Generating...
              </>
            ) : activeStatus === 'done' || displayMd ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main layout: panel + inline chat ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Cheat sheet panel — takes available space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <CheatSheetPanel
            sessionId={sessionId}
            contentMd={displayMd}
            status={activeStatus}
            isStreaming={isStreaming}
            onGenerate={handleGenerate}
            selectedContexts={selectedContexts}
            onTextSelect={(context) => {
              setSelectedContexts((prev) =>
                prev.some((item) => item.text === context.text)
                  ? prev
                  : [...prev, context]
              );
            }}
            onClearContext={(id) => setSelectedContexts((prev) => prev.filter((item) => item.id !== id))}
            onClearAllContexts={() => setSelectedContexts([])}
          />
        </div>

        {/* Inline chat — shown when session has content */}
        <div className="shrink-0 border-t border-white/8">
          <CheatSheetInlineChat
            sessionId={sessionId}
            selectedContexts={selectedContexts}
            onClearContext={(id) => setSelectedContexts((prev) => prev.filter((item) => item.id !== id))}
            onClearAllContexts={() => setSelectedContexts([])}
          />
        </div>
      </div>
    </div>
  );
}
