// app-api/src/routes/problem-solver.ts
// F4-M1.3 — POST /problem-solver/solve  (SSE streaming)
// F4-M1.5 — POST /problem-solver/chat   (non-streaming sub-chat reply)

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert tutor and problem solver. The user has uploaded a problem or exercise set as a PDF.
Your job is to solve it completely, step by step, showing all work clearly.

Guidelines:
- Structure your solution with clear sections using Markdown headers (## Problem 1, ## Solution, etc.)
- Show ALL steps of mathematical derivations
- Use LaTeX for ALL math: inline with $...$ and display with $$...$$
- Use tables (Markdown) for comparisons, summaries, or data
- Use **bold** for key concepts and *italic* for definitions
- For physics/engineering problems: draw ASCII diagrams if helpful
- End with a brief summary of key results in a highlighted section
- If the PDF contains multiple problems, solve each one clearly numbered
- Be thorough but clear — this is for a student who needs to understand, not just get the answer`;

const SUB_CHAT_SYSTEM_PROMPT = `You are a helpful study assistant. The student is working on a problem that has already been solved.
You have access to the full solution. Answer the student's follow-up questions clearly and concisely.
If the question involves math, use LaTeX: inline with $...$ and display with $$...$$`;

export interface ProblemSolverRouterOptions {
  openaiApiKey: string;
  openaiModel?: string;
}

export function createProblemSolverRouter(opts: ProblemSolverRouterOptions): Router {
  const router = Router();
  const openai = new OpenAI({ apiKey: opts.openaiApiKey });
  const model = opts.openaiModel ?? 'gpt-4o';

  // ─── POST /problem-solver/solve ───────────────────────────────────────────────
  // Accepts { pdfText: string }, streams the solution as SSE.
  // Events:
  //   data: {"chunk": "..."}  — incremental text
  //   data: {"done": true}    — end of stream
  //   data: {"error": "..."}  — error during stream
  router.post('/solve', async (req: Request, res: Response) => {
    const { pdfText } = req.body as { pdfText?: string };

    if (!pdfText || typeof pdfText !== 'string' || !pdfText.trim()) {
      res.status(400).json({ ok: false, error: 'pdfText is required' });
      return;
    }

    // Set SSE headers
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const sendEvent = (payload: Record<string, unknown>): void => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const completion = await openai.chat.completions.create({
        model,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Solve the following problem:\n\n${pdfText}` },
        ],
      });

      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          sendEvent({ chunk: text });
        }
      }

      sendEvent({ done: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error during streaming';
      sendEvent({ error: message });
    } finally {
      res.end();
    }
  });

  // ─── POST /problem-solver/chat ───────────────────────────────────────────────
  // Non-streaming. Accepts { solutionMd, history, userMessage }, returns { reply }.
  // history: array of { role: 'user' | 'assistant'; content: string }
  router.post('/chat', async (req: Request, res: Response) => {
    const { solutionMd, history, userMessage } = req.body as {
      solutionMd?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userMessage?: string;
    };

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      res.status(400).json({ ok: false, error: 'userMessage is required' });
      return;
    }

    const solutionContext = solutionMd
      ? `[SOLUTION]\n${solutionMd}\n[/SOLUTION]`
      : '[SOLUTION]\nNo solution available yet.\n[/SOLUTION]';

    const historyLines = (history ?? [])
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const userContent = [
      solutionContext,
      historyLines ? `\nPrevious conversation:\n${historyLines}` : '',
      `\nStudent question: ${userMessage}`,
    ]
      .filter(Boolean)
      .join('');

    try {
      const completion = await openai.chat.completions.create({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SUB_CHAT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      });

      const reply = completion.choices[0]?.message?.content ?? '';
      res.json({ reply });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      res.status(500).json({ ok: false, error: message });
    }
  });

  return router;
}
