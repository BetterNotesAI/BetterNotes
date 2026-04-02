import OpenAI from 'openai';
import { AIProvider, GenerateLatexArgs, GenerateLatexResult, FixLatexArgs, EditBlockArgs, EditDocumentArgs, EditDocumentResult, AttachmentInput, ConversationTurn, GenerateExamArgs, GenerateExamResult, GenerateExamQuestion, GradeFillInArgs, GradeFillInResult } from './types';
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
 * Pre-parse sanitizer: doubles lone backslashes before a letter so that
 * \alpha, \{, etc. (invalid JSON escapes) don't cause SyntaxError.
 */
function sanitizeLatexInJsonString(raw: string): string {
  return raw
    .replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1')
    .replace(/(?<!\\)\\([{}[\]|^_])/g, '\\\\$1');
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

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages,
    });

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
      '• COHERENCE RULE (applies to all types): the value of "correct_answer" must be the exact same answer that "explanation" concludes as correct. Never let these two fields disagree. If the question involves a calculation, perform the calculation explicitly before writing any field, then copy the verified result into both "correct_answer" (or the matching option) and "explanation".',
      '• MATH VERIFICATION — MANDATORY SCRATCHPAD: before writing any JSON field for a math question, work through the full calculation in a private scratchpad (you may include it as a comment before the JSON). Steps: (1) identify every sub-expression, (2) compute each step numerically or symbolically, (3) verify the result by substituting back or by an independent method, (4) only then write "correct_answer" and "explanation". A result that has not been independently verified must not appear in the output.',
      '• DERIVATIVES: differentiate each term individually using the power rule d/dx[xⁿ] = n·xⁿ⁻¹. Never skip or combine terms. For SECOND DERIVATIVES apply the power rule again term-by-term to the first derivative — never reuse the original function. Example: if f\'(x) = 4x³ − 12x² + 12x then f\'\'(x) = 12x² − 24x + 12. Triple-check every exponent and coefficient.',
      '• INTEGRALS: compute the antiderivative term-by-term, apply limits if definite, verify by differentiating the result. For indefinite integrals always include + C.',
      '• ARITHMETIC AND ALGEBRA: perform every arithmetic operation explicitly (no mental shortcuts). For equations, isolate the variable step by step and verify by substituting the solution back into the original equation.',
      '• LIMITS AND SERIES: evaluate limits by the appropriate technique (substitution, L\'Hôpital, factoring); state which rule is applied.',
      '• WRONG MATH IS A CRITICAL ERROR: an incorrect numerical result in "correct_answer" or "explanation" — regardless of how well the question is written — renders the entire question invalid. Prefer a simpler question you can verify over a complex question you cannot.'
    );

    const levelDesc = LEVEL_DESCRIPTIONS[level] ?? level;

    const systemMessage =
      'You are an expert educator and exam designer. You always respond with a valid JSON object and nothing else — no markdown, no prose, no code fences.' +
      ' MATH ACCURACY IS YOUR HIGHEST PRIORITY: before writing any question that involves calculation, carry out every arithmetic or algebraic step explicitly in your internal reasoning, verify the result independently (e.g. substitute back, differentiate the integral, check with a different method), and only then write the JSON fields. If you cannot verify a result with certainty, simplify the question until you can.' +
      ' LATEX MATH FORMAT: every mathematical expression, formula, equation, or symbol — including single variables used in a mathematical sense (e.g. $x$, $n$, $f(x)$) — must be wrapped in $...$ for inline math or $$...$$ for display math. Plain prose must never be wrapped in $...$.' +
      ' CRITICAL JSON RULE: inside JSON string values ALL LaTeX backslash commands MUST use a double backslash. Write \\\\frac, \\\\sqrt, \\\\sum, \\\\int, \\\\alpha, \\\\beta, \\\\times, \\\\cdot, \\\\vec, \\\\hat, \\\\bar, \\\\left, \\\\right, \\\\text, \\\\mathrm, \\\\lim, \\\\infty, \\\\partial, \\\\nabla, \\\\pm, \\\\leq, \\\\geq, \\\\neq, \\\\approx, \\\\equiv, \\\\in, \\\\subset, \\\\cup, \\\\cap, \\\\forall, \\\\exists — never a single backslash. A single \\f in JSON is a form-feed control character, not the LaTeX \\frac command. Always double every backslash in JSON string values.';

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

` : ''}MATH PRE-COMPUTATION STEP (mandatory for any math question):
Before writing the JSON, reason through each math question like this:
  [QUESTION PLAN] What concept is tested?
  [CALCULATION] Work every step explicitly: compute intermediate values, apply rules term-by-term.
  [VERIFICATION] Check: substitute the answer back, differentiate the integral, or use an independent method.
  [CONFIRMED RESULT] Only after verification, write this value into "correct_answer" and "explanation".
If a calculation cannot be fully verified, replace the question with one that can.

OUTPUT: Return a JSON object with exactly two keys:
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
      max_tokens: 16000,
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

    // ── Step 1b: top-up missing questions if AI returned fewer than requested ──
    const missing = totalQuestions - questions.length;
    if (missing > 0) {
      const topUpMessage = `You are an exam question generator.
The exam already has ${questions.length} questions on the subject "${args.subject}" at level "${args.level}".
Generate exactly ${missing} MORE questions to complete the exam. Do NOT repeat existing questions.
Use the same language: ${language}.
Use the same format types: ${format.join(', ')}.
Return ONLY a JSON object with key "questions": an array of exactly ${missing} objects, each with:
- "question": string
- "type": one of ${format.map((f) => `"${f}"`).join(' | ')}
- "options": string[] (4 items) or null
- "correct_answer": string
- "explanation": string (1–2 sentences)
- "has_math": boolean

EXISTING QUESTIONS (do not repeat):
${questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`;

      try {
        const topUpResp = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0.4,
          max_tokens: Math.max(2000, missing * 400),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an expert educator. Always respond with a valid JSON object and nothing else.' },
            { role: 'user', content: topUpMessage },
          ],
        });
        const rawTopUp = topUpResp.choices?.[0]?.message?.content ?? '{}';
        const cleanedTopUp = sanitizeLatexInJsonString(
          restoreLatexControlChars(rawTopUp.replace(/```(?:json)?/g, '').replace(/```/g, '').trim())
        );
        const parsedTopUp = JSON.parse(cleanedTopUp) as { questions?: GenerateExamQuestion[] };
        if (Array.isArray(parsedTopUp.questions) && parsedTopUp.questions.length > 0) {
          questions = [...questions, ...parsedTopUp.questions].slice(0, totalQuestions);
        }
      } catch {
        // If top-up fails, continue with the questions we have
      }
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
        max_tokens: 16000,
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
