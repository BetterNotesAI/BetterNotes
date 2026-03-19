import OpenAI from 'openai';
import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, AttachmentInput } from './types';
import type { ProcessedAttachment } from '../attachments';

const MAX_FILE_CONTEXT_CHARS = 12000;
const MAX_TOTAL_FILE_CONTEXT_CHARS = 45000;

function stripMarkdownFences(text: string): string {
  const t = text.trim();
  if (t.startsWith('```')) {
    const lines = t.split('\n');
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
    return lines.join('\n').trim();
  }
  return t;
}

function isLatex(text: string): boolean {
  return (
    text.includes('\\documentclass') ||
    text.includes('\\begin{document}') ||
    text.includes('\\section') ||
    text.includes('\\maketitle')
  );
}

function applyLatexFallbacks(latex: string): string {
  // Ensure document is properly terminated
  const trimmed = latex.trim();
  if (!trimmed.endsWith('\\end{document}')) {
    return trimmed + '\n\\end{document}';
  }
  return trimmed;
}

function buildAttachmentContent(
  files: (AttachmentInput | ProcessedAttachment)[]
): { textContext: string; imageItems: Array<{ type: 'image_url'; image_url: { url: string; detail: 'high' } }> } {
  const imageItems: Array<{ type: 'image_url'; image_url: { url: string; detail: 'high' } }> = [];
  const textParts: string[] = [];
  let totalTextChars = 0;

  // Build the embed-image filename instruction block first
  const embedImages = files.filter(
    (f): f is ProcessedAttachment =>
      !!(f as ProcessedAttachment).embedInPdf && (f.mimeType ?? '').startsWith('image/')
  );
  if (embedImages.length > 0) {
    const lines: string[] = [
      '=== IMAGE ATTACHMENTS (embed in document) ===',
      'Reference them in your LaTeX using ONLY these exact filenames:',
    ];
    embedImages.forEach((f, i) => {
      const ext = (f.mimeType ?? 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
      lines.push(`  attachment_${i}.${ext}   (Image ${i + 1}: ${f.name})`);
    });
    lines.push(
      'Use \\includegraphics[width=\\linewidth]{attachment_0.jpg} or similar.',
      'The graphicx package is already loaded in the preamble.',
      'IMPORTANT: use ONLY the normalized filenames above, never the original names.'
    );
    textParts.push(lines.join('\n'));
  }

  for (const file of files) {
    const mimeType = file.mimeType ?? '';
    const processed = file as ProcessedAttachment;

    if (mimeType.startsWith('image/')) {
      if (processed.embedInPdf) {
        // Embed images: pass as image_url for vision so the model can see them
        if (processed.data) {
          imageItems.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${processed.data}`, detail: 'high' } });
        } else if (file.url) {
          imageItems.push({ type: 'image_url', image_url: { url: file.url, detail: 'high' } });
        }
      } else {
        // Vision-only images: pass as image_url
        if (processed.data) {
          imageItems.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${processed.data}`, detail: 'high' } });
        } else if (file.url) {
          imageItems.push({ type: 'image_url', image_url: { url: file.url, detail: 'high' } });
        }
      }
    } else if (totalTextChars < MAX_TOTAL_FILE_CONTEXT_CHARS) {
      // Prefer extractedText (from pdf-parse / mammoth); fall back to raw data field
      const rawText = processed.extractedText ?? file.data;
      if (rawText) {
        const snippet = rawText.slice(0, MAX_FILE_CONTEXT_CHARS);
        textParts.push(`=== File: ${file.name} ===\n${snippet}${snippet.length < rawText.length ? '\n[truncated]' : ''}`);
        totalTextChars += snippet.length;
      }
    }
  }

  const header = textParts.length > 0 ? '=== ATTACHED CONTEXT FILES ===' : '';
  const body = textParts.join('\n\n');
  const textContext = header ? `${header}\n${body}` : '';

  return { textContext, imageItems };
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateLatex(args: GenerateLatexArgs): Promise<GenerateLatexResult> {
    const system = [
      'You are BetterNotes AI, an expert academic assistant specialised in generating LaTeX documents.',
      'Your ONLY output is either a complete, compilable LaTeX document OR a short plain-text message (never both).',
      'RULES:',
      '- If the request implies a document topic, output a COMPLETE .tex file — no explanations, no markdown, no triple backticks.',
      '- If the user is just chatting (e.g. \'hi\', \'thanks\'), reply with a short plain-text message only.',
      '- CRITICAL: NEVER redefine \\newtheorem, \\newcommand, \\usepackage for anything already in the provided preamble.',
      '- CRITICAL: The preamble is FINAL. Work within its constraints — do NOT add \\usepackage commands.',
      '- CRITICAL: NEVER nest display math environments: do not put \\begin{equation*} inside \\[ ... \\].',
      '- CRITICAL: Always close every \\begin{env} with \\end{env} before closing the enclosing environment.',
      '- CRITICAL: Use the STRUCTURE TEMPLATE as your blueprint — replace % FILL: comments with real content.',
      '- CRITICAL: The STRUCTURE EXAMPLE shows formatting style only — DO NOT copy its content.',
      '- NEVER output triple backticks.',
      '- In titles/headings, use \\& for ampersand, not bare &.',
    ].join(' ');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
      { role: 'system', content: system },
    ];

    let textPrompt: string;

    if (args.baseLatex?.trim()) {
      // Refinement mode: inject previous LaTeX as the assistant's prior output
      messages.push({ role: 'assistant', content: args.baseLatex });
      textPrompt = [
        `Revise the LaTeX document above according to this request: "${args.prompt}"`,
        'Return the FULL updated document (same preamble and structure).',
        'Apply the change explicitly — do NOT return the document unchanged.',
        'Preserve the style, preamble, and layout unless explicitly asked to change them.',
      ].join(' ');
    } else {
      textPrompt = [
        `User request: "${args.prompt}"`,
        '',
        'Decision: if this is casual conversation, reply with ONLY a short plain-text message.',
        'Otherwise, generate a COMPLETE LaTeX document.',
        '',
        '=== REQUIRED PREAMBLE (copy VERBATIM before \\begin{document}) ===',
        args.preamble,
        '',
        '=== STYLE GUIDE (follow exactly) ===',
        args.styleGuide,
        '',
        '=== STRUCTURE TEMPLATE (use this skeleton — replace % FILL: comments with real content) ===',
        args.structureTemplate,
        '',
        '=== STRUCTURE EXAMPLE (reference for formatting style ONLY — DO NOT copy this content) ===',
        args.structureExample,
        '',
        'Generate the complete .tex document with REAL, DETAILED, HIGH-QUALITY academic content.',
        'Do NOT copy or paraphrase the example content — create original content for the requested topic.',
      ].join('\n');
    }

    // Build user message content array
    const userContent: any[] = [{ type: 'text', text: textPrompt }];

    if (args.files && args.files.length > 0) {
      const { textContext, imageItems } = buildAttachmentContent(args.files);
      if (textContext) {
        userContent[0].text += `\n\n${textContext}`;
      }
      for (const img of imageItems) {
        userContent.push(img);
      }
    }

    messages.push({ role: 'user', content: userContent });

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages,
    });

    const raw = resp.choices?.[0]?.message?.content ?? '';
    const out = stripMarkdownFences(raw);

    if (isLatex(out)) {
      let latex = out;
      // If there's no preamble (AI only output body), prepend it
      if (!args.baseLatex && !latex.includes('\\documentclass')) {
        latex = `${args.preamble}\n\n${latex}`;
      }
      return { latex: applyLatexFallbacks(latex) };
    }

    // Short conversational reply
    if (!out.includes('\\') && out.length < 600) {
      return { message: out };
    }

    // Fallback: treat as LaTeX if it contains backslashes
    if (out.includes('\\')) {
      return { latex: applyLatexFallbacks(out) };
    }

    return { message: out };
  }

  async fixLatex(args: FixLatexArgs): Promise<string> {
    const system = [
      'You are BetterNotes AI. Output ONLY LaTeX source (no Markdown, no explanations).',
      'Fix the LaTeX so it compiles with pdflatex. Make the smallest changes necessary.',
      'CRITICAL: If \'Environment ... undefined\', REPLACE with standard environment or remove.',
      'CRITICAL: If \'Command ... already defined\', REMOVE the re-definition.',
      'NEVER output triple backticks.',
    ].join(' ');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Fix this LaTeX:\n\n${args.latex}\n\nCompiler log:\n${args.log}\n\nReturn the FULL corrected LaTeX.`,
        },
      ],
    });

    return stripMarkdownFences(resp.choices?.[0]?.message?.content ?? '');
  }
}
