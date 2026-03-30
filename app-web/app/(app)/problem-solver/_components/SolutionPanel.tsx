'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

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
        html.push(`<pre class="code-block"><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
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
        html.push(`<div class="math-display">${renderKatex(math, true)}</div>`);
        continue;
      }
      // Multi-line display math block starting with $$ alone
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      html.push(`<div class="math-display">${renderKatex(mathLines.join('\n'), true)}</div>`);
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
      html.push(`<h${level} class="md-h${level}">${processed}</h${level}>`);
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
      html.push(`<li class="md-li">${text}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = raw.match(/^[\s]*\d+\. (.+)/);
    if (olMatch) {
      closeParagraph();
      const text = renderInline(renderInlineMath(olMatch[1]));
      html.push(`<li class="md-li md-oli">${text}</li>`);
      continue;
    }

    // Regular text → paragraph
    const processed = renderInline(renderInlineMath(raw));
    if (!inParagraph) {
      html.push('<p class="md-p">');
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
  solutionMd: string | null;
  status: 'pending' | 'solving' | 'done' | 'error';
  isStreaming: boolean;
  onSolve: () => void;
  onAskQuestion?: () => void;
}

export function SolutionPanel({ solutionMd, status, isStreaming, onSolve, onAskQuestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [solutionMd, isStreaming]);

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
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white
                font-medium text-sm transition-colors shadow-lg shadow-orange-500/20"
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
                  className="solution-md"
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
                <span className="text-sm text-white/60">AI is working on your solution…</span>
              </div>
            )}
          </div>
        )}

        {/* DONE state */}
        {status === 'done' && html && !isStreaming && (
          <div
            className="solution-md"
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

        <div ref={bottomRef} />
      </div>

      {/* Footer actions */}
      {(status === 'done' || status === 'solving') && (
        <div className="shrink-0 border-t border-white/10 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={onAskQuestion}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15
              hover:border-orange-500/40 bg-white/4 hover:bg-orange-500/10 text-white/60
              hover:text-orange-300 text-sm transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            Ask a question
          </button>
        </div>
      )}

      <style jsx global>{`
        /* Markdown styles */
        .solution-md {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
          line-height: 1.75;
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
