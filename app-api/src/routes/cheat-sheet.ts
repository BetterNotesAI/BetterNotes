// app-api/src/routes/cheat-sheet.ts
// POST /cheat-sheet/generate  — SSE streaming cheat sheet generation
// POST /cheat-sheet/chat      — non-streaming sub-chat reply

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { recordModelUsage, type ModelUsagePayload } from '../lib/usage/tracker';

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
You have access to the selected cheat sheet content. Answer questions clearly and concisely.
Math formatting: use $...$ for inline math and $$...$$ for display math on its own line. NEVER use \\(...\\) or \\[...\\].

IMPORTANT — The FIRST line of your response must be exactly one of these four tags, alone on its own line:
[EDIT:yes]    — the student wants to modify, rewrite, expand, improve, shorten, fix, or translate the selected content
[EDIT:insert] — the student wants to ADD or INSERT new content after the selected content (the original is kept)
[EDIT:delete] — the student wants to delete or remove the selected content
[EDIT:no]     — the student is asking a question or wants an explanation (NOT changing content)

Then a blank line, then follow EXACTLY these rules:

When [EDIT:yes]:
  Output ONLY the replacement markdown. No intro sentence. No "Here is the result:". No explanation.
  Start directly with the replacement content. Your entire response is inserted verbatim in place of the selection.

When [EDIT:insert]:
  Output ONLY the new markdown to insert AFTER the selected content. No intro. No explanation.
  The original selected content is preserved — only the new content is added after it.

When [EDIT:delete]:
  Output nothing — leave the response empty after the tag. The system deletes automatically.

When [EDIT:no]:
  Answer the question normally with explanation.`;

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

function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
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
            ...(provider.name === 'openai' ? { stream_options: { include_usage: true } } : {}),
            messages: [
              { role: 'system', content: CHEAT_SHEET_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          });

          let emittedAnyChunk = false;
          let streamedOutput = '';
          let usagePayload: ModelUsagePayload | null = null;
          try {
            for await (const chunk of completion) {
              if (chunk.usage) {
                usagePayload = chunk.usage as ModelUsagePayload;
              }
              const text = chunk.choices[0]?.delta?.content ?? '';
              if (text) {
                emittedAnyChunk = true;
                streamedOutput += text;
                sendEvent({ chunk: text });
              }
            }

            const finalUsagePayload: ModelUsagePayload = usagePayload ?? {
              prompt_tokens: estimateTokenCount(`${CHEAT_SHEET_SYSTEM_PROMPT}\n${userPrompt}`),
              completion_tokens: estimateTokenCount(streamedOutput),
              prompt_tokens_details: { cached_tokens: 0 },
            };

            await recordModelUsage({
              provider: provider.name,
              model: provider.model,
              usage: finalUsagePayload,
              feature: 'cheat_sheet_generate_stream',
              metadata: {
                stream: true,
                usage_estimated: usagePayload === null,
              },
            });

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
        const raw = completion.choices[0]?.message?.content ?? '';

        await recordModelUsage({
          provider: provider.name,
          model: provider.model,
          usage: completion.usage ?? {
            prompt_tokens: estimateTokenCount(`${SUB_CHAT_SYSTEM_PROMPT}\n${userContent}`),
            completion_tokens: estimateTokenCount(raw),
            prompt_tokens_details: { cached_tokens: 0 },
          },
          feature: 'cheat_sheet_chat',
          metadata: { usage_estimated: !completion.usage },
        });

        // Detect intent tag (search anywhere — models don't always put it first)
        const deleteMarkerMatch = raw.match(/\[EDIT\s*:\s*delete\]/i);
        const insertMarkerMatch = raw.match(/\[EDIT\s*:\s*insert\]/i);
        const editMarkerMatch = raw.match(/\[EDIT\s*:\s*(yes|no)\]/i);
        const isDeleteIntentFromMarker = !!deleteMarkerMatch;
        const isInsertIntentFromMarker = !!insertMarkerMatch;
        const isEditIntentFromMarker = editMarkerMatch ? editMarkerMatch[1].toLowerCase() === 'yes' : null;
        // Strip all intent tags from the reply shown in chat
        const reply = raw
          .replace(/[*_`]*\[EDIT\s*:\s*(?:yes|no|delete|insert)\][*_`]*[ \t]*\n?/gi, '')
          .trimStart()
          .trimEnd();
        // Fallback keyword detection when model omits the tag
        const DELETE_KW = /\b(esborra|elimina|suprimeix|remove|delete|borra|quita|treu(?:-ho)?|esborrar|eliminar)\b/i;
        const INSERT_KW = /\b(afegeix|afegir|add|insereix|inserir|insert|nou apartat|nova secci[oó]|append)\b/i;
        const EDIT_KW = /\b(rewrite|rescri(?:u|be)|simplif(?:y|ica)|shorten|escurç|acort|lengthen|allar(?:ga)|expand|amplia|improv(?:e|a)|millo?ra|updat(?:e|a)|actualitz|replac(?:e|a)|substitueix|cambia|canvia|change|modif(?:y|ica)|edit(?:a)?|arregla|fix|reformat|restructur|summar(?:iz|itz)|extend|ampliar|amplía)\b/i;
        const noMarker = !deleteMarkerMatch && !insertMarkerMatch && !editMarkerMatch;
        const isDeleteIntent = isDeleteIntentFromMarker || (noMarker && DELETE_KW.test(userMessage ?? ''));
        const isInsertIntent = isInsertIntentFromMarker || (!isDeleteIntent && noMarker && INSERT_KW.test(userMessage ?? ''));
        const isEditIntent = isEditIntentFromMarker !== null
          ? isEditIntentFromMarker
          : !isDeleteIntent && !isInsertIntent && EDIT_KW.test(userMessage ?? '');
        const editContent: string | null = (isEditIntent || isInsertIntent) ? reply : null;
        res.json({ ok: true, reply, isEditIntent, isDeleteIntent, isInsertIntent, editContent });
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
