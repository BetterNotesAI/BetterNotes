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

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface EditBlockArgs {
  blockId: string;
  blockLatex: string;
  blockType: string;
  adjacentBlocks: AdjacentBlock[];
  userPrompt: string;
  /** Full document LaTeX for broader context (may be large — provider can truncate). */
  fullLatex: string;
  /** Prior conversation turns for this block (user instructions + AI responses). Max ~6 turns. */
  conversationHistory?: ConversationTurn[];
}

// ─── Exam generation ─────────────────────────────────────────────────────────

export interface GenerateExamQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  has_math?: boolean;
}

export interface CognitiveDistribution {
  memory: number;
  logic: number;
  application: number;
}

export interface GenerateExamArgs {
  subject: string;
  level: string;
  language: string;
  distribution: Record<string, number>;
  format: string[];
  documentContext: string;
  cognitiveDistribution?: CognitiveDistribution;
  customInstructions?: string;
}

export interface GenerateExamResult {
  questions: GenerateExamQuestion[];
  canonical_subject?: string;
}

// ─── Math solving ─────────────────────────────────────────────────────────────

export interface SolveMathArgs {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';
  options: string[] | null;
  language: string;
}

export interface SolveMathResult {
  correct_answer: string;
  explanation: string;
}

export interface SolveMathBatchItem {
  index: number;  // position in the original questions array
  question: string;
  type: 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';
  options: string[] | null;
}

export interface SolveMathBatchArgs {
  items: SolveMathBatchItem[];
  language: string;
}

export interface SolveMathBatchResult {
  solutions: Array<{ index: number; correct_answer: string; explanation: string }>;
}

// ─── Fill-in grading ─────────────────────────────────────────────────────────

export interface GradeFillInItem {
  id: string;
  question: string;
  correct_answer: string;
  user_answer: string;
  image_url?: string;
}

export interface GradeFillInArgs {
  items: GradeFillInItem[];
  gradingMode: 'strict' | 'partial';
}

export interface GradeFillInResult {
  scores: Array<{ id: string; score: number }>;
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
  generateExam(args: GenerateExamArgs): Promise<GenerateExamResult>;
  gradeFillIn(args: GradeFillInArgs): Promise<GradeFillInResult>;
  /** Dedicated math solver — resolves a single question using a reasoning-focused model. */
  solveMath(args: SolveMathArgs): Promise<SolveMathResult>;
  /** Batch math solver — resolves all math questions in a single API call. */
  solveMathBatch(args: SolveMathBatchArgs): Promise<SolveMathBatchResult>;
}
