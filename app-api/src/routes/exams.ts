/**
 * exams.ts
 * POST /exams/generate
 * POST /exams/export-pdf
 *
 * Receives exam generation parameters from app-web, calls the AI provider,
 * and returns the generated questions.
 *
 * Input:
 *   { subject, level, language, distribution, format, documentContext }
 * Output:
 *   { ok: true, questions: GenerateExamQuestion[] }
 */

import { Router, Request, Response } from 'express';
import { AIProvider } from '../lib/ai/types';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ExamsRouterOptions {
  aiProvider: AIProvider;
  mathProvider?: AIProvider;
  mathFallbackProvider?: AIProvider;  // Used if mathProvider fails
}

const VALID_LEVELS = [
  'secondary_basic', 'secondary_intermediate', 'secondary_advanced',
  'highschool_basic', 'highschool_intermediate', 'highschool_advanced',
  'university_basic', 'university_intermediate', 'university_advanced',
] as const;
const VALID_FORMATS = ['multiple_choice', 'true_false', 'fill_in', 'flashcard'] as const;

interface GenerateExamBody {
  subject?: string;
  level?: string;
  language?: string;
  distribution?: Record<string, number>;
  format?: string[];
  documentContext?: string;
  cognitiveDistribution?: { memory: number; logic: number; application: number };
  customInstructions?: string;
}

export function createExamsRouter(opts: ExamsRouterOptions): Router {
  const router = Router();
  const { aiProvider, mathProvider, mathFallbackProvider } = opts;

  // POST /exams/generate
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const {
        subject,
        level,
        language,
        distribution,
        format,
        documentContext,
        cognitiveDistribution,
        customInstructions,
      } = req.body as GenerateExamBody;

      // --- Input validation ---
      if (typeof level !== 'string' || !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
        res.status(400).json({ ok: false, error: `level must be one of: ${VALID_LEVELS.join(', ')}` });
        return;
      }

      if (!Array.isArray(format) || format.length === 0) {
        res.status(400).json({ ok: false, error: 'format must be a non-empty array' });
        return;
      }

      const invalidFormats = format.filter(
        (f) => !VALID_FORMATS.includes(f as typeof VALID_FORMATS[number])
      );
      if (invalidFormats.length > 0) {
        res.status(400).json({
          ok: false,
          error: `Invalid format values: ${invalidFormats.join(', ')}. Valid: ${VALID_FORMATS.join(', ')}`,
        });
        return;
      }

      if (
        distribution === null ||
        typeof distribution !== 'object' ||
        Array.isArray(distribution) ||
        Object.keys(distribution).length === 0
      ) {
        res.status(400).json({ ok: false, error: 'distribution must be a non-empty object' });
        return;
      }

      const totalQuestions = Object.values(distribution).reduce((s, n) => s + n, 0);
      if (totalQuestions < 1 || totalQuestions > 50) {
        res.status(400).json({ ok: false, error: 'Total question count must be between 1 and 50' });
        return;
      }

      const subjectTrimmed = (subject ?? '').trim();
      const docCtx = (documentContext ?? '').trim();

      if (!subjectTrimmed && !docCtx) {
        res.status(400).json({
          ok: false,
          error: 'subject is required when no documentContext is provided',
        });
        return;
      }

      const lang = (language ?? 'english').trim().toLowerCase() || 'english';

      const t0 = Date.now();
      const result = await aiProvider.generateExam({
        subject: subjectTrimmed,
        level,
        language: lang,
        distribution,
        format,
        documentContext: docCtx,
        cognitiveDistribution,
        customInstructions: (customInstructions ?? '').trim() || undefined,
      });

      console.log(`[exams] generation took ${Date.now() - t0}ms`);
      let { questions, canonical_subject } = result;

      // Resolve all math questions with Groq in a single batch call
      if (mathProvider) {
        const allMath = isMathSubject(subjectTrimmed);
        const mathItems = questions
          .map((q, i) => ({ q, i }))
          .filter(({ q }) =>
            allMath ||
            q.has_math === true ||
            q.correct_answer === '' ||
            hasMathContent(q.question)
          )
          .map(({ q, i }) => ({ index: i, question: q.question, type: q.type, options: q.options }));

        console.log(`[exams] subject="${subjectTrimmed}" allMath=${allMath} mathItems=${mathItems.length}/${questions.length}`);

        if (mathItems.length > 0) {
          try {
            const CHUNK_SIZE = 10;
            const allSolutions: Array<{ index: number; correct_answer: string; explanation: string }> = [];

            for (let i = 0; i < mathItems.length; i += CHUNK_SIZE) {
              const chunk = mathItems.slice(i, i + CHUNK_SIZE);
              const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
              const tChunk = Date.now();
              console.log(`[exams] calling math solver chunk ${chunkNum} (${chunk.length} questions)`);
              let solutions: Array<{ index: number; correct_answer: string; explanation: string }>;
              try {
                ({ solutions } = await mathProvider.solveMathBatch({ items: chunk as any, language: lang }));
              } catch (primaryErr) {
                if (mathFallbackProvider) {
                  console.warn(`[exams] primary math solver failed on chunk ${chunkNum}, retrying with fallback:`, (primaryErr as Error).message);
                  ({ solutions } = await mathFallbackProvider.solveMathBatch({ items: chunk as any, language: lang }));
                } else {
                  throw primaryErr;
                }
              }
              console.log(`[exams] math solver chunk ${chunkNum} took ${Date.now() - tChunk}ms`);
              allSolutions.push(...solutions);
            }

            console.log(`[exams] math solver returned ${allSolutions.length} solutions total`);
            for (const sol of allSolutions) {
              if (sol.index >= 0 && sol.index < questions.length && sol.correct_answer) {
                questions[sol.index] = {
                  ...questions[sol.index],
                  correct_answer: sol.correct_answer,
                  explanation: sol.explanation,
                };
              }
            }
          } catch (err) {
            console.error('[exams] solveMathBatch failed:', err);
          }
        }
      }

      res.json({ ok: true, questions, canonical_subject });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
      });
    }
  });

  // POST /exams/grade-fill-in
  router.post('/grade-fill-in', async (req: Request, res: Response) => {
    try {
      const { items, gradingMode } = req.body as {
        items?: unknown;
        gradingMode?: string;
      };

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ ok: false, error: 'items must be a non-empty array' });
        return;
      }

      const mode = gradingMode === 'partial' ? 'partial' : 'strict';
      const result = await aiProvider.gradeFillIn({ items: items as any, gradingMode: mode });
      res.json({ ok: true, scores: result.scores });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
      });
    }
  });

  // POST /exams/export-pdf
  // Receives an ExamReport and returns a PDF file generated via Pandoc + XeLaTeX.
  router.post('/export-pdf', async (req: Request, res: Response) => {
    const report = req.body as ExamReportForExport | undefined;

    if (!report || !report.exam || !Array.isArray(report.questions)) {
      res.status(400).json({ ok: false, error: 'Invalid exam report payload' });
      return;
    }

    let tmpDir: string | undefined;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bn-exam-'));
      const mdPath  = path.join(tmpDir, 'exam.md');
      const pdfPath = path.join(tmpDir, 'exam.pdf');

      const md = buildExamMarkdown(report);
      fs.writeFileSync(mdPath, md, 'utf-8');

      await runPandoc(mdPath, pdfPath);

      const pdfBuffer = fs.readFileSync(pdfPath);
      const safeName = (report.exam.subject || report.exam.title || 'exam')
        .replace(/[/\\:*?"<>|]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err: any) {
      console.error('[export-pdf] error:', err?.message ?? err);
      res.status(500).json({
        ok: false,
        error: err?.message ?? 'PDF generation failed',
      });
    } finally {
      if (tmpDir) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }
  });

  return router;
}

// ─── Types for export-pdf ─────────────────────────────────────────────────────

interface ExamReportQuestionExport {
  question_number: number;
  type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean | null;
  partial_score?: number | null;
  explanation: string | null;
}

interface ExamReportForExport {
  exam: {
    title: string;
    subject: string;
    level: string;
    score: number | null;
    completed_at: string | null;
  };
  questions: ExamReportQuestionExport[];
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  secondary_basic:          'Secondary — Basic',
  secondary_intermediate:   'Secondary — Intermediate',
  secondary_advanced:       'Secondary — Advanced',
  highschool_basic:         'High School — Basic',
  highschool_intermediate:  'High School — Intermediate',
  highschool_advanced:      'High School — Advanced',
  university_basic:         'University — Basic',
  university_intermediate:  'University — Intermediate',
  university_advanced:      'University — Advanced',
};

function questionState(q: ExamReportQuestionExport): 'correct' | 'partial' | 'wrong' | 'unanswered' {
  if (!q.user_answer || q.user_answer.trim() === '') return 'unanswered';
  if (q.is_correct === true) return 'correct';
  if (q.partial_score != null && q.partial_score > 0 && q.partial_score < 1) return 'partial';
  return 'wrong';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Wraps bare $...$ math so it survives Pandoc's Markdown parser.
 * Pandoc already handles $...$ and $$...$$ natively with --mathml or
 * the default LaTeX math pass-through, so we just ensure the text is
 * passed through unchanged.
 */
function buildExamMarkdown(report: ExamReportForExport): string {
  const { exam, questions } = report;
  const level   = LEVEL_LABELS[exam.level] ?? exam.level;
  const date    = exam.completed_at ? formatDate(exam.completed_at) : 'N/A';
  const score   = exam.score !== null ? `${exam.score}%` : 'N/A';
  const subject = exam.subject || exam.title;

  const lines: string[] = [];

  // ── YAML front-matter for Pandoc ──────────────────────────────────────────
  lines.push('---');
  lines.push(`title: "${subject.replace(/"/g, "'")}"`);
  lines.push(`date: "${date}"`);
  lines.push('geometry: "margin=2.5cm"');
  lines.push('fontsize: 11pt');
  lines.push('---');
  lines.push('');

  // ── Cover block ───────────────────────────────────────────────────────────
  lines.push(`# ${latexEscape(subject)}`);
  lines.push('');
  lines.push(`**Level:** ${latexEscape(level)}  `);
  lines.push(`**Date:** ${latexEscape(date)}  `);
  lines.push(`**Score:** ${score}  `);
  lines.push(`**Questions:** ${questions.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Questions ─────────────────────────────────────────────────────────────
  lines.push('## Answer Review');
  lines.push('');

  for (const q of questions) {
    const state = questionState(q);
    const stateLabel =
      state === 'correct'    ? '[Correct]' :
      state === 'partial'    ? `[Partial — ${Math.round((q.partial_score ?? 0) * 100)}%]` :
      state === 'wrong'      ? '[Incorrect]' :
                               '[No answer]';

    lines.push(`### Question ${q.question_number} — ${stateLabel}`);
    lines.push('');
    // Question text — ensure bare LaTeX commands are wrapped in math mode
    lines.push(ensureMathDelimiters(q.question));
    lines.push('');

    // Options for multiple choice
    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0) {
      const labels = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, i) => {
        const label     = labels[i] ?? String(i + 1);
        const isUser    = opt === q.user_answer;
        const isCorrect = opt === q.correct_answer;
        let marker = '';
        if (isUser && state === 'correct')       marker = ' [your answer - correct]';
        else if (isUser && state === 'wrong')    marker = ' [your answer - wrong]';
        else if (isUser && state === 'partial')  marker = ' [your answer - partial]';
        else if (isCorrect && state === 'wrong') marker = ' [correct answer]';
        lines.push(`- **${label}.** ${ensureMathDelimiters(opt)}${marker}`);
      });
      lines.push('');
    }

    // User answer
    const ua = q.user_answer && q.user_answer.trim() !== '' ? ensureMathDelimiters(q.user_answer) : '_No answer given_';
    lines.push(`**Your answer:** ${ua}  `);

    // Correct answer (for wrong/unanswered non-MC)
    if ((state === 'wrong' || state === 'unanswered') && q.type !== 'multiple_choice') {
      lines.push(`**Correct answer:** ${ensureMathDelimiters(q.correct_answer)}  `);
    }

    // Explanation
    if (q.explanation) {
      lines.push('');
      lines.push('> **Explanation:** ' + ensureMathDelimiters(q.explanation));
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Ensures LaTeX commands outside of math delimiters are wrapped in $...$.
 * The AI sometimes omits $ around expressions like \ln(x), \frac{a}{b}, etc.
 */
/** Detects if a question contains mathematical content by looking for LaTeX commands or math symbols. */
function hasMathContent(text: string): boolean {
  return /\\(?:int|frac|sum|prod|sqrt|lim|partial|nabla|alpha|beta|gamma|delta|theta|lambda|sigma|omega|pi|mu|infty|times|cdot|vec|hat|bar|left|right|begin|end)\b/.test(text)
    || /\$[\s\S]+?\$/.test(text)
    || /\d+\s*[\^\/]\s*\d+/.test(text);
}

/** Returns true if the subject is inherently mathematical — all questions should go to Groq. */
function isMathSubject(subject: string): boolean {
  const s = subject.toLowerCase();
  return /c[àa]lcul|calculus|c[áa]lculo|integral|derivad|derivative|[\s,]math|matem[àa]tic|algebra|àlgebra|trigonometr|probabilit|estad[íi]stic|statistic|geometr|f[íi]sic|physic|linear algebra|equaci[oó]|ecuaci[oó]n|equation/.test(s);
}

function ensureMathDelimiters(text: string): string {
  // Split on existing math blocks to avoid double-processing
  const segments = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/);
  return segments.map((seg, idx) => {
    if (idx % 2 === 1) return seg; // already a math block, keep as-is
    // Non-math segment: wrap any \commandName occurrences in $...$
    return seg.replace(/\\[a-zA-Z]+(?:\{[^}]*\}|\[[^\]]*\]|\([^)]*\))*/g, (m) => `$${m}$`);
  }).join('');
}

/**
 * Escapes special LaTeX characters in plain text segments (not math).
 * We only use this for metadata strings (title, level, date).
 */
function latexEscape(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, (c) => `\\${c}`)
    .replace(/\[/g, '{[}')
    .replace(/\]/g, '{]}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

// ─── Pandoc runner ────────────────────────────────────────────────────────────

function runPandoc(mdPath: string, pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      mdPath,
      '-o', pdfPath,
      '--pdf-engine=pdflatex',
      '--standalone',
    ];

    const proc = spawn('pandoc', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      reject(new Error(`pandoc not found or failed to start: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pandoc exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
      }
    });
  });
}
