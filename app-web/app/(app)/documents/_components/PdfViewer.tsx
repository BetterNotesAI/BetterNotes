'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfViewerProps {
  url: string | null;
  isLoading?: boolean;
  loadingLabel?: string;
  loadingPhaseIndex?: number;
  zoom: number;
  visualZoom?: number;
  currentPage: number;
  onTotalPages: (total: number) => void;
  viewportRef?: Ref<HTMLDivElement>;
}

const PHASES = ['Generating LaTeX', 'Compiling PDF'] as const;

function getActivePhase(label: string | undefined): number {
  if (!label) return 0;
  if (label.includes('Compiling') || label.includes('Finalizing')) return 1;
  return 0;
}

export function PdfViewer({
  url,
  isLoading,
  loadingLabel,
  loadingPhaseIndex,
  zoom,
  visualZoom,
  currentPage,
  onTotalPages,
  viewportRef,
}: PdfViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Fetch PDF and create object URL to avoid CORS/redirect issues with signed URLs
  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setObjectUrl(url);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        } else {
          // Component unmounted before fetch finished — revoke immediately
          const tmp = URL.createObjectURL(blob);
          URL.revokeObjectURL(tmp);
        }
      })
      .catch(() => {
        if (active) setObjectUrl(url);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  // Revoke object URL on cleanup when it changes
  useEffect(() => {
    const current = objectUrl;
    return () => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current);
      }
    };
  }, [objectUrl]);

  // Scroll to currentPage when it changes from parent
  useEffect(() => {
    if (currentPage < 1 || currentPage > numPages) return;
    pageRefs.current[currentPage - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage, numPages]);

  function handleLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    onTotalPages(n);
  }

  const visualScale = Math.max(0.1, (visualZoom ?? zoom) / zoom);

  // Loading state
  if (isLoading) {
    const activePhase = Math.max(
      0,
      Math.min(PHASES.length - 1, loadingPhaseIndex ?? getActivePhase(loadingLabel)),
    );
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent px-6 text-white/65">
        <div className="w-full max-w-[340px] rounded-2xl border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.045))] px-5 py-4 shadow-[0_14px_42px_rgba(0,0,0,0.30)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.4s' }} />
            </div>
            <p className="text-sm font-medium text-white/65">{loadingLabel ?? 'Generating LaTeX...'}</p>
          </div>

          <div className="mt-3 flex items-start gap-2">
            {PHASES.map((phase, i) => (
              <div key={phase} className="flex-1 min-w-0">
                <div className={`h-0.5 w-full rounded-full transition-colors duration-500 ${
                  i <= activePhase ? 'bg-cyan-300/70' : 'bg-white/15'
                }`} />
                <span className={`mt-1 block truncate text-[11px] transition-colors duration-500 ${
                  i === activePhase ? 'text-white/60' : 'text-white/28'
                }`}>{phase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!url && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent text-gray-600">
        <div className="text-center space-y-2">
          <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Describe your document in the chat to generate a PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={viewportRef} className="flex-1 min-h-0 overflow-auto overscroll-contain bg-transparent">
      {objectUrl && (
        <div
          className="w-max min-w-full mx-auto px-4 py-6"
          style={{ zoom: visualScale }}
        >
          <Document
            file={objectUrl}
            onLoadSuccess={handleLoadSuccess}
            loading={
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="flex-1 flex items-center justify-center py-12 text-gray-500">
                <div className="text-center space-y-2">
                  <svg className="w-10 h-10 mx-auto opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No se pudo cargar el PDF</p>
                </div>
              </div>
            }
            className="flex flex-col items-center"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                ref={(el) => { pageRefs.current[i] = el; }}
                className="mb-6 last:mb-0"
              >
                <Page
                  pageNumber={i + 1}
                  scale={zoom / 100}
                  className="shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </div>
            ))}
          </Document>
        </div>
      )}

      {/* Fetching blob — URL exists but objectUrl not ready yet */}
      {url && !objectUrl && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
