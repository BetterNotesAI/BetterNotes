'use client';

/**
 * LatexViewer.tsx
 * Top-level viewer component. Receives a raw LaTeX string, parses it
 * into blocks, and renders each block via LatexBlock.
 *
 * F3-M2.3: templateId prop drives multicolumn layout.
 * F3-M2.4: Built-in toolbar with virtual page navigation and zoom.
 * F3-M3:   Interactivity — hover, focus, inline edit, format toolbar,
 *          contextual menu "Reference in chat", auto-detect block type.
 *
 * Usage:
 *   <LatexViewer latexSource={rawLatexString} templateId="lecture_notes" />
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { parseLatex, reconstructLatexFromBlocks, newBlockLatex } from '@/lib/latex-parser';
import type { Block, BlockType, NewBlockType } from '@/lib/latex-parser';
import LatexBlock from './LatexBlock';
import { getTemplateProfile } from '@/lib/template-profiles';

// ─── F3-M4.2: BlockReference type ────────────────────────────────────────────

export interface BlockReference {
  blockId: string;
  blockType: string;
  latex_source: string;
  /** Up to 2 blocks before/after for AI context */
  adjacentBlocks: Array<{ blockId: string; blockType: string; latex_source: string }>;
  /**
   * IA-M1: character offsets of this block in the original LaTeX source (after preamble strip).
   * When present, the edit-block API uses them for unambiguous offset-based substitution.
   */
  sourceStart?: number;
  sourceEnd?: number;
}

// ─── F3-M4.7: undo/redo history ──────────────────────────────────────────────

const MAX_HISTORY = 20;

// ─── zoom presets ─────────────────────────────────────────────────────────────

const ZOOM_PRESETS = [75, 100, 125, 150] as const;
type ZoomPreset = typeof ZOOM_PRESETS[number];

/** Determine the appropriate initial zoom based on viewport width. */
function getInitialZoom(): ZoomPreset {
  if (typeof window !== 'undefined' && window.innerWidth < 900) return 75;
  return 100;
}

// ─── M3.7: block-type label for toolbar context ───────────────────────────────

function getBlockTypeLabel(type: BlockType | null): string {
  if (!type) return '';
  switch (type) {
    case 'section': return 'Heading';
    case 'formula-block': return 'Formula (block)';
    case 'formula-inline': return 'Formula (inline)';
    case 'paragraph': return 'Paragraph';
    case 'list': return 'List';
    case 'table': return 'Table';
    case 'box': return 'Box';
    default: return '';
  }
}

// ─── M3.6: format toolbar ────────────────────────────────────────────────────

interface FormatToolbarProps {
  focusedBlockType: BlockType | null;
  onApplyFormat: (format: FormatAction) => void;
}

type FormatAction =
  | { kind: 'heading'; level: 1 | 2 }
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'math' }
  | { kind: 'boxed' };

function FormatToolbar({ focusedBlockType, onApplyFormat }: FormatToolbarProps) {
  const isTextBlock =
    focusedBlockType === 'paragraph' ||
    focusedBlockType === 'formula-inline' ||
    focusedBlockType === 'section';
  const isMathBlock =
    focusedBlockType === 'formula-block' || focusedBlockType === 'formula-inline';

  const btnBase =
    'px-2 py-1 text-xs rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  const btnActive = 'bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200';
  const btnInactive = 'text-gray-500 hover:text-gray-700 hover:bg-gray-200 border border-transparent';

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 bg-gray-50 shrink-0 flex-wrap">
      {/* M3.7: block type label */}
      {focusedBlockType && (
        <>
          <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mr-1">
            {getBlockTypeLabel(focusedBlockType)}
          </span>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
        </>
      )}

      {/* H1 */}
      <button
        title="Heading 1"
        disabled={!isTextBlock}
        onClick={() => onApplyFormat({ kind: 'heading', level: 1 })}
        className={`${btnBase} ${isTextBlock ? btnInactive : ''}`}
      >
        H1
      </button>

      {/* H2 */}
      <button
        title="Heading 2"
        disabled={!isTextBlock}
        onClick={() => onApplyFormat({ kind: 'heading', level: 2 })}
        className={`${btnBase} ${isTextBlock ? btnInactive : ''}`}
      >
        H2
      </button>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Bold */}
      <button
        title="Bold"
        disabled={!isTextBlock}
        onClick={() => onApplyFormat({ kind: 'bold' })}
        className={`${btnBase} font-bold ${isTextBlock ? btnInactive : ''}`}
      >
        B
      </button>

      {/* Italic */}
      <button
        title="Italic"
        disabled={!isTextBlock}
        onClick={() => onApplyFormat({ kind: 'italic' })}
        className={`${btnBase} italic ${isTextBlock ? btnInactive : ''}`}
      >
        I
      </button>

      {/* Underline */}
      <button
        title="Underline"
        disabled={!isTextBlock}
        onClick={() => onApplyFormat({ kind: 'underline' })}
        className={`${btnBase} underline ${isTextBlock ? btnInactive : ''}`}
      >
        U
      </button>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Math toggle */}
      <button
        title={isMathBlock ? 'Already a formula block' : 'Wrap in inline math $...$'}
        disabled={focusedBlockType === null || focusedBlockType === 'formula-block'}
        onClick={() => onApplyFormat({ kind: 'math' })}
        className={`${btnBase} font-mono ${focusedBlockType && focusedBlockType !== 'formula-block' ? btnInactive : ''}`}
      >
        ∑
      </button>

      {/* Boxed */}
      <button
        title="Wrap in box"
        disabled={!isTextBlock && !isMathBlock}
        onClick={() => onApplyFormat({ kind: 'boxed' })}
        className={`${btnBase} ${isTextBlock || isMathBlock ? btnInactive : ''}`}
      >
        [ ]
      </button>

      {!focusedBlockType && (
        <span className="text-[10px] text-gray-400 ml-1">Click a block to activate formatting</span>
      )}
    </div>
  );
}

// ─── M3.5: contextual menu "Reference in chat" ───────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  selectedText: string;
  blockId: string;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onReference: (blockId: string) => void;
  onClose: () => void;
}

function ContextMenu({ menu, onReference, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Prevent mousedown inside the menu from clearing the browser's native text selection
  function handleMenuMouseDown(e: React.MouseEvent) {
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px]"
      onMouseDown={handleMenuMouseDown}
    >
      <button
        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors"
        onClick={() => {
          onReference(menu.blockId);
          onClose();
        }}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Reference in chat
      </button>
      <button
        className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        onClick={onClose}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Dismiss
      </button>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

interface LatexViewerProps {
  latexSource: string;
  templateId?: string;
  /** Optional CSS class for the outer wrapper */
  className?: string;
  /** When true, the built-in toolbar is hidden (parent manages controls) */
  hideToolbar?: boolean;
  /**
   * M3.5 / F3-M4.2: called when user clicks "Reference in chat".
   * Now receives a BlockReference with full block metadata.
   */
  onReferenceInChat?: (ref: BlockReference) => void;
  /**
   * F3-M4.5: called when "Apply" is used in the chat to replace a block.
   * Provides the current full reconstructed LaTeX so the parent can persist it.
   */
  onLatexChange?: (newLatex: string) => void;
  /**
   * F3-M4.5: apply a block edit from outside (e.g. ChatPanel "Apply" button).
   * Replace block with blockId using newBlockLatex.
   */
  applyBlockEdit?: { blockId: string; newBlockLatex: string; token: number } | null;
  /**
   * Document-level AI edit preview (Flujo C).
   * When non-null, the viewer renders this LaTeX instead of latexSource,
   * and shows an "AI preview" banner at the top of the sheet.
   */
  pendingDocumentEdit?: string | null;
  /**
   * IA-M2: called when a structural block mutation (add, delete, reorder) produces
   * a new full LaTeX string. Unlike onLatexChange (which is used for block AI edits),
   * this callback triggers a direct compile + persist cycle in the parent.
   */
  onBlockMutation?: (newLatex: string) => void;
}

export default function LatexViewer({
  latexSource,
  templateId,
  className,
  hideToolbar = false,
  onReferenceInChat,
  onLatexChange,
  applyBlockEdit,
  pendingDocumentEdit,
  onBlockMutation,
}: LatexViewerProps) {
  // ── Active source: preview takes priority over persisted source ───────────
  const activeLatexSource = pendingDocumentEdit ?? latexSource;

  // ── Parse blocks (mutable state for inline editing) ──────────────────────
  const [blocks, setBlocks] = useState<Block[]>(() => parseLatex(activeLatexSource));

  // ── F3-M4.7: undo/redo history ────────────────────────────────────────────
  // History stores past blocks snapshots; pointer starts at -1 (no history yet)
  const historyRef = useRef<Block[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Mejora C: undo/redo step counts for the toolbar indicator
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Helper to sync undo/redo counts after history mutations
  const syncHistoryCounts = useCallback(() => {
    setUndoCount(historyIndexRef.current + 1);
    setRedoCount(historyRef.current.length - 1 - historyIndexRef.current);
  }, []);

  // Push current blocks to history before a mutation
  const pushHistory = useCallback((snapshot: Block[]) => {
    // Truncate any forward history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    setUndoCount(historyIndexRef.current + 1);
    setRedoCount(0);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setBlocks(snapshot);
    setUndoCount(historyIndexRef.current + 1);
    setRedoCount(historyRef.current.length - 1 - historyIndexRef.current);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setBlocks(snapshot);
    setUndoCount(historyIndexRef.current + 1);
    setRedoCount(historyRef.current.length - 1 - historyIndexRef.current);
  }, []);

  // Keyboard shortcut Ctrl+Z / Ctrl+Y
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  // Re-parse when the active source changes (preview or persisted)
  useEffect(() => {
    const parsed = parseLatex(activeLatexSource);
    setBlocks(parsed);
    // Reset history when a completely new source is loaded
    historyRef.current = [];
    historyIndexRef.current = -1;
    setUndoCount(0);
  }, [activeLatexSource]);

  // ── Template profile ──────────────────────────────────────────────────────
  const profile = useMemo(() => getTemplateProfile(templateId), [templateId]);

  // ── Zoom (persisted across source changes) ────────────────────────────────
  const [zoom, setZoom] = useState<ZoomPreset>(() => getInitialZoom());

  // All blocks are rendered on a single scrollable A4 sheet (no pagination)
  // The page indicator in the toolbar is removed; all blocks visible at once.

  // Scroll-to-block ref (Mejora D)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastEditedBlockIdRef = useRef<string | null>(null);

  // ── M3.1/M3.2/M3.3: interaction state ────────────────────────────────────
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // M3.7: derive focused block type for toolbar
  const focusedBlock = useMemo(
    () => blocks.find((b) => b.id === focusedBlockId) ?? null,
    [blocks, focusedBlockId]
  );
  const focusedBlockType = focusedBlock?.type ?? null;

  // Click-away to blur focus/editing
  const contentRef = useRef<HTMLDivElement>(null);
  // Ref to capture selection text on right-mousedown before the browser can clear it
  const pendingRightClickSelectionRef = useRef<string>('');

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (e.button === 2) {
        // Right-click: capture selection immediately before anything clears it.
        // Do NOT run click-away logic — the contextmenu handler will manage the menu.
        pendingRightClickSelectionRef.current =
          window.getSelection()?.toString().trim() ?? '';
        return;
      }
      // Left/middle click: blur focused block if clicking outside content area
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setFocusedBlockId(null);
        setEditingBlockId(null);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // ── M3.4: confirm edit — re-render block ──────────────────────────────────
  const handleConfirm = useCallback((id: string, newSource: string) => {
    setBlocks((prev) => {
      pushHistory(prev);
      return prev.map((b) => (b.id === id ? { ...b, latex_source: newSource } : b));
    });
    setEditingBlockId(null);
    setFocusedBlockId(id);
  }, [pushHistory]);

  const handleCancelEdit = useCallback((id: string) => {
    setEditingBlockId(null);
    setFocusedBlockId(id);
  }, []);

  // ── IA-M2: block management helpers ──────────────────────────────────────

  /**
   * Reconstruct the full LaTeX from the current block array and notify the parent.
   * Called after every structural mutation (add, delete, reorder).
   * Uses onBlockMutation (IA-M2) if available, otherwise falls back to onLatexChange.
   */
  const commitBlockMutation = useCallback(
    (newBlocks: Block[]) => {
      const notify = onBlockMutation ?? onLatexChange;
      if (notify) {
        const reconstructed = reconstructLatexFromBlocks(newBlocks, activeLatexSource);
        notify(reconstructed);
      }
    },
    [onBlockMutation, onLatexChange, activeLatexSource]
  );

  /**
   * Add a new block of the given type after (position='after') or before
   * (position='before') the block with id `anchorId`.
   */
  const handleAddBlock = useCallback(
    (anchorId: string, type: NewBlockType, position: 'before' | 'after') => {
      setBlocks((prev) => {
        pushHistory(prev);
        const idx = prev.findIndex((b) => b.id === anchorId);
        if (idx === -1) return prev;
        const insertAt = position === 'after' ? idx + 1 : idx;
        const idSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newBlock: Block = {
          id: `${type}-${idSuffix}`,
          type: type === 'formula' ? 'formula-block' : type === 'list' ? 'list' : type === 'section' ? 'section' : 'paragraph',
          latex_source: newBlockLatex(type),
          level: type === 'section' ? 1 : undefined,
        };
        const next = [...prev.slice(0, insertAt), newBlock, ...prev.slice(insertAt)];
        // Defer onLatexChange so state updates first
        setTimeout(() => commitBlockMutation(next), 0);
        return next;
      });
    },
    [pushHistory, commitBlockMutation]
  );

  /** Delete the block with the given id. Cannot delete col-start/col-end markers. */
  const handleDeleteBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        const target = prev.find((b) => b.id === id);
        if (!target || target.type === 'col-start' || target.type === 'col-end') return prev;
        pushHistory(prev);
        const next = prev.filter((b) => b.id !== id);
        setTimeout(() => commitBlockMutation(next), 0);
        return next;
      });
      setFocusedBlockId(null);
      setEditingBlockId(null);
    },
    [pushHistory, commitBlockMutation]
  );

  /**
   * Move the block with `id` up (direction=-1) or down (direction=1) by one position.
   * Skips over col-start/col-end markers to avoid breaking multicols structure.
   */
  const handleMoveBlock = useCallback(
    (id: string, direction: -1 | 1) => {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;

        // Find the target swap index (skip structural markers)
        let targetIdx = idx + direction;
        while (
          targetIdx >= 0 &&
          targetIdx < prev.length &&
          (prev[targetIdx].type === 'col-start' || prev[targetIdx].type === 'col-end')
        ) {
          targetIdx += direction;
        }
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;

        pushHistory(prev);
        const next = [...prev];
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        setTimeout(() => commitBlockMutation(next), 0);
        return next;
      });
    },
    [pushHistory, commitBlockMutation]
  );

  // ── M3.6: apply format action to focused block ────────────────────────────
  const handleApplyFormat = useCallback(
    (format: FormatAction) => {
      if (!focusedBlockId) return;
      setBlocks((prev) => {
        pushHistory(prev);
        return prev.map((b) => {
          if (b.id !== focusedBlockId) return b;
          switch (format.kind) {
            case 'heading':
              // Convert paragraph to section, or change level
              return {
                ...b,
                type: 'section' as BlockType,
                level: format.level,
                // Strip existing \section{} wrapper if present, otherwise use text as-is
                latex_source: b.latex_source
                  .replace(/^\\(?:sub)*section\*?\{([\s\S]*)\}$/, '$1')
                  .trim(),
              };
            case 'bold':
              return { ...b, latex_source: `\\textbf{${b.latex_source}}` };
            case 'italic':
              return { ...b, latex_source: `\\textit{${b.latex_source}}` };
            case 'underline':
              return { ...b, latex_source: `\\underline{${b.latex_source}}` };
            case 'math':
              return {
                ...b,
                type: 'formula-inline' as BlockType,
                latex_source: `$${b.latex_source}$`,
              };
            case 'boxed':
              return {
                ...b,
                type: 'box' as BlockType,
                latex_source: b.latex_source,
              };
            default:
              return b;
          }
        });
      });
    },
    [focusedBlockId, pushHistory]
  );

  // ── M3.5: context menu state ──────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    function handleContextMenu(e: MouseEvent) {
      // Use the live selection first; fall back to what we captured on mousedown
      // (the browser may have cleared the native selection between mousedown and contextmenu)
      const selectedText =
        window.getSelection()?.toString().trim() ||
        pendingRightClickSelectionRef.current;
      pendingRightClickSelectionRef.current = ''; // reset after use

      if (!selectedText || !contentRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      // Find closest block id via DOM traversal
      let el = e.target as HTMLElement | null;
      let blockId = '';
      while (el && el !== contentRef.current) {
        if (el.dataset?.blockId) { blockId = el.dataset.blockId; break; }
        el = el.parentElement;
      }
      setContextMenu({ x: e.clientX, y: e.clientY, selectedText, blockId });
    }
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // ── F3-M4.5: apply block edit from ChatPanel (Mejora E: robust replace) ──
  const appliedTokenRef = useRef<number>(-1);
  useEffect(() => {
    if (!applyBlockEdit) return;
    if (applyBlockEdit.token === appliedTokenRef.current) return;
    appliedTokenRef.current = applyBlockEdit.token;

    setBlocks((prev) => {
      const target = prev.find((b) => b.id === applyBlockEdit.blockId);
      if (!target) return prev;
      pushHistory(prev);
      const next = prev.map((b) =>
        b.id === applyBlockEdit.blockId
          ? { ...b, latex_source: applyBlockEdit.newBlockLatex }
          : b
      );

      // Mejora E: reconstruct full latex by iterating over updated blocks
      // instead of fragile string.replace(). For each block we find its contribution
      // in the original source; for the edited block we substitute the new latex.
      if (onLatexChange) {
        // Strategy: find the block's original latex_source in the full string and
        // replace only the first occurrence that exactly matches (searching from
        // left-to-right in block order reduces the chance of an ambiguous match).
        let reconstructed = activeLatexSource;
        const originalSource = target.latex_source;
        const newSource = applyBlockEdit.newBlockLatex;

        // Robust replace: find the Nth occurrence of the original source, where N is the
        // number of preceding blocks with the same latex_source. This correctly handles
        // documents with duplicate blocks (e.g. two identical formulas or paragraphs).
        const targetIdx = prev.indexOf(target);
        const precedingDuplicates = prev
          .slice(0, targetIdx)
          .filter((b) => b.latex_source === originalSource).length;

        let searchFrom = 0;
        let idx = -1;
        for (let occurrence = 0; occurrence <= precedingDuplicates; occurrence++) {
          const found = reconstructed.indexOf(originalSource, searchFrom);
          if (found === -1) break;
          idx = found;
          searchFrom = found + 1;
        }

        if (idx !== -1) {
          reconstructed =
            reconstructed.slice(0, idx) +
            newSource +
            reconstructed.slice(idx + originalSource.length);
        }
        // If not found at all, latexSource stays unchanged (safer than a broken replace)
        onLatexChange(reconstructed);
      }

      // Mejora D: schedule scroll to the edited block
      lastEditedBlockIdRef.current = applyBlockEdit.blockId;

      return next;
    });
  }, [applyBlockEdit, activeLatexSource, onLatexChange, pushHistory]);

  // Mejora D: scroll to last edited block after blocks state updates
  useEffect(() => {
    const blockId = lastEditedBlockIdRef.current;
    if (!blockId || !scrollContainerRef.current) return;
    lastEditedBlockIdRef.current = null;
    // Use a short rAF delay so the DOM has updated before we query
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-block-id="${blockId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, [blocks]);

  // ── Helper: build BlockReference for a given blockId ─────────────────────
  const buildBlockReference = useCallback(
    (blockId: string): BlockReference | null => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return null;
      const b = blocks[idx];
      const adjacent: BlockReference['adjacentBlocks'] = [];
      for (let d = -2; d <= 2; d++) {
        if (d === 0) continue;
        const nb = blocks[idx + d];
        if (nb && nb.type !== 'col-start' && nb.type !== 'col-end') {
          adjacent.push({ blockId: nb.id, blockType: nb.type, latex_source: nb.latex_source });
        }
      }
      return {
        blockId: b.id,
        blockType: b.type,
        latex_source: b.latex_source,
        adjacentBlocks: adjacent,
        // IA-M1: include parser offsets for robust substitution
        sourceStart: b.sourceStart,
        sourceEnd: b.sourceEnd,
      };
    },
    [blocks]
  );

  if (!latexSource.trim()) {
    return (
      <div className="text-gray-400 italic text-sm p-4">
        No LaTeX source provided.
      </div>
    );
  }

  // Compute CSS custom properties from the nested template profile
  const profileCssVars = {
    '--accent': profile.colors.accentColor,
    '--thm-color': profile.colors.thmColor,
    '--def-color': profile.colors.defColor,
    '--prop-color': profile.colors.propColor,
  } as React.CSSProperties;

  // Derive sheet height from aspectRatio ("W / H" string)
  const [arW, arH] = profile.geometry.aspectRatio.split('/').map((s) => parseFloat(s.trim()));
  const sheetHeightPx = Math.round(profile.geometry.widthPx * (arH / arW));

  // Zoom wrapper: two-div approach so the scroll container sees the correct visual height.
  // Outer div has the scaled dimensions (for correct scroll height calculation).
  // Inner div applies the transform and has the natural sheet dimensions.
  const zoomScale = zoom / 100;
  const zoomOuterStyle: React.CSSProperties = {
    width: profile.geometry.widthPx,
    height: Math.round(sheetHeightPx * zoomScale),
    flexShrink: 0,
    position: 'relative',
  };
  const zoomInnerStyle: React.CSSProperties = {
    transform: `scale(${zoomScale})`,
    transformOrigin: 'top left',
    width: profile.geometry.widthPx,
    height: sheetHeightPx,
    position: 'absolute',
    top: 0,
    left: 0,
  };

  const sheetStyle: React.CSSProperties = {
    width: profile.geometry.widthPx,
    minHeight: sheetHeightPx,
    background: 'white',
    color: '#111111',
    boxShadow: pendingDocumentEdit
      ? '0 4px 32px rgba(0,0,0,0.18), 0 0 0 2px rgba(99,102,241,0.35)'
      : '0 4px 32px rgba(0,0,0,0.18)',
    paddingTop: `${profile.geometry.margins.top}rem`,
    paddingRight: `${profile.geometry.margins.right}rem`,
    paddingBottom: `${profile.geometry.margins.bottom}rem`,
    paddingLeft: `${profile.geometry.margins.left}rem`,
    fontSize: profile.typography.baseFontSize,
    lineHeight: profile.typography.lineSpread,
    fontFamily: profile.typography.fontFamily,
    boxSizing: 'border-box',
    ...profileCssVars,
  };

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      {/* ── Zoom + undo toolbar ── */}
      {!hideToolbar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
          {/* Zoom presets */}
          <div className="flex items-center gap-1">
            {ZOOM_PRESETS.map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  zoom === z
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {z}%
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-gray-300 mx-1" />

          {/* Mejora C: undo step indicator */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={undoCount <= 0}
              title={undoCount > 0 ? `Undo (${undoCount} step${undoCount !== 1 ? 's' : ''} available)` : 'Nothing to undo'}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700 hover:bg-gray-200 disabled:hover:bg-transparent"
              aria-label={`Undo — ${undoCount} step${undoCount !== 1 ? 's' : ''} available`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a4 4 0 010 8H7m-4-8l4-4-4 4z" />
              </svg>
              {undoCount > 0 && (
                <span className="tabular-nums text-[10px] text-indigo-600 font-semibold">{undoCount}</span>
              )}
            </button>
            <button
              onClick={redo}
              disabled={redoCount <= 0}
              title={redoCount > 0 ? `Redo (${redoCount} step${redoCount !== 1 ? 's' : ''} available)` : 'Nothing to redo'}
              aria-label={`Redo — ${redoCount} step${redoCount !== 1 ? 's' : ''} available`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700 hover:bg-gray-200 disabled:hover:bg-transparent"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a4 4 0 000 8h6m4-8l-4-4 4 4z" />
              </svg>
            </button>
          </div>

          {/* Hint */}
          <div className="flex-1" />
          {!focusedBlockId && (
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Click to focus · Double-click to edit
            </span>
          )}
          {focusedBlockId && (
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Double-click to edit · Esc to cancel
            </span>
          )}
        </div>
      )}

      {/* ── M3.6: Format toolbar (only when main toolbar is visible) ── */}
      {!hideToolbar && (
        <FormatToolbar
          focusedBlockType={focusedBlockType}
          onApplyFormat={handleApplyFormat}
        />
      )}

      {/* ── Transparent scroll container → white A4 sheet ── */}
      <div
        className="flex-1 overflow-auto flex justify-center py-6"
        style={{ background: 'transparent' }}
        ref={scrollContainerRef}
      >
        {/* Zoom outer: has the visual (scaled) dimensions so scroll height is correct */}
        <div style={zoomOuterStyle}>
          {/* Zoom inner: applies the CSS transform */}
          <div style={zoomInnerStyle}>
          {/* White A4 / landscape sheet */}
          <div style={sheetStyle} ref={contentRef}>
            {/* AI preview banner — shown when pendingDocumentEdit is active */}
            {pendingDocumentEdit && (
              <div
                style={{
                  margin: `-${profile.geometry.margins.top}rem -${profile.geometry.margins.right}rem 0.75rem -${profile.geometry.margins.left}rem`,
                  padding: '0.35rem 0.75rem',
                  background: 'rgba(238,242,255,0.95)',
                  borderBottom: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <svg
                  style={{ width: '0.875rem', height: '0.875rem', color: 'rgb(99,102,241)', flexShrink: 0 }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span style={{ fontSize: '0.6875rem', color: 'rgb(79,70,229)', fontWeight: 500, fontFamily: 'sans-serif' }}>
                  AI preview — Apply or Discard in the chat
                </span>
              </div>
            )}
            <BlockRegionRenderer
              blocks={blocks}
              hoveredBlockId={hoveredBlockId}
              focusedBlockId={focusedBlockId}
              editingBlockId={editingBlockId}
              onHover={setHoveredBlockId}
              onFocus={setFocusedBlockId}
              onEdit={setEditingBlockId}
              onConfirm={handleConfirm}
              onCancel={handleCancelEdit}
              columnGap={profile.layout.columnGap}
              showColumnRule={profile.layout.showColumnRule}
              columnRuleWidth={profile.layout.columnRuleWidth}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onMoveBlock={handleMoveBlock}
            />
            {blocks.length === 0 && (
              <div className="text-gray-400 italic text-sm">
                Parser returned no blocks. Check the LaTeX source.
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ── M3.5 / F3-M4.2: Context menu ── */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onReference={(blockId) => {
            const ref = buildBlockReference(blockId);
            if (ref) onReferenceInChat?.(ref);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ─── BlockRegionRenderer ──────────────────────────────────────────────────────

interface BlockRegionRendererProps {
  blocks: Block[];
  hoveredBlockId: string | null;
  focusedBlockId: string | null;
  editingBlockId: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
  onEdit: (id: string) => void;
  onConfirm: (id: string, newSource: string) => void;
  onCancel: (id: string) => void;
  columnGap?: string;
  showColumnRule?: boolean;
  columnRuleWidth?: string;
  // IA-M2: block management
  onAddBlock?: (id: string, type: NewBlockType, position: 'before' | 'after') => void;
  onDeleteBlock?: (id: string) => void;
  onMoveBlock?: (id: string, direction: -1 | 1) => void;
}

function BlockRegionRenderer({
  blocks,
  hoveredBlockId,
  focusedBlockId,
  editingBlockId,
  onHover,
  onFocus,
  onEdit,
  onConfirm,
  onCancel,
  columnGap = '1.5rem',
  showColumnRule = false,
  columnRuleWidth = '0',
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
}: BlockRegionRendererProps) {
  // IA-M2: precompute which indices are first/last non-structural blocks for move buttons
  const interactiveIndices = blocks
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => b.type !== 'col-start' && b.type !== 'col-end' && b.type !== 'hr');
  const firstInteractiveIdx = interactiveIndices[0]?.idx ?? -1;
  const lastInteractiveIdx = interactiveIndices[interactiveIndices.length - 1]?.idx ?? -1;

  const regions: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'col-start') {
      const colCount = parseInt(block.latex_source) || 2;
      const inner: React.ReactNode[] = [];
      i++;
      while (i < blocks.length && blocks[i].type !== 'col-end') {
        const b = blocks[i];
        const bIdx = blocks.indexOf(b);
        inner.push(
          <LatexBlock
            key={b.id}
            block={b}
            isHovered={hoveredBlockId === b.id}
            isFocused={focusedBlockId === b.id}
            isEditing={editingBlockId === b.id}
            onHover={onHover}
            onFocus={onFocus}
            onEdit={onEdit}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onAddBlock={onAddBlock}
            onDeleteBlock={onDeleteBlock}
            onMoveBlock={onMoveBlock}
            canMoveUp={bIdx > firstInteractiveIdx}
            canMoveDown={bIdx < lastInteractiveIdx}
          />
        );
        i++;
      }
      regions.push(
        <div
          key={block.id}
          style={{
            columnCount: colCount,
            columnGap,
            columnRule: showColumnRule ? `${columnRuleWidth} solid rgba(80, 80, 80, 0.75)` : 'none',
          }}
          className="w-full"
        >
          {inner}
        </div>
      );
      i++; // skip col-end
    } else if (block.type !== 'col-end') {
      regions.push(
        <LatexBlock
          key={block.id}
          block={block}
          isHovered={hoveredBlockId === block.id}
          isFocused={focusedBlockId === block.id}
          isEditing={editingBlockId === block.id}
          onHover={onHover}
          onFocus={onFocus}
          onEdit={onEdit}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onAddBlock={onAddBlock}
          onDeleteBlock={onDeleteBlock}
          onMoveBlock={onMoveBlock}
          canMoveUp={i > firstInteractiveIdx}
          canMoveDown={i < lastInteractiveIdx}
        />
      );
      i++;
    } else {
      i++;
    }
  }

  return <>{regions}</>;
}
