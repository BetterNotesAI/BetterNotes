// app-api/src/lib/ai/types.ts

export interface AttachmentInput {
  type: string;
  url?: string;
  data?: string;
  name: string;
  mimeType?: string;
  embedInPdf?: boolean;  // true = image that must appear in the final PDF
}

export interface GenerateLatexArgs {
  prompt: string;
  templateId: string;
  preamble: string;
  styleGuide: string;
  structureTemplate: string;
  structureExample: string;
  baseLatex?: string;
  files?: AttachmentInput[];
}

export interface GenerateLatexResult {
  latex?: string;
  message?: string;
  summary?: string;  // breve descripción de lo que fue generado/modificado
}

export interface FixLatexArgs {
  latex: string;
  log: string;
}

// ─── F3-M4.3: block editing ───────────────────────────────────────────────────

export interface AdjacentBlock {
  blockId: string;
  blockType: string;
  latex_source: string;
}

export interface EditBlockArgs {
  blockId: string;
  blockLatex: string;
  blockType: string;
  adjacentBlocks: AdjacentBlock[];
  userPrompt: string;
  /** Full document LaTeX for broader context (may be large — provider can truncate). */
  fullLatex: string;
}

// ─── Document-level AI edit ──────────────────────────────────────────────────

export interface EditDocumentArgs {
  prompt: string;
  fullLatex: string;
  templateId: string;
}

export type EditDocumentResult =
  | { type: 'edit'; latex: string; summary: string }
  | { type: 'message'; content: string };

export interface AIProvider {
  generateLatex(args: GenerateLatexArgs): Promise<GenerateLatexResult>;
  fixLatex(args: FixLatexArgs): Promise<string>;
  /** F3-M4.3: Edit a single block. Returns the modified LaTeX fragment (not compiled). */
  editBlock(args: EditBlockArgs): Promise<string>;
  /** Document-level AI edit. Returns either a full modified LaTeX or a conversational message. */
  editDocument(args: EditDocumentArgs): Promise<EditDocumentResult>;
}
