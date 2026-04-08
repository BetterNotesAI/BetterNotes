'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { CheatSheetSubChat } from './CheatSheetSubChat';

// ---------------------------------------------------------------------------
// Minimal Markdown + KaTeX renderer
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderKatex(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, { displayMode, throwOnError: false, output: 'html' });
  } catch {
    return escapeHtml(math);
  }
}

function renderInlineMath(text: string): string {
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => renderKatex(math, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => renderKatex(math, true));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderKatex(math, false));
  text = text.replace(/\\\((.+?)\\\)/g, (_, math) => renderKatex(math, false));
  return text;
}

function renderInline(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="cs-inline-code">$1</code>');
  return text;
}

interface CSBlock {
  html: string;
  text: string;
}

function markdownToBlocks(md: string): CSBlock[] {
  const lines = md.split('\n');
  const blocks: CSBlock[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

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
          html: `<pre class="cs-code-block"><code${langAttr}>${escapeHtml(text)}</code></pre>`,
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

    // Display math: $$...$$
    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        const math = raw.trim().slice(2, -2);
        blocks.push({ html: `<div class="cs-math-display">${renderKatex(math, true)}</div>`, text: `$$${math}$$` });
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      const mathText = mathLines.join('\n');
      blocks.push({ html: `<div class="cs-math-display">${renderKatex(mathText, true)}</div>`, text: `$$${mathText}$$` });
      continue;
    }

    // Display math: \[...\]
    if (raw.trim() === '\\[' || (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim().length > 4)) {
      if (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim() !== '\\[') {
        const math = raw.trim().slice(2, -2);
        blocks.push({ html: `<div class="cs-math-display">${renderKatex(math, true)}</div>`, text: `\\[${math}\\]` });
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') { mathLines.push(lines[i]); i++; }
      const mathText = mathLines.join('\n');
      blocks.push({ html: `<div class="cs-math-display">${renderKatex(mathText, true)}</div>`, text: `\\[${mathText}\\]` });
      continue;
    }

    if (raw.trim() === '') continue;

    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      blocks.push({ html: `<h${level} class="cs-h${level}">${renderInline(renderInlineMath(text))}</h${level}>`, text });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
      blocks.push({ html: '<hr class="cs-hr" />', text: '---' });
      continue;
    }

    const ulMatch = raw.match(/^[\s]*[-*+•] (.+)/);
    if (ulMatch) {
      blocks.push({ html: `<li class="cs-li">${renderInline(renderInlineMath(ulMatch[1]))}</li>`, text: ulMatch[1] });
      continue;
    }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) {
      blocks.push({ html: `<li class="cs-li cs-oli">${renderInline(renderInlineMath(olMatch[1]))}</li>`, text: olMatch[1] });
      continue;
    }

    // Table row
    if (raw.trim().startsWith('|')) {
      blocks.push({ html: `<div class="cs-table-row">${renderInline(renderInlineMath(raw))}</div>`, text: raw });
      continue;
    }

    const paraHtml = renderInline(renderInlineMath(raw));
    blocks.push({ html: `<p class="cs-p">${paraHtml}</p>`, text: raw });
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
// Props
// ---------------------------------------------------------------------------

interface Props {
  sessionId: string;
  contentMd: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  isStreaming: boolean;
  onGenerate: () => void;
  selectedContexts: Array<{ id: string; text: string }>;
  onTextSelect: (context: { id: string; text: string }) => void;
  onClearContext: (id: string) => void;
  onClearAllContexts: () => void;
}

export function CheatSheetPanel({
  sessionId,
  contentMd,
  status,
  isStreaming,
  onGenerate,
  selectedContexts,
  onTextSelect,
  onClearContext,
  onClearAllContexts,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Selection tooltip
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    id: string;
    text: string;
    blockIndex: number;
  } | null>(null);
  const [pendingOutlineRects, setPendingOutlineRects] = useState<Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>>([]);
  const pendingHighlightedBlocksRef = useRef<HTMLElement[]>([]);

  // Subchats
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
        const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/subchats`);
        if (!res.ok || cancelled) return;

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
              messages: sc.messages.map((m) => ({ ...m, role: m.role as 'user' | 'assistant' })),
            });
          }
          return next;
        });
      } catch {
        // Non-critical
      }
    }

    loadSubchats();
    return () => { cancelled = true; };
  }, [sessionId, status]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const clearHighlightFromBlocks = useCallback((blocks: HTMLElement[], className: string) => {
    for (const block of blocks) block.classList.remove(className);
  }, []);

  const applyHighlightToBlocks = useCallback((blocks: HTMLElement[], className: string) => {
    for (const block of blocks) block.classList.add(className);
  }, []);

  const clearPendingHighlight = useCallback(() => {
    clearHighlightFromBlocks(pendingHighlightedBlocksRef.current, 'cs-context-pending');
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
    if (!contentRef.current) return [] as HTMLElement[];
    return Array.from(
      contentRef.current.querySelectorAll<HTMLElement>('[data-cs-block="true"]'),
    ).filter((block) => {
      try { return range.intersectsNode(block); } catch { return false; }
    });
  }, []);

  const getClosestCSBlock = useCallback((node: Node | null) => {
    if (!node) return null;
    const baseEl = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!baseEl) return null;
    return baseEl.closest('[data-cs-block="true"]') as HTMLElement | null;
  }, []);

  const getRectFromBlocks = useCallback((blocks: HTMLElement[]) => {
    if (blocks.length === 0) return null;
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    if (!isFinite(minLeft)) return null;
    return { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, []);

  const getRectFromRange = useCallback((range: Range) => {
    const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
    if (clientRects.length === 0) {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    for (const rect of clientRects) {
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    return { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop };
  }, []);

  const isRangeInsideContent = useCallback((range: Range) => {
    const root = contentRef.current;
    if (!root) return false;
    const startInside = root.contains(range.startContainer);
    const endInside = root.contains(range.endContainer);
    try { return range.intersectsNode(root) && (startInside || endInside); }
    catch { return startInside || endInside; }
  }, []);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contentMd, isStreaming]);

  // ---------------------------------------------------------------------------
  // Text selection handler
  // ---------------------------------------------------------------------------

  const handleTextSelection = useCallback(() => {
    if (isStreaming) { hideSelectionTooltip(); return; }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideSelectionTooltip(); return; }

    const range = sel.getRangeAt(0);
    if (!isRangeInsideContent(range)) { hideSelectionTooltip(); return; }

    const rawSelection = normalizeSelectionText(sel.toString());
    if (!rawSelection) { hideSelectionTooltip(); return; }

    const blocks = getIntersectingBlocks(range);
    let contextText = rawSelection;
    let tooltipX: number | null = null;
    let tooltipY: number | null = null;
    let outlineRect: { left: number; top: number; width: number; height: number } | null = null;
    let anchorBlockIndex = -1;

    if (blocks.length > 0) {
      clearPendingHighlight();
      applyHighlightToBlocks(blocks, 'cs-context-pending');
      pendingHighlightedBlocksRef.current = blocks;

      const blockText = normalizeSelectionText(
        blocks
          .map((block) => normalizeSelectionText(block.textContent ?? ''))
          .filter(Boolean)
          .join('\n\n'),
      );
      if (blockText) contextText = blockText;

      const endBlock = getClosestCSBlock(range.endContainer);
      const startBlock = getClosestCSBlock(range.startContainer);
      const endIndex = parseInt(endBlock?.getAttribute('data-block-index') ?? '-1', 10);
      const startIndex = parseInt(startBlock?.getAttribute('data-block-index') ?? '-1', 10);
      anchorBlockIndex = endIndex >= 0 ? endIndex : startIndex >= 0 ? startIndex : -1;

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
      if (rect.width === 0 && rect.height === 0) { hideSelectionTooltip(); return; }
      tooltipX = rect.right;
      tooltipY = rect.top;
    }

    setTooltipPos({ x: tooltipX, y: tooltipY });
    setPendingSelection({ id: createSelectionId(), text: contextText, blockIndex: anchorBlockIndex });
    setPendingOutlineRects(outlineRect ? [outlineRect] : []);
  }, [
    applyHighlightToBlocks, createSelectionId, clearPendingHighlight,
    getClosestCSBlock, getRectFromBlocks, getRectFromRange, getIntersectingBlocks,
    hideSelectionTooltip, isStreaming, isRangeInsideContent, normalizeSelectionText,
  ]);

  const handleTextSelectionDeferred = useCallback(() => {
    requestAnimationFrame(() => handleTextSelection());
  }, [handleTextSelection]);

  useEffect(() => {
    const handleScroll = () => hideSelectionTooltip();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [hideSelectionTooltip]);

  useEffect(() => {
    if (isStreaming) hideSelectionTooltip();
  }, [hideSelectionTooltip, isStreaming]);

  useEffect(() => () => clearPendingHighlight(), [clearPendingHighlight]);

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

    const scrollToSubchat = (targetIdx: number) => {
      requestAnimationFrame(() => {
        const anchor = contentRef.current?.querySelector<HTMLElement>(`[data-subchat-anchor="${targetIdx}"]`);
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
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/subchats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex, contextText }),
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

      if (!res.ok) throw new Error(data.error ?? 'Failed to create subchat');

      setSubchatsMap((prev) => {
        const next = new Map(prev);
        const resolvedIdx = data.subchat.block_index;
        next.set(resolvedIdx, {
          id: data.subchat.id,
          blockIndex: resolvedIdx,
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
      await fetch(`/api/cheat-sheets/sessions/${sessionId}/subchats/${subchatId}`, { method: 'DELETE' });
    } catch {
      // Optimistic
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

  const blocks = useMemo(() => (contentMd ? markdownToBlocks(contentMd) : null), [contentMd]);
  const showSubchats = status === 'done' && !isStreaming;

  function renderBlocks(blockList: CSBlock[]) {
    return (
      <div
        ref={contentRef}
        className="cs-content-md"
        onMouseUp={handleTextSelectionDeferred}
        onTouchEnd={handleTextSelectionDeferred}
      >
        {blockList.map((block, idx) => {
          const subchat = subchatsMap.get(idx);
          return (
            <React.Fragment key={idx}>
              <div
                data-cs-block="true"
                data-block-index={idx}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
              <div data-subchat-anchor={idx}>
                {showSubchats && subchat && (
                  <CheatSheetSubChat
                    subchatId={subchat.id}
                    sessionId={sessionId}
                    contextText={subchat.contextText}
                    initialMessages={subchat.messages}
                    onDelete={() => handleDeleteSubchat(subchat.id, idx)}
                  />
                )}
                {showSubchats && creatingSubchatBlock === idx && !subchat && (
                  <div className="cs-subchat-creating">
                    <span className="cs-subchat-creating-dot" />
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
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* PENDING state */}
        {status === 'pending' && !contentMd && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-white">Ready to generate</h3>
              <p className="text-sm text-white/45 max-w-xs">
                Click Generate to create your cheat sheet from the selected content.
              </p>
            </div>
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 hover:text-indigo-200 text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Cheat Sheet
            </button>
          </div>
        )}

        {/* GENERATING — streaming */}
        {(status === 'generating' || isStreaming) && !contentMd && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
            <div className="w-10 h-10 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-sm text-white/45">Generating cheat sheet...</p>
          </div>
        )}

        {/* Content — streaming or done */}
        {contentMd && (
          <div className="max-w-3xl mx-auto">
            {blocks ? renderBlocks(blocks) : null}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-indigo-400 rounded-sm animate-pulse ml-1 align-middle" />
            )}
          </div>
        )}

        {/* ERROR state */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-4 text-center py-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-red-400 font-medium">Generation failed</p>
              <p className="text-xs text-white/35">Try again or check your content.</p>
            </div>
            <button
              onClick={onGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500/15 hover:bg-red-500/20 border border-red-500/25 text-red-300 hover:text-red-200 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        )}

        {subchatActionError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mt-2 mx-auto max-w-lg">
            {subchatActionError}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <style jsx global>{`
        .cs-content-md {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
          line-height: 1.75;
          user-select: text;
          -webkit-user-select: text;
          cursor: text;
        }
        .cs-content-md::selection,
        .cs-content-md *::selection {
          background: rgba(99, 102, 241, 0.35);
          color: #fff;
        }
        .cs-content-md [data-cs-block="true"] {
          transition: background-color 0.2s ease, box-shadow 0.2s ease, outline-color 0.2s ease;
          border-radius: 8px;
        }
        .cs-content-md .cs-context-pending {
          background: rgba(99, 102, 241, 0.22) !important;
          outline: 3px solid rgba(99, 102, 241, 0.9) !important;
          outline-offset: 2px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.12) inset, 0 8px 28px rgba(99,102,241,0.3) !important;
          position: relative;
          z-index: 3;
        }
        .cs-subchat-creating {
          margin: 10px 0;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.18);
          border-left: 2px solid rgba(99, 102, 241, 0.5);
          background: rgba(99, 102, 241, 0.03);
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
        }
        .cs-subchat-creating-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: rgba(129, 140, 248, 0.8);
          animation: csPulse 1.1s ease-in-out infinite;
        }
        @keyframes csPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1); opacity: 1; }
        }
        .cs-content-md .cs-h1 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          margin: 1.4em 0 0.5em;
        }
        .cs-content-md .cs-h2 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #fff;
          margin: 1.2em 0 0.45em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid rgba(99,102,241,0.2);
        }
        .cs-content-md .cs-h3 {
          font-size: 0.92rem;
          font-weight: 600;
          color: rgba(200, 200, 255, 0.9);
          margin: 1em 0 0.4em;
        }
        .cs-content-md .cs-p {
          margin: 0.45em 0;
        }
        .cs-content-md .cs-li {
          margin-left: 1.25rem;
          list-style-type: disc;
          display: list-item;
          margin-bottom: 0.2em;
        }
        .cs-content-md .cs-oli {
          list-style-type: decimal;
        }
        .cs-content-md .cs-hr {
          border: none;
          border-top: 1px solid rgba(99,102,241,0.2);
          margin: 1em 0;
        }
        .cs-content-md .cs-math-display {
          margin: 0.7em 0;
          overflow-x: auto;
          text-align: center;
        }
        .cs-content-md .cs-code-block {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0.65rem 0.9rem;
          overflow-x: auto;
          margin: 0.6em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.55;
        }
        .cs-content-md .cs-inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.82em;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 4px;
          padding: 0.1em 0.28em;
          color: #a5b4fc;
        }
        .cs-content-md .cs-table-row {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.75);
          padding: 0.2em 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .cs-content-md strong { color: #fff; font-weight: 600; }
        .cs-content-md em { color: rgba(200,200,255,0.7); font-style: italic; }
      `}</style>

      {/* Selection tooltip — portal */}
      {tooltipPos &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 flex items-center gap-1 bg-[#1a1a1a]/95 border border-white/15 rounded-xl shadow-xl shadow-black/40 px-1.5 py-1.5 backdrop-blur-md"
            style={{ left: tooltipPos.x + 8, top: tooltipPos.y - 8 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              onClick={handleAddToChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Add to chat context"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Add to chat
            </button>
            {pendingSelection && pendingSelection.blockIndex >= 0 && (
              <button
                onClick={handleCreateSubchat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-400/80 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                title="Open mini-chat for this block"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Subchat
              </button>
            )}
          </div>,
          document.body,
        )}

      {/* Outline rects */}
      {pendingOutlineRects.map((rect, i) =>
        typeof window !== 'undefined'
          ? createPortal(
              <div
                key={i}
                className="fixed z-40 pointer-events-none border border-indigo-400/40 bg-indigo-500/8 rounded-sm"
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              />,
              document.body,
            )
          : null,
      )}
    </div>
  );
}
