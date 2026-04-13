import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams
 *
 * Lists all exams for the authenticated user, ordered by created_at DESC.
 * Does NOT include questions (use /api/exams/[id] for that if needed).
 *
 * Query params:
 *   status = pending | completed  (optional filter)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const folderId = searchParams.get('folder_id')?.trim() || null;

  const VALID_STATUSES = ['pending', 'completed'];

  let query = supabase
    .from('exams')
    .select('id, title, folder_id, subject, level, question_count, score, status, created_at, completed_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    query = query.eq('status', status);
  }

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

    query = query.eq('folder_id', folderId);
  }

  const { data: exams, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exams: exams ?? [] });
}
