'use client';

import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SubChatDrawerProps {
  sessionId: string;
  subChatId: string;
  title: string;
  messages: SubChatMessage[];
  onClose: () => void;
  onMinimize: () => void;
  onMessagesUpdate: (messages: SubChatMessage[]) => void;
}

// ---------------------------------------------------------------------------
// Markdown + KaTeX renderer (mirrors SolutionPanel's markdownToHtml)
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
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => renderKatex(math, true));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => renderKatex(math, false));
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
    if (inParagraph) {
      html.push('</p>');
      inParagraph = false;
    }
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
        html.push(`<pre class="sc-code-block"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    if (
      raw.trim() === '$$' ||
      (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim().length > 4)
    ) {
      closeParagraph();
      if (raw.trim().startsWith('$$') && raw.trim().endsWith('$$') && raw.trim() !== '$$') {
        const math = raw.trim().slice(2, -2);
        html.push(`<div class="sc-math-display">${renderKatex(math, true)}</div>`);
        continue;
      }
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      html.push(`<div class="sc-math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
      continue;
    }

    if (raw.trim() === '') {
      closeParagraph();
      continue;
    }

    const h3 = raw.match(/^### (.+)/);
    const h2 = raw.match(/^## (.+)/);
    const h1 = raw.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      closeParagraph();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 ?? h2 ?? h3)![1];
      const processed = renderInline(renderInlineMath(text));
      html.push(`<h${level} class="sc-md-h${level}">${processed}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
      closeParagraph();
      html.push('<hr class="sc-md-hr" />');
      continue;
    }

    const ulMatch = raw.match(/^[\s]*[-*+] (.+)/);
    if (ulMatch) {
      closeParagraph();
      const text = renderInline(renderInlineMath(ulMatch[1]));
      html.push(`<li class="sc-md-li">${text}</li>`);
      continue;
    }

    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) {
      closeParagraph();
      const text = renderInline(renderInlineMath(olMatch[1]));
      html.push(`<li class="sc-md-li sc-md-oli">${text}</li>`);
      continue;
    }

    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) {
      html.push('<p class="sc-md-p">');
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
// SubChatDrawer
// ---------------------------------------------------------------------------

export function SubChatDrawer({
  sessionId,
  subChatId,
  title,
  messages,
  onClose,
  onMinimize,
  onMessagesUpdate,
}: SubChatDrawerProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState(title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync title from parent when it changes
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    setSendError(null);
    setIsSending(true);

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: SubChatMessage = {
      id: tempId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    onMessagesUpdate([...messages, optimisticMsg]);

    try {
      const res = await fetch(
        `/api/problem-solver/sessions/${sessionId}/sub-chats/${subChatId}/messages`,
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

      const data = await res.json() as { message: SubChatMessage };
      const assistantMsg = data.message;

      // Replace the optimistic message with a stable user entry + add assistant reply
      // We don't get the saved user message back, so we just update the optimistic one
      onMessagesUpdate([
        ...messages,
        { ...optimisticMsg, id: optimisticMsg.id },
        assistantMsg,
      ]);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Unknown error');
      // Revert optimistic update
      onMessagesUpdate(messages);
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

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = localTitle.trim() || title;
    setLocalTitle(trimmed);
    try {
      await fetch(
        `/api/problem-solver/sessions/${sessionId}/sub-chats/${subChatId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed }),
        },
      );
    } catch {
      // Optimistic update stays
    }
  }

  return (
    <>
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{ width: 320 }}
      >
        {/* Panel */}
        <div className="flex flex-col h-full bg-[#141414] border-l border-white/10 shadow-2xl shadow-black/60">

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-white/5">
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle();
                    if (e.key === 'Escape') {
                      setLocalTitle(title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full appearance-none bg-[#1f1f1f] border border-white/25 rounded-md px-2 py-0.5 text-xs font-medium text-white outline-none focus:border-orange-400/50"
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.focus(), 0);
                  }}
                  className="text-xs font-semibold text-white/80 hover:text-white truncate max-w-full block transition-colors text-left"
                  title="Click to rename"
                >
                  {localTitle}
                </button>
              )}
            </div>

            {/* Minimize */}
            <button
              onClick={onMinimize}
              title="Minimize"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm leading-none"
            >
              —
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close sub-chat"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-white/30 text-xs text-center mt-4">
                Ask a follow-up question about the solution.
              </p>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-orange-500/20 border border-orange-500/30 text-white/90 text-xs leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[95%]">
                    <div
                      className="sc-message-md text-white/85 text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                    />
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-white/40 text-xs pl-1">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:300ms]" />
                </div>
                <span>Thinking…</span>
              </div>
            )}

            {sendError && (
              <p className="text-red-400 text-xs px-1">{sendError}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-white/10 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question… (Enter to send)"
                rows={2}
                disabled={isSending}
                className="flex-1 appearance-none resize-none bg-[#1f1f1f] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/35 outline-none focus:border-orange-400/40 focus:bg-[#262626] transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-white/10 disabled:text-white/20 text-white transition-colors"
                title="Send"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19V5m-7 7l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .sc-message-md {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.75rem;
          line-height: 1.65;
        }
        .sc-message-md .sc-md-h1 {
          font-size: 0.9rem;
          font-weight: 700;
          color: #fff;
          margin: 0.8em 0 0.3em;
        }
        .sc-message-md .sc-md-h2 {
          font-size: 0.82rem;
          font-weight: 600;
          color: #fff;
          margin: 0.7em 0 0.3em;
          padding-bottom: 0.2em;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .sc-message-md .sc-md-h3 {
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 0.6em 0 0.25em;
        }
        .sc-message-md .sc-md-p {
          margin: 0.4em 0;
        }
        .sc-message-md .sc-md-li {
          margin-left: 1rem;
          list-style-type: disc;
          display: list-item;
          margin-bottom: 0.2em;
        }
        .sc-message-md .sc-md-oli {
          list-style-type: decimal;
        }
        .sc-message-md .sc-md-hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 0.8em 0;
        }
        .sc-message-md .sc-inline-code {
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.75em;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 3px;
          padding: 0.1em 0.3em;
          color: #fcd34d;
        }
        .sc-message-md .sc-code-block {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          overflow-x: auto;
          margin: 0.5em 0;
          font-family: 'Fira Mono', 'Consolas', monospace;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.5;
        }
        .sc-message-md .sc-math-display {
          margin: 0.6em 0;
          overflow-x: auto;
          text-align: center;
        }
        .sc-message-md strong { color: #fff; font-weight: 600; }
        .sc-message-md em { color: rgba(255,255,255,0.75); font-style: italic; }
      `}</style>
    </>
  );
}
