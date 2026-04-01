'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { InlineChat } from './InlineChat';

// ---------------------------------------------------------------------------
// Minimal Markdown → HTML renderer (no external lib)
// Handles: h1-h3, bold, italic, inline code, fenced code blocks,
//          display math ($$...$$), inline math ($...$), paragraphs
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderKatex(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return escapeHtml(math);
  }
}

/** Replace math expressions before HTML-escaping to avoid escaping LaTeX */
function renderInlineMath(text: string): string {
  // Display math: $$...$$ (avoid dotAll flag for ES2017 compat — use [\s\S])
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) =>
    renderKatex(math, true)
  );
  // Inline math: $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) =>
    renderKatex(math, false)
  );
  return text;
}

function renderInline(text: string): string {
  // Bold + italic: ***...***
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold: **...**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *...*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code: `...`
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return text;
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let inParagraph = false;

  function closeParagraph() {
    if (inParagraph) {
      html.push('</p>');
      inParagraph = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Fenced code block
    if (raw.startsWith('```')) {
      if (!inCodeBlock) {
        closeParagraph();
        inCodeBlock = true;
        codeLang = raw.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre class="code-block" data-solution-block="true"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    // Display math block: line is exactly $$
    if (raw.trim() === '$$' || raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4) {
      closeParagraph();
      // Single-line display: $$...$$
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        const math = raw.trim().slice(2, -2);
        html.push(`<div class="math-display" data-solution-block="true">${renderKatex(math, true)}</div>`);
        continue;
      }
      // Multi-line display math block starting with $$ alone
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      html.push(`<div class="math-display" data-solution-block="true">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    // Blank line
    if (raw.trim() === '') {
      closeParagraph();
      continue;
    }

    // Headings
    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      closeParagraph();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      const processed = renderInline(renderInlineMath(text));
      html.push(`<h${level} class="md-h${level}" data-solution-block="true">${processed}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
      closeParagraph();
      html.push('<hr class="md-hr" />');
      continue;
    }

    // Unordered list item
    const ulMatch = raw.match(/^[\s]*[-*+] (.+)/);
    if (ulMatch) {
      closeParagraph();
      const text = renderInline(renderInlineMath(ulMatch[1]));
      html.push(`<li class="md-li" data-solution-block="true">${text}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) {
      closeParagraph();
      const text = renderInline(renderInlineMath(olMatch[1]));
      html.push(`<li class="md-li md-oli" data-solution-block="true">${text}</li>`);
      continue;
    }

    // Regular text → paragraph
    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) {
      html.push('<p class="md-p" data-solution-block="true">');
      inParagraph = true;
    } else {
      html.push('<br />');
    }
    html.push(processed);
  }

  closeParagraph();
  return html.join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  sessionId: string;
  solutionMd: string | null;
  status: 'pending' | 'solving' | 'done' | 'error';
  isStreaming: boolean;
  onSolve: () => void;
  selectedContexts: Array<{ id: string; text: string }>;
  onTextSelect: (context: { id: string; text: string }) => void;
  onClearContext: (id: string) => void;
  onClearAllContexts: () => void;
}

export function SolutionPanel({
  sessionId,
  solutionMd,
  status,
  isStreaming,
  onSolve,
  selectedContexts,
  onTextSelect,
  onClearContext,
  onClearAllContexts,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);

  // Selection tooltip
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ id: string; text: string } | null>(null);
  const [pendingOutlineRects, setPendingOutlineRects] = useState<Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>>([]);
  const pendingHighlightedBlocksRef = useRef<HTMLElement[]>([]);

  const clearHighlightFromBlocks = useCallback((blocks: HTMLElement[], className: string) => {
    for (const block of blocks) {
      block.classList.remove(className);
    }
  }, []);

  const applyHighlightToBlocks = useCallback((blocks: HTMLElement[], className: string) => {
    for (const block of blocks) {
      block.classList.add(className);
    }
  }, []);

  const clearPendingHighlight = useCallback(() => {
    clearHighlightFromBlocks(pendingHighlightedBlocksRef.current, 'solution-context-pending');
    pendingHighlightedBlocksRef.current = [];
  }, [clearHighlightFromBlocks]);

  const hideSelectionTooltip = useCallback(() => {
    clearPendingHighlight();
    setTooltipPos(null);
    setPendingSelection(null);
    setPendingOutlineRects([]);
  }, [clearPendingHighlight]);

  const normalizeSelectionText = useCallback((value: string) => {
    return value
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, []);

  const createSelectionId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const getIntersectingBlocks = useCallback((range: Range) => {
    if (!solutionRef.current) return [] as HTMLElement[];

    return Array.from(
      solutionRef.current.querySelectorAll<HTMLElement>('[data-solution-block="true"]'),
    ).filter((block) => {
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
  }, []);

  const getRectFromBlocks = useCallback((blocks: HTMLElement[]) => {
    if (blocks.length === 0) return null;
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    }

    if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
      return null;
    }
    return { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, []);

  const getRectFromRange = useCallback((range: Range) => {
    const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
    if (clientRects.length === 0) {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const rect of clientRects) {
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    return { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, []);

  const isRangeInsideSolution = useCallback((range: Range) => {
    const root = solutionRef.current;
    if (!root) return false;

    const startInside = root.contains(range.startContainer);
    const endInside = root.contains(range.endContainer);

    try {
      return range.intersectsNode(root) && (startInside || endInside);
    } catch {
      return startInside || endInside;
    }
  }, []);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [solutionMd, isStreaming]);

  const handleTextSelection = useCallback(() => {
    if (isStreaming) {
      hideSelectionTooltip();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      hideSelectionTooltip();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!isRangeInsideSolution(range)) {
      hideSelectionTooltip();
      return;
    }

    const rawSelection = normalizeSelectionText(sel.toString());
    if (!rawSelection) {
      hideSelectionTooltip();
      return;
    }

    const blocks = getIntersectingBlocks(range);
    let contextText = rawSelection;
    let tooltipX: number | null = null;
    let tooltipY: number | null = null;
    let outlineRect: { left: number; top: number; width: number; height: number } | null = null;

    if (blocks.length > 0) {
      clearPendingHighlight();
      applyHighlightToBlocks(blocks, 'solution-context-pending');
      pendingHighlightedBlocksRef.current = blocks;

      const blockText = normalizeSelectionText(
        blocks
          .map((block) => normalizeSelectionText(block.textContent ?? ''))
          .filter(Boolean)
          .join('\n\n'),
      );
      if (blockText) contextText = blockText;

      // Position tooltip at the top-right of the first block
      const firstRect = blocks[0].getBoundingClientRect();
      if (firstRect.width > 0 || firstRect.height > 0) {
        tooltipX = firstRect.right;
        tooltipY = firstRect.top;
      }
      outlineRect = getRectFromBlocks(blocks);
    } else {
      clearPendingHighlight();
      outlineRect = getRectFromRange(range);
    }

    if (tooltipX === null || tooltipY === null) {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        hideSelectionTooltip();
        return;
      }
      tooltipX = rect.right;
      tooltipY = rect.top;
    }

    setTooltipPos({ x: tooltipX, y: tooltipY });
    setPendingSelection({ id: createSelectionId(), text: contextText });
    setPendingOutlineRects(outlineRect ? [outlineRect] : []);
  }, [
    applyHighlightToBlocks,
    createSelectionId,
    clearPendingHighlight,
    getRectFromBlocks,
    getRectFromRange,
    getIntersectingBlocks,
    hideSelectionTooltip,
    isStreaming,
    isRangeInsideSolution,
    normalizeSelectionText,
  ]);

  const handleTextSelectionDeferred = useCallback(() => {
    requestAnimationFrame(() => {
      handleTextSelection();
    });
  }, [handleTextSelection]);

  // Hide tooltip on scroll
  useEffect(() => {
    const handleScroll = () => hideSelectionTooltip();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hideSelectionTooltip]);

  useEffect(() => {
    if (isStreaming) {
      hideSelectionTooltip();
    }
  }, [hideSelectionTooltip, isStreaming]);

  useEffect(() => {
    return () => {
      clearPendingHighlight();
    };
  }, [clearPendingHighlight]);

  function handleAddToChat() {
    if (!pendingSelection) return;

    const alreadySelected = selectedContexts.some((ctx) => ctx.text === pendingSelection.text);
    if (alreadySelected) {
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      return;
    }

    onTextSelect(pendingSelection);
    window.getSelection()?.removeAllRanges();
    hideSelectionTooltip();
  }

  const html = solutionMd ? markdownToHtml(solutionMd) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* PENDING state */}
        {status === 'pending' && !solutionMd && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-500/15 border border-orange-500/25">
              <svg
                className="w-7 h-7 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-base mb-1">Ready to solve</p>
              <p className="text-white/45 text-sm max-w-xs">
                Click the button below to let AI analyze your problem and generate a step-by-step solution.
              </p>
            </div>
            <button
              onClick={onSolve}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-medium text-sm transition-colors shadow-lg shadow-orange-500/20"
            >
              Solve with AI
            </button>
          </div>
        )}

        {/* SOLVING / STREAMING state */}
        {(status === 'solving' || isStreaming) && (
          <div>
            {html ? (
              <>
                <div
                  ref={solutionRef}
                  className="solution-md"
                  onMouseUp={handleTextSelectionDeferred}
                  onTouchEnd={handleTextSelectionDeferred}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                {/* Blinking cursor */}
                <span className="inline-block w-0.5 h-4 bg-orange-400 animate-pulse ml-0.5 align-middle" />
              </>
            ) : (
              <div className="flex items-center gap-3 text-orange-400 py-8">
                <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-sm text-white/60">AI is working on your solution...</span>
              </div>
            )}
          </div>
        )}

        {/* DONE state */}
        {status === 'done' && html && !isStreaming && (
          <div
            ref={solutionRef}
            className="solution-md"
            onMouseUp={handleTextSelectionDeferred}
            onTouchEnd={handleTextSelectionDeferred}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {/* ERROR state */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 text-sm">Something went wrong while solving.</p>
            <button
              onClick={onSolve}
              className="text-xs text-white/50 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Inline chat — below the solution */}
        {(status === 'done' || (status === 'solving' && solutionMd)) && (
          <InlineChat
            sessionId={sessionId}
            selectedContexts={selectedContexts}
            onTextSelect={onTextSelect}
            onClearContext={onClearContext}
            onClearAllContexts={onClearAllContexts}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Selection outline overlay (in-situ) */}
      {pendingOutlineRects.length > 0 && typeof document !== 'undefined' && createPortal(
        <>
          {pendingOutlineRects.map((rect, index) => (
            <div
              key={`${index}-${rect.left}-${rect.top}-${rect.width}-${rect.height}`}
              className="fixed pointer-events-none rounded-[10px]"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                zIndex: 2147483645,
                border: '2px solid rgba(249, 115, 22, 0.95)',
                background: 'rgba(249, 115, 22, 0.12)',
                boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.22)',
              }}
            />
          ))}
        </>,
        document.body,
      )}

      {/* Selection tooltip — positioned at top-right of the recuadro */}
      {tooltipPos && pendingSelection && typeof document !== 'undefined' && createPortal(
        <div
          id="selection-tooltip"
          className="fixed"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-100%, -50%)',
            zIndex: 2147483646,
          }}
        >
          <button
            onClick={handleAddToChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/90 hover:bg-orange-400 text-white text-[11px] font-semibold shadow-lg shadow-orange-500/30 transition-all whitespace-nowrap backdrop-blur-sm"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add to chat
          </button>
        </div>,
        document.body,
      )}

      <style jsx global>{`
        /* Markdown styles */
        .solution-md {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
          line-height: 1.75;
          user-select: text;
          -webkit-user-select: text;
          cursor: text;
        }
        .solution-md::selection,
        .solution-md *::selection {
          background: rgba(249, 115, 22, 0.35);
          color: #fff;
        }
        .solution-md [data-solution-block="true"] {
          transition: background-color 0.2s ease, box-shadow 0.2s ease, padding 0.2s ease, margin 0.2s ease;
          border-radius: 8px;
        }
        .solution-md .solution-context-pending {
          background: rgba(249, 115, 22, 0.26) !important;
          outline: 3px solid rgba(249, 115, 22, 1) !important;
          outline-offset: 2px;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.14) inset,
            0 8px 30px rgba(249, 115, 22, 0.38) !important;
          padding: 8px 12px;
          margin-left: -12px;
          margin-right: -12px;
          position: relative;
          z-index: 3;
        }
        .solution-md .md-h1 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #fff;
          margin: 1.4em 0 0.6em;
        }
        .solution-md .md-h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
          margin: 1.2em 0 0.5em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .solution-md .md-h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 1em 0 0.4em;
        }
        .solution-md .md-p {
          margin: 0.5em 0;
        }
        .solution-md .md-li {
          margin-left: 1.25rem;
          list-style-type: disc;
          display: list-item;
          margin-bottom: 0.25em;
        }
        .solution-md .md-oli {
          list-style-type: decimal;
        }
        .solution-md .md-hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 1.5em 0;
        }
        .solution-md .inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.82em;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          padding: 0.1em 0.35em;
          color: #fcd34d;
        }
        .solution-md .code-block {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 1rem 1.25rem;
          overflow-x: auto;
          margin: 0.75em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.6;
        }
        .solution-md .math-display {
          margin: 1em 0;
          overflow-x: auto;
          text-align: center;
        }
        .solution-md strong { color: #fff; font-weight: 600; }
        .solution-md em { color: rgba(255,255,255,0.75); font-style: italic; }
      `}</style>
    </div>
  );
}
