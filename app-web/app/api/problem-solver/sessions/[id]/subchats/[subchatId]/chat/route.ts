// Subchat chat — POST (send message, get AI reply)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';
const MAX_HISTORY_MESSAGES = 24;

type RouteContext = { params: Promise<{ id: string; subchatId: string }> };

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId, subchatId } = await params;

  // Ownership + get session data
  const { data: session } = await supabase
    .from('problem_solver_sessions')
    .select('id, solution_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Get subchat
  const { data: subchat } = await supabase
    .from('problem_solver_subchats')
    .select('id, context_text')
    .eq('id', subchatId)
    .eq('session_id', sessionId)
    .single();
  if (!subchat) {
    return NextResponse.json({ error: 'Subchat not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const userMessageTrimmed = content.trim();

  // Load only recent history to keep subchat latency stable.
  const { data: recentMessages, error: historyError } = await supabase
    .from('problem_solver_subchat_messages')
    .select('role, content')
    .eq('subchat_id', subchatId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  const history = (recentMessages ?? [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )
    .reverse();

  // Save user message
  const { data: userMsg, error: userMsgError } = await supabase
    .from('problem_solver_subchat_messages')
    .insert({ subchat_id: subchatId, role: 'user', content: userMessageTrimmed })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json(
      { error: userMsgError?.message ?? 'Failed to save message' },
      { status: 500 },
    );
  }

  // Always include the focused section context so the AI stays on topic
  const contextPrefix = subchat.context_text
    ? `[Focusing on this section of the solution:]\n${toQuoteBlock(subchat.context_text)}\n\n`
    : '';
  const userMessageForLLM = `${contextPrefix}${userMessageTrimmed}`;

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 },
    );
  }

  // Call app-api
  // Prefer focused context for subchats to keep responses fast and on-topic.
  const solutionForLLM = subchat.context_text?.trim() || session.solution_md || '';
  let assistantContent: string;
  try {
    const apiResp = await fetch(`${API_URL}/problem-solver/chat`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'problem_solver_subchat_chat', API_INTERNAL_TOKEN, {
        projectType: 'problem_solver',
        projectId: sessionId,
      }),
      body: JSON.stringify({
        solutionMd: solutionForLLM,
        history,
        userMessage: userMessageForLLM,
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

  // Save assistant reply
  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('problem_solver_subchat_messages')
    .insert({ subchat_id: subchatId, role: 'assistant', content: assistantContent })
    .select('id, role, content, created_at')
    .single();

  if (assistantMsgError || !assistantMsg) {
    return NextResponse.json(
      { error: assistantMsgError?.message ?? 'Failed to save assistant message' },
      { status: 500 },
    );
  }

  return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg });
}
