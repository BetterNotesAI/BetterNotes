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
    return `<code class="text-xs text-red-400 font-mono">${latex}</code>`;
  }
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
    // Strip display math delimiters and render
    let inner = latex.trim();
    inner = inner.replace(/^\\\[|\\\]$/g, '').trim();
    inner = inner.replace(/^\$\$|\$\$$/g, '').trim();
    // If it's a \begin{env}...\end{env}, render as-is
    if (inner.startsWith('\\begin{')) {
      return renderKatexSafe(inner, true);
    }
    return renderKatexSafe(inner, true);
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
    // Strip outer display delimiters
    let inner = latex.trim();
    inner = inner.replace(/^\\\[|\\\]$/g, '').trim();
    inner = inner.replace(/^\$\$|\$\$$/g, '').trim();
    inner = inner.replace(/^\\begin\{[^}]+\}|\\end\{[^}]+\}$/g, '').trim();
    // Truncate very long formulas to avoid layout explosion
    const truncated = inner.length > 200 ? inner.slice(0, 200) + '\\ldots' : inner;
    try {
      return katex.renderToString(truncated, {
        displayMode: false,
        throwOnError: false,
        macros: KATEX_MACROS,
        trust: false,
      });
    } catch {
      return `<code class="text-xs font-mono">${inner.slice(0, 80)}</code>`;
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
        setEditError(errData?.error ?? 'AI edit failed. Try again.');
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
        setDocumentEditError(errData?.error ?? 'AI edit failed. Try again.');
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-black/20 border-l border-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2 className="text-sm font-semibold text-white/80">Chat</h2>
      </div>

      {/* F3-M4.1: Empty state when no block referenced and no messages */}
      {messages.length === 0 && !isLoading && !blockReference && !blockEditPreview && (
        <div className="px-4 py-6 text-center text-white/30 text-sm space-y-2">
          <p className="text-white/50 font-medium">
            {isDraft ? 'What would you like to create?' : 'Continue the conversation'}
          </p>
          <p className="text-xs">
            {isDraft
              ? 'Describe your document and the AI will generate it for you.'
              : 'Ask the AI to modify your document, or right-click a block in the viewer to edit it with AI.'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white/90'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>

            <p className={`text-xs text-white/25 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        ))}

        {/* Standard generation loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs text-white/50 font-medium">
                  {LOADING_PHASES[loadingPhaseIndex].label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {LOADING_PHASES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                      i <= loadingPhaseIndex
                        ? 'bg-indigo-400/60 w-6'
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
            <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs text-indigo-300/80 font-medium">Asking AI to edit block...</span>
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
            <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs text-indigo-300/80 font-medium">Asking AI to edit document...</span>
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
      <div className="px-4 py-3 border-t border-white/10 shrink-0 space-y-2">

        {/* F3-M4.2: Block reference chip — Mejora B: KaTeX mini-preview */}
        {blockReference && (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/25">
            {/* Block type badge */}
            <span className="shrink-0 text-[10px] font-medium text-indigo-400 bg-indigo-500/25 rounded px-1.5 py-0.5 mt-0.5">
              {blockReference.blockType}
            </span>
            {/* KaTeX / text mini-preview */}
            <span
              className="flex-1 text-xs text-indigo-100/90 leading-snug line-clamp-2 overflow-hidden
                [&_.katex]:text-indigo-100 [&_.katex-html]:max-w-full"
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
              className="shrink-0 text-indigo-400/50 hover:text-indigo-300 transition-colors p-0.5 rounded"
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
            className="flex-1 bg-black/20 text-white/90 text-sm rounded-xl px-3 py-2.5 resize-none
              placeholder-white/30 border border-white/15 focus:outline-none focus:border-indigo-500/60
              transition-colors disabled:opacity-50 min-h-[40px] max-h-[160px]"
          />
          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
              bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
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
          <p className="text-xs text-indigo-300/50">
            Editing block with AI &middot; Enter to send &middot; Shift+Enter for new line
          </p>
        ) : (
          <p className="text-xs text-white/25 mt-1.5">
            Enter to send &middot; Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}
