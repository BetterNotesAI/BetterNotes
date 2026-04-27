'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';

interface ExamReportModalProps {
  examId: string;
  onClose: () => void;
}

export default function ExamReportModal({ examId, onClose }: ExamReportModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string>('');
  const [examScore, setExamScore] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [downloading, setDownloading] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Fetch PDF from backend and create a blob URL for the iframe preview
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // First fetch the report metadata for the header display
        const metaRes = await fetch(`/api/exams/${examId}/report`);
        if (!metaRes.ok) throw new Error('Could not load exam report');
        const meta = await metaRes.json();
        if (cancelled) return;
        setExamTitle(meta.exam?.title ?? t('exam.report.title'));
        setExamScore(meta.exam?.score ?? null);
        setQuestionCount(meta.questions?.length ?? 0);

        // Then fetch the PDF from the backend (Pandoc-generated)
        const pdfRes = await fetch(`/api/exams/${examId}/export-pdf`);
        if (!pdfRes.ok) {
          // Fall back gracefully: show error without crashing
          const errText = await pdfRes.text().catch(() => '');
          let msg = 'PDF generation failed';
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) msg = parsed.error;
          } catch { /* not JSON */ }
          throw new Error(msg);
        }
        if (cancelled) return;

        const blob = await pdfRes.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPdfUrl(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error loading report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [examId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleDownload() {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${(examTitle || 'exam').replace(/[/\\:*?"<>|]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl h-[88vh] rounded-2xl bg-neutral-950 border border-white/10 flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25 shrink-0">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {examTitle || t('exam.report.title')}
              </p>
              {questionCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <span>{t('exam.report.questions').replace('{count}', String(questionCount))}</span>
                  {examScore !== null && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{examScore}%</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfUrl || downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-white/5
                text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
              {downloading ? t('exam.report.downloading') : t('exam.report.downloadPdf')}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40
                hover:text-white/80 hover:bg-white/8 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-neutral-900">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-white/40">
              <div className="w-8 h-8 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm">{t('exam.report.generating')}</p>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60"
              >
                {t('exam.report.close')}
              </button>
            </div>
          )}

          {pdfUrl && !loading && (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="Exam report preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
