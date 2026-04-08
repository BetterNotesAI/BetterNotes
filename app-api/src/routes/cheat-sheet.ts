// app-api/src/routes/cheat-sheet.ts
// POST /cheat-sheet/generate  — SSE streaming cheat sheet generation
// POST /cheat-sheet/chat      — non-streaming sub-chat reply

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const CHEAT_SHEET_SYSTEM_PROMPT = `You are an expert study assistant specializing in creating dense, information-rich cheat sheets for students.
Your task is to generate a comprehensive cheat sheet from the provided content.

Guidelines:
- Structure with clear Markdown headers (## Topic, ### Subtopic)
- Pack as much useful information per line as possible — this is a reference, not a textbook
- Include: key definitions, important formulas, critical properties, notable theorems, quick examples
- CRITICAL — Math formatting rules (follow EXACTLY):
  - Inline math: use $...$ (e.g. $E = mc^2$)
  - Display math (standalone formulas): use $$ on its own line:
    $$
    \\int_a^b f(x)\\,dx = F(b) - F(a)
    $$
  - NEVER use \\(...\\) or \\[...\\] — ONLY use $ and $$
  - NEVER use \\begin{equation} or \\begin{align} outside $$ blocks
- Use **bold** for terms, *italic* for emphasis, \`code\` for code/syntax
- Use tables for comparisons, property lists, or parameter summaries
- Use bullet lists for enumerable facts
- Group related concepts together
- End each section with the most important formula or rule to remember
- Do NOT include long prose explanations — be extremely concise
- Assume the reader already has basic familiarity; focus on the precise details they need during an exam`;

const SUB_CHAT_SYSTEM_PROMPT = `You are a helpful study assistant. The student is working with a cheat sheet.
You have access to the full cheat sheet content. Answer follow-up questions clearly and concisely.
Math formatting: use $...$ for inline math and $$...$$ for display math on its own line. NEVER use \\(...\\) or \\[...\\].`;

export interface CheatSheetProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  openaiBaseURL?: string;
}

export interface CheatSheetRouterOptions {
  openaiApiKey?: string;
  openaiModel?: string;
  openaiBaseURL?: string;
  providers?: CheatSheetProviderConfig[];
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

function buildProviderChain(opts: CheatSheetRouterOptions): ProviderRuntime[] {
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

export function createCheatSheetRouter(opts: CheatSheetRouterOptions): Router {
  const router = Router();
  const providerChain = buildProviderChain(opts);

  // ─── POST /cheat-sheet/generate ───────────────────────────────────────────────
  // Accepts { title, sourceText, language, subject? }, streams cheat sheet as SSE.
  // Events:
  //   data: {"chunk": "..."}  — incremental text
  //   data: {"done": true}    — end of stream
  //   data: {"error": "..."}  — error during stream
  router.post('/generate', async (req: Request, res: Response) => {
    const {
      title,
      sourceText,
      language,
      subject,
    } = req.body as {
      title?: string;
      sourceText?: string;
      language?: string;
      subject?: string;
    };

    if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
      res.status(400).json({ ok: false, error: 'sourceText is required' });
      return;
    }

    // SSE headers
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
      sendEvent({ error: 'No Cheat Sheet providers configured.' });
      res.end();
      return;
    }

    const langNote = language && language !== 'english'
      ? `\n\nIMPORTANT: Generate the entire cheat sheet in ${language}.`
      : '';

    const subjectNote = subject ? ` for ${subject}` : '';
    const titleNote = title ? `\n\nCheat sheet title: "${title}"` : '';

    const userPrompt = [
      `Generate a comprehensive cheat sheet${subjectNote} from the following content.${titleNote}${langNote}`,
      '',
      '--- SOURCE CONTENT ---',
      sourceText.trim(),
      '--- END OF SOURCE ---',
    ].join('\n');

    let lastError: unknown = null;
    try {
      for (const provider of providerChain) {
        try {
          const completion = await provider.client.chat.completions.create({
            model: provider.model,
            stream: true,
            messages: [
              { role: 'system', content: CHEAT_SHEET_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
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
            sendEvent({ error: `Streaming failed on ${provider.name}: ${toErrorMessage(streamErr)}` });
            return;
          }
        } catch (providerErr: unknown) {
          lastError = providerErr;
          continue;
        }
      }

      sendEvent({ error: `All providers failed. Last error: ${toErrorMessage(lastError)}` });
    } catch (err: unknown) {
      sendEvent({ error: toErrorMessage(err) });
    } finally {
      res.end();
    }
  });

  // ─── POST /cheat-sheet/chat ────────────────────────────────────────────────────
  // Non-streaming. Accepts { contentMd, history, userMessage }, returns { reply }.
  router.post('/chat', async (req: Request, res: Response) => {
    const {
      contentMd,
      history,
      userMessage,
    } = req.body as {
      contentMd?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userMessage?: string;
    };

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      res.status(400).json({ ok: false, error: 'userMessage is required' });
      return;
    }

    if (providerChain.length === 0) {
      res.status(500).json({ ok: false, error: 'No Cheat Sheet providers configured.' });
      return;
    }

    const cheatSheetContext = contentMd
      ? `[CHEAT SHEET]\n${contentMd}\n[/CHEAT SHEET]`
      : '[CHEAT SHEET]\nNo cheat sheet generated yet.\n[/CHEAT SHEET]';

    const historyLines = (history ?? [])
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const userContent = [
      cheatSheetContext,
      historyLines ? `\nPrevious conversation:\n${historyLines}` : '',
      `\nStudent question: ${userMessage.trim()}`,
    ]
      .filter(Boolean)
      .join('');

    let lastError: unknown = null;
    for (const provider of providerChain) {
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
        res.json({ ok: true, reply });
        return;
      } catch (err: unknown) {
        lastError = err;
        continue;
      }
    }

    res.status(500).json({ ok: false, error: `All providers failed. Last error: ${toErrorMessage(lastError)}` });
  });

  return router;
}
