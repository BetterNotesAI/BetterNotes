/**
 * POST /api/documents/[id]/chat-edit
 *
 * Document-level AI edit endpoint for the interactive viewer.
 * Calls app-api /latex/edit-document and handles both response types:
 *
 * - type === 'edit':
 *     Validates the generated LaTeX and attempts one repair if compilation fails.
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

function decodeLatexHeader(response: Response, fallback: string): string {
  const latexB64 = response.headers.get('x-betternotes-latex') ?? '';
  return latexB64 ? Buffer.from(latexB64, 'base64').toString('utf8') : fallback;
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string,
  content: string
): Promise<void> {
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: userId,
    role: 'assistant',
    content,
  });
}

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', user.id)
    .maybeSingle();
  const isAnonymous = Boolean(profile?.is_anonymous);

  if (isAnonymous) {
    return NextResponse.json(
      { error: 'account_required_for_generation' },
      { status: 403 }
    );
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
      { status: 402 }
    );
  }

  // Save user message first (both paths need this)
  const { error: userMessageError } = await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'user',
    content: prompt,
  });
  if (userMessageError) {
    return NextResponse.json({ error: userMessageError.message }, { status: 500 });
  }

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
      await saveAssistantMessage(
        supabase,
        documentId,
        user.id,
        `I couldn't edit the document: ${errBody?.error ?? 'AI edit failed'}`
      );
      return NextResponse.json(
        { error: errBody?.error ?? 'AI edit failed', userMessageSaved: true },
        { status: apiResp.status >= 500 ? 502 : apiResp.status }
      );
    }

    apiResult = await apiResp.json();
  } catch (fetchErr: any) {
    await saveAssistantMessage(
      supabase,
      documentId,
      user.id,
      `I couldn't reach the AI service: ${fetchErr.message}`
    );
    return NextResponse.json(
      { error: `Failed to reach app-api: ${fetchErr.message}`, userMessageSaved: true },
      { status: 502 }
    );
  }

  // Handle 'edit' response
  if (apiResult.type === 'edit' && typeof apiResult.latex === 'string') {
    const summary = typeof apiResult.summary === 'string'
      ? apiResult.summary
      : 'Document updated';

    // Pre-validate the AI-generated LaTeX before showing the preview. If the first
    // compile fails, ask app-api to repair the document once and validate again.
    let modifiedLatex = apiResult.latex;
    let repairedLatex = false;
    try {
      const validation = await validateLatexWithRepair(apiResult.latex);

      if (!validation.ok) {
        await saveAssistantMessage(
          supabase,
          documentId,
          user.id,
          'I could not apply that edit because the generated LaTeX failed to compile, and the automatic repair also failed.'
        );
        return NextResponse.json(
          {
            error: 'AI generated invalid LaTeX that failed to compile, and automatic repair failed. Try a smaller or more specific edit.',
            compileLog: validation.compileLog,
            userMessageSaved: true,
          },
          { status: 422 }
        );
      }

      modifiedLatex = validation.latex;
      repairedLatex = validation.repaired;
    } catch (validateErr: any) {
      // Validation unreachable — skip validation and allow the preview (best-effort)
      console.warn('[chat-edit] LaTeX pre-validation unavailable:', validateErr.message);
    }

    // Save assistant message with the summary (NOT the full LaTeX)
    await supabase.from('chat_messages').insert({
      document_id: documentId,
      user_id: user.id,
      role: 'assistant',
      content: repairedLatex ? `${summary} The LaTeX was repaired automatically before preview.` : summary,
    });

    return NextResponse.json({
      type: 'edit',
      modifiedLatex,
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
