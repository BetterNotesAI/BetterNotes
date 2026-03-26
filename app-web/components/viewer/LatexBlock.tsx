'use client';

/**
 * LatexBlock.tsx
 * Renders a single parsed Block from latex-parser.ts using KaTeX.
 *
 * - formula-block  : KaTeX display mode
 * - formula-inline : paragraph with inline $...$ formulas rendered
 * - section        : <h2> or <h3> depending on level
 * - paragraph      : <p> with inline math rendered if present
 * - table          : plain <pre> placeholder (tabular is complex to render)
 * - list           : basic itemize/enumerate render
 */

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Block } from '@/lib/latex-parser';

// ─── KaTeX macros — custom commands from landscape_3col_maths template ────────
const KATEX_MACROS: Record<string, string> = {
  '\\dd': '\\mathrm{d}',
  '\\real': '\\mathbb{R}',
  '\\cplex': '\\mathbb{C}',
};

// ─── render a single KaTeX formula string ─────────────────────────────────────

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      macros: KATEX_MACROS,
      trust: false,
    });
  } catch {
    return `<span class="katex-error" title="KaTeX error">${escapeHtml(formula)}</span>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── inline math renderer ────────────────────────────────────────────────────

/**
 * Take a paragraph string that may contain $...$ inline formulas and
 * return an HTML string with those formulas rendered by KaTeX.
 */
function renderInlineMath(text: string): string {
  // Match $...$ but not $$...$$
  // Use a simple approach: split on single $ boundaries
  const parts: string[] = [];
  let i = 0;
  let inMath = false;
  let current = '';

  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] !== '$' && (i === 0 || text[i - 1] !== '$')) {
      if (!inMath) {
        // Flush plain text — renderLatexCommands returns HTML; do NOT escape it
        if (current) parts.push(`<span>${renderLatexCommands(current)}</span>`);
        current = '';
        inMath = true;
      } else {
        // End of inline math
        parts.push(renderKatex(current, false));
        current = '';
        inMath = false;
      }
      i++;
    } else {
      current += text[i];
      i++;
    }
  }
  // Flush remaining
  if (current) {
    if (inMath) {
      // Unclosed $ — render as plain text
      parts.push(`<span>$${escapeHtml(current)}</span>`);
    } else {
      parts.push(`<span>${renderLatexCommands(current)}</span>`);
    }
  }

  return parts.join('');
}

/**
 * Convert common LaTeX text commands to HTML equivalents for paragraph text.
 * Returns an HTML string — callers must NOT additionally HTML-escape the result.
 * Processing order: escape bare chars first, then substitute LaTeX commands.
 */
function renderLatexCommands(text: string): string {
  // Step 1 — escape raw HTML-significant chars (except inside LaTeX args, handled below)
  // We escape the whole string first, then substitute LaTeX commands.
  // This is safe because LaTeX args use {} not < >.
  let out = text
    .replace(/&/g, '&amp;')
    // Step 2 — LaTeX text commands (applied on escaped string; args use {} so safe)
    // \textbf{...}
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    // \textit{...}
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    // \emph{...}
    .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
    // \textcolor{color}{text} → drop color
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1')
    // \text{...}
    .replace(/\\text\{([^}]*)\}/g, '$1')
    // ___newline___ marker → line break (produced by parser from \\ at end of line)
    .replace(/___newline___/g, '<br/>')
    // \\ → line break (any remaining explicit line breaks)
    .replace(/\\\\/g, '<br/>')
    // \hfill → spacer
    .replace(/\\hfill/g, ' ')
    // \footnotesize, \scriptsize, etc. → ignore (these are standalone font-size commands)
    .replace(/\\(?:footnotesize|scriptsize|small|large|Large|LARGE|huge|Huge|normalsize)\b/g, '')
    // Known layout/spacing commands with one {arg} that should be dropped entirely
    .replace(/\\(?:vspace|hspace|vspace\*|hspace\*|label|ref|cite|pageref|index)\*?(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    // Remove bare \command (no args) for remaining unknown commands — preserve argument text
    // by only stripping the command token and optional [...] arg, keeping the {} content
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, '$1')
    // Remove any truly bare \command tokens with no argument
    .replace(/\\[a-zA-Z]+\*?\b/g, '');

  return out;
}

// ─── list renderer ────────────────────────────────────────────────────────────

function renderList(latex: string): React.ReactElement {
  const isEnumerate = latex.includes('\\begin{enumerate}');
  // Extract \item entries
  const inner = latex
    .replace(/\\begin\{(?:itemize|enumerate|description)\}/g, '')
    .replace(/\\end\{(?:itemize|enumerate|description)\}/g, '');

  const rawItems = inner.split('\\item').slice(1); // first element is empty

  const Tag = isEnumerate ? 'ol' : 'ul';

  return (
    <Tag className={isEnumerate ? 'list-decimal pl-6 space-y-1' : 'list-disc pl-6 space-y-1'}>
      {rawItems.map((item, idx) => {
        const cleaned = item.trim();
        return (
          <li key={idx} className="text-sm leading-relaxed">
            <span
              dangerouslySetInnerHTML={{ __html: renderInlineMath(cleaned) }}
            />
          </li>
        );
      })}
    </Tag>
  );
}

// ─── table renderer (simplified) ─────────────────────────────────────────────

function renderTable(latex: string): React.ReactElement {
  // Extract rows between \begin{tabular}{...} and \end{tabular}
  const inner = latex
    .replace(/\\begin\{tabular\*?\}\{[^}]*\}/g, '')
    .replace(/\\end\{tabular\*?\}/g, '')
    .replace(/\\toprule|\\midrule|\\bottomrule/g, '')
    .trim();

  const rows = inner
    .split('\\\\')
    .map(r => r.trim())
    .filter(r => r.length > 0 && r !== '\\hline');

  return (
    <div className="overflow-x-auto my-3">
      <table className="border-collapse text-sm">
        <tbody>
          {rows.map((row, rowIdx) => {
            const cells = row.split('&').map(c => c.trim());
            return (
              <tr key={rowIdx} className={rowIdx === 0 ? 'font-semibold border-b border-gray-400' : ''}>
                {cells.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-3 py-1 border border-gray-200 text-sm">
                    <span dangerouslySetInnerHTML={{ __html: renderInlineMath(cell) }} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface LatexBlockProps {
  block: Block;
}

export default function LatexBlock({ block }: LatexBlockProps) {
  const rendered = useMemo(() => {
    switch (block.type) {
      case 'formula-block': {
        // Strip outer $$...$$ or \[...\] or \begin{env}...\end{env} wrappers
        let formula = block.latex_source;
        if (formula.startsWith('$$') && formula.endsWith('$$')) {
          formula = formula.slice(2, -2).trim();
        } else if (formula.startsWith('\\[') && formula.endsWith('\\]')) {
          formula = formula.slice(2, -2).trim();
        }
        // If it's a \begin{env}...\end{env}, pass as-is — KaTeX handles align*, equation*, etc.
        return renderKatex(formula, true);
      }

      case 'formula-inline':
      case 'paragraph': {
        return renderInlineMath(block.latex_source);
      }

      default:
        return null;
    }
  }, [block]);

  switch (block.type) {
    case 'section': {
      const HeadingTag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
      const headingClass =
        block.level === 1
          ? 'text-xl font-bold mt-6 mb-2 border-b border-gray-300 pb-1'
          : block.level === 2
          ? 'text-lg font-semibold mt-4 mb-1'
          : 'text-base font-semibold mt-3 mb-1';
      return (
        <HeadingTag className={headingClass}>
          {block.latex_source}
        </HeadingTag>
      );
    }

    case 'formula-block':
      return (
        <div
          className="my-4 overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: rendered! }}
        />
      );

    case 'formula-inline':
    case 'paragraph':
      return (
        <p
          className="my-2 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: rendered! }}
        />
      );

    case 'list':
      return <div className="my-2">{renderList(block.latex_source)}</div>;

    case 'table':
      return renderTable(block.latex_source);

    case 'hr':
      return <hr className="my-2 border-gray-400" style={{ breakBefore: 'avoid' }} />;

    case 'box':
      return (
        <div
          style={{ breakInside: 'avoid' }}
          className="my-2 border border-gray-400 rounded px-3 py-2 bg-gray-50 text-sm"
        >
          <span dangerouslySetInnerHTML={{ __html: renderInlineMath(block.latex_source) }} />
        </div>
      );

    case 'col-start':
    case 'col-end':
      return null;

    default:
      return null;
  }
}
