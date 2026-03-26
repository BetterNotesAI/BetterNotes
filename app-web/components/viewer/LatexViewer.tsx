'use client';

/**
 * LatexViewer.tsx
 * Top-level viewer component. Receives a raw LaTeX string, parses it
 * into blocks, and renders each block via LatexBlock.
 *
 * Usage:
 *   <LatexViewer latexSource={rawLatexString} />
 */

import React, { useMemo } from 'react';
import { parseLatex } from '@/lib/latex-parser';
import LatexBlock from './LatexBlock';

interface LatexViewerProps {
  latexSource: string;
  /** Optional CSS class for the container div */
  className?: string;
}

export default function LatexViewer({ latexSource, className }: LatexViewerProps) {
  const blocks = useMemo(() => parseLatex(latexSource), [latexSource]);

  if (!latexSource.trim()) {
    return (
      <div className="text-gray-400 italic text-sm p-4">
        No LaTeX source provided.
      </div>
    );
  }

  return (
    <div className={className ?? 'max-w-3xl mx-auto px-6 py-4 font-sans'}>
      {blocks.map(block => (
        <LatexBlock key={block.id} block={block} />
      ))}
      {blocks.length === 0 && (
        <div className="text-gray-400 italic text-sm">
          Parser returned no blocks. Check the LaTeX source.
        </div>
      )}
    </div>
  );
}
