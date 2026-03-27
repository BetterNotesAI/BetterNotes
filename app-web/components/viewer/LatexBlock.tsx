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
 *
 * F3-M3: Interactive props — hover, focus, edit, confirm
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
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

export interface LatexBlockInteractiveProps {
  /** Whether this block is hovered */
  isHovered?: boolean;
  /** Whether this block is focused (single-click) */
  isFocused?: boolean;
  /** Whether this block is in inline edit mode (double-click) */
  isEditing?: boolean;
  onHover?: (id: string | null) => void;
  onFocus?: (id: string | null) => void;
  onEdit?: (id: string) => void;
  /** Confirm edit: new latex_source value */
  onConfirm?: (id: string, newSource: string) => void;
  onCancel?: (id: string) => void;
}

interface LatexBlockProps extends LatexBlockInteractiveProps {
  block: Block;
}

export default function LatexBlock({
  block,
  isHovered = false,
  isFocused = false,
  isEditing = false,
  onHover,
  onFocus,
  onEdit,
  onConfirm,
  onCancel,
}: LatexBlockProps) {
  const [editValue, setEditValue] = useState(block.latex_source);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync edit value when block source changes externally
  useEffect(() => {
    setEditValue(block.latex_source);
  }, [block.latex_source]);

  // Auto-focus and select textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Auto-resize textarea to content
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [isEditing, editValue]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onConfirm?.(block.id, editValue);
    }
    if (e.key === 'Escape') {
      onCancel?.(block.id);
    }
  }

  // Interactive block wrapper classes
  const interactiveClass = [
    'group relative transition-all duration-150 rounded',
    // M3.1: hover highlight — subtle ring on hover (non-editing, non-section)
    block.type !== 'hr' && block.type !== 'col-start' && block.type !== 'col-end'
      ? isEditing
        ? 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-50/60'
        : isFocused
        ? 'ring-1 ring-indigo-300 ring-offset-1 bg-indigo-50/30 cursor-text'
        : isHovered
        ? 'ring-1 ring-gray-300 bg-gray-50/50 cursor-text'
        : 'cursor-text'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Event handlers for interactive blocks
  const interactiveHandlers =
    block.type !== 'hr' && block.type !== 'col-start' && block.type !== 'col-end'
      ? {
          onMouseEnter: () => onHover?.(block.id),
          onMouseLeave: () => onHover?.(null),
          onClick: (e: React.MouseEvent) => {
            // Prevent bubbling so LatexViewer click-away doesn't immediately re-blur
            e.stopPropagation();
            if (!isEditing) onFocus?.(block.id);
          },
          onDoubleClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onEdit?.(block.id);
          },
        }
      : {};

  // ── Rendered content (must be computed before any conditional returns) ────────
  const rendered = useMemo(() => {
    switch (block.type) {
      case 'formula-block': {
        // Strip outer $$...$$ or \[...\] wrappers
        // If it's already a \begin{env}...\end{env}, pass as-is (KaTeX handles align*, equation*, etc.)
        let formula = block.latex_source;
        if (formula.startsWith('$$') && formula.endsWith('$$')) {
          formula = formula.slice(2, -2).trim();
        } else if (formula.startsWith('\\[') && formula.endsWith('\\]')) {
          formula = formula.slice(2, -2).trim();
        }
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

  // ── Inline editor overlay — shown when isEditing ───────────────────────────
  if (isEditing) {
    return (
      <div className={`${interactiveClass} px-1 py-0.5`} {...interactiveHandlers}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onConfirm?.(block.id, editValue)}
          className="w-full resize-none rounded border border-indigo-300 bg-white/90 px-2 py-1
            font-mono text-xs text-gray-800 outline-none focus:ring-2 focus:ring-indigo-400
            shadow-sm leading-relaxed"
          rows={3}
          spellCheck={false}
          aria-label="Edit LaTeX source"
        />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-gray-400">Enter to confirm · Esc to cancel</span>
        </div>
      </div>
    );
  }

  // ── Normal rendered view ───────────────────────────────────────────────────
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
        <div className={interactiveClass} {...interactiveHandlers}>
          <HeadingTag className={headingClass}>
            {block.latex_source}
          </HeadingTag>
        </div>
      );
    }

    case 'formula-block':
      return (
        <div
          className={`my-4 overflow-x-auto text-center ${interactiveClass}`}
          {...interactiveHandlers}
          dangerouslySetInnerHTML={{ __html: rendered! }}
        />
      );

    case 'formula-inline':
    case 'paragraph':
      return (
        <div className={interactiveClass} {...interactiveHandlers}>
          <p
            className="my-2 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: rendered! }}
          />
        </div>
      );

    case 'list':
      return (
        <div className={`my-2 ${interactiveClass}`} {...interactiveHandlers}>
          {renderList(block.latex_source)}
        </div>
      );

    case 'table':
      return (
        <div className={interactiveClass} {...interactiveHandlers}>
          {renderTable(block.latex_source)}
        </div>
      );

    case 'hr':
      return <hr className="my-2 border-gray-400" style={{ breakBefore: 'avoid' }} />;

    case 'box':
      return (
        <div
          style={{ breakInside: 'avoid' }}
          className={`my-2 border border-gray-400 rounded px-3 py-2 bg-gray-50 text-sm ${interactiveClass}`}
          {...interactiveHandlers}
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
