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
- CRITICAL — Math formatting rules (follow these EXACTLY):
  - Inline math: wrap with dollar signs like $x^2 + y^2 = r^2$
  - Display math: wrap with double dollar signs on their own lines:
    $$
    \\int_a^b f(x)\\,dx = F(b) - F(a)
    $$
  - NEVER use \\(...\\) or \\[...\\] delimiters — ONLY use $ and $$
  - NEVER use \\begin{equation} or \\begin{align} outside of $$ blocks
- Use tables (Markdown) for comparisons, summaries, or data
- Use **bold** for key concepts and *italic* for definitions
- For physics/engineering problems: draw ASCII diagrams if helpful
- End with a brief summary of key results in a highlighted section
- If the PDF contains multiple problems, solve each one clearly numbered
- Be thorough but clear — this is for a student who needs to understand, not just get the answer`;

const SUB_CHAT_SYSTEM_PROMPT = `You are a helpful study assistant. The student is working on a problem that has already been solved.
You have access to the full solution. Answer the student's follow-up questions clearly and concisely.
Math formatting: use $...$ for inline math and $$...$$ for display math. NEVER use \\(...\\) or \\[...\\] delimiters.`;

export interface ProblemSolverRouterOptions {
  openaiApiKey?: string;
  openaiModel?: string;
  /** Optional base URL for OpenAI-compatible providers (Groq, OpenRouter, Google AI Studio). */
  openaiBaseURL?: string;
  /** Preferred provider chain with fallback order. */
  providers?: ProblemSolverProviderConfig[];
}

export interface ProblemSolverProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  openaiBaseURL?: string;
}

interface ProviderRuntime {
  name: string;
  model: string;
  client: OpenAI;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}

function buildProviderChain(opts: ProblemSolverRouterOptions): ProviderRuntime[] {
  const fromProviders = (opts.providers ?? [])
    .filter((p) => p.apiKey?.trim() && p.model?.trim())
    .map((p) => ({
      name: p.name,
      model: p.model,
      client: new OpenAI({
        apiKey: p.apiKey,
        ...(p.openaiBaseURL ? { baseURL: p.openaiBaseURL } : {}),
      }),
    }));

  if (fromProviders.length > 0) return fromProviders;

  if (!opts.openaiApiKey?.trim()) return [];
  return [{
    name: 'openai',
    model: opts.openaiModel ?? 'gpt-4o',
    client: new OpenAI({
      apiKey: opts.openaiApiKey,
      ...(opts.openaiBaseURL ? { baseURL: opts.openaiBaseURL } : {}),
    }),
  }];
}

export function createProblemSolverRouter(opts: ProblemSolverRouterOptions): Router {
  const router = Router();
  const providerChain = buildProviderChain(opts);

  // ─── GET /problem-solver/providers ──────────────────────────────────────────
  // Returns the list of available providers for the model selector UI.
  router.get('/providers', (_req: Request, res: Response) => {
    const available = providerChain.map((p) => ({
      name: p.name,
      model: p.model,
    }));
    res.json({ providers: available });
  });

  // ─── POST /problem-solver/solve ───────────────────────────────────────────────
  // Accepts { pdfText: string, provider?: string }, streams the solution as SSE.
  // If provider is specified, uses that provider only. Otherwise uses fallback chain.
  // Events:
  //   data: {"chunk": "..."}  — incremental text
  //   data: {"done": true}    — end of stream
  //   data: {"error": "..."}  — error during stream
  router.post('/solve', async (req: Request, res: Response) => {
    const { pdfText, provider: preferredProvider } = req.body as { pdfText?: string; provider?: string };

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

    if (providerChain.length === 0) {
      sendEvent({ error: 'No Problem Solver providers configured.' });
      res.end();
      return;
    }

    // If a specific provider is requested, use only that one
    const activeChain = preferredProvider
      ? providerChain.filter((p) => p.name === preferredProvider)
      : providerChain;

    if (activeChain.length === 0) {
      sendEvent({ error: `Provider "${preferredProvider}" not found or not configured.` });
      res.end();
      return;
    }

    let lastError: unknown = null;
    try {
      for (const provider of activeChain) {
        try {
          const completion = await provider.client.chat.completions.create({
            model: provider.model,
            stream: true,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Solve the following problem:\n\n${pdfText}` },
            ],
          });

          let emittedAnyChunk = false;
          try {
            for await (const chunk of completion) {
              const text = chunk.choices[0]?.delta?.content ?? '';
              if (text) {
                emittedAnyChunk = true;
                sendEvent({ chunk: text });
              }
            }
            sendEvent({ done: true });
            return;
          } catch (streamErr: unknown) {
            if (!emittedAnyChunk) {
              lastError = streamErr;
              continue;
            }
            sendEvent({
              error: `Streaming failed on ${provider.name}: ${toErrorMessage(streamErr)}`,
            });
            return;
          }
        } catch (providerErr: unknown) {
          lastError = providerErr;
          continue;
        }
      }

      sendEvent({
        error: `All providers failed. Last error: ${toErrorMessage(lastError)}`,
      });
    } catch (err: unknown) {
      const message = toErrorMessage(err);
      sendEvent({ error: message });
    } finally {
      res.end();
    }
  });

  // ─── POST /problem-solver/chat ───────────────────────────────────────────────
  // Non-streaming. Accepts { solutionMd, history, userMessage }, returns { reply }.
  // history: array of { role: 'user' | 'assistant'; content: string }
  router.post('/chat', async (req: Request, res: Response) => {
    const { solutionMd, history, userMessage, provider: preferredProvider } = req.body as {
      solutionMd?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userMessage?: string;
      provider?: string;
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

    if (providerChain.length === 0) {
      res.status(500).json({ ok: false, error: 'No Problem Solver providers configured.' });
      return;
    }

    const activeChain = preferredProvider
      ? providerChain.filter((p) => p.name === preferredProvider)
      : providerChain;

    if (activeChain.length === 0) {
      res.status(400).json({ ok: false, error: `Provider "${preferredProvider}" not found.` });
      return;
    }

    let lastError: unknown = null;
    try {
      for (const provider of activeChain) {
        try {
          const completion = await provider.client.chat.completions.create({
            model: provider.model,
            stream: false,
            messages: [
              { role: 'system', content: SUB_CHAT_SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
          });

          const reply = completion.choices[0]?.message?.content ?? '';
          res.json({ reply });
          return;
        } catch (providerErr: unknown) {
          lastError = providerErr;
          continue;
        }
      }

      res.status(502).json({
        ok: false,
        error: `All providers failed. Last error: ${toErrorMessage(lastError)}`,
      });
    } catch (err: unknown) {
      const message = toErrorMessage(err);
      res.status(500).json({ ok: false, error: message });
    }
  });

  return router;
}
