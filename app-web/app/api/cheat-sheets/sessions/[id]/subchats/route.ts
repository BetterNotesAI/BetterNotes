// GET  /api/cheat-sheets/sessions/[id]/subchats — list subchats with messages
// POST /api/cheat-sheets/sessions/[id]/subchats — create subchat

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

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

  const { data: subchats, error } = await supabase
    .from('cheat_sheet_sub_chats')
    .select('id, block_index, block_text, created_at')
    .eq('session_id', sessionId)
    .order('block_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subchatIds = (subchats ?? []).map((s) => s.id);
  const messagesMap: Record<string, Array<{ id: string; role: string; content: string; created_at: string }>> = {};

  if (subchatIds.length > 0) {
    const { data: messages } = await supabase
      .from('cheat_sheet_messages')
      .select('id, subchat_id, role, content, created_at')
      .in('subchat_id', subchatIds)
      .order('created_at', { ascending: true });

    for (const msg of messages ?? []) {
      if (!messagesMap[msg.subchat_id]) messagesMap[msg.subchat_id] = [];
      messagesMap[msg.subchat_id].push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      });
    }
  }

  const result = (subchats ?? []).map((sc) => ({
    id: sc.id,
    block_index: sc.block_index,
    context_text: sc.block_text,
    created_at: sc.created_at,
    messages: messagesMap[sc.id] ?? [],
  }));

  return NextResponse.json({ subchats: result });
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
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { blockIndex, contextText } = body as { blockIndex?: number; contextText?: string };

  if (typeof blockIndex !== 'number' || blockIndex < 0) {
    return NextResponse.json({ error: 'Invalid blockIndex' }, { status: 400 });
  }

  // Idempotent — return existing if already present
  const { data: existing } = await supabase
    .from('cheat_sheet_sub_chats')
    .select('id, block_index, block_text, created_at')
    .eq('session_id', sessionId)
    .eq('block_index', blockIndex)
    .maybeSingle();

  if (existing) {
    const { data: existingMessages } = await supabase
      .from('cheat_sheet_messages')
      .select('id, role, content, created_at')
      .eq('subchat_id', existing.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      subchat: {
        id: existing.id,
        block_index: existing.block_index,
        context_text: existing.block_text,
        created_at: existing.created_at,
        messages: existingMessages ?? [],
      },
    });
  }

  const { data: subchat, error } = await supabase
    .from('cheat_sheet_sub_chats')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      block_index: blockIndex,
      block_text: contextText ?? '',
    })
    .select('id, block_index, block_text, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Race condition — fetch the existing one
      const { data: raceExisting } = await supabase
        .from('cheat_sheet_sub_chats')
        .select('id, block_index, block_text, created_at')
        .eq('session_id', sessionId)
        .eq('block_index', blockIndex)
        .maybeSingle();

      if (raceExisting) {
        const { data: raceMessages } = await supabase
          .from('cheat_sheet_messages')
          .select('id, role, content, created_at')
          .eq('subchat_id', raceExisting.id)
          .order('created_at', { ascending: true });

        return NextResponse.json({
          subchat: {
            id: raceExisting.id,
            block_index: raceExisting.block_index,
            context_text: raceExisting.block_text,
            created_at: raceExisting.created_at,
            messages: raceMessages ?? [],
          },
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    subchat: {
      id: subchat.id,
      block_index: subchat.block_index,
      context_text: subchat.block_text,
      created_at: subchat.created_at,
      messages: [],
    },
  }, { status: 201 });
}
