'use client';

/**
 * LatexViewer.tsx
 * Top-level viewer component. Receives a raw LaTeX string, parses it
 * into blocks, and renders each block via LatexBlock.
 *
 * F3-M2.3: templateId prop drives multicolumn layout.
 * F3-M2.4: Built-in toolbar with virtual page navigation and zoom.
 *
 * Usage:
 *   <LatexViewer latexSource={rawLatexString} templateId="lecture_notes" />
 */

import React, { useMemo, useState, useCallback } from 'react';
import { parseLatex } from '@/lib/latex-parser';
import LatexBlock from './LatexBlock';

// ─── template layout config ───────────────────────────────────────────────────

/**
 * How many blocks constitute a "virtual page" for each template.
 * Used by the toolbar prev/next page navigation.
 */
const BLOCKS_PER_PAGE: Record<string, number> = {
  lecture_notes: 12,
  '2cols_portrait': 16,
  study_form: 20,
  landscape_3col_maths: 20,
};
const DEFAULT_BLOCKS_PER_PAGE = 15;

/**
 * Returns the CSS class(es) to apply to the content area based on templateId.
 * - lecture_notes       → single column, max-width 700px
 * - 2cols_portrait      → 2 columns grid
 * - study_form          → 3 columns portrait
 * - landscape_3col_maths → 3 columns landscape (wider)
 */
function getLayoutClass(templateId: string | undefined): string {
  switch (templateId) {
    case 'lecture_notes':
      return 'max-w-2xl mx-auto';
    case '2cols_portrait':
      return 'grid grid-cols-2 gap-x-6 items-start max-w-5xl mx-auto';
    case 'study_form':
      return 'grid grid-cols-3 gap-x-5 items-start max-w-6xl mx-auto';
    case 'landscape_3col_maths':
      return 'grid grid-cols-3 gap-x-5 items-start w-full';
    default:
      return 'max-w-2xl mx-auto';
  }
}

// ─── zoom presets ─────────────────────────────────────────────────────────────

const ZOOM_PRESETS = [75, 100, 125, 150] as const;
type ZoomPreset = typeof ZOOM_PRESETS[number];

// ─── component ────────────────────────────────────────────────────────────────

interface LatexViewerProps {
  latexSource: string;
  templateId?: string;
  /** Optional CSS class for the outer wrapper */
  className?: string;
  /** When true, the built-in toolbar is hidden (parent manages controls) */
  hideToolbar?: boolean;
}

export default function LatexViewer({
  latexSource,
  templateId,
  className,
  hideToolbar = false,
}: LatexViewerProps) {
  const blocks = useMemo(() => parseLatex(latexSource), [latexSource]);

  const blocksPerPage = BLOCKS_PER_PAGE[templateId ?? ''] ?? DEFAULT_BLOCKS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(blocks.length / blocksPerPage));

  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<ZoomPreset>(100);

  const goToPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToNext = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  // Reset page when source changes
  React.useEffect(() => { setPage(1); }, [latexSource]);

  const pageBlocks = useMemo(() => {
    const start = (page - 1) * blocksPerPage;
    return blocks.slice(start, start + blocksPerPage);
  }, [blocks, page, blocksPerPage]);

  const layoutClass = getLayoutClass(templateId);

  if (!latexSource.trim()) {
    return (
      <div className="text-gray-400 italic text-sm p-4">
        No LaTeX source provided.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      {/* ── Toolbar ── */}
      {!hideToolbar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
          {/* Page navigation */}
          <button
            onClick={goToPrev}
            disabled={page <= 1}
            className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800
              text-sm transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-gray-500 text-xs tabular-nums whitespace-nowrap min-w-[52px] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={goToNext}
            disabled={page >= totalPages}
            className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800
              text-sm transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            ›
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-gray-300 mx-1" />

          {/* Zoom presets */}
          <div className="flex items-center gap-1">
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  zoom === z
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {z}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto">
        <div
          style={{ fontSize: `${zoom}%` }}
          className={`px-6 py-5 font-sans text-gray-900 ${layoutClass}`}
        >
          {pageBlocks.map((block) => (
            <LatexBlock key={block.id} block={block} />
          ))}
          {pageBlocks.length === 0 && (
            <div className="text-gray-400 italic text-sm col-span-full">
              Parser returned no blocks. Check the LaTeX source.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
