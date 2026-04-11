/**
 * POST /api/documents/[id]/chat-edit
 *
 * Document-level AI edit endpoint for the interactive viewer.
 * Calls app-api /latex/edit-document and handles both response types:
 *
 * - type === 'edit':
 *     Does NOT compile (user may discard).
 *     Saves an assistant message in chat_messages with the summary.
 *     Returns { type: 'edit', modifiedLatex, summary }.
 *
 * - type === 'message':
 *     Saves the user prompt AND the AI response in chat_messages.
 *     Returns { type: 'message', content }.
 *
 * Body: { prompt: string, fullLatex: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Verify ownership + get template_id
  const { data: doc } = await supabase
    .from('documents')
    .select('id, template_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  const projectContext = buildDocumentProjectContext(documentId, doc.template_id);

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
      { status: 402 }
    );
  }

  // Save user message first (both paths need this)
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'user',
    content: prompt,
  });

  // Call app-api /latex/edit-document
  let apiResult: { type: string; latex?: string; summary?: string; content?: string };
  try {
    const apiResp = await fetch(`${API_URL}/latex/edit-document`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_chat_edit', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        prompt,
        fullLatex,
        templateId: doc.template_id ?? '',
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' }));
      return NextResponse.json(
        { error: errBody?.error ?? 'AI edit failed' },
        { status: apiResp.status >= 500 ? 502 : apiResp.status }
      );
    }

    apiResult = await apiResp.json();
  } catch (fetchErr: any) {
    return NextResponse.json(
      { error: `Failed to reach app-api: ${fetchErr.message}` },
      { status: 502 }
    );
  }

  // Handle 'edit' response
  if (apiResult.type === 'edit' && typeof apiResult.latex === 'string') {
    const summary = typeof apiResult.summary === 'string'
      ? apiResult.summary
      : 'Document updated';

    // IA-M1: Pre-validate the AI-generated LaTeX by attempting a compile before showing
    // the preview to the user. If compilation fails, return an error instead of presenting
    // broken LaTeX. This prevents the "Apply" step from failing with a bad document.
    try {
      const validateResp = await fetch(`${API_URL}/latex/compile-only`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
        },
        body: JSON.stringify({ latex: apiResult.latex }),
      });

      if (!validateResp.ok) {
        const errBody = await validateResp.json().catch(() => ({}));
        // Save user message was already saved above; save a system error note
        await supabase.from('chat_messages').insert({
          document_id: documentId,
          user_id: user.id,
          role: 'assistant',
          content: `[AI edit rejected — LaTeX failed to compile: ${errBody?.error ?? 'compile error'}]`,
        });
        return NextResponse.json(
          {
            error: `AI generated invalid LaTeX that failed to compile. Try rephrasing your request.`,
            compileLog: errBody?.compileLog,
          },
          { status: 422 }
        );
      }
    } catch (validateErr: any) {
      // Validation unreachable — skip validation and allow the preview (best-effort)
      console.warn('[chat-edit] LaTeX pre-validation unavailable:', validateErr.message);
    }

    // Save assistant message with the summary (NOT the full LaTeX)
    await supabase.from('chat_messages').insert({
      document_id: documentId,
      user_id: user.id,
      role: 'assistant',
      content: summary,
    });

    return NextResponse.json({
      type: 'edit',
      modifiedLatex: apiResult.latex,
      summary,
    });
  }

  // Handle 'message' response
  if (apiResult.type === 'message' && typeof apiResult.content === 'string') {
    // Save assistant response
    await supabase.from('chat_messages').insert({
      document_id: documentId,
      user_id: user.id,
      role: 'assistant',
      content: apiResult.content,
    });

    return NextResponse.json({
      type: 'message',
      content: apiResult.content,
    });
  }

  // Unexpected shape from app-api
  return NextResponse.json(
    { error: 'Unexpected response from AI service' },
    { status: 502 }
  );
}
