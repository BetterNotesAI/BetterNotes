// F4-M1.3 — POST /api/problem-solver/sessions/[id]/solve
// Streams the AI solution for a problem-solver session as Server-Sent Events.
//
// SSE event shapes:
//   data: {"chunk": "..."}   — incremental solution text
//   data: {"done": true}     — stream complete
//   data: {"error": "..."}   — error during streaming

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: sessionId } = await params;

  // Read optional provider from request body
  let preferredProvider: string | undefined;
  try {
    const body = await req.json().catch(() => ({})) as { provider?: string };
    preferredProvider = body.provider;
  } catch {
    // No body or invalid JSON — proceed without provider preference
  }

  // ── 2. Ownership check ───────────────────────────────────────────────────────
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id, user_id, pdf_text, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 3. Verify pdf_text exists ────────────────────────────────────────────────
  if (!session.pdf_text) {
    return new Response(
      JSON.stringify({ error: 'PDF text not extracted yet' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 4. Mark session as solving ───────────────────────────────────────────────
  await supabase
    .from('problem_solver_sessions')
    .update({ status: 'solving' })
    .eq('id', sessionId);

  // ── 5. Set up SSE TransformStream ────────────────────────────────────────────
  const encoder = new TextEncoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transform.writable.getWriter();

  const sendEvent = async (payload: Record<string, unknown>): Promise<void> => {
    await writer.write(
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
    );
  };

  // ── 6. Stream in background ──────────────────────────────────────────────────
  (async () => {
    let solutionMd = '';

    try {
      const apiResp = await fetch(`${API_URL}/problem-solver/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_INTERNAL_TOKEN
            ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          pdfText: session.pdf_text,
          ...(preferredProvider ? { provider: preferredProvider } : {}),
        }),
      });

      if (!apiResp.ok || !apiResp.body) {
        const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
        await sendEvent({ error: errBody?.error ?? 'Failed to reach solve API' });
        await supabase
          .from('problem_solver_sessions')
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

        // SSE lines are separated by double newlines
        const parts = buffer.split('\n\n');
        // Keep the last (possibly incomplete) segment in the buffer
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
            solutionMd += event.chunk;
            await sendEvent({ chunk: event.chunk });
          } else if (event.done === true) {
            // Will be sent after the loop
          } else if (typeof event.error === 'string') {
            await sendEvent({ error: event.error });
            await supabase
              .from('problem_solver_sessions')
              .update({ status: 'error' })
              .eq('id', sessionId);
            return;
          }
        }
      }

      // ── 7. Persist solution and mark done ──────────────────────────────────
      await supabase
        .from('problem_solver_sessions')
        .update({
          solution_md: solutionMd,
          status: 'done',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      await sendEvent({ done: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected streaming error';
      await sendEvent({ error: message }).catch(() => undefined);

      // ── 8. Mark session as error on failure ────────────────────────────────
      await supabase
        .from('problem_solver_sessions')
        .update({ status: 'error' })
        .eq('id', sessionId);
    } finally {
      await writer.close().catch(() => undefined);
    }
  })();

  // ── Return the readable stream immediately ───────────────────────────────────
  return new Response(transform.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
