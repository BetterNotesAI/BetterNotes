// GET  /api/cheat-sheets/sessions/[id]/chat — load inline chat messages
// POST /api/cheat-sheets/sessions/[id]/chat — send message, get AI reply
//
// Uses cheat_sheet_sub_chats with block_index >= 1_000_000 as inline chat messages.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

// Block indices >= this value are reserved for inline chat (not block-anchored subchats)
const INLINE_CHAT_SESSION_SUBCHAT_BLOCK_INDEX = 2_000_000;

type RouteContext = { params: Promise<{ id: string }> };

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

async function getOrCreateInlineSubchat(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  sessionId: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('cheat_sheet_sub_chats')
    .select('id')
    .eq('session_id', sessionId)
    .eq('block_index', INLINE_CHAT_SESSION_SUBCHAT_BLOCK_INDEX)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('cheat_sheet_sub_chats')
    .insert({
      session_id: sessionId,
      user_id: userId,
      block_index: INLINE_CHAT_SESSION_SUBCHAT_BLOCK_INDEX,
      block_text: '',
    })
    .select('id')
    .single();

  if (error) {
    // Race condition — try fetching again
    const { data: raceExisting } = await supabase
      .from('cheat_sheet_sub_chats')
      .select('id')
      .eq('session_id', sessionId)
      .eq('block_index', INLINE_CHAT_SESSION_SUBCHAT_BLOCK_INDEX)
      .maybeSingle();

    if (raceExisting) return raceExisting.id;
    throw new Error(error.message);
  }

  return created.id;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { data: session } = await supabase
    .from('cheat_sheet_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Find inline subchat if it exists
  const { data: subchat } = await supabase
    .from('cheat_sheet_sub_chats')
    .select('id')
    .eq('session_id', sessionId)
    .eq('block_index', INLINE_CHAT_SESSION_SUBCHAT_BLOCK_INDEX)
    .maybeSingle();

  if (!subchat) {
    return NextResponse.json({ messages: [] });
  }

  const { data: messages, error } = await supabase
    .from('cheat_sheet_messages')
    .select('id, role, content, created_at')
    .eq('subchat_id', subchat.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { data: session } = await supabase
    .from('cheat_sheet_sessions')
    .select('id, content_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, selectedTexts } = body as {
    content?: string;
    selectedTexts?: string[];
  };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const contexts = Array.isArray(selectedTexts)
    ? selectedTexts.map((t) => t.trim()).filter(Boolean)
    : [];

  const quoteBlocks = contexts.map((ctx) => toQuoteBlock(ctx));
  const userMessageForLLM = quoteBlocks.length > 0
    ? `${quoteBlocks.join('\n\n')}\n\n${content.trim()}`
    : content.trim();

  // Get or create the inline chat subchat record
  let subchatId: string;
  try {
    subchatId = await getOrCreateInlineSubchat(supabase, sessionId, user.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Save user message
  const { data: userMsg, error: userMsgError } = await supabase
    .from('cheat_sheet_messages')
    .insert({ subchat_id: subchatId, role: 'user', content: userMessageForLLM })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    return NextResponse.json({ error: userMsgError?.message ?? 'Failed to save message' }, { status: 500 });
  }

  // Load history (exclude just-inserted message)
  const { data: allMessages } = await supabase
    .from('cheat_sheet_messages')
    .select('role, content')
    .eq('subchat_id', subchatId)
    .order('created_at', { ascending: true });

  const history = (allMessages ?? [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )
    .slice(0, -1);

  // Call app-api
  let assistantContent: string;
  let isEditIntent = false;
  let isDeleteIntent = false;
  let isInsertIntent = false;
  let editContent: string | null = null;
  try {
    const apiResp = await fetch(`${API_URL}/cheat-sheet/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        // If the user selected specific blocks, only send those as context (much faster).
        // Fall back to the full cheatsheet only when there's no selection.
        contentMd: contexts.length > 0 ? contexts.join('\n\n') : (session.content_md ?? ''),
        history,
        userMessage: userMessageForLLM,
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
      return NextResponse.json({ error: errBody?.error ?? 'Failed to reach AI API' }, { status: 502 });
    }

    const respData = await apiResp.json() as { reply?: string; isEditIntent?: boolean; isDeleteIntent?: boolean; isInsertIntent?: boolean; editContent?: string | null };
    assistantContent = respData.reply ?? '';
    isEditIntent = respData.isEditIntent ?? false;
    isDeleteIntent = respData.isDeleteIntent ?? false;
    isInsertIntent = respData.isInsertIntent ?? false;
    editContent = respData.editContent ?? null;
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
    return NextResponse.json({ error: assistantMsgError?.message ?? 'Failed to save assistant message' }, { status: 500 });
  }

  return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg, isEditIntent, isDeleteIntent, isInsertIntent, editContent });
}
