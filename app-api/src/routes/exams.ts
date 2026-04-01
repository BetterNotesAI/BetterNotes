/**
 * exams.ts
 * POST /exams/generate
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

export interface ExamsRouterOptions {
  aiProvider: AIProvider;
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
  const { aiProvider } = opts;

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

      res.json({ ok: true, questions: result.questions, canonical_subject: result.canonical_subject });
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

  return router;
}
