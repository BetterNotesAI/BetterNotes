import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/exams/[id]/unpublish
 *
 * Revokes the share token and sets is_published=false.
 * Only the owner can unpublish.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: examId } = await params;

  const { data: exam, error: fetchError } = await supabase
    .from('exams')
    .select('id, user_id')
    .eq('id', examId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('exams')
    .update({ is_published: false, share_token: null })
    .eq('id', examId)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to unpublish exam' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
