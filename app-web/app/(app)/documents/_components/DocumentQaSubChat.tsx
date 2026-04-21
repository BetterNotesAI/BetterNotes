'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface DocumentQaSubChatProps {
  subchatId: string;
  documentId: string;
  contextText: string;
  initialMessages: ChatMessage[];
  onDelete: () => void;
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
  text = text.replace(/`([^`]+)`/g, '<code class="sc-inline-code">$1</code>');
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
        html.push(`<pre class="sc-code-block"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = []; codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(raw); continue; }

    if (raw.trim() === '$$' || (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        html.push(`<div class="sc-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="sc-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    // Display math block: \[...\]
    if (raw.trim() === '\\[' || (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim().length > 4)) {
      closeParagraph();
      if (raw.trim().startsWith('\\[') && raw.trim().endsWith('\\]') && raw.trim() !== '\\[') {
        html.push(`<div class="sc-math-display">${renderKatex(raw.trim().slice(2, -2), true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '\\]') { mathLines.push(lines[i]); i++; }
      html.push(`<div class="sc-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
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
      html.push(`<h${level} class="sc-md-h${level}">${renderInline(renderInlineMath(text))}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { closeParagraph(); html.push('<hr class="sc-md-hr" />'); continue; }

    const ulMatch = raw.match(/^[\s]*[-*+] (.+)/);
    if (ulMatch) { closeParagraph(); html.push(`<li class="sc-md-li">${renderInline(renderInlineMath(ulMatch[1]))}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { closeParagraph(); html.push(`<li class="sc-md-li sc-md-oli">${renderInline(renderInlineMath(olMatch[1]))}</li>`); continue; }

    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) { html.push('<p class="sc-md-p">'); inParagraph = true; } else { html.push('<br />'); }
    html.push(processed);
  }

  closeParagraph();
  return html.join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentQaSubChat({ subchatId, documentId, contextText, initialMessages, onDelete }: DocumentQaSubChatProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(initialMessages.length);
  const prevIsSendingRef = useRef(false);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
  }, []);

  useEffect(() => {
    if (collapsed) return;

    const hasNewMessages = messages.length > prevMessageCountRef.current;
    const sendingStarted = isSending && !prevIsSendingRef.current;

    if (hasNewMessages || sendingStarted) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevMessageCountRef.current = messages.length;
    prevIsSendingRef.current = isSending;
  }, [messages.length, isSending, collapsed]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    setError(null);
    setIsSending(true);
    resizeTextarea();

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(
        `/api/documents/${documentId}/qa/subchats/${subchatId}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to send message');
      }

      const data = await res.json() as {
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
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

  // ── Collapsed view ──
  if (collapsed) {
    return (
      <div className="subchat-collapsed" onClick={() => setCollapsed(false)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg className="w-3.5 h-3.5 text-orange-400/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-[11px] font-medium text-white/50">Subchat</span>
          {messages.length > 0 && (
            <span className="text-[10px] text-white/30">{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="subchat-expanded">
      {/* Header */}
      <div className="subchat-header">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-orange-400/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-[11px] font-medium text-white/50">Subchat</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title="Collapse"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete subchat"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Context */}
      {contextText && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowContext(!showContext)}
            className="flex items-center gap-1 text-[10px] text-orange-400/50 hover:text-orange-400/70 transition-colors mb-1"
          >
            <svg className={`w-2.5 h-2.5 transition-transform ${showContext ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Referenced section
          </button>
          {showContext && (
            <div className="rounded-lg border border-orange-500/15 bg-orange-500/5 px-2.5 py-2">
              <p className="max-h-28 overflow-y-auto text-[11px] text-white/40 leading-relaxed whitespace-pre-wrap">
                {contextText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="px-3 space-y-2 pb-2 max-h-[350px] overflow-y-auto">
        {messages.length === 0 && !isSending && (
          <p className="text-white/20 text-[11px] text-center py-2">
            Ask about this section...
          </p>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] px-2.5 py-1.5 rounded-xl rounded-tr-sm bg-orange-500/15 border border-orange-500/20">
                  <p className="text-white/80 text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%]">
                <div
                  className="sc-message-md"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                />
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-1.5 text-white/35 text-[11px] pl-1 py-1">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-orange-400/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-orange-400/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-orange-400/50 animate-bounce [animation-delay:300ms]" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

        {error && <p className="text-red-400 text-[11px] px-1">{error}</p>}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex gap-1.5 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this section..."
            rows={1}
            disabled={isSending}
            className="flex-1 appearance-none resize-none bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white placeholder-white/25 outline-none focus:border-orange-400/30 focus:bg-white/8 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-white/8 disabled:text-white/20 text-white transition-colors"
            title="Send"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .subchat-collapsed {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          margin: 8px 0;
          border-radius: 10px;
          border: 1px solid rgba(249, 115, 22, 0.15);
          border-left: 2px solid rgba(249, 115, 22, 0.5);
          background: rgba(249, 115, 22, 0.04);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .subchat-collapsed:hover {
          background: rgba(249, 115, 22, 0.08);
          border-color: rgba(249, 115, 22, 0.25);
        }
        .subchat-expanded {
          margin: 10px 0;
          border-radius: 12px;
          border: 1px solid rgba(249, 115, 22, 0.15);
          border-left: 2px solid rgba(249, 115, 22, 0.5);
          background: rgba(249, 115, 22, 0.03);
          overflow: hidden;
        }
        .subchat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        /* Subchat markdown styles */
        .sc-message-md {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.75rem;
          line-height: 1.65;
        }
        .sc-message-md .sc-md-h1 { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0.6em 0 0.25em; }
        .sc-message-md .sc-md-h2 { font-size: 0.82rem; font-weight: 600; color: #fff; margin: 0.5em 0 0.2em; }
        .sc-message-md .sc-md-h3 { font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.9); margin: 0.4em 0 0.2em; }
        .sc-message-md .sc-md-p { margin: 0.3em 0; }
        .sc-message-md .sc-md-li { margin-left: 0.9rem; list-style-type: disc; display: list-item; margin-bottom: 0.15em; }
        .sc-message-md .sc-md-oli { list-style-type: decimal; }
        .sc-message-md .sc-md-hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0.6em 0; }
        .sc-message-md .sc-inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.75em;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px;
          padding: 0.1em 0.25em;
          color: #fcd34d;
        }
        .sc-message-md .sc-code-block {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          overflow-x: auto;
          margin: 0.4em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.7);
          line-height: 1.5;
        }
        .sc-message-md .sc-math-display { margin: 0.4em 0; overflow-x: auto; text-align: center; }
        .sc-message-md strong { color: #fff; font-weight: 600; }
        .sc-message-md em { color: rgba(255,255,255,0.7); font-style: italic; }
      `}</style>
    </div>
  );
}
