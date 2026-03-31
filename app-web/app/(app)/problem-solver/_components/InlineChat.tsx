'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface InlineChatProps {
  sessionId: string;
  selectedContexts: Array<{ id: string; text: string }>;
  onTextSelect: (context: { id: string; text: string }) => void;
  onClearContext: (id: string) => void;
  onClearAllContexts: () => void;
}

// ---------------------------------------------------------------------------
// Markdown + KaTeX renderer (same approach as SolutionPanel)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderKatex(math, false));
  return text;
}

function renderInline(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="ic-inline-code">$1</code>');
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
    if (inParagraph) { html.push('</p>'); inParagraph = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (raw.startsWith('```')) {
      if (!inCodeBlock) {
        closeParagraph();
        inCodeBlock = true;
        codeLang = raw.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre class="ic-code-block" data-chat-block="true"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(raw); continue; }

    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        html.push(`<div class="ic-math-display" data-chat-block="true">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="ic-math-display" data-chat-block="true">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    if (raw.trim() === '') { closeParagraph(); continue; }

    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      closeParagraph();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      html.push(`<h${level} class="ic-md-h${level}" data-chat-block="true">${renderInline(renderInlineMath(text))}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { closeParagraph(); html.push('<hr class="ic-md-hr" />'); continue; }

    const ulMatch = raw.match(/^[\s]*[-*+] (.+)/);
    if (ulMatch) { closeParagraph(); html.push(`<li class="ic-md-li" data-chat-block="true">${renderInline(renderInlineMath(ulMatch[1]))}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { closeParagraph(); html.push(`<li class="ic-md-li ic-md-oli" data-chat-block="true">${renderInline(renderInlineMath(olMatch[1]))}</li>`); continue; }

    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) { html.push('<p class="ic-md-p" data-chat-block="true">'); inParagraph = true; } else { html.push('<br />'); }
    html.push(processed);
  }

  closeParagraph();
  return html.join('');
}

// ---------------------------------------------------------------------------
// Strip leading "> quote" from user message for display
// ---------------------------------------------------------------------------

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

function extractQuotes(content: string): { quotes: string[]; body: string } {
  const lines = content.split('\n');
  const quotes: string[] = [];
  let index = 0;

  // Extract consecutive quote blocks separated by blank lines
  while (index < lines.length) {
    // Skip blank lines between quotes
    while (index < lines.length && lines[index].trim() === '') index++;

    if (index >= lines.length || !lines[index].startsWith('>')) break;

    // Collect one quote block
    const quoteLines: string[] = [];
    while (index < lines.length && lines[index].startsWith('>')) {
      quoteLines.push(lines[index].replace(/^>\s?/, ''));
      index++;
    }
    if (quoteLines.length > 0) {
      quotes.push(quoteLines.join('\n').trim());
    }
  }

  // Skip blank lines after quotes
  while (index < lines.length && lines[index].trim() === '') index++;

  const body = lines.slice(index).join('\n').trim();
  return { quotes, body: body || content };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineChat({ sessionId, selectedContexts, onTextSelect, onClearContext, onClearAllContexts }: InlineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ id: string; text: string } | null>(null);
  const [pendingOutlineRects, setPendingOutlineRects] = useState<Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    clearHighlightFromBlocks(pendingHighlightedBlocksRef.current, 'ic-context-pending');
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

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  // Load messages on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/problem-solver/sessions/${sessionId}/chat`);
        if (!res.ok) return;
        const data = await res.json() as { messages: ChatMessage[] };
        setMessages(data.messages ?? []);
      } catch {
        // Non-critical
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sessionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const getAssistantContainerFromRange = useCallback((range: Range) => {
    const ancestor = range.commonAncestorContainer;
    const baseEl = ancestor.nodeType === Node.ELEMENT_NODE
      ? (ancestor as Element)
      : ancestor.parentElement;
    if (!baseEl) return null;
    return baseEl.closest('[data-chat-assistant="true"]') as HTMLElement | null;
  }, []);

  const getIntersectingBlocks = useCallback((range: Range, assistantContainer: HTMLElement) => {
    return Array.from(
      assistantContainer.querySelectorAll<HTMLElement>('[data-chat-block="true"]'),
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

  const handleAssistantSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      hideSelectionTooltip();
      return;
    }

    const range = sel.getRangeAt(0);
    const assistantContainer = getAssistantContainerFromRange(range);
    if (!assistantContainer) {
      hideSelectionTooltip();
      return;
    }

    const rawSelection = normalizeSelectionText(sel.toString());
    if (!rawSelection) {
      hideSelectionTooltip();
      return;
    }

    const blocks = getIntersectingBlocks(range, assistantContainer);
    let contextText = rawSelection;
    let tooltipX: number | null = null;
    let tooltipY: number | null = null;
    let outlineRect: { left: number; top: number; width: number; height: number } | null = null;

    if (blocks.length > 0) {
      clearPendingHighlight();
      applyHighlightToBlocks(blocks, 'ic-context-pending');
      pendingHighlightedBlocksRef.current = blocks;

      const blockText = normalizeSelectionText(
        blocks
          .map((block) => normalizeSelectionText(block.textContent ?? ''))
          .filter(Boolean)
          .join('\n\n'),
      );
      if (blockText) contextText = blockText;

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
    clearPendingHighlight,
    createSelectionId,
    getAssistantContainerFromRange,
    getRectFromBlocks,
    getRectFromRange,
    getIntersectingBlocks,
    hideSelectionTooltip,
    normalizeSelectionText,
  ]);

  useEffect(() => {
    const handleScroll = () => hideSelectionTooltip();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hideSelectionTooltip]);

  useEffect(() => {
    return () => {
      clearPendingHighlight();
    };
  }, [clearPendingHighlight]);

  function handleAddSelectionToContext() {
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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    setError(null);
    setIsSending(true);
    resizeTextarea();

    // Build display content (with quotes if contexts)
    const quoteBlocks = selectedContexts.map((ctx) => toQuoteBlock(ctx.text));
    const displayContent = quoteBlocks.length > 0
      ? `${quoteBlocks.join('\n\n')}\n\n${trimmed}`
      : trimmed;

    // Capture contexts before clearing
    const contextsToSend = selectedContexts.length > 0
      ? selectedContexts.map((ctx) => ctx.text)
      : undefined;

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Clear contexts after adding to message
    if (selectedContexts.length > 0) onClearAllContexts();

    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          selectedTexts: contextsToSend,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to send message');
      }

      const data = await res.json() as {
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
      };

      // Replace optimistic message with real data + add assistant reply
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Revert optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col">
      {/* Divider */}
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="flex-1 border-t border-white/8" />
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Chat</span>
        <div className="flex-1 border-t border-white/8" />
      </div>

      {/* Messages */}
      <div className="px-6 space-y-3 pb-3">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="w-4 h-4 border-2 border-white/15 border-t-orange-400 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && !isSending && (
          <p className="text-white/25 text-xs text-center py-3">
            Ask follow-up questions about the solution.
          </p>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            const { quotes, body } = extractQuotes(msg.content);
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] space-y-2">
                  {/* Quoted context cards */}
                  {quotes.map((q, qi) => (
                    <div
                      key={qi}
                      className="rounded-xl border border-orange-500/25 bg-orange-500/8 px-3 py-2 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <svg className="w-3 h-3 text-orange-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.51a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
                        </svg>
                        <span className="text-[10px] font-medium text-orange-400/50 uppercase tracking-wider">Referenced section</span>
                      </div>
                      <p className="max-h-36 overflow-y-auto pr-1 text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap">{q}</p>
                    </div>
                  ))}
                  {/* User message */}
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-orange-500/15 border border-orange-500/25">
                    <p className="text-white/85 text-[13px] leading-relaxed whitespace-pre-wrap">{body}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%]">
                <div
                  className="ic-message-md"
                  data-chat-assistant="true"
                  data-chat-message-id={msg.id}
                  onMouseUp={handleAssistantSelection}
                  onTouchEnd={handleAssistantSelection}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                />
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-white/40 text-xs pl-1 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:300ms]" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs px-1">{error}</p>
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

      {/* Selection tooltip for assistant messages */}
      {tooltipPos && pendingSelection && typeof document !== 'undefined' && createPortal(
        <div
          id="chat-selection-tooltip"
          className="fixed"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-100%, -50%)',
            zIndex: 2147483646,
          }}
        >
          <button
            onClick={handleAddSelectionToContext}
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

      {/* Input area — sticky at bottom */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        {/* Selected context chips */}
        {selectedContexts.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {selectedContexts.map((ctx, i) => (
              <div key={ctx.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-orange-500/8 border border-orange-500/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-orange-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.51a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
                    </svg>
                    <span className="text-[10px] font-medium text-orange-400/60 uppercase tracking-wider">
                      Selection {selectedContexts.length > 1 ? i + 1 : ''}
                    </span>
                  </div>
                  <p className="text-xs text-white/45 line-clamp-2 mt-0.5">{ctx.text}</p>
                </div>
                <button
                  onClick={() => onClearContext(ctx.id)}
                  className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {selectedContexts.length > 1 && (
              <button
                onClick={onClearAllContexts}
                className="text-[10px] text-white/30 hover:text-red-400 transition-colors px-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the solution..."
            rows={1}
            disabled={isSending}
            className="flex-1 appearance-none resize-none bg-white/5 border border-white/12 rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-orange-400/40 focus:bg-white/8 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-white/8 disabled:text-white/20 text-white transition-colors"
            title="Send"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .ic-message-md {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.8125rem;
          line-height: 1.7;
          user-select: text;
          -webkit-user-select: text;
          cursor: text;
        }
        .ic-message-md::selection,
        .ic-message-md *::selection {
          background: rgba(249, 115, 22, 0.35);
          color: #fff;
        }
        .ic-message-md [data-chat-block="true"] {
          transition: background-color 0.2s ease, box-shadow 0.2s ease, padding 0.2s ease, margin 0.2s ease;
          border-radius: 8px;
        }
        .ic-message-md .ic-context-pending {
          background: rgba(249, 115, 22, 0.26) !important;
          outline: 3px solid rgba(249, 115, 22, 1) !important;
          outline-offset: 2px;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.14) inset,
            0 8px 30px rgba(249, 115, 22, 0.38) !important;
          padding: 6px 10px;
          margin-left: -10px;
          margin-right: -10px;
          position: relative;
          z-index: 3;
        }
        .ic-message-md .ic-md-h1 { font-size: 1rem; font-weight: 700; color: #fff; margin: 0.8em 0 0.3em; }
        .ic-message-md .ic-md-h2 { font-size: 0.9rem; font-weight: 600; color: #fff; margin: 0.7em 0 0.3em; padding-bottom: 0.2em; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .ic-message-md .ic-md-h3 { font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.9); margin: 0.6em 0 0.25em; }
        .ic-message-md .ic-md-p { margin: 0.4em 0; }
        .ic-message-md .ic-md-li { margin-left: 1rem; list-style-type: disc; display: list-item; margin-bottom: 0.2em; }
        .ic-message-md .ic-md-oli { list-style-type: decimal; }
        .ic-message-md .ic-md-hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0.8em 0; }
        .ic-message-md .ic-inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.78em;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 3px;
          padding: 0.1em 0.3em;
          color: #fcd34d;
        }
        .ic-message-md .ic-code-block {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          overflow-x: auto;
          margin: 0.5em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.5;
        }
        .ic-message-md .ic-math-display { margin: 0.6em 0; overflow-x: auto; text-align: center; }
        .ic-message-md strong { color: #fff; font-weight: 600; }
        .ic-message-md em { color: rgba(255,255,255,0.75); font-style: italic; }
      `}</style>
    </div>
  );
}
