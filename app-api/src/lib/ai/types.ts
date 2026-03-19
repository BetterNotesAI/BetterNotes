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
}

export interface FixLatexArgs {
  latex: string;
  log: string;
}

export interface AIProvider {
  generateLatex(args: GenerateLatexArgs): Promise<GenerateLatexResult>;
  fixLatex(args: FixLatexArgs): Promise<string>;
}
