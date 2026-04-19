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
import { KATEX_MACROS } from '@/lib/katex-macros';

// ─── render a single KaTeX formula string ─────────────────────────────────────

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      macros: KATEX_MACROS,
      // KaTeX supports \textcolor and \color natively without trust.
      // trust stays false to block \url, \href, \htmlStyle etc.
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
  // Normalize \( ... \) inline math into $...$ so both notations render.
  const normalized = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner}$`);

  // Match $...$ but not $$...$$
  // Use a simple approach: split on single $ boundaries
  const parts: string[] = [];
  let i = 0;
  let inMath = false;
  let current = '';

  while (i < normalized.length) {
    if (normalized[i] === '$' && normalized[i + 1] !== '$' && (i === 0 || normalized[i - 1] !== '$')) {
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
      current += normalized[i];
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
  const out = text
    .replace(/&/g, '&amp;')
    // Step 2 — LaTeX text commands (applied on escaped string; args use {} so safe)
    // \textbf{...}
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    // \textit{...}
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    // \emph{...}
    .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
    // \textcolor{color}{text} → render with inline color style
    .replace(/\\textcolor\{([^}]*)\}\{([^}]*)\}/g, '<span style="color:$1">$2</span>')
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

/**
 * Render box/theorem-like body content, which may contain both display math
 * (\[...\], $$...$$) and inline math ($...$). Returns an HTML string.
 */
function renderBoxContentHtml(text: string): string {
  const re = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(renderInlineMath(text.slice(last, m.index)));
    }
    let inner = m[0];
    inner = inner.startsWith('$$') ? inner.slice(2, -2) : inner.slice(2, -2);
    parts.push(
      `<div style="text-align:center;margin:0.3em 0;overflow-x:auto;">${renderKatex(inner.trim(), true)}</div>`
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(renderInlineMath(text.slice(last)));
  }
  return parts.join('');
}

// Human-readable labels for theorem-like environments
const BOX_SUBTYPE_LABELS: Record<string, string> = {
  definition: 'Definition',
  theorem: 'Theorem',
  proposition: 'Proposition',
  observation: 'Observation',
  example: 'Example',
  lemma: 'Lemma',
  corollary: 'Corollary',
  remark: 'Remark',
  proof: 'Proof',
  workedexample: 'Worked Example',
  keypoint: 'Key Point',
  warning: 'Note',
};

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
    <Tag
      className={isEnumerate ? 'list-decimal' : 'list-disc'}
      style={{
        margin: '0.15em 0 0.22em 1.18em',
        padding: 0,
        lineHeight: 1.2,
        fontSize: '1em',
      }}
    >
      {rawItems.map((item, idx) => {
        const cleaned = item.trim();
        return (
          <li key={idx} style={{ margin: '0.1em 0' }}>
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
    <div className="overflow-x-auto" style={{ margin: '0.2em 0 0.3em' }}>
      <table className="border-collapse" style={{ fontSize: '1em', width: '100%' }}>
        <tbody>
          {rows.map((row, rowIdx) => {
            const cells = row.split('&').map(c => c.trim());
            return (
              <tr
                key={rowIdx}
                style={rowIdx === 0 ? { fontWeight: 600, borderBottom: '1px solid #7d7d7d' } : undefined}
              >
                {cells.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    style={{
                      padding: '0.1em 0.35em',
                      border: '1px solid #a9a9a9',
                      verticalAlign: 'top',
                    }}
                  >
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

// ─── IA-M2: block action bar ──────────────────────────────────────────────────

interface BlockActionBarProps {
  blockId: string;
  onAddBlock?: (id: string, type: AddBlockType, position: 'before' | 'after') => void;
  onDeleteBlock?: (id: string) => void;
  onMoveBlock?: (id: string, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Tiny action bar shown when a block is focused. */
function BlockActionBar({
  blockId,
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  canMoveUp,
  canMoveDown,
}: BlockActionBarProps) {
  const [showAddMenu, setShowAddMenu] = useState<'before' | 'after' | null>(null);

  const btnBase =
    'flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-[10px] font-medium select-none';
  const btnDisabled = 'opacity-30 cursor-not-allowed pointer-events-none';

  function stopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      className="absolute right-0 top-0 translate-x-full pl-0.5 flex flex-col items-center gap-0.5 z-10"
      onMouseDown={stopProp}
      onClick={stopProp}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Move up */}
      <button
        title="Move block up"
        className={`${btnBase} ${!canMoveUp ? btnDisabled : ''}`}
        onClick={() => canMoveUp && onMoveBlock?.(blockId, -1)}
        tabIndex={-1}
        aria-label="Move block up"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Move down */}
      <button
        title="Move block down"
        className={`${btnBase} ${!canMoveDown ? btnDisabled : ''}`}
        onClick={() => canMoveDown && onMoveBlock?.(blockId, 1)}
        tabIndex={-1}
        aria-label="Move block down"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Add above */}
      <div className="relative">
        <button
          title="Add block above"
          className={btnBase}
          onClick={() => setShowAddMenu((m) => (m === 'before' ? null : 'before'))}
          tabIndex={-1}
          aria-label="Add block above"
        >
          +↑
        </button>
        {showAddMenu === 'before' && (
          <AddBlockMenu
            blockId={blockId}
            position="before"
            onAdd={(id, type, pos) => { onAddBlock?.(id, type, pos); setShowAddMenu(null); }}
            onClose={() => setShowAddMenu(null)}
          />
        )}
      </div>

      {/* Add below */}
      <div className="relative">
        <button
          title="Add block below"
          className={btnBase}
          onClick={() => setShowAddMenu((m) => (m === 'after' ? null : 'after'))}
          tabIndex={-1}
          aria-label="Add block below"
        >
          +↓
        </button>
        {showAddMenu === 'after' && (
          <AddBlockMenu
            blockId={blockId}
            position="after"
            onAdd={(id, type, pos) => { onAddBlock?.(id, type, pos); setShowAddMenu(null); }}
            onClose={() => setShowAddMenu(null)}
          />
        )}
      </div>

      {/* Delete */}
      <button
        title="Delete block"
        className={`${btnBase} hover:text-red-600 hover:bg-red-50`}
        onClick={() => {
          if (confirm('Delete this block? This action can be undone with Ctrl+Z.')) {
            onDeleteBlock?.(blockId);
          }
        }}
        tabIndex={-1}
        aria-label="Delete block"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

interface AddBlockMenuProps {
  blockId: string;
  position: 'before' | 'after';
  onAdd: (id: string, type: AddBlockType, position: 'before' | 'after') => void;
  onClose: () => void;
}

const ADD_BLOCK_OPTIONS: Array<{ type: AddBlockType; label: string }> = [
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'formula', label: 'Formula' },
  { type: 'list', label: 'List' },
  { type: 'section', label: 'Section' },
];

function AddBlockMenu({ blockId, position, onAdd, onClose }: AddBlockMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 ml-0.5 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px] z-50"
      style={{ fontSize: '11px' }}
    >
      <div className="px-2 py-0.5 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
        {position === 'before' ? 'Add above' : 'Add below'}
      </div>
      {ADD_BLOCK_OPTIONS.map(({ type, label }) => (
        <button
          key={type}
          className="w-full text-left px-2.5 py-1 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          onClick={() => onAdd(blockId, type, position)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export type AddBlockType = 'paragraph' | 'formula' | 'list' | 'section';

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
  // ── IA-M2: block management ────────────────────────────────────────────
  /** Add a new block before or after this block. */
  onAddBlock?: (id: string, type: AddBlockType, position: 'before' | 'after') => void;
  /** Delete this block. */
  onDeleteBlock?: (id: string) => void;
  /** Move this block up (-1) or down (+1). */
  onMoveBlock?: (id: string, direction: -1 | 1) => void;
  /** Whether this block can move up (not first in list). */
  canMoveUp?: boolean;
  /** Whether this block can move down (not last in list). */
  canMoveDown?: boolean;
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
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  canMoveUp = true,
  canMoveDown = true,
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
    'group relative transition-colors duration-100',
    // M3.1: hover highlight — subtle ring on hover (non-editing, non-section)
    block.type !== 'hr' && block.type !== 'col-start' && block.type !== 'col-end'
      ? isEditing
        ? 'ring-1 ring-indigo-400'
        : isFocused
        ? 'ring-1 ring-indigo-300 cursor-text'
        : isHovered
        ? 'ring-1 ring-gray-300/80 cursor-text'
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
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (isFocused) {
                onEdit?.(block.id);
              } else {
                onFocus?.(block.id);
              }
            }
          },
        }
      : {};

  // ── Rendered content (must be computed before any conditional returns) ────────
  const rendered = useMemo(() => {
    switch (block.type) {
      case 'formula-block': {
        // Strip outer $$...$$ or \[...\] wrappers before passing to KaTeX
        let formula = block.latex_source;
        if (formula.startsWith('$$') && formula.endsWith('$$')) {
          formula = formula.slice(2, -2).trim();
        } else if (formula.startsWith('\\[') && formula.endsWith('\\]')) {
          formula = formula.slice(2, -2).trim();
        }
        // If the formula contains a \begin{env} environment (align*, equation*, gather*, etc.)
        // pass displayMode: false — KaTeX honours the environment's own display semantics
        // and double-wrapping with displayMode: true causes rendering errors.
        const hasEnv = /\\begin\s*\{/.test(formula);
        return renderKatex(formula, !hasEnv);
      }

      case 'formula-inline':
      case 'paragraph': {
        return renderInlineMath(block.latex_source);
      }

      default:
        return null;
    }
  }, [block]);

  // ── Accessibility props for interactive blocks ────────────────────────────
  const isInteractive =
    block.type !== 'hr' && block.type !== 'col-start' && block.type !== 'col-end';
  const a11yProps = isInteractive
    ? {
        tabIndex: 0,
        role: 'article' as const,
        'aria-label': `${block.type} block — click to focus, double-click or Enter to edit`,
      }
    : {};

  // IA-M2: action bar (only for interactive, non-structural blocks when focused)
  const isInteractiveForActions =
    block.type !== 'hr' && block.type !== 'col-start' && block.type !== 'col-end';
  const actionBar = isInteractiveForActions && isFocused && !isEditing && (
    <BlockActionBar
      blockId={block.id}
      onAddBlock={onAddBlock}
      onDeleteBlock={onDeleteBlock}
      onMoveBlock={onMoveBlock}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    />
  );

  // ── Inline editor overlay — shown when isEditing ───────────────────────────
  if (isEditing) {
    return (
      <div className={`${interactiveClass} px-1 py-0.5`} data-block-id={block.id} {...a11yProps} {...interactiveHandlers}>
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
      const headingStyle: React.CSSProperties =
        block.level === 1
          ? {
              fontSize: '1.38em',
              fontWeight: 700,
              margin: '0.18em 0',
              lineHeight: 1.18,
              borderBottom: '1px solid #8f8f8f',
              paddingBottom: '0.1em',
              breakAfter: 'avoid',
            }
          : block.level === 2
          ? { fontSize: '1.05em', fontWeight: 700, margin: '0.14em 0 0.1em', lineHeight: 1.2, breakAfter: 'avoid' }
          : { fontSize: '1em', fontWeight: 700, margin: '0.12em 0 0.08em', lineHeight: 1.2, breakAfter: 'avoid' };
      const hfillParts = block.latex_source
        .split('___HFILL___')
        .map((part) => part.trim())
        .filter(Boolean);
      return (
        <div className={interactiveClass} style={{ overflow: 'visible' }} data-block-id={block.id} {...a11yProps} {...interactiveHandlers}>
          <HeadingTag style={{ ...headingStyle, color: 'var(--accent, #333)' }}>
            {hfillParts.length >= 2 ? (
              <span style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6em' }}>
                <span>{hfillParts[0]}</span>
                <span style={{ fontSize: block.level === 1 ? '0.74em' : '0.85em', fontWeight: 600 }}>
                  {hfillParts.slice(1).join(' ')}
                </span>
              </span>
            ) : (
              block.latex_source
            )}
          </HeadingTag>
          {actionBar}
        </div>
      );
    }

    case 'formula-block':
      return (
        <div
          className={`text-center ${interactiveClass}`}
          style={{ overflow: 'visible', margin: '0.16em 0 0.24em', breakInside: 'avoid' }}
          data-block-id={block.id}
          {...a11yProps}
          {...interactiveHandlers}
        >
          <div
            className="overflow-x-auto"
            style={{ fontSize: '1em', lineHeight: 1.12 }}
            dangerouslySetInnerHTML={{ __html: rendered! }}
          />
          {actionBar}
        </div>
      );

    case 'formula-inline':
    case 'paragraph':
      return (
        <div className={interactiveClass} style={{ overflow: 'visible' }} data-block-id={block.id} {...a11yProps} {...interactiveHandlers}>
          <p
            style={{ margin: '0.12em 0', fontSize: '1em', lineHeight: 1.22 }}
            dangerouslySetInnerHTML={{ __html: rendered! }}
          />
          {actionBar}
        </div>
      );

    case 'list':
      return (
        <div className={interactiveClass} style={{ overflow: 'visible', margin: '0.1em 0' }} data-block-id={block.id} {...a11yProps} {...interactiveHandlers}>
          {renderList(block.latex_source)}
          {actionBar}
        </div>
      );

    case 'table':
      return (
        <div className={interactiveClass} style={{ overflow: 'visible', breakInside: 'avoid' }} data-block-id={block.id} {...a11yProps} {...interactiveHandlers}>
          {renderTable(block.latex_source)}
          {actionBar}
        </div>
      );

    case 'hr':
      return <hr style={{ margin: '0.2em 0 0.26em', borderTop: '1px solid #8f8f8f', breakBefore: 'avoid' }} />;

    case 'box': {
      const borderColor =
        block.boxSubtype === 'definition'
          ? 'var(--def-color, #0891B2)'
          : block.boxSubtype === 'theorem'
          ? 'var(--thm-color, #7C3AED)'
          : block.boxSubtype === 'proposition'
          ? 'var(--prop-color, #059669)'
          : block.boxSubtype === 'observation'
          ? 'var(--accent, #374151)'
          : block.boxSubtype === 'example'
          ? 'var(--accent, #374151)'
          : 'var(--accent, #374151)';
      const isTypedTheoremLike = !!block.boxSubtype;
      const bgColor = isTypedTheoremLike ? 'rgba(246,248,252,0.7)' : 'transparent';
      const heading = block.boxSubtype ? BOX_SUBTYPE_LABELS[block.boxSubtype] ?? null : null;
      return (
        <div
          style={{
            breakInside: 'avoid',
            borderLeft: `3px solid ${borderColor}`,
            border: `1px solid ${borderColor}`,
            borderRadius: '3px',
            padding: '0.35em 0.55em',
            margin: '0.35em 0 0.45em',
            background: bgColor,
            overflow: 'visible',
            fontSize: '1em',
            lineHeight: 1.25,
          }}
          className={interactiveClass}
          data-block-id={block.id}
          {...a11yProps}
          {...interactiveHandlers}
        >
          {(heading || block.label) && (
            <div
              style={{
                fontWeight: 700,
                color: borderColor,
                fontSize: '0.9em',
                marginBottom: '0.2em',
                letterSpacing: '0.01em',
              }}
            >
              {heading}
              {block.label ? (
                <span style={{ fontWeight: 500, color: '#374151' }}>
                  {heading ? ' — ' : ''}
                  {block.label}
                </span>
              ) : null}
            </div>
          )}
          <div dangerouslySetInnerHTML={{ __html: renderBoxContentHtml(block.latex_source) }} />
          {actionBar}
        </div>
      );
    }

    case 'cover': {
      return (
        <div
          className={interactiveClass}
          style={{
            breakAfter: 'page',
            padding: '2.6em 0 2.2em',
            margin: '0 0 1.4em',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            textAlign: 'center',
            overflow: 'visible',
          }}
          data-block-id={block.id}
          {...a11yProps}
          {...interactiveHandlers}
        >
          {block.title && (
            <h1
              style={{
                fontSize: '2.3em',
                fontWeight: 700,
                color: 'var(--accent, #1f2937)',
                margin: '0 auto 0.45em',
                lineHeight: 1.18,
                maxWidth: '85%',
              }}
            >
              {block.title}
            </h1>
          )}
          {block.title && (
            <div
              style={{
                width: '40%',
                height: '2px',
                margin: '0 auto 1.2em',
                background: 'var(--accent, #1f2937)',
                opacity: 0.6,
              }}
            />
          )}
          {block.author && (
            <div
              style={{
                fontSize: '1.15em',
                color: '#333',
                margin: '0.3em 0 0.2em',
                fontStyle: 'italic',
              }}
            >
              {block.author}
            </div>
          )}
          {block.date && (
            <div style={{ fontSize: '0.95em', color: '#555', margin: '0.35em 0 0' }}>
              {block.date}
            </div>
          )}
          <div
            style={{
              marginTop: '2.2em',
              fontSize: '0.78em',
              color: '#888',
              fontStyle: 'italic',
              letterSpacing: '0.03em',
            }}
          >
            Document generated with BetterNotes AI
          </div>
          {actionBar}
        </div>
      );
    }

    case 'chapter': {
      return (
        <div
          className={interactiveClass}
          style={{
            margin: '1.4em 0 0.8em',
            breakBefore: 'page',
            breakAfter: 'avoid',
            overflow: 'visible',
          }}
          data-block-id={block.id}
          {...a11yProps}
          {...interactiveHandlers}
        >
          {block.chapterNumber !== undefined && (
            <div
              style={{
                fontSize: '0.78em',
                fontWeight: 600,
                color: 'var(--accent, #005AAA)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                margin: '0 0 0.25em',
              }}
            >
              Chapter {block.chapterNumber}
            </div>
          )}
          <h1
            style={{
              fontSize: '1.85em',
              fontWeight: 700,
              color: 'var(--accent, #1f2937)',
              margin: '0 0 0.35em',
              lineHeight: 1.18,
              borderBottom: '2px solid var(--accent, #005AAA)',
              paddingBottom: '0.18em',
            }}
          >
            {block.latex_source}
          </h1>
          {actionBar}
        </div>
      );
    }

    case 'col-start':
    case 'col-end':
      return null;

    default:
      return null;
  }
}
