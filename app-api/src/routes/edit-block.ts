/**
 * edit-block.ts — F3-M4.3
 * POST /latex/edit-block
 *
 * Receives a single LaTeX block + adjacent blocks + user prompt.
 * Returns the modified block latex (fragment only, not compiled).
 *
 * Input:
 *   { blockId, blockLatex, blockType, adjacentBlocks[], userPrompt, fullLatex }
 * Output:
 *   { modifiedLatex: string }
 */

import { Router, Request, Response } from 'express';
import { AIProvider } from '../lib/ai/types';

export interface EditBlockRouterOptions {
  aiProvider: AIProvider;
}

export interface AdjacentBlock {
  blockId: string;
  blockType: string;
  latex_source: string;
}

export interface EditBlockBody {
  blockId?: string;
  blockLatex?: string;
  blockType?: string;
  adjacentBlocks?: AdjacentBlock[];
  userPrompt?: string;
  fullLatex?: string;
}

export function createEditBlockRouter(opts: EditBlockRouterOptions): Router {
  const router = Router();
  const { aiProvider } = opts;

  // POST /latex/edit-block
  router.post('/edit-block', async (req: Request, res: Response) => {
    try {
      const {
        blockId,
        blockLatex,
        blockType,
        adjacentBlocks = [],
        userPrompt,
        fullLatex,
      } = req.body as EditBlockBody;

      if (!blockLatex || typeof blockLatex !== 'string') {
        res.status(400).json({ ok: false, error: 'blockLatex is required' });
        return;
      }
      if (!userPrompt || typeof userPrompt !== 'string') {
        res.status(400).json({ ok: false, error: 'userPrompt is required' });
        return;
      }

      const modifiedLatex = await aiProvider.editBlock({
        blockId: blockId ?? '',
        blockLatex,
        blockType: blockType ?? 'paragraph',
        adjacentBlocks,
        userPrompt,
        fullLatex: fullLatex ?? '',
      });

      res.json({ ok: true, modifiedLatex });
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
