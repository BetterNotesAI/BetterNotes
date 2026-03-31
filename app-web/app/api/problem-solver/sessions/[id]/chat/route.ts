// Inline chat — GET (load messages) + POST (send message, get AI reply)
// Uses problem_solver_chat_messages table (direct FK to session).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type RouteContext = { params: Promise<{ id: string }> };

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

// ── GET — load all chat messages for a session ────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Ownership check
  const { data: session } = await supabase
    .from('problem_solver_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from('problem_solver_chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

// ── POST — send user message, get AI reply, persist both ──────────────────────
export async function POST(
  req: NextRequest,
  { params }: RouteContext,
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Ownership + get solution_md
  const { data: session } = await supabase
    .from('problem_solver_sessions')
    .select('id, solution_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Parse body
  const body = await req.json().catch(() => ({}));
  const { content, selectedTexts } = body as {
    content?: string;
    selectedTexts?: string[];
  };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Build the message content that gets sent to the LLM
  // If there are selected texts, prepend each as a quote block
  const contexts = Array.isArray(selectedTexts)
    ? selectedTexts.map((t) => t.trim()).filter(Boolean)
    : [];

  const quoteBlocks = contexts.map((ctx) => toQuoteBlock(ctx));
  const userMessageForLLM = quoteBlocks.length > 0
    ? `${quoteBlocks.join('\n\n')}\n\n${content.trim()}`
    : content.trim();

  // Save user message (store with quote so history is complete for the LLM)
  const { data: userMsg, error: userMsgError } = await supabase
    .from('problem_solver_chat_messages')
    .insert({
      session_id: sessionId,
      role: 'user',
      content: userMessageForLLM,
    })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json(
      { error: userMsgError?.message ?? 'Failed to save message' },
      { status: 500 },
    );
  }

  // Load history (excluding the message we just inserted)
  const { data: allMessages } = await supabase
    .from('problem_solver_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const history = (allMessages ?? [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )
    .slice(0, -1); // exclude the just-inserted user message

  // Call app-api
  let assistantContent: string;
  try {
    const apiResp = await fetch(`${API_URL}/problem-solver/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        solutionMd: session.solution_md ?? '',
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
    .from('problem_solver_chat_messages')
    .insert({
      session_id: sessionId,
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

  return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg });
}
