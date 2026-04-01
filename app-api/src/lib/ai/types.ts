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

// ─── Exam generation ──────────────────────────────────────────────────────────

export interface GenerateExamQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  has_math?: boolean;
}

export interface CognitiveDistribution {
  memory: number;       // 0-100
  logic: number;        // 0-100
  application: number;  // 0-100
}

export interface GenerateExamArgs {
  subject: string;           // puede estar vacío si hay documentContext
  level: string;             // 'beginner' | 'intermediate' | 'advanced'
  language: string;
  distribution: Record<string, number>;  // { multiple_choice: 4, true_false: 3, fill_in: 3 }
  format: string[];
  documentContext: string;   // contenido de documentos (puede estar vacío)
  cognitiveDistribution?: CognitiveDistribution;
  customInstructions?: string;
}

export interface GenerateExamResult {
  questions: GenerateExamQuestion[];
  canonical_subject?: string;
}

// ─── Fill-in grading ──────────────────────────────────────────────────────────

export interface GradeFillInItem {
  id: string;
  question: string;
  correct_answer: string;
  user_answer: string;
  /** Optional: public URL of a photo of the student's handwritten work. When present, GPT-4o vision is used. */
  image_url?: string;
}

export interface GradeFillInArgs {
  items: GradeFillInItem[];
  gradingMode: 'strict' | 'partial';
}

export interface GradeFillInResult {
  scores: Array<{ id: string; score: number }>;
}

export interface AIProvider {
  generateLatex(args: GenerateLatexArgs): Promise<GenerateLatexResult>;
  fixLatex(args: FixLatexArgs): Promise<string>;
  /** F3-M4.3: Edit a single block. Returns the modified LaTeX fragment (not compiled). */
  editBlock(args: EditBlockArgs): Promise<string>;
  generateExam(args: GenerateExamArgs): Promise<GenerateExamResult>;
  gradeFillIn(args: GradeFillInArgs): Promise<GradeFillInResult>;
}
