import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/problem-solver/sessions — list authenticated user's sessions
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const folderIdParam = searchParams.get('folder_id')?.trim() || null;

  if (folderIdParam) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderIdParam)
      .eq('user_id', user.id)
      .maybeSingle();

    if (folderError) {
      return NextResponse.json({ error: folderError.message }, { status: 500 });
    }
    if (!folder) {
      return NextResponse.json({ error: 'Project folder not found' }, { status: 404 });
    }
  }

  let query = supabase
    .from('problem_solver_sessions')
    .select(
      'id, title, folder_id, status, is_published, published_at, university, degree, subject, visibility, keywords, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (folderIdParam) {
    query = query.eq('folder_id', folderIdParam);
  }

  const { data: sessions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}

// POST /api/problem-solver/sessions — create a new empty session
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { title, folder_id } = body as { title?: string; folder_id?: string | null };
  const folderId = typeof folder_id === 'string' && folder_id.trim().length > 0 ? folder_id.trim() : null;

  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (folderError) {
      return NextResponse.json({ error: folderError.message }, { status: 500 });
    }
    if (!folder) {
      return NextResponse.json({ error: 'Project folder not found' }, { status: 404 });
    }
  }

  const { data: session, error } = await supabase
    .from('problem_solver_sessions')
    .insert({
      user_id: user.id,
      title: title?.trim() || 'Untitled Problem',
      folder_id: folderId,
      status: 'pending',
    })
    .select('id, title, folder_id, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session }, { status: 201 });
}
