import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/problem-solver/sessions/[id]/sub-chats
// Returns sub-chats for the session including their messages
export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

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

  const { data: subChats, error } = await supabase
    .from('problem_solver_sub_chats')
    .select(`
      id,
      session_id,
      title,
      is_minimized,
      created_at,
      problem_solver_messages (
        id,
        role,
        content,
        created_at
      )
    `)
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Rename nested relation key to `messages` for a cleaner API surface
  const result = (subChats ?? []).map((sc) => {
    const { problem_solver_messages, ...rest } = sc as typeof sc & {
      problem_solver_messages: Array<{
        id: string;
        role: string;
        content: string;
        created_at: string;
      }>;
    };
    return { ...rest, messages: problem_solver_messages ?? [] };
  });

  return NextResponse.json({ subChats: result });
}

// POST /api/problem-solver/sessions/[id]/sub-chats — create a sub-chat
export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

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

  const body = await req.json().catch(() => ({}));
  const { title } = body as { title?: string };

  const { data: subChat, error } = await supabase
    .from('problem_solver_sub_chats')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      title: title?.trim() || 'Question',
    })
    .select('id, session_id, title, is_minimized, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subChat }, { status: 201 });
}
