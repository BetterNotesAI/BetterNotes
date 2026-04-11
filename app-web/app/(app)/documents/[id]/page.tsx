'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PdfViewer } from '../_components/PdfViewer';
import { ChatPanel } from '../_components/ChatPanel';
import { UsageBanner } from '../_components/UsageBanner';
import { UpgradeModal } from '../_components/UpgradeModal';
import { LatexHighlighter } from '../_components/LatexHighlighter';
import { WorkspaceAttachmentsPanel } from '../_components/WorkspaceAttachmentsPanel';
import { useDocumentWorkspace, GenerationPhase } from '../_hooks/useDocumentWorkspace';
import { useChatMessages } from '../_hooks/useChatMessages';
import { GuestSignupModal } from '@/app/_components/GuestSignupModal';
import { createClient } from '@/lib/supabase/client';
import LatexViewer, { type BlockReference } from '@/components/viewer/LatexViewer';
import { PublishModal } from '../_components/PublishModal';

type ViewerTab = 'interactive' | 'pdf' | 'latex' | 'split';

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: '3-Col Landscape',
  cornell: 'Cornell Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Lecture Notes',
  long_template: 'Long Document',
};

function getLoadingLabel(phase: GenerationPhase): string | undefined {
  if (phase === 'calling_ai') return 'Asking the AI...';
  if (phase === 'compiling') return 'Compiling LaTeX...';
  if (phase === 'uploading') return 'Finalizing PDF...';
  return undefined;
}

function InitialPromptSender({
  isDraft,
  isDocReady,
  onSend,
}: {
  isDraft: boolean;
  isDocReady: boolean;
  onSend: (msg: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sentRef = useRef(false);

  useEffect(() => {
    if (!isDraft || !isDocReady || sentRef.current) return;
    const prompt = searchParams?.get('prompt');
    if (!prompt) return;
    sentRef.current = true;
    router.replace(window.location.pathname, { scroll: false });
    onSend(prompt);
  }, [isDraft, isDocReady, searchParams, router, onSend]);

  return null;
}

export default function DocumentWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const documentId = params?.id ?? '';
  const backListHref = pathname.startsWith('/cheat-sheets/') ? '/cheat-sheets' : '/documents';
  const backListLabel = backListHref === '/cheat-sheets' ? 'Back to cheat sheets' : 'Back to documents';

  const {
    document: docData,
    pdfSignedUrl,
    latexContent,
    versions,
    activeVersionId,
    isLoading,
    isGenerating,
    generationPhase,
    error: wsError,
    generate,
    reload: reloadDocument,
    switchVersion,
  } = useDocumentWorkspace(documentId);

  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [renameTitleValue, setRenameTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (isRenamingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isRenamingTitle]);

  const commitTitleRename = useCallback(async () => {
    const trimmed = renameTitleValue.trim();
    setIsRenamingTitle(false);
    if (!trimmed || !docData || trimmed === docData.title) return;
    await fetch(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    reloadDocument();
  }, [renameTitleValue, docData, documentId, reloadDocument]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [usagePlan, setUsagePlan] = useState<'free' | 'pro' | null>(null);
  // isGuest state value is reserved for future gating UI (currently only used for auth listener)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isGuest, setIsGuest] = useState(false);

  const [mobileTab, setMobileTab] = useState<'pdf' | 'chat'>('pdf');
  const [viewerTab, setViewerTab] = useState<ViewerTab>('interactive');
  // F3-M3.5 / F3-M4.2: BlockReference from interactive viewer → chat panel
  const [chatPrefill, setChatPrefill] = useState<string | undefined>(undefined);
  const chatPrefillCounterRef = useRef(0);
  const [blockReference, setBlockReference] = useState<BlockReference | null>(null);
  // F3-M4.5: applyBlockEdit signal from ChatPanel → LatexViewer
  const [applyBlockEdit, setApplyBlockEdit] = useState<{ blockId: string; newBlockLatex: string; token: number } | null>(null);
  // F3-M4.6: current full latex (updated when viewer applies a block edit, used to persist)
  const [pendingApplyLatex, setPendingApplyLatex] = useState<string | null>(null);
  // F3-M5.3: "Saved X ago" — timestamp set after onApplyPersisted fires
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedAgoLabel, setSavedAgoLabel] = useState<string | null>(null);
  // Document-level AI edit preview (Flujo C)
  const [pendingDocumentEdit, setPendingDocumentEdit] = useState<string | null>(null);
  // IA-M2: block mutation in progress (compile + persist)
  const [isBlockMutating, setIsBlockMutating] = useState(false);

  // F3-M5.2: Publish modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishData, setPublishData] = useState<{
    is_published: boolean;
    university?: string | null;
    degree?: string | null;
    subject?: string | null;
    visibility?: string;
    keywords?: string[];
  } | undefined>(undefined);
  const searchParamsDoc = useSearchParams();
  const [showHistory, setShowHistory] = useState(() => searchParamsDoc?.get('history') === '1');
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // F3-M5.2: load publish metadata when document data arrives
  // We cast via unknown because DocumentData is the minimal type from the hook;
  // the API returns additional publish columns that TypeScript doesn't know about yet.
  useEffect(() => {
    if (!docData) return;
    const d = docData as unknown as Record<string, unknown>;
    setPublishData({
      is_published: (d.is_published as boolean) ?? false,
      university: (d.university as string | null) ?? null,
      degree: (d.degree as string | null) ?? null,
      subject: (d.subject as string | null) ?? null,
      visibility: (d.visibility as string) ?? 'private',
      keywords: (d.keywords as string[]) ?? [],
    });
  }, [docData]);

  // F3-M5.3: keep "Saved X ago" label fresh every 30s
  useEffect(() => {
    if (!lastSavedAt) return;
    function formatAgo(d: Date): string {
      const diffMs = Date.now() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 10) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      return `${diffH}h ago`;
    }
    setSavedAgoLabel(formatAgo(lastSavedAt));
    const id = setInterval(() => setSavedAgoLabel(formatAgo(lastSavedAt)), 30_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // --- Task 6: editable LaTeX state ---
  const [editedLatex, setEditedLatex] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Sync editedLatex when latexContent from hook changes
  useEffect(() => {
    setEditedLatex(latexContent ?? '');
  }, [latexContent]);

  // --- Task 5: resizable split ---
  const [splitRatio, setSplitRatio] = useState(0.5);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ctrl+scroll zoom: must listen on window with passive:false so preventDefault
  // actually reaches Chrome before it handles the native page zoom.
  // We only intercept when the pointer is physically over the PDF pane.
  const pdfPaneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const el = pdfPaneRef.current;
      if (!el) return;
      const { left, right, top, bottom } = el.getBoundingClientRect();
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return;
      e.preventDefault();
      setZoom((z) => Math.min(200, Math.max(50, z + (e.deltaY < 0 ? 10 : -10))));
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.7, Math.max(0.3, ratio)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    async function loadUsage() {
      try {
        const resp = await fetch('/api/usage');
        if (resp.ok) {
          const data = await resp.json();
          setUsageRemaining(data.remaining ?? null);
          setUsagePlan(data.plan ?? null);
        }
      } catch {
        // Non-fatal — usage banner is optional
      }
    }
    loadUsage();
  }, []);

  useEffect(() => {
    async function loadGuestStatus() {
      try {
        const resp = await fetch('/api/guest-status');
        if (resp.ok) {
          const data = await resp.json();
          setIsGuest(data.is_guest ?? false);
        }
      } catch {
        // Non-fatal
      }
    }
    loadGuestStatus();

    // Re-check when auth state changes (e.g. guest converts to real account)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadGuestStatus();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Use the PDF URL from workspace or the one updated by chat
  const activePdfUrl = currentPdfUrl ?? pdfSignedUrl;

  const handleNewVersion = useCallback((data: {
    versionId: string;
    pdfSignedUrl: string | null;
    latex: string | null;
  }) => {
    if (data.pdfSignedUrl) {
      setCurrentPdfUrl(data.pdfSignedUrl);
    }
    setCurrentPage(1);
    reloadDocument();
  }, [reloadDocument]);

  const { messages, isSending, sendMessage, reloadMessages } = useChatMessages({
    documentId,
    onNewVersion: handleNewVersion,
  });

  const isDraft = docData?.status === 'draft';
  const isDocumentGenerating = isGenerating || docData?.status === 'generating';

  function isLimitReachedError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg === 'limit_reached' || msg.includes('limit_reached');
  }

  function isGuestLimitError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg === 'guest_doc_limit' || msg === 'guest_message_limit';
  }

  // --- Task 6c: compile handler ---
  const handleCompile = useCallback(async () => {
    if (!editedLatex || isCompiling) return;
    setIsCompiling(true);
    setCompileError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: editedLatex }),
      });
      if (res.ok) {
        const { pdfUrl } = await res.json();
        await reloadDocument();
        if (pdfUrl) setCurrentPdfUrl(pdfUrl);
      } else {
        const data = await res.json().catch(() => ({}));
        setCompileError(data.error ?? 'Compilation failed');
      }
    } catch {
      setCompileError('Network error — check your connection');
    } finally {
      setIsCompiling(false);
    }
  }, [editedLatex, isCompiling, documentId, reloadDocument]);

  async function handleSend(content: string) {
    if (!docData) return;

    if (isDraft) {
      // First generation
      try {
        const result = await generate(content);
        if (result && 'pdfSignedUrl' in result && result.pdfSignedUrl) {
          setCurrentPdfUrl(result.pdfSignedUrl);
        }
        await Promise.all([reloadDocument(), reloadMessages()]);
      } catch (err: unknown) {
        if (isGuestLimitError(err)) {
          setShowGuestModal(true);
        } else if (isLimitReachedError(err)) {
          setShowUpgradeModal(true);
        }
        // Other errors are shown via wsError from the hook
      }
    } else {
      // Chat refinement
      setIsChatGenerating(true);
      try {
        await sendMessage(content);
      } catch (err: unknown) {
        if (isGuestLimitError(err)) {
          setShowGuestModal(true);
        } else if (isLimitReachedError(err)) {
          setShowUpgradeModal(true);
        }
      } finally {
        setIsChatGenerating(false);
      }
    }
  }


  // ── Document-level edit handlers (Flujo C) ──────────────────────────────

  const handleDocumentEditPreview = useCallback((modifiedLatex: string) => {
    setPendingDocumentEdit(modifiedLatex);
  }, []);

  const handleDiscardDocumentEdit = useCallback(() => {
    setPendingDocumentEdit(null);
  }, []);

  const handleApplyDocumentEdit = useCallback(async (modifiedLatex: string) => {
    const res = await fetch(`/api/documents/${documentId}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: modifiedLatex }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? 'Compilation failed');
    }
    const { pdfUrl } = await res.json();
    await reloadDocument();
    if (pdfUrl) setCurrentPdfUrl(pdfUrl);
    setCurrentPage(1);
    setPendingDocumentEdit(null);
    setLastSavedAt(new Date());
  }, [documentId, reloadDocument]);

  /**
   * IA-M2: handle structural block mutations (add, delete, reorder).
   * Compiles the new LaTeX and persists it as a new version.
   * Uses the existing /api/documents/[id]/compile route.
   */
  const handleBlockMutation = useCallback(async (newLatex: string) => {
    if (isBlockMutating) return; // debounce concurrent calls
    setIsBlockMutating(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: newLatex }),
      });
      if (!res.ok) {
        // Non-fatal: the viewer already applied the change locally; just don't persist
        console.warn('[IA-M2] Block mutation compile failed:', await res.json().catch(() => ({})));
        return;
      }
      const { pdfUrl } = await res.json();
      await reloadDocument();
      if (pdfUrl) setCurrentPdfUrl(pdfUrl);
      setLastSavedAt(new Date());
    } catch (err) {
      console.warn('[IA-M2] Block mutation error:', err);
    } finally {
      setIsBlockMutating(false);
    }
  }, [documentId, isBlockMutating, reloadDocument]);

  if (isLoading && !docData) {
    return (
      <div className="h-full bg-transparent flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="h-full bg-transparent flex items-center justify-center text-gray-500">
        <div className="text-center space-y-3">
          <p>Document not found</p>
          <button
            onClick={() => router.push(backListHref)}
            className="text-sm text-blue-400 hover:underline"
          >
            {backListLabel}
          </button>
        </div>
      </div>
    );
  }

  const templateLabel = TEMPLATE_LABELS[docData.template_id] ?? docData.template_id;
  const showGenerating = isDocumentGenerating || isChatGenerating || isSending;
  const loadingLabel = getLoadingLabel(generationPhase);

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <Suspense fallback={null}>
        <InitialPromptSender
          isDraft={isDraft}
          isDocReady={!isLoading && !!docData}
          onSend={handleSend}
        />
      </Suspense>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(backListHref)}
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {isRenamingTitle ? (
            <input
              ref={titleInputRef}
              value={renameTitleValue}
              onChange={(e) => setRenameTitleValue(e.target.value)}
              onBlur={commitTitleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitleRename();
                if (e.key === 'Escape') setIsRenamingTitle(false);
              }}
              className="text-sm font-semibold text-white bg-white/10 border border-indigo-400/60
                rounded px-2 py-0.5 outline-none max-w-xs w-48 sm:w-64"
              maxLength={120}
            />
          ) : (
            <h1
              className="text-sm font-semibold text-white truncate max-w-xs cursor-text select-none"
              onDoubleClick={() => { setRenameTitleValue(docData.title); setIsRenamingTitle(true); }}
              title="Double-click to rename"
            >
              {docData.title}
            </h1>
          )}

          <span className="text-xs bg-white/8 text-white/60 rounded px-2 py-0.5 border border-white/15 shrink-0 hidden sm:inline">
            {templateLabel}
          </span>


          {docData.status === 'generating' && (
            <span className="text-xs text-blue-400 animate-pulse shrink-0">Generating...</span>
          )}

          {/* F3-M5.3: Saved X ago — appears after a block edit is persisted */}
          {savedAgoLabel && (
            <span className="text-xs text-green-400/70 shrink-0 hidden sm:inline">
              Saved {savedAgoLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* F3-M5.2: Publish button */}
          {docData.status !== 'draft' && (
            <button
              onClick={() => setShowPublishModal(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                publishData?.is_published
                  ? 'text-indigo-300 border-indigo-400/40 bg-indigo-500/15 hover:bg-indigo-500/25'
                  : 'text-white/60 hover:text-white border-white/15 hover:border-white/30'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
              <span className="hidden sm:inline">
                {publishData?.is_published ? 'Published' : 'Publish'}
              </span>
            </button>
          )}

          {/* Download PDF — fetch blob so browser shows Save-As dialog */}
          {activePdfUrl && (
            <button
              onClick={async () => {
                const res = await fetch(activePdfUrl);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${docData.title}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-2.5 py-1.5
                rounded-lg border border-white/15 hover:border-white/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {wsError && !showUpgradeModal && !showGuestModal && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          {wsError}
        </div>
      )}


      {/* Usage banner — shown when ≤5 generations remain on free plan */}
      {usagePlan === 'free' && usageRemaining !== null && usageRemaining <= 5 && (
        <UsageBanner remaining={usageRemaining} />
      )}

      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b border-white/10 shrink-0">
        <button
          onClick={() => setMobileTab('pdf')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobileTab === 'pdf' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
          }`}
        >
          Document
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobileTab === 'chat' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
          }`}
        >
          Chat
        </button>
      </div>

      {/* Main content: viewer area + Chat */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Viewer column — hidden on mobile when chat tab is active */}
        <div className={`flex-[3] flex-col min-w-0 min-h-0 ${
          mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
        }`}>

          {/* Tab + controls bar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0">
            {/* Viewer tabs — Interactive shown only when latexContent exists */}
            {latexContent && (
              <button
                onClick={() => setViewerTab('interactive')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  viewerTab === 'interactive'
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                Interactive
              </button>
            )}
            {(['pdf', 'latex', 'split'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setViewerTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  viewerTab === tab
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {tab === 'pdf' ? 'PDF' : tab === 'latex' ? 'LaTeX' : 'Split'}
              </button>
            ))}

            {/* History button */}
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 ${
                showHistory
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/10'
              }`}
              title="Version history"
            >
              History
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Zoom + page controls — only when PDF pane is visible */}
            {(viewerTab === 'pdf' || viewerTab === 'split') && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm transition-colors flex items-center justify-center"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="text-white/50 text-xs w-10 text-center tabular-nums">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm transition-colors flex items-center justify-center"
                  aria-label="Zoom in"
                >
                  +
                </button>

                {/* Separator */}
                <div className="w-px h-4 bg-white/10 mx-1" />

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors flex items-center justify-center"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <span className="text-white/50 text-xs tabular-nums whitespace-nowrap">
                  {currentPage}{totalPages > 0 ? `/${totalPages}` : ''}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => totalPages > 0 ? Math.min(totalPages, p + 1) : p + 1)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors flex items-center justify-center"
                  aria-label="Next page"
                >
                  ›
                </button>

                {/* Separator */}
                <div className="w-px h-4 bg-white/10 mx-1" />
              </>
            )}

            {/* Compile button — visible when LaTeX pane is visible */}
            {viewerTab !== 'pdf' && (
              <button
                onClick={handleCompile}
                disabled={isCompiling}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/30 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isCompiling ? (
                  <><span className="animate-spin inline-block">⟳</span> Compiling…</>
                ) : (
                  <>&#9889; Compile</>
                )}
              </button>
            )}
          </div>

          {/* Compile error */}
          {compileError && (
            <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs shrink-0 flex items-center justify-between">
              <span>{compileError}</span>
              <button onClick={() => setCompileError(null)} className="ml-2 text-red-400/60 hover:text-red-400">✕</button>
            </div>
          )}

          {/* Viewer body — key on viewerTab so React remounts on tab switch, enabling CSS fade-in */}
          <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden relative transition-opacity duration-150">

            {/* F3-M5.3: Skeleton loader — shown while document is loading in interactive tab */}
            {viewerTab === 'interactive' && isLoading && !latexContent && (
              <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white overflow-auto p-6 space-y-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-5/6" />
                <div className="h-10 bg-gray-200 rounded w-1/2 mt-4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-4/6" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-3/5 mt-4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-5/6" />
              </div>
            )}

            {/* Interactive viewer (F3-M2.6) */}
            {viewerTab === 'interactive' && latexContent && (
              <div className="relative flex-1 flex flex-col min-h-0 min-w-0 bg-white overflow-auto transition-opacity duration-200">
                {isBlockMutating && (
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-black/60 text-white text-[10px] rounded-full px-2 py-0.5">
                    <span className="animate-spin inline-block">⟳</span> Saving…
                  </div>
                )}
                <LatexViewer
                  latexSource={latexContent}
                  templateId={docData.template_id}
                  onReferenceInChat={(ref) => {
                    chatPrefillCounterRef.current += 1;
                    setBlockReference(ref);
                    // Also set prefillText for backwards compat (shows in input)
                    setChatPrefill(`__ref${chatPrefillCounterRef.current}__${ref.latex_source.slice(0, 120)}`);
                    setMobileTab('chat');
                  }}
                  applyBlockEdit={applyBlockEdit}
                  onLatexChange={(newLatex) => {
                    setPendingApplyLatex(newLatex);
                  }}
                  pendingDocumentEdit={pendingDocumentEdit}
                  onBlockMutation={handleBlockMutation}
                />
              </div>
            )}

            {/* PDF pane */}
            {(viewerTab === 'pdf' || viewerTab === 'split') && (
              <div
                ref={pdfPaneRef}
                style={viewerTab === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
                className={`flex flex-col min-h-0 min-w-0 ${viewerTab === 'split' ? '' : 'flex-1'}`}
              >
                <PdfViewer
                  url={activePdfUrl}
                  isLoading={showGenerating && !activePdfUrl}
                  loadingLabel={loadingLabel}
                  zoom={zoom}
                  currentPage={currentPage}
                  onTotalPages={setTotalPages}
                />
              </div>
            )}

            {/* Resizer (split only) */}
            {viewerTab === 'split' && (
              <div
                onMouseDown={handleResizerMouseDown}
                className="w-1 bg-white/10 hover:bg-indigo-400/60 cursor-col-resize transition-colors flex-shrink-0"
              />
            )}

            {/* LaTeX pane */}
            {(viewerTab === 'latex' || viewerTab === 'split') && (
              <div
                style={viewerTab === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : undefined}
                className={`flex flex-col min-h-0 min-w-0 ${viewerTab !== 'split' ? 'flex-1' : ''}`}
              >
                {latexContent !== null ? (
                  <LatexHighlighter
                    value={editedLatex}
                    onChange={setEditedLatex}
                    readOnly={false}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/30 text-sm" style={{ background: 'rgba(0,0,0,0.20)' }}>
                    No LaTeX content yet
                  </div>
                )}
              </div>
            )}

            {/* Fallback: draft with no content yet */}
            {viewerTab === 'interactive' && !latexContent && (
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <PdfViewer
                  url={activePdfUrl}
                  isLoading={showGenerating && !activePdfUrl}
                  loadingLabel={loadingLabel}
                  zoom={zoom}
                  currentPage={currentPage}
                  onTotalPages={setTotalPages}
                />
              </div>
            )}

            {/* Version History panel — slides in from the right over the viewer */}
            {showHistory && (
              <div className="absolute top-0 right-0 h-full w-72 flex flex-col bg-neutral-950/95 border-l border-white/15 backdrop-blur-xl z-30 shadow-2xl">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/80">Version History</span>
                  </div>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-white/30 hover:text-white/70 transition-colors p-0.5 rounded hover:bg-white/8"
                    aria-label="Close history"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Version list */}
                <div className="flex-1 overflow-y-auto py-2">
                  {versions.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-white/30">
                      No versions yet
                    </div>
                  ) : (
                    versions.map((v) => {
                      const isActive = v.id === activeVersionId;
                      const promptText =
                        !v.prompt_used || v.prompt_used === '[duplicated]'
                          ? 'Initial version'
                          : v.prompt_used.length > 60
                          ? v.prompt_used.slice(0, 60) + '…'
                          : v.prompt_used;
                      const dateLabel = new Date(v.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <button
                          key={v.id}
                          onClick={() => switchVersion(v.id)}
                          className={`w-full text-left px-4 py-3 transition-colors border-b border-white/5 last:border-0 ${
                            isActive
                              ? 'bg-indigo-500/15 hover:bg-indigo-500/20'
                              : 'hover:bg-white/8'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${isActive ? 'text-indigo-300' : 'text-white/80'}`}>
                              v{v.version_number}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded-full">
                                active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/40 mb-1 leading-snug">{dateLabel}</p>
                          <p className="text-[11px] text-white/55 leading-snug line-clamp-2">{promptText}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right column: attachments panel + chat — hidden on mobile when pdf tab is active */}
        <div className={`flex-[2] flex-col min-h-0 overflow-hidden ${
          mobileTab === 'pdf' ? 'hidden md:flex' : 'flex'
        } md:min-w-[300px] md:max-w-[420px] max-w-none`}>
          <WorkspaceAttachmentsPanel documentId={documentId} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel
              messages={messages}
              isLoading={showGenerating}
              isDraft={isDraft}
              onSend={handleSend}
              loadingLabel={loadingLabel}
              prefillText={chatPrefill}
              blockReference={blockReference}
              onClearBlockReference={() => setBlockReference(null)}
              documentId={documentId}
              latexSource={latexContent ?? ''}
              onApplyBlockEdit={(blockId, newBlockLatex) => {
                chatPrefillCounterRef.current += 1;
                setApplyBlockEdit({ blockId, newBlockLatex, token: chatPrefillCounterRef.current });
              }}
              onApplyPersisted={() => {
                // After successful persist, reload the document to sync versions
                reloadDocument();
                // F3-M5.3: record save timestamp for "Saved X ago" display
                setLastSavedAt(new Date());
              }}
              pendingApplyLatex={pendingApplyLatex}
              onDocumentEditPreview={handleDocumentEditPreview}
              onApplyDocumentEdit={handleApplyDocumentEdit}
              onDiscardDocumentEdit={handleDiscardDocumentEdit}
            />
          </div>
        </div>
      </div>

      {/* Upgrade modal — triggered on 402 responses */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Guest signup modal — triggered when guest hits a limit or clicks "Save your work" */}
      <GuestSignupModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
      />

      {/* F3-M5.2: Publish modal */}
      {docData && (
        <PublishModal
          documentId={documentId}
          documentTitle={docData.title}
          isOpen={showPublishModal}
          initialData={publishData}
          onClose={() => setShowPublishModal(false)}
          onSuccess={(published) => {
            setPublishData((prev) => (prev ? { ...prev, is_published: published } : prev));
            reloadDocument();
          }}
        />
      )}
    </div>
  );
}
