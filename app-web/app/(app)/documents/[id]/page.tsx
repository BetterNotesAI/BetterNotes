'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PdfViewer } from '../_components/PdfViewer';
import { ChatPanel } from '../_components/ChatPanel';
import { VersionSelector } from '../_components/VersionSelector';
import { UsageBanner } from '../_components/UsageBanner';
import { UpgradeModal } from '../_components/UpgradeModal';
import { useDocumentWorkspace, GenerationPhase } from '../_hooks/useDocumentWorkspace';
import { useChatMessages } from '../_hooks/useChatMessages';

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
    document,
    pdfSignedUrl,
    latexContent: _latexContent,
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

  const isDraft = document?.status === 'draft';
  const isDocumentGenerating = isGenerating || document?.status === 'generating';

  function isLimitReachedError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg === 'limit_reached' || msg.includes('limit_reached');
  }

  async function handleSend(content: string) {
    if (!document) return;

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

  if (!document) {
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

  const templateLabel = TEMPLATE_LABELS[document.template_id] ?? document.template_id;
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
            {document.title}
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

          {document.status === 'generating' && (
            <span className="text-xs text-blue-400 animate-pulse shrink-0">Generating...</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Download PDF */}
          {activePdfUrl && (
            <a
              href={activePdfUrl}
              download={`${document.title}.pdf`}
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

      {/* Main content: PDF viewer + Chat */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* PDF Viewer — hidden on mobile when chat tab is active */}
        <div className={`flex-[3] flex-col min-w-0 min-h-0 ${
          mobileTab === 'chat' ? 'hidden md:flex' : 'flex'
        }`}>
          <PdfViewer
            url={activePdfUrl}
            isLoading={showGenerating && !activePdfUrl}
            loadingLabel={loadingLabel}
          />
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
