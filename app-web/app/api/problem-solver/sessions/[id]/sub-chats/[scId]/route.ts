import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string; scId: string }> };

// PATCH /api/problem-solver/sessions/[id]/sub-chats/[scId]
// Updates is_minimized and/or title
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId, scId } = await params;
  const body = await req.json().catch(() => ({}));
  const { is_minimized, title } = body as {
    is_minimized?: boolean;
    title?: string;
  };

  if (is_minimized === undefined && title === undefined) {
    return NextResponse.json(
      { error: 'At least one of is_minimized or title must be provided' },
      { status: 400 }
    );
  }

  // Verify session ownership so a user cannot mutate sub-chats of another user's session
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (is_minimized !== undefined) updates.is_minimized = is_minimized;
  if (title !== undefined) updates.title = title.trim();

  const { data: subChat, error } = await supabase
    .from('problem_solver_sub_chats')
    .update(updates)
    .eq('id', scId)
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .select('id, is_minimized, title')
    .single();

  if (error || !subChat) {
    return NextResponse.json({ error: 'Sub-chat not found' }, { status: 404 });
  }

  return NextResponse.json({ subChat });
}

// DELETE /api/problem-solver/sessions/[id]/sub-chats/[scId]
// Cascade in DB removes associated messages automatically
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId, scId } = await params;

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('problem_solver_sub_chats')
    .delete()
    .eq('id', scId)
    .eq('session_id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
