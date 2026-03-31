import OpenAI from 'openai';
import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, EditBlockArgs, EditDocumentArgs, EditDocumentResult, AttachmentInput, ConversationTurn } from './types';
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
      'IMPORTANT: Add \\usepackage{graphicx} and \\usepackage{float} to the preamble.',
      'Use \\begin{figure}[H] (capital H, from float package) to force exact placement.',
      'Example: \\begin{figure}[H]\\centering\\includegraphics[width=0.9\\linewidth]{FILENAME}\\caption{...}\\end{figure}',
      'Replace FILENAME with the exact normalized filename listed above.',
      'IMPORTANT: use ONLY the normalized filenames listed above, never the original file names.'
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
      '- When generating or modifying a document, add ONE line at the very start of your output: [SUMMARY: <what you created or changed, plain English, max 30 words>]',
      '- This [SUMMARY: ...] line must be the absolute first line, before \\documentclass.',
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

    // Extract optional [SUMMARY: ...] prefix
    const summaryMatch = out.match(/^\[SUMMARY:\s*(.+?)\]\s*\r?\n?/);
    const summary = summaryMatch?.[1]?.trim();
    const outWithoutSummary = summaryMatch ? out.slice(summaryMatch[0].length) : out;

    if (isLatex(outWithoutSummary)) {
      let latex = outWithoutSummary;
      // If there's no preamble (AI only output body), prepend it
      if (!args.baseLatex && !latex.includes('\\documentclass')) {
        latex = `${args.preamble}\n\n${latex}`;
      }
      return { latex: applyLatexFallbacks(latex), summary };
    }

    // Short conversational reply
    if (!outWithoutSummary.includes('\\') && outWithoutSummary.length < 600) {
      return { message: outWithoutSummary };
    }

    // Fallback: treat as LaTeX if it contains backslashes
    if (outWithoutSummary.includes('\\')) {
      return { latex: applyLatexFallbacks(outWithoutSummary), summary };
    }

    return { message: outWithoutSummary };
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

  // ─── F3-M4.3: editBlock ───────────────────────────────────────────────────

  // ─── Document-level AI edit ──────────────────────────────────────────────

  async editDocument(args: EditDocumentArgs): Promise<EditDocumentResult> {
    const system = [
      'You are BetterNotes AI, an expert LaTeX document editor.',
      'You receive the FULL LaTeX source of a document and a user instruction.',
      'Classify the instruction and respond ONLY with a valid JSON object (no markdown, no backticks).',
      '',
      'CLASSIFICATION RULES:',
      '- If the user asks to modify, add, remove, translate, rewrite, reformat, or change document content → respond with:',
      '  {"type":"edit","latex":"<FULL modified LaTeX document>","summary":"<one sentence describing what changed>"}',
      '- If the user asks a question, requests an explanation, or is chatting → respond with:',
      '  {"type":"message","content":"<your answer>"}',
      '',
      'EDIT RULES:',
      '- The "latex" field must be the COMPLETE .tex document — not a fragment.',
      '- Preserve the preamble, \\documentclass, and overall structure unless the instruction explicitly asks to change them.',
      '- Apply the change precisely and minimally.',
      '- "summary" must be a short plain-English sentence (max 20 words) describing what changed.',
      '',
      'OUTPUT: Valid JSON only. No markdown fences. No explanation outside the JSON.',
    ].join('\n');

    // Truncate fullLatex to avoid token explosion (~80k chars ≈ 20k tokens)
    const MAX_LATEX_CHARS = 80_000;
    const truncatedLatex = args.fullLatex.length > MAX_LATEX_CHARS
      ? args.fullLatex.slice(0, MAX_LATEX_CHARS) + '\n% [truncated]'
      : args.fullLatex;

    const userContent = [
      `=== CURRENT DOCUMENT LaTeX ===`,
      truncatedLatex,
      '',
      `=== USER INSTRUCTION ===`,
      args.prompt,
    ].join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content ?? '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: treat as a conversational message if JSON parse fails
      return { type: 'message', content: raw.slice(0, 500) };
    }

    if (parsed.type === 'edit' && typeof parsed.latex === 'string') {
      const latex = stripMarkdownFences(parsed.latex).trim();
      const summary = typeof parsed.summary === 'string'
        ? parsed.summary.trim()
        : 'Document updated';
      return { type: 'edit', latex, summary };
    }

    if (parsed.type === 'message' && typeof parsed.content === 'string') {
      return { type: 'message', content: parsed.content.trim() };
    }

    // Unexpected shape — treat as conversational
    return { type: 'message', content: 'I could not process that request. Please try again.' };
  }

  // ─── F3-M4.3: editBlock ───────────────────────────────────────────────────

  async editBlock(args: EditBlockArgs): Promise<string> {
    const system = [
      'You are BetterNotes AI, an expert LaTeX editor.',
      'You will receive a single LaTeX block (fragment) and a user instruction.',
      'There may also be a prior conversation history for refinements to the same block.',
      'OUTPUT RULES:',
      '- Return ONLY the modified LaTeX fragment — not the full document.',
      '- Do NOT include \\documentclass, \\begin{document}, or any preamble.',
      '- Do NOT wrap the output in markdown fences or backticks.',
      '- Preserve the block type: if it is a formula-block, keep it as a formula-block; if it is a paragraph, keep it as a paragraph; etc.',
      '- Apply the user instruction precisely and minimally — change only what is asked.',
      '- When there is conversation history, the most recent assistant turn represents the current state of the block; apply the new instruction on top of it.',
      '- If the instruction is unclear or impossible, return the original block unchanged.',
      '- NEVER output explanations, only LaTeX source.',
    ].join('\n');

    const adjacentContext =
      args.adjacentBlocks.length > 0
        ? '\n\n=== ADJACENT BLOCKS (for context only — do NOT modify) ===\n' +
          args.adjacentBlocks
            .map((b) => `[${b.blockType}] ${b.latex_source}`)
            .join('\n---\n')
        : '';

    // Truncate fullLatex to ~3000 chars to avoid token explosion
    const fullLatexSnippet = args.fullLatex
      ? `\n\n=== FULL DOCUMENT (first 3000 chars, context only) ===\n${args.fullLatex.slice(0, 3000)}`
      : '';

    // Build the initial user message with block + context (sent before any history)
    const initialUserContent = [
      `=== BLOCK TO EDIT (type: ${args.blockType}) ===`,
      args.blockLatex,
      adjacentContext,
      fullLatexSnippet,
    ].join('\n');

    // Build message array: system → initial context → history turns → current instruction
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: system },
      { role: 'user', content: initialUserContent },
    ];

    // Inject prior conversation turns (max 6 to keep token cost low)
    const history: ConversationTurn[] = args.conversationHistory ?? [];
    const recentHistory = history.slice(-6);
    for (const turn of recentHistory) {
      messages.push({ role: turn.role, content: turn.content });
    }

    // Append the new instruction as the latest user message
    messages.push({
      role: 'user',
      content: [
        `=== USER INSTRUCTION ===`,
        args.userPrompt,
        '',
        'Return ONLY the modified block LaTeX — nothing else.',
      ].join('\n'),
    });

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages,
    });

    const raw = resp.choices?.[0]?.message?.content ?? '';
    return stripMarkdownFences(raw).trim();
  }
}
