/**
 * katex-macros.ts
 * Shared KaTeX custom macro definitions.
 * Extracted from LatexBlock.tsx so both LatexBlock and ChatPanel
 * use the same macro set without duplication.
 */

export const KATEX_MACROS: Record<string, string> = {
  '\\dd': '\\mathrm{d}',
  '\\real': '\\mathbb{R}',
  '\\cplex': '\\mathbb{C}',
};
