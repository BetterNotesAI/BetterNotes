// F4-M1.5 — POST /api/problem-solver/sessions/[id]/sub-chats/[scId]/messages
// Non-streaming. Saves the user message, calls app-api, saves assistant reply.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type RouteContext = { params: Promise<{ id: string; scId: string }> };

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId, scId } = await params;

  // ── 2. Ownership check — session must belong to the user ─────────────────────
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id, solution_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // ── 3. Verify sub-chat belongs to this session / user ────────────────────────
  const { data: subChat, error: subChatError } = await supabase
    .from('problem_solver_sub_chats')
    .select('id')
    .eq('id', scId)
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (subChatError || !subChat) {
    return NextResponse.json({ error: 'Sub-chat not found' }, { status: 404 });
  }

  // ── 4. Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // ── 5. Save user message ──────────────────────────────────────────────────────
  const { data: userMsg, error: userMsgError } = await supabase
    .from('problem_solver_messages')
    .insert({
      sub_chat_id: scId,
      user_id: user.id,
      role: 'user',
      content: content.trim(),
    })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json(
      { error: userMsgError?.message ?? 'Failed to save message' },
      { status: 500 },
    );
  }

  // ── 6. Load previous messages for context (all except the one just inserted) ──
  const { data: prevMessages } = await supabase
    .from('problem_solver_messages')
    .select('role, content')
    .eq('sub_chat_id', scId)
    .order('created_at', { ascending: true });

  // Exclude the last entry (the user message we just saved) from the history
  // so the LLM sees the prior conversation but receives the new question separately.
  const allMessages = (prevMessages ?? []).filter(
    (m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
  );
  const history = allMessages.slice(0, allMessages.length - 1);

  // ── 7. Call app-api /problem-solver/chat ─────────────────────────────────────
  let assistantContent: string;

  try {
    const apiResp = await fetch(`${API_URL}/problem-solver/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN
          ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        solutionMd: session.solution_md ?? '',
        history,
        userMessage: content.trim(),
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
      return NextResponse.json(
        { error: errBody?.error ?? 'Failed to reach AI API' },
        { status: 502 },
      );
    }

    const respData = await apiResp.json() as { reply?: string };
    assistantContent = respData.reply ?? '';
  } catch (fetchErr: unknown) {
    const message = fetchErr instanceof Error ? fetchErr.message : 'Network error';
    return NextResponse.json({ error: `Failed to reach app-api: ${message}` }, { status: 502 });
  }

  // ── 8. Save assistant message ─────────────────────────────────────────────────
  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('problem_solver_messages')
    .insert({
      sub_chat_id: scId,
      user_id: user.id,
      role: 'assistant',
      content: assistantContent,
    })
    .select('id, role, content, created_at')
    .single();

  if (assistantMsgError || !assistantMsg) {
    return NextResponse.json(
      { error: assistantMsgError?.message ?? 'Failed to save assistant message' },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: assistantMsg });
}
