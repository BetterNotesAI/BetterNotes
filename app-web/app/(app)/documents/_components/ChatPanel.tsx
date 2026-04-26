'use client';

/**
 * ChatPanel.tsx
 * F3-M4: Chat contextual panel.
 *
 * New features vs M3:
 *   F3-M4.1 — Panel lateral de chat vinculado al visor.
 *             Sin referencia: mensaje "Select a block to edit with AI".
 *             Con referencia: muestra chip encima del input.
 *   F3-M4.2 — Chip visual con "x" para desreferenciar.
 *   F3-M4.4 — Preview del fragmento modificado con KaTeX renderizado.
 *   F3-M4.5 — Botones "Apply" / "Discard" — al aplicar, reemplaza el bloque en el visor.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { BlockReference } from '@/components/viewer/LatexViewer';
import { KATEX_MACROS } from '@/lib/katex-macros';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  version_id?: string | null;
  version_number?: number | null;
  created_at: string;
}

// A pending AI block edit preview — shown in the chat with Apply/Discard.
interface BlockEditPreview {
  blockId: string;
  blockType: string;
  originalLatex: string;
  modifiedLatex: string;
  userPrompt: string;
  /** IA-M1: parser offsets for unambiguous substitution in the route handler. */
  sourceStart?: number;
  sourceEnd?: number;
}

// A pending document-level AI edit preview.
interface DocumentEditPreview {
  modifiedLatex: string;
  summary: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isDraft: boolean;
  onSend: (content: string) => void;
  placeholder?: string;
  loadingLabel?: string;
  /**
   * Legacy: plain text prefill from "Reference in chat".
   * The parent must provide a stable reference with counter prefix (__refN__).
   */
  prefillText?: string;
  /** F3-M4.2: full BlockReference from the viewer. */
  blockReference?: BlockReference | null;
  /** F3-M4.2: clear the block reference (user clicked "x" on chip). */
  onClearBlockReference?: () => void;
  /** F3-M4.3: document id for the edit-block API call. */
  documentId?: string;
  /** F3-M4.5: current full LaTeX source (for apply payload). */
  latexSource?: string;
  /**
   * F3-M4.5: called when user clicks "Apply" — triggers the LatexViewer
   * to replace the block visually (optimistic update).
   */
  onApplyBlockEdit?: (blockId: string, newBlockLatex: string) => void;
  /**
   * F3-M4.6: called after a successful persist (apply mode returned 200).
   * Parent should reload the document to sync the new version.
   */
  onApplyPersisted?: () => void;
  /**
   * F3-M4.6: the new full LaTeX after the viewer replaced the block.
   * ChatPanel sends this to the API for compilation + persistence.
   * Set by the parent after onApplyBlockEdit is called.
   */
  pendingApplyLatex?: string | null;
  // ── Document-level edit props (Flujo C) ──────────────────────────────────
  /** Called when AI returns a document edit preview. Parent shows it in the viewer. */
  onDocumentEditPreview?: (modifiedLatex: string) => void;
  /** Called when user clicks "Apply to document". Parent compiles + persists. */
  onApplyDocumentEdit?: (modifiedLatex: string) => Promise<void>;
  /** Called when user clicks "Discard". Parent resets the preview. */
  onDiscardDocumentEdit?: () => void;
}

// ─── KaTeX helpers ────────────────────────────────────────────────────────────

function renderKatexSafe(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      macros: KATEX_MACROS,
      trust: false,
    });
  } catch {
    return `<code class="text-xs text-cyan-100/75 font-mono">${escapeHtml(latex)}</code>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeDisplayFormula(source: string): { formula: string; displayMode: boolean } {
  let formula = source.trim();

  if (formula.startsWith('$$') && formula.endsWith('$$')) {
    formula = formula.slice(2, -2).trim();
  } else if (formula.startsWith('\\[') && formula.endsWith('\\]')) {
    formula = formula.slice(2, -2).trim();
  }

  const envMatch = formula.match(/^\\begin\{([^}]+)\}([\s\S]*)\\end\{\1\}$/);
  if (!envMatch) return { formula, displayMode: true };

  const env = envMatch[1];
  const inner = envMatch[2].trim();

  if (/^equation\*?$/.test(env)) {
    return { formula: inner, displayMode: true };
  }

  if (/^(align|alignat|flalign|eqnarray)\*?$/.test(env)) {
    return { formula: `\\begin{aligned}${inner}\\end{aligned}`, displayMode: true };
  }

  if (/^gather\*?$/.test(env)) {
    return { formula: `\\begin{gathered}${inner}\\end{gathered}`, displayMode: true };
  }

  if (/^multline\*?$/.test(env)) {
    return { formula: `\\begin{aligned}${inner}\\end{aligned}`, displayMode: true };
  }

  return { formula, displayMode: false };
}

/**
 * Render a LaTeX fragment for preview in the chat panel.
 * Tries display mode first (for formula-block types), falls back to inline.
 */
function renderLatexPreview(latex: string, blockType: string): string {
  const isDisplayMath =
    blockType === 'formula-block' ||
    latex.trim().startsWith('\\[') ||
    latex.trim().startsWith('$$') ||
    latex.trim().startsWith('\\begin{');

  if (isDisplayMath) {
    const { formula, displayMode } = normalizeDisplayFormula(latex);
    return renderKatexSafe(formula, displayMode);
  }

  // Paragraph / mixed: render inline math fragments
  const parts: string[] = [];
  let i = 0;
  let inMath = false;
  let current = '';
  while (i < latex.length) {
    if (latex[i] === '$' && latex[i + 1] !== '$' && (i === 0 || latex[i - 1] !== '$')) {
      if (!inMath) {
        if (current) parts.push(`<span>${current}</span>`);
        current = '';
        inMath = true;
      } else {
        parts.push(renderKatexSafe(current, false));
        current = '';
        inMath = false;
      }
      i++;
    } else {
      current += latex[i];
      i++;
    }
  }
  if (current) {
    if (inMath) {
      parts.push(renderKatexSafe(current, false));
    } else {
      parts.push(`<span>${current}</span>`);
    }
  }
  return parts.join('');
}

// ─── BlockReference chip preview helper ──────────────────────────────────────

/**
 * Render a compact preview of a block reference for the chat chip.
 * - Formula blocks: render with KaTeX (inline mode, truncated).
 * - Text blocks: strip basic LaTeX commands, return first 80 chars.
 * Returns an HTML string ready for dangerouslySetInnerHTML.
 */
function renderChipPreview(latex: string, blockType: string): string {
  const isFormula =
    blockType === 'formula-block' ||
    blockType === 'formula-inline' ||
    latex.trim().startsWith('$') ||
    latex.trim().startsWith('\\[') ||
    latex.trim().startsWith('\\begin{');

  if (isFormula) {
    const { formula } = normalizeDisplayFormula(latex);
    // Truncate very long formulas to avoid layout explosion
    const truncated = formula.length > 200 ? formula.slice(0, 200) + '\\ldots' : formula;
    try {
      return katex.renderToString(truncated, {
        displayMode: false,
        throwOnError: false,
        macros: KATEX_MACROS,
        trust: false,
      });
    } catch {
      const preview = formula.length > 90 ? `${formula.slice(0, 90)}...` : formula;
      return `<span class="text-cyan-50/80 font-mono">${escapeHtml(preview)}</span>`;
    }
  }

  // Text block: clean up common LaTeX commands and return first 80 chars
  const cleaned = latex
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\*?(?:\{[^}]*\})?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const display = cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  return `<span>${display.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function humanizeApiError(message: unknown): string {
  const msg = typeof message === 'string' ? message : '';
  const normalized = msg.toLowerCase();

  if (normalized.includes('account_required_for_long_document')) {
    return 'Long Document requires creating an account. Please sign up or log in.';
  }
  if (normalized.includes('account_required_for_generation')) {
    return 'Create an account to keep using AI generation.';
  }
  if (normalized.includes('unauthorized')) {
    return 'You need to log in to use AI editing.';
  }

  return msg || 'Something went wrong. Please try again.';
}

const LOADING_PHASES = [
  { label: 'Generating LaTeX...', duration: 4000 },
  { label: 'Compiling PDF...', duration: null },
] as const;

// ─── BlockEditPreviewCard ─────────────────────────────────────────────────────

interface BlockEditPreviewCardProps {
  preview: BlockEditPreview;
  isApplying: boolean;
  applyError: string | null;
  onApply: () => void;
  onDiscard: () => void;
}

function BlockEditPreviewCard({
  preview,
  isApplying,
  applyError,
  onApply,
  onDiscard,
}: BlockEditPreviewCardProps) {
  const previewHtml = renderLatexPreview(preview.modifiedLatex, preview.blockType);

  return (
    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-400/20">
        <span className="text-xs font-medium text-indigo-300">Block preview</span>
        <span className="text-[10px] text-indigo-400/60 bg-indigo-500/20 rounded px-1.5 py-0.5">
          {preview.blockType}
        </span>
      </div>

      {/* KaTeX rendered preview */}
      <div className="px-3 py-3 bg-white/95 rounded-none overflow-auto max-h-48">
        <div
          className="font-sans text-gray-900 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>

      {/* Raw LaTeX (collapsible via details) */}
      <details className="px-3 py-1 border-t border-indigo-400/20">
        <summary className="text-[10px] text-indigo-300/70 cursor-pointer select-none py-1 hover:text-indigo-300">
          View LaTeX source
        </summary>
        <pre className="text-[10px] text-indigo-100/80 font-mono whitespace-pre-wrap break-all py-1 max-h-28 overflow-auto">
          {preview.modifiedLatex}
        </pre>
      </details>

      {/* Apply error */}
      {applyError && (
        <div className="px-3 py-1.5 bg-red-500/20 border-t border-red-500/20 text-red-400 text-xs">
          {applyError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-indigo-400/20">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
            bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <><span className="animate-spin inline-block text-sm">⟳</span> Applying…</>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Apply
            </>
          )}
        </button>
        <button
          onClick={onDiscard}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
            bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Discard
        </button>
      </div>
    </div>
  );
}

// ─── DocumentEditPreviewCard ──────────────────────────────────────────────────

interface DocumentEditPreviewCardProps {
  preview: DocumentEditPreview;
  isApplying: boolean;
  applyError: string | null;
  onApply: () => void;
  onDiscard: () => void;
}

function DocumentEditPreviewCard({
  preview,
  isApplying,
  applyError,
  onApply,
  onDiscard,
}: DocumentEditPreviewCardProps) {
  return (
    <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-400/20">
        <svg className="w-3.5 h-3.5 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-xs font-medium text-indigo-300">Document Edit Preview</span>
      </div>

      {/* Summary */}
      <div className="px-3 py-3">
        <p className="text-xs text-indigo-100/85 leading-relaxed">{preview.summary}</p>
      </div>

      {/* Apply error */}
      {applyError && (
        <div className="px-3 py-1.5 bg-red-500/20 border-t border-red-500/20 text-red-400 text-xs">
          {applyError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-indigo-400/20">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
            bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <><span className="animate-spin inline-block text-sm">⟳</span> Applying…</>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Apply to document
            </>
          )}
        </button>
        <button
          onClick={onDiscard}
          disabled={isApplying}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
            bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Discard
        </button>
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

export function ChatPanel({
  messages,
  isLoading,
  isDraft,
  onSend,
  placeholder,
  // loadingLabel is accepted for API compatibility but ChatPanel manages its own loading phases
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadingLabel: _loadingLabel,
  prefillText,
  blockReference,
  onClearBlockReference,
  documentId,
  latexSource,
  onApplyBlockEdit,
  onApplyPersisted,
  pendingApplyLatex,
  onDocumentEditPreview,
  onApplyDocumentEdit,
  onDiscardDocumentEdit,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // F3-M4.3 / M4.4: block edit state
  const [isEditingBlock, setIsEditingBlock] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [blockEditPreview, setBlockEditPreview] = useState<BlockEditPreview | null>(null);

  // IA-M1: conversation history for multi-turn block editing.
  // Accumulates user instructions + AI responses for the currently referenced block.
  // Reset when blockReference changes (new block selected).
  const [blockEditHistory, setBlockEditHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // F3-M4.5 / M4.6: apply state
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Document-level edit state (Flujo C)
  const [isDocumentEditing, setIsDocumentEditing] = useState(false);
  const [documentEditError, setDocumentEditError] = useState<string | null>(null);
  const [documentEditPreview, setDocumentEditPreview] = useState<DocumentEditPreview | null>(null);
  const [isApplyingDocumentEdit, setIsApplyingDocumentEdit] = useState(false);
  const [documentApplyError, setDocumentApplyError] = useState<string | null>(null);

  // Track pendingApplyLatex to trigger persistence after optimistic update
  const pendingApplyLatexRef = useRef<string | null>(null);
  const pendingApplyPreviewRef = useRef<BlockEditPreview | null>(null);
  // IA-M1: capture history at apply time so the useEffect closure has a stable snapshot
  const pendingApplyHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // When blockReference changes (new block referenced), clear previous preview + history
  useEffect(() => {
    if (blockReference) {
      setBlockEditPreview(null);
      setEditError(null);
      setBlockEditHistory([]); // IA-M1: reset history for the new block
    }
  }, [blockReference]);

  // Legacy prefillText: append raw text to input (for non-block-reference use)
  useEffect(() => {
    if (!prefillText) return;
    // If there's a blockReference, chip handles it — no need to inject raw text
    if (blockReference) return;
    const displayText = prefillText.replace(/^__ref\d+__/, '');
    setInput((prev) => {
      const separator = prev.trim() ? '\n' : '';
      return prev + separator + `[ref: ${displayText}] `;
    });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        textareaRef.current.focus();
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillText]);

  // When a new blockReference arrives, focus the input
  useEffect(() => {
    if (!blockReference) return;
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [blockReference]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingPhaseIndex(0);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingPhaseIndex(1);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, blockEditPreview, documentEditPreview]);

  // ── F3-M4.3: send block edit request ─────────────────────────────────────

  const handleSendBlockEdit = useCallback(async () => {
    if (!blockReference || !input.trim() || !documentId) return;
    setIsEditingBlock(true);
    setEditError(null);
    setBlockEditPreview(null);

    const userPrompt = input.trim();

    try {
      const resp = await fetch(`/api/documents/${documentId}/edit-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId: blockReference.blockId,
          blockLatex: blockReference.latex_source,
          blockType: blockReference.blockType,
          adjacentBlocks: blockReference.adjacentBlocks,
          userPrompt,
          fullLatex: latexSource ?? '',
          // IA-M1: pass accumulated conversation history for multi-turn editing
          conversationHistory: blockEditHistory,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setEditError(humanizeApiError(errData?.error));
        return;
      }

      const data = await resp.json();
      const modifiedLatex = data.modifiedLatex ?? blockReference.latex_source;

      setBlockEditPreview({
        blockId: blockReference.blockId,
        blockType: blockReference.blockType,
        originalLatex: blockReference.latex_source,
        modifiedLatex,
        userPrompt,
        // IA-M1: carry offsets from BlockReference → apply payload
        sourceStart: blockReference.sourceStart,
        sourceEnd: blockReference.sourceEnd,
      });

      // IA-M1: accumulate this turn in history so follow-up prompts have context
      setBlockEditHistory((prev) => [
        ...prev,
        { role: 'user' as const, content: userPrompt },
        { role: 'assistant' as const, content: modifiedLatex },
      ]);

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setEditError(`Failed to reach server: ${msg}`);
    } finally {
      setIsEditingBlock(false);
    }
  }, [blockReference, input, documentId, latexSource, blockEditHistory]);

  // ── F3-M4.5: Apply block edit ─────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!blockEditPreview || !documentId) return;
    setIsApplying(true);
    setApplyError(null);

    // 1. Optimistic update: tell LatexViewer to replace the block visually
    onApplyBlockEdit?.(blockEditPreview.blockId, blockEditPreview.modifiedLatex);
    // Store refs so they're available when pendingApplyLatex arrives
    pendingApplyPreviewRef.current = blockEditPreview;
    pendingApplyHistoryRef.current = blockEditHistory; // IA-M1: snapshot history at apply time
    // pendingApplyLatex will be updated by parent after LatexViewer fires onLatexChange
  }, [blockEditPreview, documentId, onApplyBlockEdit]);

  // F3-M4.6: once pendingApplyLatex is updated by parent (after optimistic update),
  // fire the persist API call
  useEffect(() => {
    if (!pendingApplyLatex) return;
    if (pendingApplyLatex === pendingApplyLatexRef.current) return;
    pendingApplyLatexRef.current = pendingApplyLatex;

    const preview = pendingApplyPreviewRef.current;
    if (!preview || !documentId || !isApplying) return;

    (async () => {
      try {
        const resp = await fetch(`/api/documents/${documentId}/edit-block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apply: true,
            blockId: preview.blockId,
            blockLatex: preview.originalLatex,
            modifiedLatex: preview.modifiedLatex,
            fullLatex: pendingApplyLatex,
            // IA-M1: pass parser offsets for robust substitution
            sourceStart: preview.sourceStart,
            sourceEnd: preview.sourceEnd,
            conversationHistory: pendingApplyHistoryRef.current,
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          setApplyError(errData?.error ?? 'Failed to save. Changes applied locally only.');
        } else {
          // Success: clear preview
          setBlockEditPreview(null);
          onClearBlockReference?.();
          onApplyPersisted?.();
          pendingApplyPreviewRef.current = null;
          // IA-M1: reset history after successful apply (block is now in a new state)
          setBlockEditHistory([]);
          pendingApplyHistoryRef.current = [];
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setApplyError(`Save failed: ${msg}. Changes applied locally only.`);
      } finally {
        setIsApplying(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApplyLatex]);

  // ── Discard ───────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
    setBlockEditPreview(null);
    setApplyError(null);
    pendingApplyPreviewRef.current = null;
    // IA-M1: clear history when user discards (starts fresh next time)
    setBlockEditHistory([]);
  }, []);

  // ── Document-level send (Flujo C) ────────────────────────────────────────

  const handleSendDocumentEdit = useCallback(async () => {
    if (!documentId || !latexSource || !input.trim()) return;
    setIsDocumentEditing(true);
    setDocumentEditError(null);

    try {
      const resp = await fetch(`/api/documents/${documentId}/chat-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input.trim(),
          fullLatex: latexSource,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setDocumentEditError(humanizeApiError(errData?.error));
        return;
      }

      const data = await resp.json();

      if (data.type === 'edit') {
        setDocumentEditPreview({ modifiedLatex: data.modifiedLatex, summary: data.summary });
        onDocumentEditPreview?.(data.modifiedLatex);
      }
      // For 'message' type, the DB message was already saved server-side;
      // the parent will reload messages via the existing flow (no extra action needed here).

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setDocumentEditError(`Failed to reach server: ${msg}`);
    } finally {
      setIsDocumentEditing(false);
    }
  }, [documentId, latexSource, input, onDocumentEditPreview]);

  // ── Document-level apply ──────────────────────────────────────────────────

  const handleApplyDocumentEdit = useCallback(async () => {
    if (!documentEditPreview) return;
    setIsApplyingDocumentEdit(true);
    setDocumentApplyError(null);
    try {
      await onApplyDocumentEdit?.(documentEditPreview.modifiedLatex);
      setDocumentEditPreview(null);
    } catch {
      setDocumentApplyError('Failed to apply. Please try again.');
    } finally {
      setIsApplyingDocumentEdit(false);
    }
  }, [documentEditPreview, onApplyDocumentEdit]);

  // ── Document-level discard ────────────────────────────────────────────────

  const handleDiscardDocumentEdit = useCallback(() => {
    setDocumentEditPreview(null);
    setDocumentApplyError(null);
    onDiscardDocumentEdit?.();
  }, [onDiscardDocumentEdit]);

  // ── Standard send (non-block-edit) ────────────────────────────────────────

  function handleSend() {
    if (blockReference && documentId && !isDraft) {
      handleSendBlockEdit();
      return;
    }
    // Document-level edit mode: no blockReference, not a draft
    if (!blockReference && !isDraft && documentId && latexSource) {
      handleSendDocumentEdit();
      return;
    }
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }

  const isBlockEditMode = !!blockReference && !isDraft;

  const defaultPlaceholder = isDraft
    ? 'Describe the document you want to create...'
    : isBlockEditMode
    ? 'Describe what to change in this block...'
    : (placeholder ?? 'Ask for changes...');

  const isSendDisabled = isEditingBlock || isDocumentEditing || isLoading || !input.trim();
  const userBubbleClass =
    'text-white border border-cyan-200/25 shadow-[0_10px_28px_rgba(0,0,0,0.34)] bg-[linear-gradient(140deg,rgba(62,120,150,0.92)_0%,rgba(41,88,120,0.92)_58%,rgba(29,66,96,0.92)_100%)]';
  const assistantBubbleClass =
    'text-white/90 border border-white/[0.07] shadow-[0_10px_24px_rgba(0,0,0,0.26)] bg-[linear-gradient(145deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.05)_100%)] backdrop-blur-sm';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-full border-l border-white/10 bg-[radial-gradient(120%_110%_at_0%_0%,rgba(35,67,88,0.30)_0%,rgba(13,17,26,0.20)_45%,rgba(8,12,20,0.35)_100%)] backdrop-blur-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/85 tracking-[0.01em]">Chat</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-cyan-200/75">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" />
            AI ready
          </div>
        </div>
      </div>

      {/* F3-M4.1: Empty state when no block referenced and no messages */}
      {messages.length === 0 && !isLoading && !blockReference && !blockEditPreview && (
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm space-y-2 shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
            <p className="text-white/65 font-medium">
            {isDraft ? 'What would you like to create?' : 'Continue the conversation'}
            </p>
            <p className="text-xs text-white/45">
              {isDraft
                ? 'Describe your document and the AI will generate it for you.'
                : 'Ask the AI to modify your document, or right-click a block in the viewer to edit it with AI.'}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? userBubbleClass
                  : assistantBubbleClass
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>

            <p className={`text-[11px] text-white/30 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        ))}

        {/* Standard generation loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] backdrop-blur-sm shadow-[0_10px_28px_rgba(0,0,0,0.26)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/75 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs text-white/60 font-medium">
                  {LOADING_PHASES[loadingPhaseIndex].label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {LOADING_PHASES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                      i <= loadingPhaseIndex
                        ? 'bg-cyan-300/70 w-6'
                        : 'bg-white/15 w-4'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* F3-M4.3: Block edit loading indicator */}
        {isEditingBlock && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 border border-cyan-300/35 bg-cyan-400/10">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="text-xs text-cyan-100/85 font-medium">Asking AI to edit block...</span>
              </div>
            </div>
          </div>
        )}

        {/* F3-M4.3: Edit error */}
        {editError && (
          <div className="flex justify-start">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400 max-w-[85%]">
              {editError}
            </div>
          </div>
        )}

        {/* F3-M4.4: Block edit preview card */}
        {blockEditPreview && (
          <div className="w-full">
            <BlockEditPreviewCard
              preview={blockEditPreview}
              isApplying={isApplying}
              applyError={applyError}
              onApply={handleApply}
              onDiscard={handleDiscard}
            />
          </div>
        )}

        {/* Document-level edit loading indicator */}
        {isDocumentEditing && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 border border-cyan-300/35 bg-cyan-400/10">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="text-xs text-cyan-100/85 font-medium">Asking AI to edit document...</span>
              </div>
            </div>
          </div>
        )}

        {/* Document-level edit error */}
        {documentEditError && (
          <div className="flex justify-start">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400 max-w-[85%]">
              {documentEditError}
            </div>
          </div>
        )}

        {/* Document-level edit preview card */}
        {documentEditPreview && (
          <div className="w-full">
            <DocumentEditPreviewCard
              preview={documentEditPreview}
              isApplying={isApplyingDocumentEdit}
              applyError={documentApplyError}
              onApply={handleApplyDocumentEdit}
              onDiscard={handleDiscardDocumentEdit}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/10 shrink-0 space-y-2 bg-white/[0.02]">

        {/* F3-M4.2: Block reference chip — Mejora B: KaTeX mini-preview */}
        {blockReference && (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-cyan-500/12 border border-cyan-300/25">
            {/* Block type badge */}
            <span className="shrink-0 text-[10px] font-medium text-cyan-200 bg-cyan-500/20 rounded px-1.5 py-0.5 mt-0.5">
              {blockReference.blockType}
            </span>
            {/* KaTeX / text mini-preview */}
            <span
              className="flex-1 text-xs text-cyan-50/90 leading-snug line-clamp-2 overflow-hidden [&_.katex]:text-cyan-50 [&_.katex-html]:max-w-full"
              dangerouslySetInnerHTML={{
                __html: renderChipPreview(blockReference.latex_source, blockReference.blockType),
              }}
            />
            {/* X button */}
            <button
              onClick={() => {
                onClearBlockReference?.();
                setBlockEditPreview(null);
                setEditError(null);
              }}
              className="shrink-0 text-cyan-100/45 hover:text-cyan-100 transition-colors p-0.5 rounded"
              aria-label="Remove block reference"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            rows={1}
            disabled={isLoading || isEditingBlock || isDocumentEditing}
            className="flex-1 bg-black/30 text-white/90 text-sm rounded-xl px-3 py-2.5 resize-none placeholder-white/30 border border-white/15 focus:outline-none focus:border-cyan-300/60 transition-colors disabled:opacity-50 min-h-[40px] max-h-[160px] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          />
          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-cyan-200/30 bg-[linear-gradient(145deg,rgba(111,224,255,0.30),rgba(80,189,222,0.18))] text-cyan-50 hover:text-white hover:border-cyan-200/45 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_8px_20px_rgba(18,34,45,0.36)]"
            aria-label="Send"
          >
            {isEditingBlock || isDocumentEditing ? (
              <span className="text-sm animate-spin">⟳</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {isBlockEditMode ? (
          <p className="text-xs text-cyan-100/55">
            Editing block with AI &middot; Enter to send &middot; Shift+Enter for new line
          </p>
        ) : (
          <p className="text-xs text-white/25 mt-1.5">
            Enter to send &middot; Shift+Enter for new line
          </p>
        )}
      </div>

      <style jsx>{`
        .chat-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(180, 205, 220, 0.28) transparent;
        }
        .chat-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(168, 198, 216, 0.25);
          border-radius: 999px;
        }
        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(178, 214, 235, 0.38);
        }
      `}</style>
    </div>
  );
}
