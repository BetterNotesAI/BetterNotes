'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PdfViewer } from '@/app/(app)/documents/_components/PdfViewer';
import { SolutionPanel } from '../_components/SolutionPanel';
import { ProblemPublishModal } from '../_components/ProblemPublishModal';
import { GuestSignupModal } from '@/app/_components/GuestSignupModal';
import {
  consumePendingGenerationIntent,
  savePendingGenerationIntent,
} from '@/lib/pending-generation-intent';
import type { SessionStatus, ProblemSession } from '../_components/SessionCard';

const DEFAULT_RIGHT_PANEL_WIDTH_PCT = 50;
const MIN_RIGHT_PANEL_WIDTH_PCT = 35;
const MAX_RIGHT_PANEL_WIDTH_PCT = 70;

interface SelectedContextItem {
  id: string;
  text: string;
}

interface PendingProblemSolvePayload {
  provider: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSolveError(message: string): string {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('no readable text')
    || lower.includes('pdf text not extracted')
    || lower.includes('pdftext is required')
  ) {
    return 'No readable text was extracted from this PDF. It is likely image-only/scanned. Upload a text PDF or run OCR first.';
  }
  if (lower.includes('limit_reached')) {
    return 'You have reached your credit limit for now. Please wait or upgrade your plan.';
  }
  if (lower.includes('all providers failed')) {
    return 'The AI providers failed to respond to this problem. Please try again in a moment.';
  }
  if (!trimmed) {
    return 'Something went wrong while solving.';
  }
  return trimmed.length > 220 ? `${trimmed.slice(0, 220).trimEnd()}...` : trimmed;
}

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
  const sessionId = params?.id ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams?.get('projectId')?.trim() || null;

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
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfViewportRef = useRef<HTMLDivElement>(null);
  const lastGestureScaleRef = useRef<number | null>(null);

  // Solution streaming
  const [streamedMd, setStreamedMd] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Publish modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Model selector
  const [availableProviders, setAvailableProviders] = useState<Array<{ name: string; model: string }>>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const hasResumedPendingIntentRef = useRef(false);

  // Inline chat — selected text contexts (multiple selections)
  const [selectedContexts, setSelectedContexts] = useState<SelectedContextItem[]>([]);

  // Resizable split layout
  const [rightPanelWidthPct, setRightPanelWidthPct] = useState(DEFAULT_RIGHT_PANEL_WIDTH_PCT);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const splitLayoutRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Load available providers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch('/api/problem-solver/providers');
        if (!res.ok) return;
        const data = await res.json() as { providers: Array<{ name: string; model: string }> };
        setAvailableProviders(data.providers ?? []);
      } catch {
        // Non-critical
      }
    }
    loadProviders();
  }, []);

  const currentReturnUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.pathname}${window.location.search}`;
    }
    if (projectIdFromQuery) {
      return `/problem-solver/${sessionId}?projectId=${encodeURIComponent(projectIdFromQuery)}`;
    }
    return `/problem-solver/${sessionId}`;
  }, [projectIdFromQuery, sessionId]);

  useEffect(() => {
    let mounted = true;

    async function loadGuestStatus() {
      try {
        const resp = await fetch('/api/guest-status', { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json() as { is_guest?: boolean; is_authenticated?: boolean };
        if (!mounted) return;
        setIsGuest(Boolean(data.is_guest));
        setIsAuthenticated(data.is_authenticated !== false);
      } catch {
        // non-fatal
      }
    }

    loadGuestStatus();
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadGuestStatus();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
        const s = data.session as ProblemSession & { pdf_text?: string | null };
        setSession(s);
        setTitleDraft(s.title);
        if (s.status === 'error' && (!s.pdf_text || !s.pdf_text.trim())) {
          setSolveError(normalizeSolveError('No readable text was extracted from this PDF.'));
        } else {
          setSolveError(null);
        }
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

  const openAuthForSolve = useCallback((provider: string) => {
    savePendingGenerationIntent<PendingProblemSolvePayload>({
      type: 'problem_solve',
      path: currentReturnUrl(),
      payload: { provider },
    });

    if (isGuest) {
      setShowGuestModal(true);
      return;
    }

    const returnUrl = encodeURIComponent(currentReturnUrl());
    router.push(`/login?returnUrl=${returnUrl}&reason=problem_solver_login_required`);
  }, [currentReturnUrl, isGuest, router]);

  const handleSolve = useCallback(async (providerOverride?: string) => {
    if (!session) return;
    const providerToUse = providerOverride ?? selectedProvider;

    if (isGuest || !isAuthenticated) {
      openAuthForSolve(providerToUse);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsStreaming(true);
    setSolveError(null);
    setStreamedMd('');
    setSession((prev) => prev ? { ...prev, status: 'solving' } : prev);

    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerToUse ? { provider: providerToUse } : {}),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const rawError = typeof data.error === 'string' ? data.error.toLowerCase() : '';
        if (
          rawError.includes('unauthorized')
          || rawError.includes('account_required_for_generation')
          || rawError.includes('account_required_for_long_document')
        ) {
          setIsStreaming(false);
          setSession((prev) => prev ? { ...prev, status: 'pending' } : prev);
          openAuthForSolve(providerToUse);
          return;
        }
        throw new Error(data.error ?? `Solve request failed (${res.status})`);
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
                setSolveError(null);
                setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
                return;
              } else if (typeof parsed.chunk === 'string') {
                setStreamedMd((prev) => (prev ?? '') + parsed.chunk);
              } else if (typeof parsed.error === 'string') {
                setIsStreaming(false);
                setSolveError(normalizeSolveError(parsed.error));
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
      setSolveError(null);
      setSession((prev) => prev ? { ...prev, status: 'done' } : prev);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const rawMessage = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        rawMessage.includes('unauthorized')
        || rawMessage.includes('account_required_for_generation')
        || rawMessage.includes('account_required_for_long_document')
      ) {
        setIsStreaming(false);
        setSession((prev) => prev ? { ...prev, status: 'pending' } : prev);
        openAuthForSolve(providerToUse);
        return;
      }
      setIsStreaming(false);
      setSolveError(normalizeSolveError(err instanceof Error ? err.message : 'Solve request failed'));
      setSession((prev) => prev ? { ...prev, status: 'error' } : prev);
    }
  }, [
    isAuthenticated,
    isGuest,
    openAuthForSolve,
    selectedProvider,
    session,
    sessionId,
  ]);

  useEffect(() => {
    if (!session) return;
    if (isGuest || !isAuthenticated) return;
    if (hasResumedPendingIntentRef.current) return;

    const pending = consumePendingGenerationIntent<PendingProblemSolvePayload>({
      type: 'problem_solve',
      path: currentReturnUrl(),
    });
    if (!pending) return;

    hasResumedPendingIntentRef.current = true;
    void handleSolve(pending.payload?.provider ?? '');
  }, [currentReturnUrl, handleSolve, isAuthenticated, isGuest, session]);

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

  const clampPdfZoom = useCallback((value: number) => {
    return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, value));
  }, []);

  const applyPdfZoomDelta = useCallback((
    delta: number,
    anchor?: { clientX: number; clientY: number },
  ) => {
    const viewport = pdfViewportRef.current;
    setPdfZoom((prev) => {
      const next = clampPdfZoom(prev + delta);
      if (!viewport || next === prev) return next;

      const rect = viewport.getBoundingClientRect();
      const anchorX = anchor ? anchor.clientX - rect.left : rect.width / 2;
      const anchorY = anchor ? anchor.clientY - rect.top : rect.height / 2;

      const contentX = viewport.scrollLeft + anchorX;
      const contentY = viewport.scrollTop + anchorY;
      const ratio = next / prev;

      requestAnimationFrame(() => {
        const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        viewport.scrollLeft = Math.min(maxLeft, Math.max(0, contentX * ratio - anchorX));
        viewport.scrollTop = Math.min(maxTop, Math.max(0, contentY * ratio - anchorY));
      });

      return next;
    });
  }, [clampPdfZoom]);

  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || !pdfUrl) return;

    type GestureEventLike = Event & {
      scale: number;
      clientX: number;
      clientY: number;
      preventDefault: () => void;
      stopPropagation: () => void;
    };

    function isInsidePdfPanel(target: EventTarget | null): target is Node {
      return target instanceof Node && container!.contains(target);
    }

    function onWheel(e: WheelEvent) {
      if (!isInsidePdfPanel(e.target)) return;
      // Pinch-to-zoom on trackpad sends ctrlKey + deltaY
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        applyPdfZoomDelta(-e.deltaY * 0.4, { clientX: e.clientX, clientY: e.clientY });
      }
    }

    // Safari trackpad pinch emits gesture events (not wheel+ctrl).
    function onGestureStart(evt: Event) {
      const e = evt as GestureEventLike;
      if (!isInsidePdfPanel(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      lastGestureScaleRef.current = e.scale;
    }

    function onGestureChange(evt: Event) {
      const e = evt as GestureEventLike;
      if (!isInsidePdfPanel(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const prevScale = lastGestureScaleRef.current ?? e.scale;
      const deltaScale = e.scale - prevScale;
      lastGestureScaleRef.current = e.scale;

      if (Math.abs(deltaScale) < 0.0001) return;
      applyPdfZoomDelta(deltaScale * 180, { clientX: e.clientX, clientY: e.clientY });
    }

    function onGestureEnd(evt: Event) {
      const e = evt as GestureEventLike;
      if (!isInsidePdfPanel(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      lastGestureScaleRef.current = null;
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    document.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false, capture: true });
    document.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false, capture: true });
    document.addEventListener('gestureend', onGestureEnd as EventListener, { passive: false, capture: true });

    return () => {
      document.removeEventListener('wheel', onWheel, true);
      document.removeEventListener('gesturestart', onGestureStart as EventListener, true);
      document.removeEventListener('gesturechange', onGestureChange as EventListener, true);
      document.removeEventListener('gestureend', onGestureEnd as EventListener, true);
    };
  }, [applyPdfZoomDelta, pdfUrl]);

  function handlePdfPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pdfUrl) return;
    // Only pan with left button for mouse (touch/pen don't use button the same way)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const viewport = pdfViewportRef.current;
    if (!viewport) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePdfPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning) return;
    const viewport = pdfViewportRef.current;
    if (!viewport) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    viewport.scrollLeft = panStartRef.current.scrollLeft - dx;
    viewport.scrollTop = panStartRef.current.scrollTop - dy;
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
    pdfViewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  useEffect(() => {
    if (!isPanning) return;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isPanning]);

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
    const fallbackBackHref = projectIdFromQuery
      ? `/projects/${encodeURIComponent(projectIdFromQuery)}`
      : '/problem-solver';
    return (
      <div className="h-full flex flex-col bg-transparent text-white items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{loadError ?? 'Session not found'}</p>
        <button
          onClick={() => router.push(fallbackBackHref)}
          className="text-xs text-white/50 hover:text-white underline"
        >
          {projectIdFromQuery ? 'Back to Notebook' : 'Back to Problem Solver'}
        </button>
      </div>
    );
  }

  const resolvedProjectId = projectIdFromQuery || (session.folder_id ?? null);
  const backHref = resolvedProjectId
    ? `/projects/${encodeURIComponent(resolvedProjectId)}`
    : '/problem-solver';
  const backLabel = resolvedProjectId ? 'Back to Notebook' : 'Back to Problem Solver';

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
            onClick={() => router.push(backHref)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors"
            title={backLabel}
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

        {/* Right: Model selector + PDF controls + Publish */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Model selector dropdown */}
          {availableProviders.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/15
                  hover:border-orange-500/40 bg-white/4 hover:bg-orange-500/10 text-white/60
                  hover:text-orange-300 text-[11px] font-medium transition-all duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
                {selectedProvider
                  ? (availableProviders.find((p) => p.name === selectedProvider)?.model ?? selectedProvider)
                  : 'Auto'}
                <svg className={`w-2.5 h-2.5 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isModelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsModelDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-72 rounded-xl border border-white/15
                    bg-[#1a1a1a]/95 backdrop-blur-md shadow-xl shadow-black/40 p-1.5 space-y-0.5">
                    {/* Auto option */}
                    <button
                      onClick={() => { setSelectedProvider(''); setIsModelDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors ${
                        !selectedProvider
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'text-white/60 hover:bg-white/8 hover:text-white/80'
                      }`}
                    >
                      <div className="font-medium">Auto (cadena de fallback)</div>
                      <div className="text-[10px] text-white/35 mt-0.5">
                        Prueba cada modelo en orden hasta que uno responda
                      </div>
                    </button>

                    <div className="h-px bg-white/8 mx-2 my-1" />

                    {availableProviders.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => { setSelectedProvider(p.name); setIsModelDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors ${
                          selectedProvider === p.name
                            ? 'bg-orange-500/15 text-orange-300'
                            : 'text-white/60 hover:bg-white/8 hover:text-white/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.model}</span>
                          <span className="text-[9px] text-white/25 uppercase tracking-wider">{p.name}</span>
                        </div>
                        <div className="text-[10px] text-white/35 mt-0.5">
                          {p.name === 'openrouter' && 'Bueno para razonamiento general. Gratuito'}
                          {p.name === 'google' && 'Rapido y ligero. Ideal para problemas simples'}
                          {p.name === 'openai' && 'Alta calidad. Mejor en matematicas complejas'}
                          {p.name === 'groq' && 'Muy rapido. Bueno para problemas de logica'}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* PDF zoom controls */}
          {pdfUrl && (
            <div className="flex items-center gap-1 text-white/50">
              <button
                onClick={() => applyPdfZoomDelta(-10)}
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
                onClick={() => applyPdfZoomDelta(10)}
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
            <PdfViewer
              url={pdfUrl}
              zoom={100}
              visualZoom={pdfZoom}
              currentPage={pdfPage}
              onTotalPages={(total) => setPdfTotalPages(total)}
              viewportRef={pdfViewportRef}
            />
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
            errorMessage={solveError}
            onSolve={() => { void handleSolve(); }}
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

      <GuestSignupModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        returnUrl={currentReturnUrl()}
      />
    </div>
  );
}
