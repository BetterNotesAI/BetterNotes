'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PdfViewer } from '@/app/(app)/documents/_components/PdfViewer';
import { SolutionPanel } from '../_components/SolutionPanel';
import { ProblemPublishModal } from '../_components/ProblemPublishModal';
import { SubChatDrawer } from '../_components/SubChatDrawer';
import { SubChatBubble } from '../_components/SubChatBubble';
import type { SessionStatus, ProblemSession } from '../_components/SessionCard';
import type { SubChatMessage } from '../_components/SubChatDrawer';

// ---------------------------------------------------------------------------
// Sub-chat types
// ---------------------------------------------------------------------------

interface SubChat {
  id: string;
  session_id: string;
  title: string;
  is_minimized: boolean;
  created_at: string;
  messages: SubChatMessage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { label: string; classes: string; dot: string }> = {
    pending: {
      label: 'Pending',
      classes: 'text-white/50 bg-white/8 border-white/15',
      dot: 'bg-white/40',
    },
    solving: {
      label: 'Solving',
      classes: 'text-orange-300 bg-orange-500/15 border-orange-500/25',
      dot: 'bg-orange-400 animate-pulse',
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProblemSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();

  // Session data
  const [session, setSession] = useState<ProblemSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // PDF signed URL
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  // Solution streaming
  const [streamedMd, setStreamedMd] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Publish modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Sub-chats
  const [subChats, setSubChats] = useState<SubChat[]>([]);
  const [activeSubChatId, setActiveSubChatId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadSession() {
      try {
        setIsLoadingSession(true);
        setLoadError(null);
        const res = await fetch(`/api/problem-solver/sessions/${sessionId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load session');
        }
        const data = await res.json();
        const s: ProblemSession = data.session;
        setSession(s);
        setTitleDraft(s.title);
        if (s.solution_md) setStreamedMd(s.solution_md);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingSession(false);
      }
    }
    loadSession();
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Load sub-chats
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadSubChats() {
      try {
        const res = await fetch(`/api/problem-solver/sessions/${sessionId}/sub-chats`);
        if (!res.ok) return;
        const data = await res.json() as { subChats: SubChat[] };
        setSubChats(data.subChats ?? []);
      } catch {
        // Non-critical
      }
    }
    loadSubChats();
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Get signed URL for PDF
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!session?.pdf_path) return;

    async function getSignedUrl() {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('problem-solver-pdfs')
        .createSignedUrl(session!.pdf_path!, 3600);

      if (!error && data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    }
    getSignedUrl();
  }, [session?.pdf_path]);

  // ---------------------------------------------------------------------------
  // Solve with AI (SSE streaming)
  // ---------------------------------------------------------------------------

  const handleSolve = useCallback(async () => {
    if (!session) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsStreaming(true);
    setStreamedMd('');
    setSession((prev) => prev ? { ...prev, status: 'solving' } : prev);

    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/solve`, {
        method: 'POST',
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Solve request failed');
      }

      // Read SSE stream
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
              // Non-JSON event (e.g. keep-alive), ignore
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

  // Clean up stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

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
      await fetch(`/api/problem-solver/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  // ---------------------------------------------------------------------------
  // Sub-chat actions
  // ---------------------------------------------------------------------------

  async function handleAskQuestion() {
    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/sub-chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Question' }),
      });
      if (!res.ok) return;
      const data = await res.json() as { subChat: Omit<SubChat, 'messages'> };
      const newSubChat: SubChat = { ...data.subChat, messages: [] };
      setSubChats((prev) => [...prev, newSubChat]);
      setActiveSubChatId(newSubChat.id);
    } catch {
      // Silently fail
    }
  }

  async function handleMinimizeSubChat(scId: string) {
    setActiveSubChatId(null);
    setSubChats((prev) =>
      prev.map((sc) => (sc.id === scId ? { ...sc, is_minimized: true } : sc)),
    );
    try {
      await fetch(`/api/problem-solver/sessions/${sessionId}/sub-chats/${scId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_minimized: true }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  async function handleExpandSubChat(scId: string) {
    setSubChats((prev) =>
      prev.map((sc) => (sc.id === scId ? { ...sc, is_minimized: false } : sc)),
    );
    setActiveSubChatId(scId);
    try {
      await fetch(`/api/problem-solver/sessions/${sessionId}/sub-chats/${scId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_minimized: false }),
      });
    } catch {
      // Optimistic update stays
    }
  }

  async function handleDeleteSubChat(scId: string) {
    setSubChats((prev) => prev.filter((sc) => sc.id !== scId));
    if (activeSubChatId === scId) setActiveSubChatId(null);
    try {
      await fetch(`/api/problem-solver/sessions/${sessionId}/sub-chats/${scId}`, {
        method: 'DELETE',
      });
    } catch {
      // Optimistic update stays
    }
  }

  function handleSubChatMessagesUpdate(scId: string, messages: SubChatMessage[]) {
    setSubChats((prev) =>
      prev.map((sc) => (sc.id === scId ? { ...sc, messages } : sc)),
    );
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
          <div className="w-6 h-6 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{loadError ?? 'Session not found'}</p>
        <button
          onClick={() => router.push('/problem-solver')}
          className="text-xs text-white/50 hover:text-white underline"
        >
          Back to Problem Solver
        </button>
      </div>
    );
  }

  const activeStatus = session.status;
  const displayMd = streamedMd ?? session.solution_md ?? null;

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b border-white/10 px-6 py-3 shrink-0 flex items-center justify-between gap-4">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/problem-solver')}
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
              className="bg-white/8 border border-white/20 rounded-lg px-2.5 py-1 text-sm font-semibold
                text-white outline-none focus:border-orange-400/50 min-w-0 w-64"
            />
          ) : (
            <button
              onClick={startEditTitle}
              className="text-sm font-semibold text-white hover:text-orange-300 transition-colors truncate max-w-xs"
              title="Click to rename"
            >
              {titleDraft}
            </button>
          )}

          <StatusBadge status={activeStatus} />
        </div>

        {/* Right: PDF controls + Publish */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PDF zoom controls */}
          {pdfUrl && (
            <div className="flex items-center gap-1 text-white/50">
              <button
                onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}
                className="p-1.5 rounded-lg hover:bg-white/8 hover:text-white transition-colors text-xs font-mono"
              >
                −
              </button>
              <span className="text-xs w-10 text-center">{pdfZoom}%</span>
              <button
                onClick={() => setPdfZoom((z) => Math.min(200, z + 10))}
                className="p-1.5 rounded-lg hover:bg-white/8 hover:text-white transition-colors text-xs font-mono"
              >
                +
              </button>
              {pdfTotalPages > 1 && (
                <span className="text-xs text-white/30 ml-1">
                  {pdfPage}/{pdfTotalPages}
                </span>
              )}
            </div>
          )}

          {/* F4-M1.6 — Publish button */}
          <button
            onClick={() => setIsPublishModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15
              hover:border-orange-500/40 bg-white/4 hover:bg-orange-500/10 text-white/60
              hover:text-orange-300 text-xs font-medium transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
              />
            </svg>
            {session?.is_published ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ── Split layout 50/50 ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: PDF Viewer */}
        <div className="w-1/2 border-r border-white/10 flex flex-col min-h-0 overflow-hidden bg-black/20">
          {pdfUrl ? (
            <PdfViewer
              url={pdfUrl}
              zoom={pdfZoom}
              currentPage={pdfPage}
              onTotalPages={(total) => setPdfTotalPages(total)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/30">
              {session.pdf_path ? (
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Loading PDF…</p>
                </div>
              ) : (
                <div className="text-center space-y-2 px-8">
                  <svg className="w-10 h-10 mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs">No PDF attached</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Solution Panel */}
        <div className="w-1/2 flex flex-col min-h-0 overflow-hidden">
          <SolutionPanel
            solutionMd={displayMd}
            status={activeStatus}
            isStreaming={isStreaming}
            onSolve={handleSolve}
            onAskQuestion={handleAskQuestion}
          />
        </div>

        {/* SubChatDrawer — fixed overlay from the right edge */}
        {activeSubChatId && (() => {
          const activeSubChat = subChats.find((sc) => sc.id === activeSubChatId);
          if (!activeSubChat) return null;
          return (
            <SubChatDrawer
              sessionId={sessionId}
              subChatId={activeSubChat.id}
              title={activeSubChat.title}
              messages={activeSubChat.messages}
              onClose={() => handleDeleteSubChat(activeSubChat.id)}
              onMinimize={() => handleMinimizeSubChat(activeSubChat.id)}
              onMessagesUpdate={(msgs) => handleSubChatMessagesUpdate(activeSubChat.id, msgs)}
            />
          );
        })()}
      </div>

      {/* SubChatBubbles — fixed bottom-right stack for minimized sub-chats */}
      {subChats.filter((sc) => sc.is_minimized && sc.id !== activeSubChatId).length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse gap-2 items-end">
          {subChats
            .filter((sc) => sc.is_minimized && sc.id !== activeSubChatId)
            .map((sc) => (
              <SubChatBubble
                key={sc.id}
                subChatId={sc.id}
                sessionId={sessionId}
                title={sc.title}
                onExpand={() => handleExpandSubChat(sc.id)}
                onDelete={() => handleDeleteSubChat(sc.id)}
              />
            ))}
        </div>
      )}

      {/* F4-M1.6 — Publish Modal */}
      <ProblemPublishModal
        sessionId={sessionId}
        sessionTitle={session.title}
        isOpen={isPublishModalOpen}
        initialData={{
          is_published: session.is_published ?? false,
          university: session.university,
          degree: session.degree,
          subject: session.subject,
          visibility: session.visibility ?? undefined,
          keywords: session.keywords ?? undefined,
        }}
        onClose={() => setIsPublishModalOpen(false)}
        onSuccess={(published) => {
          setSession((prev) =>
            prev ? { ...prev, is_published: published } : prev
          );
        }}
      />
    </div>
  );
}
