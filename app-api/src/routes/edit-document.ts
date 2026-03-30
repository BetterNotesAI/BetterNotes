/**
 * edit-document.ts — Document-level AI edit
 * POST /latex/edit-document
 *
 * Receives the full LaTeX source + a user prompt.
 * Returns either an AI-modified full document or a conversational message.
 *
 * Input:
 *   { prompt: string, fullLatex: string, templateId: string }
 * Output (edit):
 *   { type: 'edit', latex: string, summary: string }
 * Output (message):
 *   { type: 'message', content: string }
 */

import { Router, Request, Response } from 'express';
import { AIProvider } from '../lib/ai/types';

export interface EditDocumentRouterOptions {
  aiProvider: AIProvider;
}

export interface EditDocumentBody {
  prompt?: string;
  fullLatex?: string;
  templateId?: string;
}

export function createEditDocumentRouter(opts: EditDocumentRouterOptions): Router {
  const router = Router();
  const { aiProvider } = opts;

  // POST /latex/edit-document
  router.post('/edit-document', async (req: Request, res: Response) => {
    try {
      const { prompt, fullLatex, templateId } = req.body as EditDocumentBody;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ ok: false, error: 'prompt is required' });
        return;
      }
      if (!fullLatex || typeof fullLatex !== 'string') {
        res.status(400).json({ ok: false, error: 'fullLatex is required' });
        return;
      }

      const result = await aiProvider.editDocument({
        prompt,
        fullLatex,
        templateId: templateId ?? '',
      });

      res.json({ ok: true, ...result });
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
