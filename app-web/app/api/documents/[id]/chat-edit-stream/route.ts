/**
 * POST /api/documents/[id]/chat-edit-stream
 *
 * Streams document-level AI edits for the interactive viewer. The route saves
 * the user message immediately, relays LaTeX chunks from app-api, validates the
 * final document once, and returns the final modified LaTeX to the client so the
 * existing compile/persist flow can create the new version.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota, recordAiUsage } from '@/lib/ai-usage';
import { buildDocumentProjectContext, type UsageProjectContext } from '@/lib/usage-project';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface StreamEvent {
  chunk?: string;
  done?: boolean;
  error?: string;
  type?: 'edit' | 'message';
  content?: string;
  latex?: string;
  summary?: string;
  compileLog?: string;
  userMessageSaved?: boolean;
  usage?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  } | null;
}

type UpstreamUsage = NonNullable<StreamEvent['usage']>;

interface ApiEditResult {
  type?: 'edit' | 'message' | string;
  latex?: string;
  summary?: string;
  content?: string;
}

function decodeLatexHeader(response: Response, fallback: string): string {
  const latexB64 = response.headers.get('x-betternotes-latex') ?? '';
  return latexB64 ? Buffer.from(latexB64, 'base64').toString('utf8') : fallback;
}

async function readSseEvents(
  response: Response,
  onEvent: (event: StreamEvent) => Promise<void>,
): Promise<void> {
  if (!response.body) throw new Error('Streaming response had no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim());
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      if (!payload) continue;
      await onEvent(JSON.parse(payload) as StreamEvent);
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    await onEvent(JSON.parse(tail.slice('data:'.length).trim()) as StreamEvent);
  }
}

async function compileLatexForPreview(latex: string): Promise<
  | { ok: true; latex: string }
  | { ok: false; error: string; compileLog?: string }
> {
  const validateResp = await fetch(`${API_URL}/latex/compile-only`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
    },
    body: JSON.stringify({ latex }),
  });

  if (validateResp.ok) {
    return { ok: true, latex: decodeLatexHeader(validateResp, latex) };
  }

  const errBody = await validateResp.json().catch(() => ({}));
  return {
    ok: false,
    error: typeof errBody?.error === 'string' ? errBody.error : 'Compilation failed',
    compileLog: typeof errBody?.compileLog === 'string' ? errBody.compileLog : undefined,
  };
}

async function validateLatexWithRepair(latex: string): Promise<
  | { ok: true; latex: string; repaired: boolean }
  | { ok: false; error: string; compileLog?: string }
> {
  const firstAttempt = await compileLatexForPreview(latex);
  if (firstAttempt.ok) {
    return { ok: true, latex: firstAttempt.latex, repaired: false };
  }

  const fixResp = await fetch(`${API_URL}/latex/fix-latex`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
    },
    body: JSON.stringify({ latex, log: firstAttempt.compileLog ?? firstAttempt.error }),
  });

  if (!fixResp.ok) {
    return firstAttempt;
  }

  const fixBody = await fixResp.json().catch(() => ({}));
  const fixedLatex = typeof fixBody?.fixedLatex === 'string' ? fixBody.fixedLatex : '';
  if (!fixedLatex.trim()) {
    return firstAttempt;
  }

  const repairAttempt = await compileLatexForPreview(fixedLatex);
  if (repairAttempt.ok) {
    return { ok: true, latex: repairAttempt.latex, repaired: true };
  }

  return repairAttempt;
}

async function saveAssistantMessage(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  content: string,
): Promise<void> {
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: userId,
    role: 'assistant',
    content,
  });
}

async function callNonStreamingEdit({
  userId,
  prompt,
  fullLatex,
  templateId,
  projectContext,
}: {
  userId: string;
  prompt: string;
  fullLatex: string;
  templateId: string;
  projectContext: UsageProjectContext;
}): Promise<ApiEditResult> {
  const resp = await fetch(`${API_URL}/latex/edit-document`, {
    method: 'POST',
    headers: buildInternalApiHeaders(userId, 'document_chat_edit', API_INTERNAL_TOKEN, projectContext),
    body: JSON.stringify({
      prompt,
      fullLatex,
      templateId,
    }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const message = typeof body?.error === 'string'
      ? body.error
      : `AI edit failed (${resp.status})`;
    throw new Error(message);
  }

  return resp.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  const { data: doc } = await supabase
    .from('documents')
    .select('id, template_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.template_id !== 'clean_3cols_landscape') {
    return NextResponse.json({ error: 'streaming_edit_not_supported_for_template' }, { status: 400 });
  }

  const projectContext = buildDocumentProjectContext(documentId, doc.template_id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_anonymous) {
    return NextResponse.json({ error: 'account_required_for_generation' }, { status: 403 });
  }

  let body: { prompt?: unknown; fullLatex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompt, fullLatex } = body;

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  if (!fullLatex || typeof fullLatex !== 'string') {
    return NextResponse.json({ error: 'fullLatex is required' }, { status: 400 });
  }

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 },
    );
  }

  const { error: userMessageError } = await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'user',
    content: prompt,
  });
  if (userMessageError) {
    return NextResponse.json({ error: userMessageError.message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const handleCompletedResult = async (result: ApiEditResult) => {
          if (result.type === 'message' && typeof result.content === 'string') {
            await saveAssistantMessage(supabase, documentId, user.id, result.content);
            send({ done: true, type: 'message', content: result.content, userMessageSaved: true });
            return;
          }

          if (result.type !== 'edit' || typeof result.latex !== 'string') {
            await saveAssistantMessage(
              supabase,
              documentId,
              user.id,
              'I could not apply that edit because the AI did not return a document.',
            );
            send({ error: 'AI did not return a modified document.', userMessageSaved: true });
            return;
          }

          const finalSummary = typeof result.summary === 'string' && result.summary.trim()
            ? result.summary
            : 'Document updated';
          const validation = await validateLatexWithRepair(result.latex);
          if (!validation.ok) {
            await saveAssistantMessage(
              supabase,
              documentId,
              user.id,
              'I could not apply that edit because the generated LaTeX failed to compile, and the automatic repair also failed.',
            );
            send({
              error: 'AI generated invalid LaTeX that failed to compile, and automatic repair failed. Try a smaller or more specific edit.',
              compileLog: validation.compileLog,
              userMessageSaved: true,
            });
            return;
          }

          await saveAssistantMessage(
            supabase,
            documentId,
            user.id,
            validation.repaired
              ? `${finalSummary} The LaTeX was repaired automatically before preview.`
              : finalSummary,
          );

          send({
            done: true,
            type: 'edit',
            latex: validation.latex,
            summary: finalSummary,
            userMessageSaved: true,
          });
        };

        const fallbackToNonStreamingEdit = async (reason: string) => {
          console.warn('[chat-edit-stream] Falling back to non-streaming edit:', reason);
          const fallbackResult = await callNonStreamingEdit({
            userId: user.id,
            prompt,
            fullLatex,
            templateId: doc.template_id ?? '',
            projectContext,
          });
          await handleCompletedResult(fallbackResult);
        };

        const apiResp = await fetch(`${API_URL}/latex/edit-document-stream`, {
          method: 'POST',
          headers: buildInternalApiHeaders(user.id, 'document_chat_edit_stream', API_INTERNAL_TOKEN, projectContext),
          body: JSON.stringify({
            prompt,
            fullLatex,
            templateId: doc.template_id ?? '',
          }),
        });

        if (!apiResp.ok) {
          const errBody = await apiResp.json().catch(() => ({}));
          const reason = typeof errBody?.error === 'string'
            ? errBody.error
            : `streaming endpoint failed (${apiResp.status})`;
          await fallbackToNonStreamingEdit(reason);
          return;
        }

        let finalResult: ApiEditResult | null = null;
        let upstreamUsage: UpstreamUsage | null = null;

        try {
          await readSseEvents(apiResp, async (event) => {
            if (event.error) throw new Error(event.error);
            if (event.chunk) send({ chunk: event.chunk });

            if (event.done) {
              finalResult = {
                type: event.type,
                content: event.content,
                latex: event.latex,
                summary: event.summary,
              };
              upstreamUsage = event.usage ?? null;
            }
          });
        } catch (streamError) {
          const reason = streamError instanceof Error ? streamError.message : 'streaming edit failed';
          await fallbackToNonStreamingEdit(reason);
          return;
        }

        const usageForRecord = upstreamUsage as UpstreamUsage | null;
        if (usageForRecord?.provider && usageForRecord?.model) {
          await recordAiUsage({
            supabase,
            userId: user.id,
            provider: usageForRecord.provider,
            model: usageForRecord.model,
            usage: {
              prompt_tokens: (usageForRecord.inputTokens ?? 0) + (usageForRecord.cachedInputTokens ?? 0),
              completion_tokens: usageForRecord.outputTokens ?? 0,
              prompt_tokens_details: { cached_tokens: usageForRecord.cachedInputTokens ?? 0 },
            },
            feature: 'document_chat_edit_stream',
            projectType: projectContext.projectType ?? null,
            projectId: projectContext.projectId ?? null,
            metadata: { source: 'app-web-stream-relay' },
          });
        }

        await handleCompletedResult(finalResult ?? {});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI edit failed';
        await saveAssistantMessage(
          supabase,
          documentId,
          user.id,
          `I couldn't edit the document: ${message}`,
        );
        send({ error: message, userMessageSaved: true });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
