'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PdfViewer } from '../_components/PdfViewer';
import { ChatPanel } from '../_components/ChatPanel';
import { VersionSelector } from '../_components/VersionSelector';
import { UsageBanner } from '../_components/UsageBanner';
import { UpgradeModal } from '../_components/UpgradeModal';
import { LatexHighlighter } from '../_components/LatexHighlighter';
import { useDocumentWorkspace, GenerationPhase } from '../_hooks/useDocumentWorkspace';
import { useChatMessages } from '../_hooks/useChatMessages';

type ViewerTab = 'pdf' | 'latex' | 'split';

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

export default function DocumentWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [usagePlan, setUsagePlan] = useState<'free' | 'pro' | null>(null);
  const [mobileTab, setMobileTab] = useState<'pdf' | 'chat'>('pdf');
  const [viewerTab, setViewerTab] = useState<ViewerTab>('pdf');

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
        if (isLimitReachedError(err)) {
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
        if (isLimitReachedError(err)) {
          setShowUpgradeModal(true);
        }
      } finally {
        setIsChatGenerating(false);
      }
    }
  }

  const handleSwitchVersion = useCallback(async (versionId: string) => {
    setCurrentPdfUrl(null);
    await switchVersion(versionId);
  }, [switchVersion]);

  if (isLoading) {
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
            onClick={() => router.push('/documents')}
            className="text-sm text-blue-400 hover:underline"
          >
            Back to documents
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
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/documents')}
            className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-sm font-semibold text-white truncate max-w-xs">
            {docData.title}
          </h1>

          <span className="text-xs bg-white/8 text-white/60 rounded px-2 py-0.5 border border-white/15 shrink-0 hidden sm:inline">
            {templateLabel}
          </span>

          {versions.length > 0 && activeVersionId && (
            <VersionSelector
              versions={versions}
              activeVersionId={activeVersionId}
              onSwitch={handleSwitchVersion}
            />
          )}

          {docData.status === 'generating' && (
            <span className="text-xs text-blue-400 animate-pulse shrink-0">Generating...</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Download PDF */}
          {activePdfUrl && (
            <a
              href={activePdfUrl}
              download={`${docData.title}.pdf`}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-2.5 py-1.5
                rounded-lg border border-white/15 hover:border-white/30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </header>

      {/* Error banner */}
      {wsError && !showUpgradeModal && (
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

          {/* Viewer tab bar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0">
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

            {/* Compile button — visible when LaTeX pane is visible */}
            {viewerTab !== 'pdf' && (
              <button
                onClick={handleCompile}
                disabled={isCompiling}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/30 text-xs font-medium transition-colors disabled:opacity-50"
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

          {/* Viewer body */}
          <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
            {/* PDF pane — shown in pdf and split modes */}
            {(viewerTab === 'pdf' || viewerTab === 'split') && (
              <div
                style={viewerTab === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
                className={`flex flex-col min-h-0 min-w-0 ${
                  viewerTab === 'split' ? '' : 'flex-1'
                }`}
              >
                <PdfViewer
                  url={activePdfUrl}
                  isLoading={showGenerating && !activePdfUrl}
                  loadingLabel={loadingLabel}
                />
              </div>
            )}

            {/* Resizer — only visible in split mode */}
            {viewerTab === 'split' && (
              <div
                onMouseDown={handleResizerMouseDown}
                className="w-1 bg-white/10 hover:bg-indigo-400/60 cursor-col-resize transition-colors flex-shrink-0"
              />
            )}

            {/* LaTeX pane — shown in latex and split modes */}
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
          </div>
        </div>

        {/* Chat Panel — hidden on mobile when pdf tab is active */}
        <div className={`flex-[2] flex-col min-h-0 ${
          mobileTab === 'pdf' ? 'hidden md:flex' : 'flex'
        } md:min-w-[300px] md:max-w-[420px] max-w-none`}>
          <ChatPanel
            messages={messages}
            isLoading={showGenerating}
            isDraft={isDraft}
            onSend={handleSend}
            loadingLabel={loadingLabel}
          />
        </div>
      </div>

      {/* Upgrade modal — triggered on 402 responses */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
