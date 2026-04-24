'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { InlineChat } from './InlineChat';
import { SubChat } from './SubChat';

// ---------------------------------------------------------------------------
// Minimal Markdown → HTML renderer helpers
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

function renderInlineMath(text: string): string {
  // Display math: $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) =>
    renderKatex(math, true)
  );
  // Display math: \[...\]
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) =>
    renderKatex(math, true)
  );
  // Inline math: $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) =>
    renderKatex(math, false)
  );
  // Inline math: \(...\)
  text = text.replace(/\\\((.+?)\\\)/g, (_, math) =>
    renderKatex(math, false)
  );
  return text;
}

function renderInline(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return text;
}

// ---------------------------------------------------------------------------
// Block-based markdown renderer
// Each block is a logical unit (heading, paragraph, list item, code, math, hr)
// ---------------------------------------------------------------------------

interface SolutionBlock {
  html: string;
  text: string;
}

function markdownToBlocks(md: string): SolutionBlock[] {
  const lines = md.split('\n');
  const blocks: SolutionBlock[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Fenced code block
    if (raw.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = raw.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const text = codeLines.join('\n');
        const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        blocks.push({
          html: `<pre class="code-block"><code${langAttr}>${escapeHtml(text)}</code></pre>`,
          text,
        });
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    // Display math block: $$...$$
    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      // Single-line display: $$...$$
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        const math = raw.trim().slice(2, -2);
        blocks.push({
          html: `<div class="math-display">${renderKatex(math, true)}</div>`,
          text: `$$${math}$$`,
        });
        continue;
      }

      // Multi-line display math block
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      const mathText = mathLines.join('\n');
      blocks.push({
        html: `<div class="math-display">${renderKatex(mathText, true)}</div>`,
        text: `$$${mathText}$$`,
      });
      continue;
    }

    // Display math block: \[...\]
    if (raw.trim() === '\\[' || (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim().length > 4)) {
      if (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim() !== '\\[') {
        const math = raw.trim().slice(2, -2);
        blocks.push({
          html: `<div class="math-display">${renderKatex(math, true)}</div>`,
          text: `\\[${math}\\]`,
        });
        continue;
      }

      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') {
        mathLines.push(lines[i]);
        i++;
      }
      const mathText = mathLines.join('\n');
      blocks.push({
        html: `<div class="math-display">${renderKatex(mathText, true)}</div>`,
        text: `\\[${mathText}\\]`,
      });
      continue;
    }

    // Blank line — skip
    if (raw.trim() === '') {
      continue;
    }

    // Headings
    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      const processed = renderInline(renderInlineMath(text));
      blocks.push({
        html: `<h${level} class="md-h${level}">${processed}</h${level}>`,
        text,
      });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
      blocks.push({ html: '<hr class="md-hr" />', text: '---' });
      continue;
    }

    // Unordered list item
    const ulMatch = raw.match(/^[\s]*[-*+•] (.+)/);
    if (ulMatch) {
      const processed = renderInline(renderInlineMath(ulMatch[1]));
      blocks.push({
        html: `<li class="md-li">${processed}</li>`,
        text: ulMatch[1],
      });
      continue;
    }

    // Ordered list item
    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) {
      const processed = renderInline(renderInlineMath(olMatch[1]));
      blocks.push({
        html: `<li class="md-li md-oli">${processed}</li>`,
        text: olMatch[1],
      });
      continue;
    }

    // Regular text → one block per source line.
    // This keeps subchat insertion visually close to the selected line.
    const paraText = raw;
    const paraHtml = renderInline(renderInlineMath(raw));
    blocks.push({
      html: `<p class="md-p">${paraHtml}</p>`,
      text: paraText,
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Subchat data types
// ---------------------------------------------------------------------------

interface SubchatData {
  id: string;
  blockIndex: number;
  contextText: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  sessionId: string;
  solutionMd: string | null;
  status: 'pending' | 'solving' | 'done' | 'error';
  isStreaming: boolean;
  errorMessage?: string | null;
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
  errorMessage,
  onSolve,
  selectedContexts,
  onTextSelect,
  onClearContext,
  onClearAllContexts,
}: Props) {
  type TooltipPosition = { x: number; y: number; placement: 'above' | 'below' };
  type SelectionFrame = { left: number; top: number; width: number; height: number };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const skipSelectionCollapseRef = useRef(false);

  // Selection tooltip
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrame | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    id: string;
    text: string;
    blockIndex: number;
  } | null>(null);

  // Subchats state
  const [subchatsMap, setSubchatsMap] = useState<Map<number, SubchatData>>(new Map());
  const [creatingSubchatBlock, setCreatingSubchatBlock] = useState<number | null>(null);
  const [subchatActionError, setSubchatActionError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load subchats
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setSubchatsMap(new Map());
    setCreatingSubchatBlock(null);
    setSubchatActionError(null);
  }, [sessionId]);

  useEffect(() => {
    if (status !== 'done') return;
    let cancelled = false;

    async function loadSubchats() {
      try {
        const res = await fetch(`/api/problem-solver/sessions/${sessionId}/subchats`);
        if (!res.ok) return;
        if (cancelled) return;

        const data = await res.json() as {
          subchats: Array<{
            id: string;
            block_index: number;
            context_text: string;
            messages: Array<{ id: string; role: string; content: string; created_at: string }>;
          }>;
        };

        setSubchatsMap((prev) => {
          const next = new Map(prev);
          for (const sc of data.subchats) {
            next.set(sc.block_index, {
              id: sc.id,
              blockIndex: sc.block_index,
              contextText: sc.context_text,
              messages: sc.messages.map((m) => ({
                ...m,
                role: m.role as 'user' | 'assistant',
              })),
            });
          }
          return next;
        });
      } catch {
        // Non-critical
      }
    }

    loadSubchats();
    return () => {
      cancelled = true;
    };
  }, [sessionId, status]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const hideSelectionTooltip = useCallback(() => {
    setTooltipPos(null);
    setSelectionFrame(null);
    setPendingSelection(null);
  }, []);

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

  const getClosestSolutionBlock = useCallback((node: Node | null) => {
    if (!node) return null;
    const baseEl = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
    if (!baseEl) return null;
    return baseEl.closest('[data-solution-block="true"]') as HTMLElement | null;
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

  const inflateRect = useCallback((rect: DOMRect, padX = 8, padY = 6): SelectionFrame => {
    return {
      left: Math.max(4, rect.left - padX),
      top: Math.max(4, rect.top - padY),
      width: rect.width + padX * 2,
      height: rect.height + padY * 2,
    };
  }, []);

  const buildUnionRectFromRange = useCallback((range: Range): SelectionFrame | null => {
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 || r.height > 0);

    if (rects.length === 0) return null;

    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));

    return inflateRect(
      new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top)),
      8,
      6,
    );
  }, [inflateRect]);

  const updateStickyScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 96;
  }, []);

  const handleScrollWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      shouldStickToBottomRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isStreaming) {
      shouldStickToBottomRef.current = true;
    }
  }, [isStreaming]);

  // Auto-scroll during streaming only while the user stays near the bottom.
  useEffect(() => {
    if (!isStreaming || !shouldStickToBottomRef.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (!shouldStickToBottomRef.current) return;
      container.scrollTo({
        top: Math.max(0, container.scrollHeight - container.clientHeight),
        behavior: 'auto',
      });
    });
  }, [solutionMd, isStreaming]);

  // ---------------------------------------------------------------------------
  // Text selection handler
  // ---------------------------------------------------------------------------

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
    let tooltipX: number | null = null;
    let tooltipY: number | null = null;
    let frameRect: SelectionFrame | null = null;
    let anchorBlockIndex = -1;

    if (blocks.length > 0) {
      const blockIndices = blocks
        .map((b) => parseInt(b.getAttribute('data-block-index') ?? '-1', 10))
        .filter((i) => i >= 0);
      const endBlock = getClosestSolutionBlock(range.endContainer);
      const startBlock = getClosestSolutionBlock(range.startContainer);
      const endIndex = parseInt(endBlock?.getAttribute('data-block-index') ?? '-1', 10);
      const startIndex = parseInt(startBlock?.getAttribute('data-block-index') ?? '-1', 10);

      if (endIndex >= 0) {
        anchorBlockIndex = endIndex;
      } else if (startIndex >= 0) {
        anchorBlockIndex = startIndex;
      } else if (blockIndices.length > 0) {
        anchorBlockIndex = Math.max(...blockIndices);
      }

    }

    frameRect = buildUnionRectFromRange(range);
    if (frameRect) {
      tooltipX = frameRect.left + frameRect.width;
      tooltipY = frameRect.top;
    }

    if (tooltipX === null || tooltipY === null) {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        hideSelectionTooltip();
        return;
      }
      frameRect = inflateRect(rect);
      tooltipX = rect.right;
      tooltipY = rect.top;
    }

    if (!frameRect) {
      hideSelectionTooltip();
      return;
    }

    const placement: 'above' | 'below' = tooltipY > 20 ? 'above' : 'below';
    const finalY = placement === 'above'
      ? frameRect.top
      : frameRect.top + frameRect.height;

    setSelectionFrame(frameRect);
    setTooltipPos({ x: tooltipX, y: finalY, placement });
    setPendingSelection({ id: createSelectionId(), text: rawSelection, blockIndex: anchorBlockIndex });

    // Keep only the custom frame UI; remove native browser text highlight.
    skipSelectionCollapseRef.current = true;
    requestAnimationFrame(() => {
      window.getSelection()?.removeAllRanges();
      requestAnimationFrame(() => {
        skipSelectionCollapseRef.current = false;
      });
    });
  }, [
    buildUnionRectFromRange,
    createSelectionId,
    getClosestSolutionBlock,
    getIntersectingBlocks,
    hideSelectionTooltip,
    inflateRect,
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
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (skipSelectionCollapseRef.current && pendingSelection) return;
        hideSelectionTooltip();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!isRangeInsideSolution(range)) {
        hideSelectionTooltip();
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [hideSelectionTooltip, isRangeInsideSolution, pendingSelection]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

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

  async function handleCreateSubchat() {
    if (!pendingSelection || pendingSelection.blockIndex < 0) return;

    const blockIndex = pendingSelection.blockIndex;
    const contextText = pendingSelection.text;
    const scrollToSubchat = (targetBlockIndex: number) => {
      requestAnimationFrame(() => {
        const anchor = solutionRef.current?.querySelector<HTMLElement>(
          `[data-subchat-anchor="${targetBlockIndex}"]`,
        );
        anchor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };

    if (subchatsMap.has(blockIndex) || creatingSubchatBlock === blockIndex) {
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      scrollToSubchat(blockIndex);
      return;
    }

    setSubchatActionError(null);
    setCreatingSubchatBlock(blockIndex);
    scrollToSubchat(blockIndex);

    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/subchats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockIndex,
          contextText,
        }),
      });

      const data = await res.json().catch(() => ({})) as {
        error?: string;
        subchat: {
          id: string;
          block_index: number;
          context_text: string;
          messages?: Array<{ id: string; role: string; content: string; created_at: string }>;
        };
      };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create subchat');
      }

      setSubchatsMap((prev) => {
        const next = new Map(prev);
        const resolvedBlockIndex = data.subchat.block_index;
        next.set(resolvedBlockIndex, {
          id: data.subchat.id,
          blockIndex: resolvedBlockIndex,
          contextText: data.subchat.context_text || contextText,
          messages: (data.subchat.messages ?? []).map((m) => ({
            ...m,
            role: m.role as 'user' | 'assistant',
          })),
        });
        return next;
      });
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      scrollToSubchat(data.subchat.block_index);
    } catch (err: unknown) {
      setSubchatActionError(err instanceof Error ? err.message : 'Failed to create subchat');
    } finally {
      setCreatingSubchatBlock((current) => (current === blockIndex ? null : current));
    }
  }

  async function handleDeleteSubchat(subchatId: string, blockIndex: number) {
    try {
      await fetch(
        `/api/problem-solver/sessions/${sessionId}/subchats/${subchatId}`,
        { method: 'DELETE' },
      );
    } catch {
      // Continue with optimistic removal
    }

    setSubchatsMap((prev) => {
      const next = new Map(prev);
      next.delete(blockIndex);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const blocks = useMemo(() => (solutionMd ? markdownToBlocks(solutionMd) : null), [solutionMd]);
  const showSubchats = status === 'done' && !isStreaming;
  const effectiveErrorMessage = (errorMessage ?? '').trim() || 'Something went wrong while solving.';
  const extractionHint = /no readable text|pdf text not extracted|pdftext is required/i.test(effectiveErrorMessage);

  function renderBlocks(blockList: SolutionBlock[]) {
    return (
      <div
        ref={solutionRef}
        className="solution-md"
        onMouseUp={handleTextSelectionDeferred}
        onTouchEnd={handleTextSelectionDeferred}
      >
        {blockList.map((block, idx) => {
          const subchat = subchatsMap.get(idx);
          return (
            <React.Fragment key={idx}>
              <div
                data-solution-block="true"
                data-block-index={idx}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
              <div data-subchat-anchor={idx}>
                {showSubchats && subchat && (
                  <SubChat
                    subchatId={subchat.id}
                    sessionId={sessionId}
                    contextText={subchat.contextText}
                    initialMessages={subchat.messages}
                    onDelete={() => handleDeleteSubchat(subchat.id, idx)}
                  />
                )}
                {showSubchats && creatingSubchatBlock === idx && !subchat && (
                  <div className="subchat-creating">
                    <span className="subchat-creating-dot" />
                    Creating subchat...
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-6"
        onScroll={updateStickyScrollState}
        onWheel={handleScrollWheel}
      >

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
              onClick={() => onSolve()}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-medium text-sm transition-colors shadow-lg shadow-orange-500/20"
            >
              Solve with AI
            </button>
          </div>
        )}

        {/* SOLVING / STREAMING state */}
        {(status === 'solving' || isStreaming) && (
          <div>
            {blocks ? (
              <>
                {renderBlocks(blocks)}
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
        {status === 'done' && blocks && !isStreaming && renderBlocks(blocks)}

        {/* ERROR state */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 text-sm max-w-md">{effectiveErrorMessage}</p>
            {extractionHint && (
              <p className="text-white/45 text-xs max-w-md">
                Tip: if this is a scanned PDF, run OCR and upload the OCR version.
              </p>
            )}
            <button
              onClick={() => onSolve()}
              className="text-xs text-white/50 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {subchatActionError && (
          <div className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {subchatActionError}
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

      </div>

      {/* Selection tooltip — 2 buttons: Add to chat + Subchat */}
      {selectionFrame && typeof document !== 'undefined' && createPortal(
        <div
          id="selection-frame"
          aria-hidden="true"
          className="fixed pointer-events-none rounded-xl border"
          style={{
            left: selectionFrame.left,
            top: selectionFrame.top,
            width: selectionFrame.width,
            height: selectionFrame.height,
            borderColor: 'rgba(251, 146, 60, 0.75)',
            background: 'rgba(249, 115, 22, 0.10)',
            boxShadow: 'inset 0 0 0 1px rgba(251,146,60,0.25), 0 0 0 1px rgba(249,115,22,0.35)',
            zIndex: 2147483644,
          }}
        />,
        document.body,
      )}

      {tooltipPos && pendingSelection && typeof document !== 'undefined' && createPortal(
        <div
          id="selection-tooltip"
          className="fixed"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.placement === 'above'
              ? 'translate(-100%, -100%)'
              : 'translate(-100%, 0%)',
            zIndex: 2147483646,
          }}
        >
          <div className="flex items-center gap-0.5 rounded-xl bg-[#1a1a1a]/95 backdrop-blur-md shadow-xl shadow-black/45 border border-orange-400/40 p-[3px]">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToChat();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-orange-500/18 text-orange-100/80 hover:text-orange-200 text-[11px] font-medium transition-all whitespace-nowrap"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add to chat
            </button>
            {pendingSelection.blockIndex >= 0 && (
              <>
                <div className="w-px h-4 bg-orange-300/25" />
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateSubchat();
                  }}
                  disabled={creatingSubchatBlock === pendingSelection.blockIndex}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                    creatingSubchatBlock === pendingSelection.blockIndex
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'hover:bg-orange-500/18 text-orange-100/80 hover:text-orange-200'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  {creatingSubchatBlock === pendingSelection.blockIndex ? 'Creating...' : 'Subchat'}
                </button>
              </>
            )}
          </div>
          {subchatActionError && (
            <p className="max-w-[280px] px-2 pb-1 pt-1 text-[10px] text-red-300">
              {subchatActionError}
            </p>
          )}
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
        .subchat-creating {
          margin: 10px 0;
          border-radius: 12px;
          border: 1px solid rgba(249, 115, 22, 0.18);
          border-left: 2px solid rgba(249, 115, 22, 0.5);
          background: rgba(249, 115, 22, 0.03);
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
        }
        .subchat-creating-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: rgba(251, 146, 60, 0.8);
          animation: subchatPulse 1.1s ease-in-out infinite;
        }
        @keyframes subchatPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1); opacity: 1; }
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
