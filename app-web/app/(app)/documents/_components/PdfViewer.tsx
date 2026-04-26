'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type Ref } from 'react';
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
  onAddSelectionToEditChat?: (selectedText: string) => void;
  onAddSelectionToAskChat?: (selectedText: string) => void;
}

const PHASES = ['Generating LaTeX', 'Compiling PDF'] as const;
const TEXT_LAYER_CANCELLED = 'AbortException: TextLayer task cancelled';

let textLayerWarningFilterInstallCount = 0;
let restoreConsoleErrorForTextLayer: (() => void) | null = null;

interface PdfSelectionMenuState {
  x: number;
  y: number;
  selectedText: string;
}

function getActivePhase(label: string | undefined): number {
  if (!label) return 0;
  if (label.includes('Compiling') || label.includes('Finalizing')) return 1;
  return 0;
}

function normalizeSelectedPdfText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isTextLayerCancellation(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(TEXT_LAYER_CANCELLED);
  }
  if (value && typeof value === 'object') {
    const maybe = value as { name?: unknown; message?: unknown; toString?: () => string };
    const name = typeof maybe.name === 'string' ? maybe.name : '';
    const message = typeof maybe.message === 'string' ? maybe.message : '';
    const stringValue = typeof maybe.toString === 'function' ? maybe.toString() : '';
    return (
      (name === 'AbortException' && message.includes('TextLayer task cancelled')) ||
      stringValue.includes(TEXT_LAYER_CANCELLED)
    );
  }
  return false;
}

function installTextLayerWarningFilter(): () => void {
  textLayerWarningFilterInstallCount += 1;
  if (textLayerWarningFilterInstallCount === 1) {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some(isTextLayerCancellation)) return;
      originalConsoleError(...args);
    };
    restoreConsoleErrorForTextLayer = () => {
      console.error = originalConsoleError;
    };
  }

  return () => {
    textLayerWarningFilterInstallCount = Math.max(0, textLayerWarningFilterInstallCount - 1);
    if (textLayerWarningFilterInstallCount === 0) {
      restoreConsoleErrorForTextLayer?.();
      restoreConsoleErrorForTextLayer = null;
    }
  };
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
  onAddSelectionToEditChat,
  onAddSelectionToAskChat,
}: PdfViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [selectionMenu, setSelectionMenu] = useState<PdfSelectionMenuState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!viewportRef) return;
    if (typeof viewportRef === 'function') {
      viewportRef(node);
    } else {
      (viewportRef as MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [viewportRef]);

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

  const selectionHasChatActions = Boolean(onAddSelectionToEditChat || onAddSelectionToAskChat);

  useEffect(() => installTextLayerWarningFilter(), []);

  const isSelectionInsideViewer = useCallback((range: Range) => {
    const container = containerRef.current;
    if (!container) return false;

    const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
    const endEl = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;

    return Boolean(startEl && endEl && container.contains(startEl) && container.contains(endEl));
  }, []);

  const showSelectionActions = useCallback(() => {
    if (!selectionHasChatActions) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionMenu(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!isSelectionInsideViewer(range)) {
      setSelectionMenu(null);
      return;
    }

    const selectedText = normalizeSelectedPdfText(selection.toString());
    if (!selectedText) {
      setSelectionMenu(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelectionMenu(null);
      return;
    }

    setSelectionMenu({
      x: Math.min(rect.right + 8, window.innerWidth - 12),
      y: Math.max(rect.top - 8, 12),
      selectedText,
    });
  }, [isSelectionInsideViewer, selectionHasChatActions]);

  const handleSelectionEnd = useCallback(() => {
    requestAnimationFrame(showSelectionActions);
  }, [showSelectionActions]);

  useEffect(() => {
    if (!selectionHasChatActions) return;

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setSelectionMenu(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectionMenu(null);
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectionHasChatActions]);

  function handleMenuMouseDown(e: React.MouseEvent) {
    e.preventDefault();
  }

  const ignoreExpectedTextLayerCancellation = useCallback((error: Error) => {
    if (isTextLayerCancellation(error)) return;
  }, []);

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
    <div
      ref={setViewportNode}
      onMouseUp={handleSelectionEnd}
      onTouchEnd={handleSelectionEnd}
      onScroll={() => setSelectionMenu(null)}
      className="flex-1 min-h-0 overflow-auto overscroll-contain bg-transparent"
    >
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
                  renderTextLayer
                  onGetTextError={ignoreExpectedTextLayerCancellation}
                  onRenderTextLayerError={ignoreExpectedTextLayerCancellation}
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

      {selectionMenu && selectionHasChatActions && (
        <div
          style={{ position: 'fixed', left: selectionMenu.x, top: selectionMenu.y, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px]"
          onMouseDown={handleMenuMouseDown}
        >
          {onAddSelectionToEditChat && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors"
              onClick={() => {
                onAddSelectionToEditChat(selectionMenu.selectedText);
                setSelectionMenu(null);
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5h2M5 19h14a2 2 0 002-2V9.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0015.586 4H5a2 2 0 00-2 2v11a2 2 0 002 2zm8-9l-5 5m0 0H8m0 0v-3" />
              </svg>
              Add to Edit chat
            </button>
          )}
          {onAddSelectionToAskChat && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 flex items-center gap-2 transition-colors"
              onClick={() => {
                onAddSelectionToAskChat(selectionMenu.selectedText);
                setSelectionMenu(null);
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Add to Ask chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
