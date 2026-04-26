'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { QA_PERSISTENCE_UNAVAILABLE_ERROR } from '@/lib/document-qa-persistence';
import { DocumentQaSubChat } from './DocumentQaSubChat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface DocumentQaInlineChatProps {
  documentId: string;
  queuedContextSelection?: {
    token: number;
    text: string;
  } | null;
}

interface InlineSubchatData {
  id: string;
  assistantIndex: number;
  blockIndex: number | null;
  storageBlockIndex: number;
  contextText: string;
  messages: ChatMessage[];
  isTemporary?: boolean;
}

const INLINE_SUBCHAT_LEGACY_BASE_BLOCK_INDEX = 1_000_000;
const INLINE_SUBCHAT_SELECTION_BASE_BLOCK_INDEX = 1_100_000;
const INLINE_SUBCHAT_SELECTION_BLOCK_STRIDE = 10_000;
const QA_SECTION_CHAT_UNAVAILABLE_COPY =
  'Section chats need the latest database migration before they can be saved.';

function getInlineSubchatStorageBlockIndex(assistantIndex: number, blockIndex: number): number {
  return INLINE_SUBCHAT_SELECTION_BASE_BLOCK_INDEX
    + (assistantIndex * INLINE_SUBCHAT_SELECTION_BLOCK_STRIDE)
    + blockIndex;
}

function decodeInlineSubchatStorageBlockIndex(storageBlockIndex: number): {
  assistantIndex: number;
  blockIndex: number | null;
  storageBlockIndex: number;
} | null {
  if (storageBlockIndex >= INLINE_SUBCHAT_SELECTION_BASE_BLOCK_INDEX) {
    const offset = storageBlockIndex - INLINE_SUBCHAT_SELECTION_BASE_BLOCK_INDEX;
    return {
      assistantIndex: Math.floor(offset / INLINE_SUBCHAT_SELECTION_BLOCK_STRIDE),
      blockIndex: offset % INLINE_SUBCHAT_SELECTION_BLOCK_STRIDE,
      storageBlockIndex,
    };
  }

  if (storageBlockIndex >= INLINE_SUBCHAT_LEGACY_BASE_BLOCK_INDEX) {
    return {
      assistantIndex: storageBlockIndex - INLINE_SUBCHAT_LEGACY_BASE_BLOCK_INDEX,
      blockIndex: null,
      storageBlockIndex,
    };
  }

  return null;
}

function getApiErrorMessage(
  data: { error?: string; message?: string },
  fallback: string,
): string {
  if (data.error === QA_PERSISTENCE_UNAVAILABLE_ERROR) {
    return QA_SECTION_CHAT_UNAVAILABLE_COPY;
  }
  return data.message ?? data.error ?? fallback;
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
  // Display math: $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => renderKatex(math, true));
  // Display math: \[...\]
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => renderKatex(math, true));
  // Inline math: $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderKatex(math, false));
  // Inline math: \(...\)
  text = text.replace(/\\\((.+?)\\\)/g, (_, math) => renderKatex(math, false));
  return text;
}

function renderInline(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="ic-inline-code">$1</code>');
  return text;
}

function markdownToHtmlBlocks(md: string): string[] {
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
        html.push(`<pre class="ic-code-block"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(raw); continue; }

    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        html.push(`<div class="ic-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="ic-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    // Display math block: \[...\]
    if (raw.trim() === '\\[' || (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim() !== '\\[') {
        html.push(`<div class="ic-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="ic-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
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
      html.push(`<h${level} class="ic-md-h${level}">${renderInline(renderInlineMath(text))}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { closeParagraph(); html.push('<hr class="ic-md-hr" />'); continue; }

    const ulMatch = raw.match(/^[\s]*[-*+•] (.+)/);
    if (ulMatch) { closeParagraph(); html.push(`<li class="ic-md-li">${renderInline(renderInlineMath(ulMatch[1]))}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { closeParagraph(); html.push(`<li class="ic-md-li ic-md-oli">${renderInline(renderInlineMath(olMatch[1]))}</li>`); continue; }

    const processed = renderInline(renderInlineMath(raw));
    closeParagraph();
    html.push(`<p class="ic-md-p">${processed}</p>`);
  }

  closeParagraph();
  return html;
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

export function DocumentQaInlineChat({ documentId, queuedContextSelection }: DocumentQaInlineChatProps) {
  const [selectedContexts, setSelectedContexts] = useState<Array<{ id: string; text: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    id: string;
    text: string;
    assistantIndex: number;
    blockIndex: number;
  } | null>(null);
  const [inlineSubchatsMap, setInlineSubchatsMap] = useState<Map<number, InlineSubchatData>>(new Map());
  const [creatingInlineSubchatIndex, setCreatingInlineSubchatIndex] = useState<number | null>(null);
  const [subchatActionError, setSubchatActionError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hideSelectionTooltip = useCallback(() => {
    setTooltipPos(null);
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

  useEffect(() => {
    if (!queuedContextSelection) return;

    const normalized = normalizeSelectionText(queuedContextSelection.text);
    if (!normalized) return;

    setSelectedContexts((prev) => {
      if (prev.some((ctx) => ctx.text === normalized)) return prev;
      return [
        ...prev,
        {
          id: `viewer-selection-${queuedContextSelection.token}`,
          text: normalized,
        },
      ];
    });

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [normalizeSelectionText, queuedContextSelection]);

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
        const res = await fetch(`/api/documents/${documentId}/qa/chat`);
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
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInlineSubchats() {
      try {
        const res = await fetch(`/api/documents/${documentId}/qa/subchats`);
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

        const next = new Map<number, InlineSubchatData>();
        for (const sc of data.subchats ?? []) {
          const decoded = decodeInlineSubchatStorageBlockIndex(sc.block_index);
          if (!decoded || decoded.assistantIndex < 0) continue;

          next.set(decoded.storageBlockIndex, {
            id: sc.id,
            assistantIndex: decoded.assistantIndex,
            blockIndex: decoded.blockIndex,
            storageBlockIndex: decoded.storageBlockIndex,
            contextText: sc.context_text,
            messages: (sc.messages ?? []).map((m) => ({
              ...m,
              role: m.role as 'user' | 'assistant',
            })),
          });
        }
        setInlineSubchatsMap(next);
      } catch {
        // Non-critical
      }
    }

    loadInlineSubchats();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const assistantIndexByMessageId = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        map.set(msg.id, index);
        index += 1;
      }
    }
    return map;
  }, [messages]);

  const getClosestAssistantContainer = useCallback((node: Node | null) => {
    if (!node) return null;
    const baseEl = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
    if (!baseEl) return null;
    if (baseEl.closest('[data-inline-subchat-anchor]')) return null;
    return baseEl.closest('[data-chat-assistant="true"]') as HTMLElement | null;
  }, []);

  const getAssistantContainerFromRange = useCallback((range: Range) => {
    const fromAncestor = getClosestAssistantContainer(range.commonAncestorContainer);
    if (fromAncestor) return fromAncestor;

    const fromStart = getClosestAssistantContainer(range.startContainer);
    const fromEnd = getClosestAssistantContainer(range.endContainer);
    if (fromStart && fromEnd && fromStart !== fromEnd) return null;

    return fromStart ?? fromEnd;
  }, [getClosestAssistantContainer]);

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
    const assistantIndexAttr = assistantContainer.getAttribute('data-chat-assistant-index');
    const assistantIndex = assistantIndexAttr ? Number.parseInt(assistantIndexAttr, 10) : -1;
    const blockIndexes = blocks
      .map((block) => Number.parseInt(block.getAttribute('data-chat-block-index') ?? '', 10))
      .filter((blockIndex) => Number.isFinite(blockIndex))
      .sort((a, b) => a - b);
    const blockIndex = blockIndexes.length > 0 ? blockIndexes[blockIndexes.length - 1] : 0;
    let tooltipX: number | null = null;
    let tooltipY: number | null = null;

    if (blocks.length > 0) {
      const firstRect = blocks[0].getBoundingClientRect();
      if (firstRect.width > 0 || firstRect.height > 0) {
        tooltipX = firstRect.right;
        tooltipY = firstRect.top;
      }
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
    setPendingSelection({ id: createSelectionId(), text: rawSelection, assistantIndex, blockIndex });
  }, [
    createSelectionId,
    getAssistantContainerFromRange,
    getIntersectingBlocks,
    hideSelectionTooltip,
    normalizeSelectionText,
  ]);

  const handleAssistantSelectionDeferred = useCallback(() => {
    requestAnimationFrame(() => {
      handleAssistantSelection();
    });
  }, [handleAssistantSelection]);

  useEffect(() => {
    const handleScroll = () => hideSelectionTooltip();
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hideSelectionTooltip]);

  function handleAddSelectionToContext() {
    if (!pendingSelection) return;

    const alreadySelected = selectedContexts.some((ctx) => ctx.text === pendingSelection.text);
    if (alreadySelected) {
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      return;
    }

    setSelectedContexts((prev) => [...prev, { id: pendingSelection.id, text: pendingSelection.text }]);
    window.getSelection()?.removeAllRanges();
    hideSelectionTooltip();
  }

  async function handleCreateSubchatFromSelection() {
    if (!pendingSelection || pendingSelection.assistantIndex < 0) return;

    const assistantIndex = pendingSelection.assistantIndex;
    const selectedBlockIndex = pendingSelection.blockIndex;
    const storageBlockIndex = getInlineSubchatStorageBlockIndex(assistantIndex, selectedBlockIndex);
    const contextText = pendingSelection.text;
    const scrollToInlineSubchat = (targetStorageBlockIndex: number) => {
      requestAnimationFrame(() => {
        const anchor = document.querySelector<HTMLElement>(
          `[data-inline-subchat-anchor="${targetStorageBlockIndex}"]`,
        );
        anchor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };

    if (
      inlineSubchatsMap.has(storageBlockIndex)
      || creatingInlineSubchatIndex === storageBlockIndex
    ) {
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      scrollToInlineSubchat(storageBlockIndex);
      return;
    }

    setSubchatActionError(null);
    setCreatingInlineSubchatIndex(storageBlockIndex);
    scrollToInlineSubchat(storageBlockIndex);

    try {
      const res = await fetch(`/api/documents/${documentId}/qa/subchats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockIndex: storageBlockIndex,
          contextText,
        }),
      });

      const data = await res.json().catch(() => ({})) as {
        error?: string;
        message?: string;
        subchat?: {
          id: string;
          block_index: number;
          context_text: string;
          messages?: Array<{ id: string; role: string; content: string; created_at: string }>;
        };
      };

      if (!res.ok) {
        if (data.error === QA_PERSISTENCE_UNAVAILABLE_ERROR) {
          setInlineSubchatsMap((prev) => {
            const next = new Map(prev);
            next.set(storageBlockIndex, {
              id: `temp-document-qa-${storageBlockIndex}-${Date.now()}`,
              assistantIndex,
              blockIndex: selectedBlockIndex,
              storageBlockIndex,
              contextText,
              messages: [],
              isTemporary: true,
            });
            return next;
          });
          window.getSelection()?.removeAllRanges();
          hideSelectionTooltip();
          scrollToInlineSubchat(storageBlockIndex);
          return;
        }
        throw new Error(getApiErrorMessage(data, 'Failed to create section chat'));
      }

      if (!data.subchat) {
        throw new Error('Failed to create section chat');
      }

      const createdSubchat = data.subchat;
      const decoded = decodeInlineSubchatStorageBlockIndex(createdSubchat.block_index) ?? {
        assistantIndex,
        blockIndex: selectedBlockIndex,
        storageBlockIndex,
      };
      setInlineSubchatsMap((prev) => {
        const next = new Map(prev);
        next.set(decoded.storageBlockIndex, {
          id: createdSubchat.id,
          assistantIndex: decoded.assistantIndex,
          blockIndex: decoded.blockIndex,
          storageBlockIndex: decoded.storageBlockIndex,
          contextText: createdSubchat.context_text || contextText,
          messages: (createdSubchat.messages ?? []).map((m) => ({
            ...m,
            role: m.role as 'user' | 'assistant',
          })),
        });
        return next;
      });
      window.getSelection()?.removeAllRanges();
      hideSelectionTooltip();
      scrollToInlineSubchat(decoded.storageBlockIndex);
    } catch (err: unknown) {
      setSubchatActionError(err instanceof Error ? err.message : 'Failed to create subchat');
    } finally {
      setCreatingInlineSubchatIndex((current) => (
        current === storageBlockIndex ? null : current
      ));
    }
  }

  async function handleDeleteInlineSubchat(subchatId: string, storageBlockIndex: number) {
    try {
      await fetch(`/api/documents/${documentId}/qa/subchats/${subchatId}`, {
        method: 'DELETE',
      });
    } catch {
      // Keep optimistic removal
    }

    setInlineSubchatsMap((prev) => {
      const next = new Map(prev);
      next.delete(storageBlockIndex);
      return next;
    });
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
    if (selectedContexts.length > 0) setSelectedContexts([]);

    try {
      const res = await fetch(`/api/documents/${documentId}/qa/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          selectedTexts: contextsToSend,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(getApiErrorMessage(data, 'Failed to send message'));
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

  const pendingInlineSubchatStorageBlockIndex = pendingSelection && pendingSelection.assistantIndex >= 0
    ? getInlineSubchatStorageBlockIndex(pendingSelection.assistantIndex, pendingSelection.blockIndex)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div className="qa-scroll flex-1 min-h-0 overflow-y-auto px-6 pt-3 pb-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="w-4 h-4 border-2 border-white/15 border-t-indigo-400 rounded-full animate-spin" />
          </div>
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

          const assistantIndex = assistantIndexByMessageId.get(msg.id) ?? -1;
          const assistantBlocks = markdownToHtmlBlocks(msg.content);
          const legacyInlineSubchat = assistantIndex >= 0
            ? Array.from(inlineSubchatsMap.values()).find((subchat) => (
                subchat.assistantIndex === assistantIndex && subchat.blockIndex === null
              ))
            : undefined;

          return (
            <div key={msg.id} className="flex justify-start">
              <div
                className="max-w-[90%]"
                data-chat-assistant="true"
                data-chat-message-id={msg.id}
                data-chat-assistant-index={assistantIndex >= 0 ? assistantIndex : undefined}
                onMouseUp={handleAssistantSelectionDeferred}
                onTouchEnd={handleAssistantSelectionDeferred}
              >
                {assistantBlocks.map((htmlBlock, blockIndex) => {
                  const storageBlockIndex = assistantIndex >= 0
                    ? getInlineSubchatStorageBlockIndex(assistantIndex, blockIndex)
                    : -1;
                  const inlineSubchat = storageBlockIndex >= 0
                    ? inlineSubchatsMap.get(storageBlockIndex)
                    : undefined;
                  const isCreatingInlineSubchat = creatingInlineSubchatIndex === storageBlockIndex
                    && !inlineSubchat;
                  const isReferencedBlock = Boolean(inlineSubchat || isCreatingInlineSubchat);

                  return (
                    <div key={blockIndex} className="ic-chat-block-slot">
                      <div className="ic-message-md">
                        <div
                          className={`ic-chat-block-content ${
                            isReferencedBlock ? 'ic-chat-block-content-referenced' : ''
                          }`}
                          data-chat-block="true"
                          data-chat-block-index={blockIndex}
                          dangerouslySetInnerHTML={{ __html: htmlBlock }}
                        />
                      </div>

                      <div data-inline-subchat-anchor={storageBlockIndex >= 0 ? storageBlockIndex : undefined}>
                        {inlineSubchat && (
                          <DocumentQaSubChat
                            subchatId={inlineSubchat.id}
                            documentId={documentId}
                            contextText={inlineSubchat.contextText}
                            initialMessages={inlineSubchat.messages}
                            isTemporary={inlineSubchat.isTemporary}
                            onDelete={() => handleDeleteInlineSubchat(
                              inlineSubchat.id,
                              inlineSubchat.storageBlockIndex,
                            )}
                          />
                        )}

                        {isCreatingInlineSubchat && (
                          <div className="inline-subchat-creating">
                            <span className="inline-subchat-creating-dot" />
                            Creating subchat...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {legacyInlineSubchat && (
                  <div data-inline-subchat-anchor={legacyInlineSubchat.storageBlockIndex}>
                    <DocumentQaSubChat
                      subchatId={legacyInlineSubchat.id}
                      documentId={documentId}
                      contextText={legacyInlineSubchat.contextText}
                      initialMessages={legacyInlineSubchat.messages}
                      isTemporary={legacyInlineSubchat.isTemporary}
                      onDelete={() => handleDeleteInlineSubchat(
                        legacyInlineSubchat.id,
                        legacyInlineSubchat.storageBlockIndex,
                      )}
                    />
                  </div>
                )}
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
        {subchatActionError && (
          <p className="text-red-400 text-xs px-1">{subchatActionError}</p>
        )}

        <div ref={bottomRef} />
      </div>

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
          <div className="flex items-center gap-0.5 rounded-xl bg-[#1a1a1a]/95 backdrop-blur-md shadow-xl shadow-black/40 border border-white/10 p-[3px]">
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
                handleAddSelectionToContext();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-orange-500/15 text-white/70 hover:text-orange-300 text-[11px] font-medium transition-all whitespace-nowrap"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add to chat
            </button>
            {pendingSelection.assistantIndex >= 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
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
                    handleCreateSubchatFromSelection();
                  }}
                  disabled={creatingInlineSubchatIndex === pendingInlineSubchatStorageBlockIndex}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                    creatingInlineSubchatIndex === pendingInlineSubchatStorageBlockIndex
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'hover:bg-orange-500/15 text-white/70 hover:text-orange-300'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  {creatingInlineSubchatIndex === pendingInlineSubchatStorageBlockIndex ? 'Creating...' : 'Subchat'}
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

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/10 shrink-0 space-y-2 bg-white/[0.02]">
        {/* Selected context chips */}
        {selectedContexts.length > 0 && (
          <div className="space-y-1.5">
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
                  onClick={() => setSelectedContexts((prev) => prev.filter((item) => item.id !== ctx.id))}
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
                onClick={() => setSelectedContexts([])}
                className="text-[10px] text-white/30 hover:text-red-400 transition-colors px-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this document..."
            rows={1}
            disabled={isSending}
            className="flex-1 bg-black/30 text-white/90 text-sm rounded-xl px-3 py-2.5 resize-none placeholder-white/30 border border-white/15 focus:outline-none focus:border-cyan-300/60 transition-colors disabled:opacity-50 min-h-[40px] max-h-[160px] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-cyan-200/30 bg-[linear-gradient(145deg,rgba(111,224,255,0.30),rgba(80,189,222,0.18))] text-cyan-50 hover:text-white hover:border-cyan-200/45 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_8px_20px_rgba(18,34,45,0.36)]"
            title="Send"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-white/25 mt-1.5">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>

      <style jsx global>{`
        .qa-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 198, 216, 0.28) transparent;
        }
        .qa-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .qa-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .qa-scroll::-webkit-scrollbar-thumb {
          background: rgba(168, 198, 216, 0.24);
          border-radius: 999px;
        }
        .qa-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(178, 214, 235, 0.36);
        }
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
        .ic-chat-block-slot {
          margin: 0;
        }
        .ic-chat-block-content {
          border: 1px solid transparent;
          border-radius: 12px;
          margin: 0;
          transition:
            background-color 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
        }
        .ic-chat-block-content-referenced {
          margin: 0.35rem -0.5rem;
          padding: 0.35rem 0.5rem;
          border-color: rgba(249, 115, 22, 0.42);
          background: rgba(249, 115, 22, 0.07);
          box-shadow:
            inset 0 0 0 1px rgba(249, 115, 22, 0.07),
            0 10px 24px rgba(0, 0, 0, 0.08);
        }
        .ic-chat-block-content-referenced > :first-child {
          margin-top: 0;
        }
        .ic-chat-block-content-referenced > :last-child {
          margin-bottom: 0;
        }
        .inline-subchat-creating {
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
        .inline-subchat-creating-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: rgba(251, 146, 60, 0.8);
          animation: inlineSubchatPulse 1.1s ease-in-out infinite;
        }
        @keyframes inlineSubchatPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1); opacity: 1; }
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
