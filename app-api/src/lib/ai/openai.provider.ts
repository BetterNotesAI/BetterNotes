import OpenAI from 'openai';
import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, EditBlockArgs, EditDocumentArgs, EditDocumentResult, AttachmentInput, ConversationTurn, GenerateExamArgs, GenerateExamResult, GenerateExamQuestion, GradeFillInArgs, GradeFillInResult, SolveMathArgs, SolveMathResult, SolveMathBatchArgs, SolveMathBatchResult } from './types';
import type { ProcessedAttachment } from '../attachments';
import { recordModelUsage } from '../usage/tracker';

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

/**
 * Restore LaTeX control chars that the OpenAI SDK already decoded from the HTTP JSON.
 * The SDK converts \f→form-feed (ASCII 12), \t→tab, \v→vert-tab, \b→backspace.
 * NOTE: /[\b]/ (char class) matches backspace; /\b/ (outside) is word-boundary!
 */
function restoreLatexControlChars(s: string): string {
  return s
    .replace(/\f([a-zA-Z])/g, '\\f$1')
    .replace(/\t([a-zA-Z])/g, '\\t$1')
    .replace(/\v([a-zA-Z])/g, '\\v$1')
    .replace(/[\b]([a-zA-Z])/g, '\\b$1');
}

/**
 * Pre-parse sanitizer: doubles lone backslashes that are not valid JSON escape sequences.
 * Consumes both characters of each \X pair so that the second backslash of an already-
 * doubled \\ is never accidentally re-doubled (which would corrupt valid \\alpha → \\\alpha).
 * Valid JSON escapes kept as-is: \" \\ \/ \b \f \n \r \t
 * Everything else (e.g. \alpha, \underbrace, \,) is doubled to \\alpha, \\underbrace, \\,
 */
function sanitizeLatexInJsonString(raw: string): string {
  return raw.replace(/\\([\s\S])/g, (_match, next: string) => {
    if ('"\\\/bfnrt'.includes(next)) return '\\' + next; // valid JSON escape — keep
    return '\\\\' + next;                                  // lone backslash — double it
  });
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

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content.map((item) => contentToText(item)).join('\n');
  }

  if (content && typeof content === 'object') {
    const maybe = content as Record<string, unknown>;
    if (typeof maybe.text === 'string') return maybe.text;
    if (typeof maybe.content === 'string') return maybe.content;
    return JSON.stringify(maybe);
  }

  return '';
}

function estimateTokensFromText(text: string): number {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

type ChatCompletionRequest = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  max_completion_tokens?: number;
};

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  if ('message' in error) return String(error.message ?? '').toLowerCase();
  return '';
}

function indicatesUnsupportedTokenParam(error: unknown, param: 'max_tokens' | 'max_completion_tokens'): boolean {
  const message = getErrorMessage(error);
  if (!message) return false;
  return (
    message.includes('unsupported parameter')
    && message.includes(param)
    && message.includes('not supported')
  );
}

function swapTokenLimitParam(
  request: ChatCompletionRequest,
  targetParam: 'max_tokens' | 'max_completion_tokens',
): ChatCompletionRequest | null {
  const mutable = { ...request } as ChatCompletionRequest & { max_tokens?: number };

  if (targetParam === 'max_completion_tokens') {
    if (typeof mutable.max_tokens !== 'number') return null;
    if (typeof mutable.max_completion_tokens !== 'number') {
      mutable.max_completion_tokens = mutable.max_tokens;
    }
    delete mutable.max_tokens;
    return mutable;
  }

  if (typeof mutable.max_completion_tokens !== 'number') return null;
  if (typeof mutable.max_tokens !== 'number') {
    mutable.max_tokens = mutable.max_completion_tokens;
  }
  delete mutable.max_completion_tokens;
  return mutable;
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
  private providerName: string;

  /**
   * @param apiKey   API key for the provider
   * @param model    Model ID to use
   * @param baseURL  Optional base URL for OpenAI-compatible providers
   *                 (Groq, OpenRouter, Google AI Studio, etc.)
   */
  constructor(apiKey: string, model = 'gpt-5.4-nano', baseURL?: string, providerName = 'openai') {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    this.model = model;
    this.providerName = providerName;
  }

  private async createChatCompletion(
    request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    feature: string,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let effectiveRequest = request as ChatCompletionRequest;
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await this.client.chat.completions.create(effectiveRequest as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    } catch (error) {
      const shouldRetryWithMaxCompletionTokens =
        indicatesUnsupportedTokenParam(error, 'max_tokens')
        && typeof (effectiveRequest as { max_tokens?: number }).max_tokens === 'number';

      const shouldRetryWithMaxTokens =
        indicatesUnsupportedTokenParam(error, 'max_completion_tokens')
        && typeof effectiveRequest.max_completion_tokens === 'number';

      const retryRequest = shouldRetryWithMaxCompletionTokens
        ? swapTokenLimitParam(effectiveRequest, 'max_completion_tokens')
        : shouldRetryWithMaxTokens
        ? swapTokenLimitParam(effectiveRequest, 'max_tokens')
        : null;

      if (!retryRequest) {
        throw error;
      }

      effectiveRequest = retryRequest;
      response = await this.client.chat.completions.create(effectiveRequest as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    }

    const estimatedPromptTokens = Array.isArray(effectiveRequest.messages)
      ? effectiveRequest.messages.reduce((acc, message) => acc + estimateTokensFromText(contentToText(message.content)), 0)
      : 0;
    const estimatedCompletionTokens = estimateTokensFromText(response.choices?.[0]?.message?.content ?? '');
    const usagePayload = response.usage ?? {
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      prompt_tokens_details: { cached_tokens: 0 },
    };

    await recordModelUsage({
      provider: this.providerName,
      model: this.model,
      usage: usagePayload,
      feature,
      metadata: { usage_estimated: !response.usage },
    });

    return response;
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

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0.2,
      messages,
    }, 'generate_latex');

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

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Fix this LaTeX:\n\n${args.latex}\n\nCompiler log:\n${args.log}\n\nReturn the FULL corrected LaTeX.`,
        },
      ],
    }, 'fix_latex');

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
      '- COLOR RULE: To color equations or text in the interactive viewer (KaTeX renderer), always use \\textcolor{colorname}{content} — e.g. \\textcolor{red}{E=mc^2}. NEVER write colorname{content} without the backslash and \\textcolor command.',
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

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }, 'edit_document');

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
      'COLOR RULES (for the interactive viewer — uses KaTeX):',
      '- To color a formula or part of it, use \\textcolor{colorname}{content} — e.g. \\textcolor{red}{E=mc^2}.',
      '- Valid color names: red, blue, green, orange, purple, cyan, magenta, brown, gray, black, white, or any CSS/HTML color name.',
      '- NEVER write just the color name followed by braces like red{...} — always include the backslash: \\textcolor{red}{...}.',
      '- For coloring text in a paragraph block, use \\textcolor{colorname}{text}.',
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

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0.2,
      messages,
    }, 'edit_block');

    const raw = resp.choices?.[0]?.message?.content ?? '';
    return stripMarkdownFences(raw).trim();
  }

  async generateExam(args: GenerateExamArgs): Promise<GenerateExamResult> {
    const LEVEL_DESCRIPTIONS: Record<string, string> = {
      secondary_basic:
        'foundational vocabulary, simple definitions, and direct recall of facts — suitable for students aged 12–14 with no prior study of the topic; avoid complex sentences or multi-step reasoning',
      secondary_intermediate:
        'understanding of core concepts, basic cause-and-effect relationships, and simple application to familiar examples — suitable for students aged 13–16 who have studied the topic in class',
      secondary_advanced:
        'comparison and analysis of concepts, interpretation of diagrams or data, and application to slightly novel scenarios — suitable for strong secondary students preparing for end-of-year exams',
      highschool_basic:
        'recall and comprehension of curriculum content — suitable for high-school students (15–17) revisiting material; questions should be clear and direct with no ambiguous wording',
      highschool_intermediate:
        'application and analysis of high-school curriculum concepts, including multi-step reasoning, interpretation of evidence, and connections between topics — typical exam difficulty',
      highschool_advanced:
        'synthesis, evaluation, and deep analytical thinking — suitable for high-school students preparing for university-entrance exams (e.g. A-Levels, IB, Selectivitat); expect edge cases and precise technical language',
      university_basic:
        'introductory university-level content — foundational theories, key terminology, and straightforward application; suitable for first-year students encountering the subject for the first time',
      university_intermediate:
        'intermediate university difficulty — multi-concept integration, quantitative reasoning, critical evaluation of arguments, and application to real-world or research contexts',
      university_advanced:
        'advanced university and graduate-level mastery — nuanced analysis, identification of assumptions and limitations, comparison of competing theories, and synthesis of cross-disciplinary knowledge; expect expert-level precision',
    };

    const { subject, level, language, distribution, format, documentContext, cognitiveDistribution, customInstructions } = args;

    const totalQuestions = Object.values(distribution).reduce((s, n) => s + n, 0);

    const distributionLines = Object.entries(distribution)
      .map(([t, n]) => `  - ${n} question${n !== 1 ? 's' : ''} of type "${t}"`)
      .join('\n');

    const typeRules: string[] = [];
    if (format.includes('multiple_choice')) {
      typeRules.push('• multiple_choice: "options" must be an array of exactly 4 distinct strings (only one correct); "correct_answer" must be the full text of the correct option — it must match one of the strings in "options" exactly.');
    }
    if (format.includes('true_false')) {
      typeRules.push('• true_false: "options" must be null; "correct_answer" must be exactly "True" or "False".');
    }
    if (format.includes('fill_in')) {
      typeRules.push('• fill_in: "options" must be null; "correct_answer" must be the canonical word or short phrase.');
    }
    if (format.includes('flashcard')) {
      typeRules.push('• flashcard: "options" must be null; "correct_answer" must be a concise but complete answer (1–3 sentences) that makes sense when shown on the back of a flashcard.');
    }
    typeRules.push(
      '• COHERENCE RULE (applies to non-math questions only): the value of "correct_answer" must be the exact same answer that "explanation" concludes as correct. Never let these two fields disagree.',
      '• MATH DELEGATION RULE: for any question where "has_math" is true — set "correct_answer" to "" and "explanation" to "". A dedicated math solver will fill them in. Do NOT attempt to solve, verify, or provide an answer for math questions. Only write the question statement and, for multiple_choice, 4 plausible options.',
      '• For multiple_choice math questions: you MUST generate exactly 4 distinct, plausible distractor options. Even though "correct_answer" will be empty, the options array is required so the solver can identify which one is correct.'
    );

    const levelDesc = LEVEL_DESCRIPTIONS[level] ?? level;

    const systemMessage =
      'You are an expert educator and exam designer. You always respond with a valid JSON object and nothing else — no markdown, no prose, no code fences.' +
      ' MATH QUESTIONS (has_math: true): write only the question statement and, for multiple_choice, the 4 options. Leave "correct_answer" and "explanation" as empty strings — a dedicated math solver will complete them. Do NOT attempt to solve math questions yourself.' +
      ' NON-MATH QUESTIONS: provide full "correct_answer" and "explanation" as normal.' +
      ' LATEX MATH FORMAT (applies to question text, options, correct_answer and explanation): ALWAYS use single dollar signs $...$ for ALL mathematical expressions — inline or display. NEVER use double dollar signs $$...$$. Examples: $x^3$, $\\frac{1}{2}$, $\\int_0^1 x\\,dx$, $f(x) = x^2 + 3x$. Even full equations must use single $...$. Plain prose must never be wrapped in $...$. NEVER use spacing commands like \\, \\; \\! inside math — they cause JSON errors.' +
      ' CRITICAL JSON RULE: inside JSON string values ALL LaTeX backslash commands MUST use a double backslash. Write \\\\frac, \\\\sqrt, \\\\sum, \\\\int, \\\\alpha, \\\\beta, \\\\times, \\\\cdot, \\\\vec, \\\\hat, \\\\bar, \\\\left, \\\\right, \\\\text, \\\\mathrm, \\\\lim, \\\\infty, \\\\partial, \\\\nabla, \\\\pm, \\\\leq, \\\\geq, \\\\neq, \\\\approx, \\\\equiv, \\\\in, \\\\subset, \\\\cup, \\\\cap, \\\\forall, \\\\exists — never a single backslash. A single \\f in JSON is a form-feed control character, not the LaTeX \\frac command. Always double every backslash in JSON string values.';

    const taskLine = documentContext
      ? [
          'Create an exam based strictly on the document content provided below.',
          subject ? `Focus specifically on: "${subject}".` : '',
          'GROUNDING RULE: every single question must be fully answerable using ONLY the provided document — no outside knowledge. If the document does not contain enough material for a question type, use simpler questions that are still grounded.',
        ].filter(Boolean).join(' ')
      : `Create an exam about "${subject}".`;

    const contentSection = documentContext
      ? `\nSOURCE DOCUMENTS (base all questions exclusively on this content — do not use outside knowledge):\n${documentContext}\n`
      : '';

    const userMessage = `${taskLine}

LANGUAGE: Write every question, option, and explanation in ${language}.

DIFFICULTY: ${level} — focus on ${levelDesc}.

QUESTION DISTRIBUTION (total: ${totalQuestions}):
${distributionLines}

FORMAT RULES:
${typeRules.join('\n')}
${cognitiveDistribution ? `
COGNITIVE DISTRIBUTION: Distribute the required mental effort across the ${totalQuestions} questions as follows:
- Memory/Recall (${cognitiveDistribution.memory} questions): pure recall of facts, definitions, names, dates — no reasoning required
- Logical Deduction (${cognitiveDistribution.logic} questions): cause-effect analysis, inference, multi-step reasoning, comparison
- Practical Application (${cognitiveDistribution.application} questions): applying concepts to real-world scenarios, case studies, novel problems
Spread these proportionally across question types. A 0-count category means no questions of that kind.
` : ''}${contentSection}
${customInstructions ? `CUSTOM INSTRUCTIONS (highest priority — override any default behaviour if there is a conflict):
${customInstructions}

` : ''}EXACT COUNT REQUIREMENT: you MUST return EXACTLY ${totalQuestions} questions — not one more, not one less. Count them before writing the JSON. If you reach the end and have fewer, add more questions of any allowed type. If you have more, trim the last ones.

MATH QUESTION RULE: for any question where has_math is true, set "correct_answer" to "" and "explanation" to "". A dedicated math solver will complete those fields. Only write the question statement (and options for multiple_choice).

OUTPUT: Return a JSON object with exactly two keys:
- "canonical_subject": the normalized, canonical name of the subject **always in English**, regardless of the exam language (e.g. "World War 2", "ww2", "WWII" → "World War II"; "fotosíntesis", "fotosíntesi", "photosynthèse" → "Photosynthesis"; "historia" → "History"). Use proper English capitalization. This is used for cross-language grouping in statistics.
- "questions": an array of exactly ${totalQuestions} objects, each with:
  - "question": string
  - "type": one of ${format.map((f) => `"${f}"`).join(' | ')}
  - "options": string[] (4 items) or null
  - "correct_answer": string — empty string "" if has_math is true
  - "explanation": string — empty string "" if has_math is true; otherwise 1–2 sentences explaining why the answer is correct
  - "has_math": boolean — set to true if the question involves mathematical formulas, equations, algebraic expressions, calculus, quantitative physics, chemistry with molecular formulas, or any content where the student would need to type mathematical symbols (e.g. exponents, Greek letters, integrals, fractions). Set to false otherwise.`;

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0.9,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
    }, 'generate_exam');

    const raw: string = resp.choices?.[0]?.message?.content ?? '{}';

    let parsed: unknown;
    const cleaned = sanitizeLatexInJsonString(
      restoreLatexControlChars(raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim())
    );
    parsed = JSON.parse(cleaned);

    let questions: GenerateExamQuestion[];
    let canonical_subject: string | undefined;

    if (Array.isArray(parsed)) {
      questions = parsed as GenerateExamQuestion[];
    } else if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'questions' in parsed &&
      Array.isArray((parsed as Record<string, unknown>).questions)
    ) {
      const p = parsed as { questions: GenerateExamQuestion[]; canonical_subject?: string };
      questions = p.questions;
      canonical_subject = p.canonical_subject;
    } else {
      const values = Object.values(parsed as Record<string, unknown>);
      if (values.length > 0 && typeof values[0] === 'object') {
        questions = values as GenerateExamQuestion[];
      } else {
        throw Object.assign(new Error('Unexpected AI response structure'), { statusCode: 502 });
      }
    }

    if (!questions || questions.length === 0) {
      throw Object.assign(new Error('AI returned no questions'), { statusCode: 502 });
    }

    // Post-process: strip letter prefixes (e.g. "A. ", "B)") from correct_answer for multiple_choice.
    // The AI occasionally returns "A. Paris" instead of "Paris" despite the prompt instructions.
    const normalizeOpt = (s: string) => s
      .replace(/^[A-D][.)]\s*/i, '')
      .replace(/\$+/g, '')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\cfrac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      .replace(/\\left|\\right|\\,|\\;|\\!/g, '')
      .replace(/∑|\\sum\b/g, 'sum').replace(/∫|\\int\b/g, 'int').replace(/∏|\\prod\b/g, 'prod')
      .replace(/∞|\\infty\b/g, 'inf').replace(/π|\\pi\b/g, 'pi').replace(/√|\\sqrt/g, 'sqrt')
      .replace(/α|\\alpha\b/g, 'alpha').replace(/β|\\beta\b/g, 'beta').replace(/γ|\\gamma\b/g, 'gamma')
      .replace(/δ|\\delta\b/g, 'delta').replace(/θ|\\theta\b/g, 'theta').replace(/λ|\\lambda\b/g, 'lambda')
      .replace(/μ|\\mu\b/g, 'mu').replace(/σ|\\sigma\b/g, 'sigma').replace(/ω|\\omega\b/g, 'omega')
      .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
      .replace(/⁸/g, '^8').replace(/⁹/g, '^9')
      .replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2').replace(/₃/g, '_3')
      .replace(/₄/g, '_4').replace(/₅/g, '_5').replace(/₆/g, '_6').replace(/₇/g, '_7')
      .replace(/₈/g, '_8').replace(/₉/g, '_9').replace(/ₙ/g, '_n').replace(/ₘ/g, '_m')
      .replace(/ₖ/g, '_k').replace(/ᵢ/g, '_i').replace(/ⱼ/g, '_j')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();

    questions = questions.map((q) => {
      if (q.type !== 'multiple_choice' || !Array.isArray(q.options) || !q.correct_answer) return q;
      let answer = q.correct_answer.replace(/^[A-D][.)]\s*/i, '').trim();
      const normalizedAnswer = normalizeOpt(answer);
      const match = q.options.find((o) =>
        normalizeOpt(o) === normalizedAnswer || o.replace(/^[A-D][.)]\s*/i, '').trim() === answer
      );
      if (match) answer = match.replace(/^[A-D][.)]\s*/i, '').trim();
      return { ...q, correct_answer: answer };
    });

    return { questions, canonical_subject };
  }

  async solveMath(args: SolveMathArgs): Promise<SolveMathResult> {
    const { question, type, options, language } = args;

    const optionsText = type === 'multiple_choice' && options?.length
      ? `\nOptions:\nA. ${options[0]}\nB. ${options[1]}\nC. ${options[2]}\nD. ${options[3]}\n\nIdentify which option is mathematically correct.`
      : '';

    const prompt = `You are an expert mathematician. Solve this problem step by step. Show every calculation explicitly.

Question: ${question}${optionsText}

INSTRUCTIONS:
1. Work through the full solution showing every step
2. For integrals: compute antiderivative term by term, apply limits if definite, verify by differentiating
3. For derivatives: apply rules term by term, show intermediate steps
4. For algebra: isolate variables step by step, verify by substitution
5. State the final answer clearly

${type === 'multiple_choice' ? 'For multiple choice: your correct_answer must be the FULL TEXT of the correct option (not just the letter A/B/C/D). If no option matches exactly, pick the closest one.' : ''}
${type === 'true_false' ? 'Your correct_answer must be exactly "True" or "False".' : ''}

Write the explanation in ${language}.

Return ONLY a valid JSON object:
{
  "correct_answer": "the exact answer",
  "explanation": "step-by-step solution with all calculations shown (minimum 2-3 sentences)"
}`;

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }, 'solve_math');

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    const cleaned = sanitizeLatexInJsonString(
      restoreLatexControlChars(raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim())
    );
    const parsed = JSON.parse(cleaned) as { correct_answer?: string; explanation?: string };

    return {
      correct_answer: parsed.correct_answer ?? '',
      explanation: parsed.explanation ?? '',
    };
  }

  async solveMathBatch(args: SolveMathBatchArgs): Promise<SolveMathBatchResult> {
    const { items, language } = args;

    const questionsBlock = items.map((item, n) => {
      const labels = ['A', 'B', 'C', 'D'];
      const optionsText = item.type === 'multiple_choice' && item.options?.length
        ? '\n' + item.options.map((o, i) => `  ${labels[i]}. ${o}`).join('\n')
        : '';
      const typeHint =
        item.type === 'multiple_choice' ? '(multiple choice — pick the correct option)' :
        item.type === 'true_false'      ? '(true/false — answer must be exactly "True" or "False")' :
        item.type === 'fill_in'         ? '(fill in the blank)' : '(flashcard)';
      return `[${n + 1}] ${typeHint}\n${item.question}${optionsText}`;
    }).join('\n\n');

    const mcInstructions = items.some((i) => i.type === 'multiple_choice')
      ? '\n- For multiple choice: correct_answer must be COPIED EXACTLY character by character from one of the options listed — same LaTeX, same symbols, same spacing. Do NOT rephrase, simplify, or change notation. Do NOT include the letter prefix (A/B/C/D).'
      : '';
    const tfInstructions = items.some((i) => i.type === 'true_false')
      ? '\n- For true/false: correct_answer must be exactly "True" or "False".'
      : '';

    const prompt = `You are an expert mathematician and physicist. Solve each problem below step by step, showing every calculation explicitly.

${questionsBlock}

RULES:
- Work through each problem fully before writing the answer.
- For integrals: compute antiderivative term by term, apply limits if definite, verify by differentiating.
- For derivatives: apply rules term by term, show all steps.
- For algebra: isolate variables step by step, verify by substituting back.${mcInstructions}${tfInstructions}
- Write all explanations in ${language}.
- LATEX FORMAT: use ONLY single $...$ for all math expressions. NEVER use $$...$$. Examples: $x^3$, $\\\\frac{1}{2}$, $\\\\int_0^1 x\\,dx$.
- CRITICAL JSON RULE: inside JSON string values all LaTeX backslash commands MUST use double backslash (\\\\frac, \\\\sqrt, \\\\int, etc.).

Return ONLY a valid JSON object with this exact shape — one entry per question, in the same order:
{
  "solutions": [
    { "correct_answer": "...", "explanation": "..." },
    { "correct_answer": "...", "explanation": "..." }
  ]
}

RULES FOR explanation:
- Show the full step-by-step solution with all calculations.
- You may verify your answer internally, but write ONLY the clean final solution in the explanation — never include re-checks, revisions, or correction notes.
- If your result does not match any option exactly, pick the closest option, state why briefly, and stop.`;

    const resp = await this.createChatCompletion({
      model: this.model,
      temperature: 0,
      max_tokens: Math.min(4000, Math.max(1000, items.length * 400)),
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }, 'solve_math_batch');

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    // Strip thinking blocks (<thought>…</thought>, <thinking>…</thinking>) that reasoning models include
    const stripped = raw
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    // Extract only the first complete JSON object in case the model adds trailing text
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const cleaned = sanitizeLatexInJsonString(restoreLatexControlChars(jsonMatch?.[0] ?? stripped));
    const parsed = JSON.parse(cleaned) as { solutions?: Array<{ correct_answer: string; explanation: string }> };

    // Map by position — Groq returns solutions in the same order as the input items
    const solutions = (parsed.solutions ?? []).map((sol, n) => {
      const item = items[n];
      let answer = sol.correct_answer ?? '';
      // Strip backticks Groq sometimes adds around accented chars (e.g. `È` → È, `à` → à)
      answer = answer.replace(/`([A-Za-zÀ-ÿ])/g, '$1').replace(/([A-Za-zÀ-ÿ])`/g, '$1');
      // Strip leading letter prefix "A. ", "B.", "A) " etc. that Groq sometimes adds
      answer = answer.replace(/^[A-D][.)]\s*/i, '').trim();
      // For multiple_choice: find the exact option that matches (handles math notation differences)
      if (item?.type === 'multiple_choice' && item.options?.length) {
        const normalize = (s: string) => s
          .replace(/^[A-D][.)]\s*/i, '')
          .replace(/\$+/g, '')
          .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
          .replace(/\\left|\\right|\\,|\\;|\\!/g, '')
          .replace(/\s+/g, '')
          .trim()
          .toLowerCase();
        const normalizedAnswer = normalize(answer);
        const match = item.options.find((o) =>
          normalize(o) === normalizedAnswer || o.replace(/^[A-D][.)]\s*/i, '').trim() === answer
        );
        if (match) answer = match.replace(/^[A-D][.)]\s*/i, '').trim();
      }
      return { index: item?.index ?? n, correct_answer: answer, explanation: sol.explanation ?? '' };
    }).filter((sol) => sol.correct_answer !== '');

    return { solutions };
  }

  async gradeFillIn(args: GradeFillInArgs): Promise<GradeFillInResult> {
    const { items, gradingMode } = args;

    // Split items: those with photos need individual vision calls; the rest are batched.
    const visionItems = items.filter((item) => !!item.image_url);
    const textItems = items.filter((item) => !item.image_url);

    const allScores: Array<{ id: string; score: number }> = [];

    // ── Batch text-only items ────────────────────────────────────────────────
    if (textItems.length > 0) {
      const mathEquivalenceRule = `MATH EQUIVALENCE (critical): different notations for the same mathematical result must be scored as fully correct. Examples: "a/b" = "\\frac{a}{b}", "x^2" = "x²", "sqrt(x)" = "\\sqrt{x}", "pi" = "π", "e^x" = "exp(x)", "ln(x)" = "log_e(x)". If the student's answer is mathematically equivalent to the correct answer — even with different notation — give full score.`;

      const prompt = gradingMode === 'partial'
        ? `You are a strict but fair exam grader. For each item, assign a score from 0.0 to 1.0 based on how correct the answer is.

${mathEquivalenceRule}

Scoring guide:
- 1.0 — fully correct (semantically or mathematically equivalent, minor spelling OK)
- 0.7–0.9 — mostly correct but imprecise, incomplete, or with minor conceptual gaps
- 0.4–0.6 — shows some understanding but missing key elements
- 0.1–0.3 — barely related or mostly wrong but shows minimal knowledge
- 0.0 — completely wrong, off-topic, or no answer

Return ONLY a valid JSON object: { "scores": [{ "id": "...", "score": <number 0.0-1.0> }] }

Items:
${JSON.stringify(textItems, null, 2)}`
        : `You are a strict but fair exam grader. For each item, decide if the user's answer is semantically correct (equivalent meaning, minor spelling errors acceptable). ${mathEquivalenceRule}

Return ONLY a valid JSON object: { "scores": [{ "id": "...", "score": 1.0 }] } for correct or { "scores": [{ "id": "...", "score": 0.0 }] } for wrong.

Items:
${JSON.stringify(textItems, null, 2)}`;

      const resp = await this.createChatCompletion({
        model: this.model,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }, 'grade_fill_in_text');

      const raw = resp.choices?.[0]?.message?.content ?? '{}';
      try {
        const parsed = JSON.parse(raw);
        const scores: Array<{ id: string; score: number }> = Array.isArray(parsed.scores)
          ? parsed.scores
          : Array.isArray(parsed)
          ? parsed
          : [];
        for (const r of scores) {
          if (r.id && typeof r.score === 'number') {
            allScores.push({ id: r.id, score: Math.max(0, Math.min(1, r.score)) });
          }
        }
      } catch {
        // leave text items unscored — caller will fall back to string comparison
      }
    }

    // ── Individual vision calls for items with photos ────────────────────────
    for (const item of visionItems) {
      try {
        const scoringGuide = gradingMode === 'partial'
          ? `MATH EQUIVALENCE: different notations for the same result are fully correct ("a/b" = "\\frac{a}{b}", "x^2" = "x²", etc.).

Scoring guide:
- 1.0 — fully correct (semantically or mathematically equivalent, minor spelling OK)
- 0.7–0.9 — mostly correct but imprecise, incomplete, or with minor conceptual gaps
- 0.4–0.6 — shows some understanding but missing key elements
- 0.1–0.3 — barely related or mostly wrong but shows minimal knowledge
- 0.0 — completely wrong, off-topic, or no answer

Assign a score from 0.0 to 1.0.`
          : `Decide if the student's work is semantically correct (score 1.0) or wrong (score 0.0). Minor spelling errors are acceptable. MATH EQUIVALENCE: different notations for the same result count as correct ("a/b" = "\\frac{a}{b}", "x^2" = "x²", etc.).`;

        const hasTextAnswer = item.user_answer && item.user_answer.trim().length > 0;

        const textPart = [
          'You are a strict but fair exam grader evaluating a student\'s handwritten answer.',
          '',
          `QUESTION: ${item.question}`,
          `CORRECT ANSWER: ${item.correct_answer}`,
          hasTextAnswer ? `STUDENT TEXT ANSWER: ${item.user_answer}` : '',
          'STUDENT HANDWRITTEN WORK: See the attached photo.',
          '',
          hasTextAnswer
            ? 'Evaluate both the text answer and the photo. The photo may contain more detailed working-out steps.'
            : 'Evaluate only the handwritten photo — there is no text answer.',
          '',
          scoringGuide,
          '',
          'Return ONLY a valid JSON object: { "score": <number> }',
        ].filter((line) => line !== null).join('\n');

        const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
          { type: 'text', text: textPart },
          { type: 'image_url', image_url: { url: item.image_url!, detail: 'high' } },
        ];

        const resp = await this.createChatCompletion({
          model: this.model,
          temperature: 0,
          max_tokens: 100,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: userContent as any }],
        }, 'grade_fill_in_vision');

        const raw = resp.choices?.[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
        if (typeof parsed.score === 'number') {
          allScores.push({ id: item.id, score: Math.max(0, Math.min(1, parsed.score)) });
        }
      } catch {
        // Non-fatal: leave this vision item unscored — caller falls back to string comparison
      }
    }

    return { scores: allScores };
  }
}
