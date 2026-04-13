import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/problem-solver/sessions/[id]
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

  const { data: session, error } = await supabase
    .from('problem_solver_sessions')
    .select(
      'id, title, folder_id, pdf_path, pdf_text, solution_md, status, is_published, published_at, university, degree, subject, visibility, keywords, created_at, updated_at'
    )
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}

// PATCH /api/problem-solver/sessions/[id] — update title
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const { title } = body as { title?: string };

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from('problem_solver_sessions')
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id, title')
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}

// DELETE /api/problem-solver/sessions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { error } = await supabase
    .from('problem_solver_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
