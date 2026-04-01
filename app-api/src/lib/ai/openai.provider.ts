import OpenAI from 'openai';
import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, EditBlockArgs, AttachmentInput, GenerateExamArgs, GenerateExamResult, GenerateExamQuestion, GradeFillInArgs, GradeFillInResult } from './types';
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

/**
 * Sanitize a raw JSON string returned by the AI before passing it to JSON.parse.
 *
 * Problem: JSON escape sequences like \f (form feed), \n, \t, \r, \b, \v are
 * interpreted by JSON.parse as control characters. When the AI writes a LaTeX
 * command such as \frac inside a JSON string using a single backslash, JSON.parse
 * turns \f into the form-feed character (ASCII 12) and leaves "rac{1}{x}" — which
 * renders as a garbage symbol in the UI.
 *
 * Strategy: inside JSON string values, replace any lone backslash that is followed
 * by a letter (i.e. a LaTeX command) with a double backslash, but only when that
 * backslash is not already escaped (i.e. not preceded by another backslash).
 * Standard JSON two-character escapes (\n, \t, \r, \b, \f, \uXXXX, \\, \", \/)
 * are left intact only when the AI intentionally used them for control characters —
 * but in practice all of those in LaTeX are commands, so we double them all.
 *
 * The regex walks character-by-character inside JSON string literals and doubles
 * any backslash that is not already doubled.
 */
/**
 * The OpenAI SDK parses the outer HTTP-level JSON before handing us `content`.
 * As part of that parse, JSON escape sequences like \f (form-feed), \v (vertical-tab),
 * and \b (backspace) are decoded into their actual control characters.
 * When the model wrote a LaTeX command such as \frac inside a JSON string using a
 * single backslash, the outer JSON parse turns \f into the form-feed character
 * (ASCII 12) and leaves "rac{1}{x}" — which renders as a garbage symbol in the UI.
 *
 * This function runs FIRST on the raw content string and restores those control
 * characters back to the two-character backslash sequences (\f → \f as text, etc.)
 * so that the subsequent sanitizeLatexInJsonString + JSON.parse pipeline can handle
 * them correctly.
 *
 * We intentionally skip \n (newline) and \t (tab) because those ARE legitimately used
 * as formatting whitespace at the JSON-structure level and replacing them blindly
 * would produce malformed JSON.
 */
function restoreLatexControlChars(s: string): string {
  return s
    .replace(/\f/g, '\\f')  // form-feed  (ASCII 12) → \f  e.g. \frac, \footnote
    .replace(/\v/g, '\\v')  // vert. tab  (ASCII 11) → \v  e.g. \vec, \vee
    .replace(/\b/g, '\\b'); // backspace  (ASCII  8) → \b  e.g. \beta, \bar
}

function sanitizeLatexInJsonString(raw: string): string {
  // Replace every occurrence of a single backslash (not already doubled) followed
  // by a letter with a doubled backslash, so JSON.parse produces the \cmd string
  // that KaTeX expects.
  // The negative lookbehind (?<!\\) avoids doubling an already-doubled \\frac.
  return raw.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1');
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

  // ─── Exam generation ──────────────────────────────────────────────────────

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
      '• COHERENCE RULE (applies to all types): the value of "correct_answer" must be the exact same answer that "explanation" concludes as correct. Never let these two fields disagree. If the question involves a calculation, perform the calculation explicitly before writing any field, then copy the verified result into both "correct_answer" (or the matching option) and "explanation".',
      '• MATH VERIFICATION: for any question requiring arithmetic, algebra, calculus, or any numerical computation, show the calculation mentally step by step first, confirm the numeric result, and only then write "correct_answer". A mismatch between "correct_answer" and "explanation" is a critical error.'
    );

    const levelDesc = LEVEL_DESCRIPTIONS[level] ?? level;

    const systemMessage =
      'You are an expert educator and exam designer. You always respond with a valid JSON object and nothing else — no markdown, no prose, no code fences. When a question, option, or answer contains a mathematical expression, equation, or formula, wrap it in $...$ delimiters (e.g. $x^2 + 2x + 1$, $\\\\frac{a}{b}$, $\\\\sqrt{n}$). Plain text must never be wrapped in $...$. CRITICAL JSON RULE: inside JSON string values, ALL LaTeX backslash commands MUST use a double backslash. For example: write \\\\frac, \\\\sqrt, \\\\sum, \\\\int, \\\\alpha, \\\\beta, \\\\times, \\\\cdot, \\\\vec, \\\\hat, \\\\bar, \\\\left, \\\\right, \\\\text, \\\\mathrm — never a single backslash before any LaTeX command inside a JSON string. A single \\f in JSON is a form-feed control character, not the LaTeX \\frac command. Always double every backslash in JSON string values.';

    const taskLine = documentContext
      ? [
          'Create an exam based strictly on the document content provided below.',
          subject ? `Focus specifically on: "${subject}".` : '',
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

` : ''}OUTPUT: Return a JSON object with exactly two keys:
- "canonical_subject": the normalized, canonical name of the subject **always in English**, regardless of the exam language (e.g. "World War 2", "ww2", "WWII" → "World War II"; "fotosíntesis", "fotosíntesi", "photosynthèse" → "Photosynthesis"; "historia" → "History"). Use proper English capitalization. This is used for cross-language grouping in statistics.
- "questions": an array of exactly ${totalQuestions} objects, each with:
  - "question": string
  - "type": one of ${format.map((f) => `"${f}"`).join(' | ')}
  - "options": string[] (4 items) or null
  - "correct_answer": string
  - "explanation": string (1–2 sentences explaining why the answer is correct)
  - "has_math": boolean — set to true if the question or its answer involves mathematical formulas, equations, algebraic expressions, calculus, quantitative physics, chemistry with molecular formulas, or any content where the student would need to type mathematical symbols (e.g. exponents, Greek letters, integrals, fractions). Set to false otherwise.`;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
    });

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

    // ── Step 2: validate grounding when a document was provided ──────────────
    if (documentContext) {
      const validationMessage = `You are a strict exam quality reviewer.

You will receive a list of exam questions and the source document they were generated from.

Your task:
1. For each question, check whether it can be fully answered using ONLY the provided document text.
2. If a question IS grounded in the document — keep it exactly as-is.
3. If a question is NOT grounded (uses outside knowledge, is too generic, or cannot be verified from the text) — replace it with a new question on the same topic that IS directly answerable from the document.

RULES:
- Return the exact same JSON structure: an object with key "questions" containing an array of exactly ${questions.length} objects.
- Every object must have: "question", "type", "options", "correct_answer", "explanation", "has_math".
- Keep the same "type" for each question when replacing.
- Preserve the "has_math" value from the original question unless you replace the question entirely; if you replace a question, set "has_math" to true if the new question involves mathematical formulas, equations, or symbols, false otherwise.
- Write all questions in ${language}.
- Do not add, remove, or reorder questions — only replace ungrounded ones in place.

SOURCE DOCUMENT:
${documentContext}

QUESTIONS TO VALIDATE:
${JSON.stringify(questions, null, 2)}`;

      const validationResp = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an exam quality reviewer. You always respond with a valid JSON object and nothing else — no markdown, no prose, no code fences.' },
          { role: 'user', content: validationMessage },
        ],
      });

      try {
        const rawV = validationResp.choices?.[0]?.message?.content ?? '{}';
        const cleanedV = sanitizeLatexInJsonString(
          restoreLatexControlChars(rawV.replace(/```(?:json)?/g, '').replace(/```/g, '').trim())
        );
        const parsedV = JSON.parse(cleanedV) as { questions?: GenerateExamQuestion[] };
        if (Array.isArray(parsedV.questions) && parsedV.questions.length === questions.length) {
          questions = parsedV.questions;
        }
      } catch {
        // If validation parse fails, keep original questions
      }
    }

    return { questions, canonical_subject };
  }

  // ─── F3-M4.3: editBlock ───────────────────────────────────────────────────

  async editBlock(args: EditBlockArgs): Promise<string> {
    const system = [
      'You are BetterNotes AI, an expert LaTeX editor.',
      'You will receive a single LaTeX block (fragment) and a user instruction.',
      'OUTPUT RULES:',
      '- Return ONLY the modified LaTeX fragment — not the full document.',
      '- Do NOT include \\documentclass, \\begin{document}, or any preamble.',
      '- Do NOT wrap the output in markdown fences or backticks.',
      '- Preserve the block type: if it is a formula-block, keep it as a formula-block; if it is a paragraph, keep it as a paragraph; etc.',
      '- Apply the user instruction precisely and minimally — change only what is asked.',
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

    const userContent = [
      `=== BLOCK TO EDIT (type: ${args.blockType}) ===`,
      args.blockLatex,
      '',
      `=== USER INSTRUCTION ===`,
      args.userPrompt,
      adjacentContext,
      fullLatexSnippet,
      '',
      'Return ONLY the modified block LaTeX — nothing else.',
    ].join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content ?? '';
    return stripMarkdownFences(raw).trim();
  }

  async gradeFillIn(args: GradeFillInArgs): Promise<GradeFillInResult> {
    const { items, gradingMode } = args;

    // Split items: those with photos need individual vision calls; the rest are batched.
    const visionItems = items.filter((item) => !!item.image_url);
    const textItems = items.filter((item) => !item.image_url);

    const allScores: Array<{ id: string; score: number }> = [];

    // ── Batch text-only items ────────────────────────────────────────────────
    if (textItems.length > 0) {
      const prompt = gradingMode === 'partial'
        ? `You are a strict but fair exam grader. For each item, assign a score from 0.0 to 1.0 based on how correct the answer is.

Scoring guide:
- 1.0 — fully correct (semantically equivalent, minor spelling OK)
- 0.7–0.9 — mostly correct but imprecise, incomplete, or with minor conceptual gaps
- 0.4–0.6 — shows some understanding but missing key elements
- 0.1–0.3 — barely related or mostly wrong but shows minimal knowledge
- 0.0 — completely wrong, off-topic, or no answer

Return ONLY a valid JSON object: { "scores": [{ "id": "...", "score": <number 0.0-1.0> }] }

Items:
${JSON.stringify(textItems, null, 2)}`
        : `You are a strict but fair exam grader. For each item, decide if the user's answer is semantically correct (equivalent meaning, minor spelling errors acceptable).

Return ONLY a valid JSON object: { "scores": [{ "id": "...", "score": 1.0 }] } for correct or { "scores": [{ "id": "...", "score": 0.0 }] } for wrong.

Items:
${JSON.stringify(textItems, null, 2)}`;

      const resp = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });

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
          ? `Scoring guide:
- 1.0 — fully correct (semantically equivalent, minor spelling OK)
- 0.7–0.9 — mostly correct but imprecise, incomplete, or with minor conceptual gaps
- 0.4–0.6 — shows some understanding but missing key elements
- 0.1–0.3 — barely related or mostly wrong but shows minimal knowledge
- 0.0 — completely wrong, off-topic, or no answer

Assign a score from 0.0 to 1.0.`
          : `Decide if the student's work is semantically correct (score 1.0) or wrong (score 0.0). Minor spelling errors are acceptable.`;

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

        const resp = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0,
          max_tokens: 100,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: userContent as any }],
        });

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
