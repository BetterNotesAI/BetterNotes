// POST /api/cheat-sheets/sessions/[id]/subchats/[subchatId]/messages
// Send a message in a subchat and get AI reply

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    .from('cheat_sheet_sessions')
    .select('id, content_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Get subchat
  const { data: subchat } = await supabase
    .from('cheat_sheet_sub_chats')
    .select('id, block_text')
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

  // Load recent history
  const { data: recentMessages, error: historyError } = await supabase
    .from('cheat_sheet_messages')
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
    .from('cheat_sheet_messages')
    .insert({ subchat_id: subchatId, role: 'user', content: userMessageTrimmed })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json(
      { error: userMsgError?.message ?? 'Failed to save message' },
      { status: 500 },
    );
  }

  // Include block context in question
  const contextPrefix = subchat.block_text
    ? `[Focusing on this section of the cheat sheet:]\n${toQuoteBlock(subchat.block_text)}\n\n`
    : '';
  const userMessageForLLM = `${contextPrefix}${userMessageTrimmed}`;

  // Use focused context for the AI
  const contentForLLM = subchat.block_text?.trim() || session.content_md || '';

  let assistantContent: string;
  try {
    const apiResp = await fetch(`${API_URL}/cheat-sheet/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        contentMd: contentForLLM,
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
    .from('cheat_sheet_messages')
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
