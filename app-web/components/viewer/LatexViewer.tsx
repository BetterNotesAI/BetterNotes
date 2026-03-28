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
import { parseLatex } from '@/lib/latex-parser';
import type { Block, BlockType } from '@/lib/latex-parser';
import LatexBlock from './LatexBlock';

// ─── F3-M4.2: BlockReference type ────────────────────────────────────────────

export interface BlockReference {
  blockId: string;
  blockType: string;
  latex_source: string;
  /** Up to 2 blocks before/after for AI context */
  adjacentBlocks: Array<{ blockId: string; blockType: string; latex_source: string }>;
}

// ─── F3-M4.7: undo/redo history ──────────────────────────────────────────────

const MAX_HISTORY = 20;

// ─── template layout config ───────────────────────────────────────────────────

const BLOCKS_PER_PAGE: Record<string, number> = {
  lecture_notes: 12,
  '2cols_portrait': 16,
  study_form: 20,
  landscape_3col_maths: 20,
};
const DEFAULT_BLOCKS_PER_PAGE = 15;

function getLayoutClass(templateId: string | undefined): string {
  switch (templateId) {
    case 'lecture_notes':
      return 'max-w-2xl mx-auto';
    case '2cols_portrait':
      return 'grid grid-cols-2 gap-x-6 items-start max-w-5xl mx-auto';
    case 'study_form':
      return 'grid grid-cols-3 gap-x-5 items-start max-w-6xl mx-auto';
    case 'landscape_3col_maths':
      return 'grid grid-cols-3 gap-x-5 items-start w-full';
    default:
      return 'max-w-2xl mx-auto';
  }
}

// ─── zoom presets ─────────────────────────────────────────────────────────────

const ZOOM_PRESETS = [75, 100, 125, 150] as const;
type ZoomPreset = typeof ZOOM_PRESETS[number];

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
}

export default function LatexViewer({
  latexSource,
  templateId,
  className,
  hideToolbar = false,
  onReferenceInChat,
  onLatexChange,
  applyBlockEdit,
}: LatexViewerProps) {
  // ── Parse blocks (mutable state for inline editing) ──────────────────────
  const [blocks, setBlocks] = useState<Block[]>(() => parseLatex(latexSource));

  // ── F3-M4.7: undo/redo history ────────────────────────────────────────────
  // History stores past blocks snapshots; pointer starts at -1 (no history yet)
  const historyRef = useRef<Block[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Push current blocks to history before a mutation
  const pushHistory = useCallback((snapshot: Block[]) => {
    // Truncate any forward history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setBlocks(snapshot);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setBlocks(snapshot);
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

  // Re-parse when external source changes
  useEffect(() => {
    const parsed = parseLatex(latexSource);
    setBlocks(parsed);
    // Reset history when a completely new source is loaded
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, [latexSource]);

  // ── Pagination & zoom ─────────────────────────────────────────────────────
  const blocksPerPage = BLOCKS_PER_PAGE[templateId ?? ''] ?? DEFAULT_BLOCKS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(blocks.length / blocksPerPage));

  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<ZoomPreset>(100);

  const goToPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToNext = useCallback(
    () => setPage((p) => Math.min(totalPages, p + 1)),
    [totalPages]
  );

  // Reset page when source changes
  useEffect(() => {
    setPage(1);
  }, [latexSource]);

  const pageBlocks = useMemo(() => {
    const start = (page - 1) * blocksPerPage;
    return blocks.slice(start, start + blocksPerPage);
  }, [blocks, page, blocksPerPage]);

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

  // ── F3-M4.5: apply block edit from ChatPanel ─────────────────────────────
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
      // Notify parent so it can reconstruct the full latex and persist
      if (onLatexChange) {
        // Reconstruct full latex: replace the old block latex_source in latexSource
        const newFullLatex = latexSource.replace(
          target.latex_source,
          applyBlockEdit.newBlockLatex
        );
        onLatexChange(newFullLatex);
      }
      return next;
    });
  }, [applyBlockEdit, latexSource, onLatexChange, pushHistory]);

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
      return { blockId: b.id, blockType: b.type, latex_source: b.latex_source, adjacentBlocks: adjacent };
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

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      {/* ── Navigation + zoom toolbar ── */}
      {!hideToolbar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
          {/* Page navigation */}
          <button
            onClick={goToPrev}
            disabled={page <= 1}
            className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800
              text-sm transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-gray-500 text-xs tabular-nums whitespace-nowrap min-w-[52px] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={goToNext}
            disabled={page >= totalPages}
            className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800
              text-sm transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            ›
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-gray-300 mx-1" />

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

          {/* Hint when no block is focused */}
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

      {/* ── M3.6: Format toolbar — always visible, context-aware ── */}
      <FormatToolbar
        focusedBlockType={focusedBlockType}
        onApplyFormat={handleApplyFormat}
      />

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto" ref={contentRef}>
        <div style={{ fontSize: `${zoom}%` }} className="px-6 py-5 font-sans text-gray-900">
          <BlockRegionRenderer
            blocks={pageBlocks}
            hoveredBlockId={hoveredBlockId}
            focusedBlockId={focusedBlockId}
            editingBlockId={editingBlockId}
            onHover={setHoveredBlockId}
            onFocus={setFocusedBlockId}
            onEdit={setEditingBlockId}
            onConfirm={handleConfirm}
            onCancel={handleCancelEdit}
          />
          {pageBlocks.length === 0 && (
            <div className="text-gray-400 italic text-sm">
              Parser returned no blocks. Check the LaTeX source.
            </div>
          )}
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
}: BlockRegionRendererProps) {
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
          />
        );
        i++;
      }
      regions.push(
        <div
          key={block.id}
          style={{ columnCount: colCount, columnGap: '1.5rem' }}
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
        />
      );
      i++;
    } else {
      i++;
    }
  }

  return <>{regions}</>;
}
