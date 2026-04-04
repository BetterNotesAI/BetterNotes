// Subchats — GET (list with messages) + POST (create)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// ── GET — list all subchats with messages ────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { data: session } = await supabase
    .from('problem_solver_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: subchats, error } = await supabase
    .from('problem_solver_subchats')
    .select('id, block_index, context_text, created_at')
    .eq('session_id', sessionId)
    .order('block_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subchatIds = (subchats ?? []).map((s) => s.id);
  const messagesMap: Record<string, Array<{ id: string; role: string; content: string; created_at: string }>> = {};

  if (subchatIds.length > 0) {
    const { data: messages } = await supabase
      .from('problem_solver_subchat_messages')
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
    ...sc,
    messages: messagesMap[sc.id] ?? [],
  }));

  return NextResponse.json({ subchats: result });
}

// ── POST — create a new subchat ──────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { data: session } = await supabase
    .from('problem_solver_sessions')
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

  // Idempotent behavior: if already exists for this block, return it.
  const { data: existingSubchat, error: existingError } = await supabase
    .from('problem_solver_subchats')
    .select('id, block_index, context_text, created_at')
    .eq('session_id', sessionId)
    .eq('block_index', blockIndex)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existingSubchat) {
    const { data: existingMessages, error: existingMessagesError } = await supabase
      .from('problem_solver_subchat_messages')
      .select('id, role, content, created_at')
      .eq('subchat_id', existingSubchat.id)
      .order('created_at', { ascending: true });

    if (existingMessagesError) {
      return NextResponse.json({ error: existingMessagesError.message }, { status: 500 });
    }

    return NextResponse.json(
      { subchat: { ...existingSubchat, messages: existingMessages ?? [] } },
      { status: 200 },
    );
  }

  const { data: subchat, error } = await supabase
    .from('problem_solver_subchats')
    .insert({
      session_id: sessionId,
      block_index: blockIndex,
      context_text: contextText ?? '',
    })
    .select('id, block_index, context_text, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: raceExistingSubchat, error: raceExistingError } = await supabase
        .from('problem_solver_subchats')
        .select('id, block_index, context_text, created_at')
        .eq('session_id', sessionId)
        .eq('block_index', blockIndex)
        .maybeSingle();

      if (raceExistingError) {
        return NextResponse.json({ error: raceExistingError.message }, { status: 500 });
      }
      if (raceExistingSubchat) {
        const { data: raceExistingMessages, error: raceExistingMessagesError } = await supabase
          .from('problem_solver_subchat_messages')
          .select('id, role, content, created_at')
          .eq('subchat_id', raceExistingSubchat.id)
          .order('created_at', { ascending: true });

        if (raceExistingMessagesError) {
          return NextResponse.json({ error: raceExistingMessagesError.message }, { status: 500 });
        }

        return NextResponse.json(
          { subchat: { ...raceExistingSubchat, messages: raceExistingMessages ?? [] } },
          { status: 200 },
        );
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subchat: { ...subchat, messages: [] } }, { status: 201 });
}
