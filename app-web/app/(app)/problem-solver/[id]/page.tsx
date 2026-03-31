'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PdfViewer } from '@/app/(app)/documents/_components/PdfViewer';
import { SolutionPanel } from '../_components/SolutionPanel';
import { ProblemPublishModal } from '../_components/ProblemPublishModal';
import type { SessionStatus, ProblemSession } from '../_components/SessionCard';

const DEFAULT_RIGHT_PANEL_WIDTH_PCT = 50;
const MIN_RIGHT_PANEL_WIDTH_PCT = 35;
const MAX_RIGHT_PANEL_WIDTH_PCT = 70;

interface SelectedContextItem {
  id: string;
  text: string;
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

  // PDF local pan/zoom
  const [pdfPan, setPdfPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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

  // Inline chat — selected text contexts (multiple selections)
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([]);

  // Resizable split layout
  const [rightPanelWidthPct, setRightPanelWidthPct] = useState(DEFAULT_RIGHT_PANEL_WIDTH_PCT);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const splitLayoutRef = useRef<HTMLDivElement>(null);

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
  // Split layout resize
  // ---------------------------------------------------------------------------

  const clampRightPanelWidth = useCallback((value: number) => {
    return Math.min(MAX_RIGHT_PANEL_WIDTH_PCT, Math.max(MIN_RIGHT_PANEL_WIDTH_PCT, value));
  }, []);

  const updateSplitFromClientX = useCallback((clientX: number) => {
    const rect = splitLayoutRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const leftPct = ((clientX - rect.left) / rect.width) * 100;
    const nextRightPct = clampRightPanelWidth(100 - leftPct);
    setRightPanelWidthPct(nextRightPct);
  }, [clampRightPanelWidth]);

  function handleSplitPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizingPanels(true);
    updateSplitFromClientX(e.clientX);
  }

  function handleSplitPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isResizingPanels) return;
    updateSplitFromClientX(e.clientX);
  }

  function handleSplitPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizingPanels(false);
  }

  function handleSplitKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setRightPanelWidthPct((prev) => clampRightPanelWidth(prev + 2));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setRightPanelWidthPct((prev) => clampRightPanelWidth(prev - 2));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setRightPanelWidthPct(MIN_RIGHT_PANEL_WIDTH_PCT);
    } else if (e.key === 'End') {
      e.preventDefault();
      setRightPanelWidthPct(MAX_RIGHT_PANEL_WIDTH_PCT);
    }
  }

  useEffect(() => {
    if (!isResizingPanels) return;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isResizingPanels]);

  // ---------------------------------------------------------------------------
  // PDF local zoom (trackpad pinch / Ctrl+wheel) & pan (drag)
  // ---------------------------------------------------------------------------

  const MIN_PDF_ZOOM = 30;
  const MAX_PDF_ZOOM = 400;

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      // Pinch-to-zoom on trackpad sends ctrlKey + deltaY
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = -e.deltaY;
        setPdfZoom((z) => Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, z + delta * 0.5)));
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function handlePdfPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only pan with left button (or touch)
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pdfPan.x, panY: pdfPan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePdfPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPdfPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  }

  function handlePdfPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (isPanning) {
      setIsPanning(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  }

  function resetPdfView() {
    setPdfZoom(100);
    setPdfPan({ x: 0, y: 0 });
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
  const leftPanelWidthPct = 100 - rightPanelWidthPct;

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
              className="bg-white/10 border border-white/25 rounded-lg px-2.5 py-1 text-sm font-semibold
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
                onClick={() => setPdfZoom((z) => Math.max(MIN_PDF_ZOOM, z - 10))}
                className="p-1.5 rounded-lg hover:bg-white/8 hover:text-white transition-colors text-xs font-mono"
              >
                −
              </button>
              <button
                onClick={resetPdfView}
                className="text-xs w-10 text-center hover:text-white transition-colors"
                title="Reset zoom & pan"
              >
                {Math.round(pdfZoom)}%
              </button>
              <button
                onClick={() => setPdfZoom((z) => Math.min(MAX_PDF_ZOOM, z + 10))}
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

      {/* ── Resizable split layout ── */}
      <div ref={splitLayoutRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: PDF Viewer with local zoom/pan */}
        <div
          ref={pdfContainerRef}
          className={`border-r border-white/10 flex flex-col min-h-0 overflow-hidden bg-black/20 relative ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ width: `${leftPanelWidthPct}%`, touchAction: 'none' }}
          onPointerDown={handlePdfPointerDown}
          onPointerMove={handlePdfPointerMove}
          onPointerUp={handlePdfPointerUp}
          onPointerCancel={handlePdfPointerUp}
        >
          {pdfUrl ? (
            <div
              className="flex-1 min-h-0 overflow-hidden"
              style={{
                transform: `translate(${pdfPan.x}px, ${pdfPan.y}px)`,
                willChange: isPanning ? 'transform' : 'auto',
              }}
            >
              <PdfViewer
                url={pdfUrl}
                zoom={pdfZoom}
                currentPage={pdfPage}
                onTotalPages={(total) => setPdfTotalPages(total)}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/30">
              {session.pdf_path ? (
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Loading PDF...</p>
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

        {/* Splitter handle */}
        <button
          type="button"
          role="separator"
          aria-label="Resize solution panel width"
          aria-orientation="vertical"
          aria-valuemin={MIN_RIGHT_PANEL_WIDTH_PCT}
          aria-valuemax={MAX_RIGHT_PANEL_WIDTH_PCT}
          aria-valuenow={Math.round(rightPanelWidthPct)}
          onPointerDown={handleSplitPointerDown}
          onPointerMove={handleSplitPointerMove}
          onPointerUp={handleSplitPointerUp}
          onPointerCancel={handleSplitPointerUp}
          onKeyDown={handleSplitKeyDown}
          onDoubleClick={() => setRightPanelWidthPct(DEFAULT_RIGHT_PANEL_WIDTH_PCT)}
          title="Drag to resize (double-click to reset)"
          className={`group absolute top-0 bottom-0 -translate-x-1/2 w-4 z-20 cursor-col-resize touch-none
            flex items-center justify-center transition-colors ${
              isResizingPanels ? 'bg-orange-500/10' : 'hover:bg-white/10'
            }`}
          style={{ left: `${leftPanelWidthPct}%` }}
        >
          <span
            className={`h-16 w-[2px] rounded-full transition-colors ${
              isResizingPanels ? 'bg-orange-400' : 'bg-white/25 group-hover:bg-white/45'
            }`}
          />
        </button>

        {/* Right: Solution Panel */}
        <div
          className="flex flex-col min-h-0 overflow-hidden"
          style={{ width: `${rightPanelWidthPct}%` }}
        >
          <SolutionPanel
            sessionId={sessionId}
            solutionMd={displayMd}
            status={activeStatus}
            isStreaming={isStreaming}
            onSolve={handleSolve}
            selectedContexts={selectedContexts}
            onTextSelect={(context) => {
              setSelectedContexts((prev) => (
                prev.some((item) => item.text === context.text)
                  ? prev
                  : [...prev, context]
              ));
            }}
            onClearContext={(id) => setSelectedContexts((prev) => prev.filter((item) => item.id !== id))}
            onClearAllContexts={() => setSelectedContexts([])}
          />
        </div>

      </div>

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
