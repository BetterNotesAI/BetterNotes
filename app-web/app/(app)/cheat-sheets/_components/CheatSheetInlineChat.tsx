'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useTranslation } from '@/lib/i18n';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Heading renumbering (runs after deletions to keep section numbers consistent)
// Handles: "## 1. Title" and "### 1.1 Title" patterns only.
// Headings without a leading number are left untouched.
// ---------------------------------------------------------------------------
// Removes duplicate/trailing separators left after a section deletion.
// e.g.  ---\n\n---  →  ---  ;  trailing ---  →  removed
function cleanupAfterDelete(md: string): string {
  const isSep = (l: string) => /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim());
  const lines = md.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    if (isSep(line)) {
      // Find the last non-blank line already in output
      let prev = out.length - 1;
      while (prev >= 0 && out[prev].trim() === '') prev--;
      if (prev >= 0 && isSep(out[prev])) {
        // Another separator right above — remove the blank gap and skip this one
        while (out.length > prev + 1) out.pop();
        continue;
      }
    }
    out.push(line);
  }

  // Remove trailing separators and blank lines
  while (out.length > 0 && (out[out.length - 1].trim() === '' || isSep(out[out.length - 1]))) {
    out.pop();
  }

  // Collapse 3+ consecutive blank lines to 2
  const final: string[] = [];
  let blanks = 0;
  for (const line of out) {
    if (line.trim() === '') {
      if (++blanks <= 2) final.push(line);
    } else {
      blanks = 0;
      final.push(line);
    }
  }

  return final.join('\n');
}

function renumberHeadings(md: string): string {
  const lines = md.split('\n');
  let h2n = 0;
  let h3n = 0;

  return lines.map((line) => {
    // ## N. Title  (top-level numbered section)
    const h2 = line.match(/^(##\s+)\d+\.\s+(.+)/);
    if (h2) {
      h2n++;
      h3n = 0;
      return `${h2[1]}${h2n}. ${h2[2]}`;
    }
    // ### N.M Title  or  ### N.M. Title  (numbered sub-section)
    const h3 = line.match(/^(###\s+)\d+\.\d+\.?\s+(.+)/);
    if (h3) {
      h3n++;
      return `${h3[1]}${h2n}.${h3n} ${h3[2]}`;
    }
    return line;
  }).join('\n');
}

interface CheatSheetInlineChatProps {
  sessionId: string;
  selectedContexts: Array<{ id: string; text: string; rawMd: string; startLine: number; endLine: number }>;
  onClearContext: (id: string) => void;
  onClearAllContexts: () => void;
  contentMd: string | null;
  onAutoApply: (newMd: string, prevMd: string) => void;
}

// ---------------------------------------------------------------------------
// Markdown + KaTeX renderer
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
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => renderKatex(math, true));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderKatex(math, false));
  text = text.replace(/\\\((.+?)\\\)/g, (_, math) => renderKatex(math, false));
  return text;
}

function renderInline(text: string): string {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="csic-inline-code">$1</code>');
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
        closeParagraph(); inCodeBlock = true; codeLang = raw.slice(3).trim(); codeLines = [];
      } else {
        inCodeBlock = false;
        const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre class="csic-code-block"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = []; codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(raw); continue; }

    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        html.push(`<div class="csic-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="csic-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    if (raw.trim() === '\\[' || (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim() !== '\\[') {
        html.push(`<div class="csic-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="csic-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
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
      html.push(`<h${level} class="csic-md-h${level}">${renderInline(renderInlineMath(text))}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { closeParagraph(); html.push('<hr class="csic-md-hr" />'); continue; }

    const ulMatch = raw.match(/^[\s]*[-*+•] (.+)/);
    if (ulMatch) { closeParagraph(); html.push(`<li class="csic-md-li">${renderInline(renderInlineMath(ulMatch[1]))}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { closeParagraph(); html.push(`<li class="csic-md-li csic-md-oli">${renderInline(renderInlineMath(olMatch[1]))}</li>`); continue; }

    const processed = renderInline(renderInlineMath(raw));
    closeParagraph();
    html.push(`<p class="csic-md-p">${processed}</p>`);
  }

  closeParagraph();
  return html.join('');
}

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

  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === '') index++;
    if (index >= lines.length || !lines[index].startsWith('>')) break;
    const quoteLines: string[] = [];
    while (index < lines.length && lines[index].startsWith('>')) {
      quoteLines.push(lines[index].replace(/^>\s?/, ''));
      index++;
    }
    if (quoteLines.length > 0) quotes.push(quoteLines.join('\n').trim());
  }

  while (index < lines.length && lines[index].trim() === '') index++;
  const body = lines.slice(index).join('\n').trim();
  return { quotes, body: body || content };
}

// ---------------------------------------------------------------------------
// Client-side operation detection — does NOT rely on AI tags
// ---------------------------------------------------------------------------
type EditOperation = 'delete' | 'insert' | 'replace' | null;

function detectOperation(msg: string): EditOperation {
  const DELETE_KW = /\b(esborra|elimina|suprimeix|remove|delete|borra|quita|treu|esborrar|eliminar)\b/i;
  const INSERT_KW = /\b(afegeix|afegir|add|insereix|inserir|insert|nou apartat|nova secci[oó]|append)\b/i;
  const REPLACE_KW = /\b(amplia|expand|reescriu|rewrite|simplifica|simplify|millora|improv|arregla|fix|canvia|change|modifica|modif|tradueix|translat|escurça|shorten|allar(?:ga)|lengthen|actualitz|updat|restructur|reformat|summar(?:iz|itz))\b/i;
  if (DELETE_KW.test(msg)) return 'delete';
  if (INSERT_KW.test(msg)) return 'insert';
  if (REPLACE_KW.test(msg)) return 'replace';
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheatSheetInlineChat({
  sessionId,
  selectedContexts,
  onClearContext,
  onClearAllContexts,
  contentMd,
  onAutoApply,
}: CheatSheetInlineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Contexts + operation saved at send-time: UI clears chips immediately, but
  // auto-apply still has everything it needs when the response arrives.
  const pendingContextsRef = useRef<typeof selectedContexts>([]);
  const pendingOperationRef = useRef<EditOperation>(null);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  // Load existing messages
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function loadMessages() {
      try {
        const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/chat`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { messages?: ChatMessage[] };
        setMessages(
          (data.messages ?? []).map((m) => ({ ...m, role: m.role as 'user' | 'assistant' }))
        );
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadMessages();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const currentMd = contentMd;
    setInput('');
    setError(null);
    setIsSending(true);
    resizeTextarea();

    // Snapshot contexts + detect operation from user message (client-side, reliable).
    // UI clears chips immediately; refs keep everything for auto-apply.
    pendingContextsRef.current = [...selectedContexts];
    pendingOperationRef.current = selectedContexts.length === 1 ? detectOperation(trimmed) : null;
    if (selectedContexts.length > 0) onClearAllContexts();

    const quoteBlocks = pendingContextsRef.current.map((ctx) => toQuoteBlock(ctx.text));
    const displayContent = quoteBlocks.length > 0
      ? `${quoteBlocks.join('\n\n')}\n\n${trimmed}`
      : trimmed;

    const contextsToSend = pendingContextsRef.current.length > 0
      ? pendingContextsRef.current.map((ctx) => ctx.text)
      : undefined;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`/api/cheat-sheets/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, selectedTexts: contextsToSend }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to send message');
      }

      const data = await res.json() as {
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        isEditIntent?: boolean;
        isDeleteIntent?: boolean;
        isInsertIntent?: boolean;
        editContent?: string | null;
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);

      // Operation: AI tags are primary (language-agnostic), keyword detection is fallback.
      // Content comes from assistantMessage.content — exactly what's shown in chat.
      let op: EditOperation;
      if (data.isDeleteIntent) op = 'delete';
      else if (data.isInsertIntent) op = 'insert';
      else if (data.isEditIntent) op = 'replace';
      else op = pendingOperationRef.current;
      if (op !== null && pendingContextsRef.current.length === 1 && currentMd !== null) {
        const ctx = pendingContextsRef.current[0];
        if (ctx.startLine >= 0 && ctx.endLine >= 0) {
          const lines = currentMd.split('\n');
          let newMd: string;

          if (op === 'delete') {
            const spliced = [
              ...lines.slice(0, ctx.startLine),
              ...lines.slice(ctx.endLine + 1),
            ].join('\n');
            newMd = cleanupAfterDelete(renumberHeadings(spliced));
          } else {
            // replace or insert — content is what the AI wrote in chat
            const aiContent = data.assistantMessage.content.trim();
            if (!aiContent) { pendingContextsRef.current = []; pendingOperationRef.current = null; return; }
            const aiLines = aiContent.split('\n');

            if (op === 'insert') {
              const spliced = [
                ...lines.slice(0, ctx.endLine + 1),
                '',
                ...aiLines,
                ...lines.slice(ctx.endLine + 1),
              ].join('\n');
              newMd = renumberHeadings(spliced);
            } else {
              // replace
              newMd = [
                ...lines.slice(0, ctx.startLine),
                ...aiLines,
                ...lines.slice(ctx.endLine + 1),
              ].join('\n');
            }
          }

          onAutoApply(newMd, currentMd);
        }
      }
      pendingContextsRef.current = [];
      pendingOperationRef.current = null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-3 shrink-0">
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-white/25">Ask anything about your cheat sheet</p>
            <p className="text-[10px] text-white/20 mt-1">Select text from above to add context</p>
          </div>
        ) : (
          messages.map((msg) => {
            const { quotes, body } = extractQuotes(msg.content);
            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%]">
                    {quotes.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {quotes.map((q, qi) => (
                          <div
                            key={qi}
                            className="text-[10px] text-indigo-300/70 bg-indigo-500/8 border-l-2 border-indigo-500/30 pl-2 py-1 rounded-r-lg line-clamp-2"
                          >
                            {q}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white/8 rounded-2xl rounded-tr-sm px-3 py-2">
                      <p className="text-xs text-white/80 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[90%]">
                    <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-2xl rounded-tl-sm px-3 py-2.5">
                      <div
                        className="csic-assistant-content text-xs text-white/75 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {isSending && (
          <div className="flex items-start">
            <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-2xl rounded-tl-sm px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-white/30">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 animate-pulse delay-75" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 animate-pulse delay-150" />
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Selected contexts */}
      {selectedContexts.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5">
          {selectedContexts.map((ctx) => (
            <div
              key={ctx.id}
              className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-indigo-500/12 border border-indigo-500/20 rounded-full text-[10px] text-indigo-300/80 max-w-[200px]"
            >
              <span className="truncate">{ctx.text.slice(0, 40)}{ctx.text.length > 40 ? '...' : ''}</span>
              <button
                onClick={() => onClearContext(ctx.id)}
                className="shrink-0 hover:text-red-400 transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={onClearAllContexts}
            className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="flex items-end gap-2 bg-white/6 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-indigo-400/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this cheat sheet..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none resize-none leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 p-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Send (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-white/20 text-center mt-1.5">Enter to send · Shift+Enter for newline</p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <style jsx global>{`
        .csic-assistant-content {
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.75rem;
          line-height: 1.65;
        }
        .csic-assistant-content .csic-md-h1 { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0.5em 0 0.2em; }
        .csic-assistant-content .csic-md-h2 { font-size: 0.82rem; font-weight: 600; color: #fff; margin: 0.45em 0 0.18em; }
        .csic-assistant-content .csic-md-h3 { font-size: 0.78rem; font-weight: 600; color: rgba(200,200,255,0.9); margin: 0.4em 0 0.15em; }
        .csic-assistant-content .csic-md-p { margin: 0.25em 0; }
        .csic-assistant-content .csic-md-li { margin-left: 0.9rem; list-style-type: disc; display: list-item; margin-bottom: 0.15em; }
        .csic-assistant-content .csic-md-oli { list-style-type: decimal; }
        .csic-assistant-content .csic-md-hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0.5em 0; }
        .csic-assistant-content .csic-inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.75em;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 3px;
          padding: 0.1em 0.22em;
          color: #a5b4fc;
        }
        .csic-assistant-content .csic-code-block {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          padding: 0.45rem 0.7rem;
          overflow-x: auto;
          margin: 0.35em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.7);
          line-height: 1.5;
        }
        .csic-assistant-content .csic-math-display { margin: 0.35em 0; overflow-x: auto; text-align: center; }
        .csic-assistant-content strong { color: #fff; font-weight: 600; }
        .csic-assistant-content em { color: rgba(200,200,255,0.7); font-style: italic; }
      `}</style>
    </div>
  );
}
