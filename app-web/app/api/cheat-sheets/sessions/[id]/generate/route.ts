// POST /api/cheat-sheets/sessions/[id]/generate
// Streams the AI cheat sheet as Server-Sent Events.
//
// SSE event shapes:
//   data: {"chunk": "..."}   — incremental cheat sheet text
//   data: {"done": true}     — stream complete
//   data: {"error": "..."}   — error during streaming

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders } from '@/lib/ai-usage';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: sessionId } = await params;

  // ── 2. Load session ──────────────────────────────────────────────────────────
  const { data: session, error: sessionError } = await supabase
    .from('cheat_sheet_sessions')
    .select('id, user_id, title, source_doc_ids, external_content, language, subject')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Read optional language override from body ──────────────────────────────
  let bodyLanguage: string | undefined;
  try {
    const body = await req.json().catch(() => ({})) as { language?: string };
    bodyLanguage = body.language;
  } catch {
    // No body — proceed with session language
  }

  // ── 4. Build source text from selected documents ──────────────────────────────
  const docIds: string[] = session.source_doc_ids ?? [];
  const sourceParts: string[] = [];

  if (docIds.length > 0) {
    // Fetch document content (blocks) for selected docs
    const { data: blocks } = await supabase
      .from('blocks')
      .select('document_id, content, latex_source')
      .in('document_id', docIds)
      .order('position', { ascending: true });

    if (blocks && blocks.length > 0) {
      // Group by document_id to keep docs together
      const byDoc: Record<string, string[]> = {};
      for (const block of blocks) {
        const docId = block.document_id as string;
        if (!byDoc[docId]) byDoc[docId] = [];
        const text = (block.content ?? block.latex_source ?? '') as string;
        if (text.trim()) byDoc[docId].push(text.trim());
      }

      for (const [, lines] of Object.entries(byDoc)) {
        sourceParts.push(lines.join('\n'));
      }
    }
  }

  // Add external_content if present
  if (session.external_content?.trim()) {
    sourceParts.push(session.external_content.trim());
  }

  const sourceText = sourceParts.join('\n\n---\n\n');

  if (!sourceText.trim()) {
    return new Response(
      JSON.stringify({ error: 'No source content found. Add documents or paste text before generating.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 5. Mark session as generating ────────────────────────────────────────────
  await supabase
    .from('cheat_sheet_sessions')
    .update({ status: 'generating' })
    .eq('id', sessionId);

  // ── 6. Set up SSE TransformStream ────────────────────────────────────────────
  const encoder = new TextEncoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transform.writable.getWriter();

  const sendEvent = async (payload: Record<string, unknown>): Promise<void> => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  // ── 7. Stream in background ──────────────────────────────────────────────────
  (async () => {
    let contentMd = '';
    const language = bodyLanguage ?? session.language ?? 'english';

    try {
      const apiResp = await fetch(`${API_URL}/cheat-sheet/generate`, {
        method: 'POST',
        headers: buildInternalApiHeaders(user.id, 'cheat_sheet_generate', API_INTERNAL_TOKEN, {
          projectType: 'cheat_sheet',
          projectId: sessionId,
        }),
        body: JSON.stringify({
          title: session.title,
          sourceText,
          language,
          subject: session.subject,
        }),
      });

      if (!apiResp.ok || !apiResp.body) {
        const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
        await sendEvent({ error: errBody?.error ?? 'Failed to reach generate API' });
        await supabase
          .from('cheat_sheet_sessions')
          .update({ status: 'error' })
          .eq('id', sessionId);
        return;
      }

      // Forward SSE chunks from app-api to the client
      const reader = apiResp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;

          const jsonStr = line.slice('data:'.length).trim();
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(jsonStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof event.chunk === 'string') {
            contentMd += event.chunk;
            await sendEvent({ chunk: event.chunk });
          } else if (event.done === true) {
            // Will be sent after the loop
          } else if (typeof event.error === 'string') {
            await sendEvent({ error: event.error });
            await supabase
              .from('cheat_sheet_sessions')
              .update({ status: 'error' })
              .eq('id', sessionId);
            return;
          }
        }
      }

      // ── 8. Persist and mark done ──────────────────────────────────────────────
      await supabase
        .from('cheat_sheet_sessions')
        .update({
          content_md: contentMd,
          status: 'done',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      await sendEvent({ done: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected streaming error';
      await sendEvent({ error: message }).catch(() => undefined);
      await supabase
        .from('cheat_sheet_sessions')
        .update({ status: 'error' })
        .eq('id', sessionId);
    } finally {
      await writer.close().catch(() => undefined);
    }
  })();

  return new Response(transform.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
