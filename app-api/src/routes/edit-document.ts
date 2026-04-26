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
import { normalizeMarkdownInlineMarkup } from '../lib/latex';
import { getUsageContext } from '../lib/usage/context';

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

      if (result.type === 'edit') {
        res.json({ ok: true, ...result, latex: normalizeMarkdownInlineMarkup(result.latex) });
        return;
      }

      res.json({ ok: true, ...result });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      res.status(status).json({
        ok: false,
        error: err?.message ?? 'Internal server error',
      });
    }
  });

  // POST /latex/edit-document-stream
  // Streams the modified document source as it is generated. Compilation and
  // persistence still happen in app-web, after the final LaTeX is available.
  router.post('/edit-document-stream', async (req: Request, res: Response) => {
    const sendEvent = (payload: Record<string, unknown>): void => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

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

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const result = await aiProvider.editDocumentStream({
        prompt,
        fullLatex,
        templateId: templateId ?? '',
      }, (chunk) => {
        sendEvent({ chunk });
      });

      if (result.type === 'edit') {
        const { accumulatedUsage } = getUsageContext();
        sendEvent({
          done: true,
          type: 'edit',
          latex: normalizeMarkdownInlineMarkup(result.latex),
          summary: result.summary,
          usage: accumulatedUsage ?? null,
        });
        return;
      }

      sendEvent({ done: true, type: 'message', content: result.content });
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? 500;
      if (!res.headersSent) {
        res.status(status).json({
          ok: false,
          error: err?.message ?? 'Internal server error',
        });
        return;
      }
      sendEvent({ error: err?.message ?? 'Internal server error' });
    } finally {
      if (res.headersSent) res.end();
    }
  });

  return router;
}
