'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PdfViewer } from '../_components/PdfViewer';
import { ChatPanel } from '../_components/ChatPanel';
import { VersionSelector } from '../_components/VersionSelector';
import { UsageBanner } from '../_components/UsageBanner';
import { UpgradeModal } from '../_components/UpgradeModal';
import { useDocumentWorkspace } from '../_hooks/useDocumentWorkspace';
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-500">
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

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/documents')}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="text-sm font-semibold text-white truncate max-w-xs">
            {document.title}
          </h1>

          <span className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5 border border-gray-700">
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
            <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Download PDF */}
          {activePdfUrl && (
            <a
              href={activePdfUrl}
              download={`${document.title}.pdf`}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2.5 py-1.5
                rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          )}
        </div>
      </header>

      {/* Error banner */}
      {wsError && !showUpgradeModal && (
        <div className="px-4 py-2 bg-red-950/50 border-b border-red-900 text-red-400 text-sm">
          {wsError}
        </div>
      )}

      {/* Usage banner — shown when ≤5 generations remain on free plan */}
      {usagePlan === 'free' && usageRemaining !== null && usageRemaining <= 5 && (
        <UsageBanner remaining={usageRemaining} />
      )}

      {/* Main content: PDF viewer + Chat */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* PDF Viewer (60%) */}
        <div className="flex-[3] flex flex-col min-w-0 min-h-0">
          <PdfViewer
            url={activePdfUrl}
            isLoading={showGenerating && !activePdfUrl}
          />
        </div>

        {/* Chat Panel (40%, ~350px min) */}
        <div className="flex-[2] min-w-[300px] max-w-[420px] flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            isLoading={showGenerating}
            isDraft={isDraft}
            onSend={handleSend}
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
