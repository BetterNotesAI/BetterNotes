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

interface InlineChatProps {
  sessionId: string;
  selectedContext: string | null;
  onClearContext: () => void;
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

    const ulMatch = raw.match(/^[\s]*[-*+] (.+)/);
    if (ulMatch) { closeParagraph(); html.push(`<li class="ic-md-li">${renderInline(renderInlineMath(ulMatch[1]))}</li>`); continue; }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) { closeParagraph(); html.push(`<li class="ic-md-li ic-md-oli">${renderInline(renderInlineMath(olMatch[1]))}</li>`); continue; }

    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) { html.push('<p class="ic-md-p">'); inParagraph = true; } else { html.push('<br />'); }
    html.push(processed);
  }

  closeParagraph();
  return html.join('');
}

// ---------------------------------------------------------------------------
// Strip leading "> quote" from user message for display
// ---------------------------------------------------------------------------

function stripQuotePrefix(content: string): { quote: string | null; body: string } {
  const match = content.match(/^> (.+?)(?:\n\n)([\s\S]*)$/);
  if (match) return { quote: match[1], body: match[2] };
  return { quote: null, body: content };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineChat({ sessionId, selectedContext, onClearContext }: InlineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    setError(null);
    setIsSending(true);
    resizeTextarea();

    // Build display content (with quote if context)
    const displayContent = selectedContext
      ? `> ${selectedContext}\n\n${trimmed}`
      : trimmed;

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // Clear context after adding to message
    if (selectedContext) onClearContext();

    try {
      const res = await fetch(`/api/problem-solver/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          selectedText: selectedContext || undefined,
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
            const { quote, body } = stripQuotePrefix(msg.content);
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-orange-500/15 border border-orange-500/25">
                  {quote && (
                    <div className="text-[11px] text-orange-300/60 border-l-2 border-orange-400/30 pl-2 mb-1.5 italic line-clamp-2">
                      {quote}
                    </div>
                  )}
                  <p className="text-white/85 text-[13px] leading-relaxed whitespace-pre-wrap">{body}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%]">
                <div
                  className="ic-message-md"
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

      {/* Input area — sticky at bottom */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        {/* Selected context chip */}
        {selectedContext && (
          <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-orange-500/8 border border-orange-500/20">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-medium text-orange-400/70 uppercase tracking-wider">Context</span>
              <p className="text-xs text-white/50 line-clamp-2 mt-0.5">{selectedContext}</p>
            </div>
            <button
              onClick={onClearContext}
              className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-md text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
