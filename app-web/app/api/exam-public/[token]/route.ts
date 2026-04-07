import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/exam-public/[token]
 *
 * Returns public metadata for a shared exam.
 * No auth required at the API level — the page itself enforces auth.
 * Does NOT return correct_answer, user_id, or private fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const adminClient = createAdminClient();

  const { data: exam, error } = await adminClient
    .from('exams')
    .select('id, title, subject, level, question_count, grading_mode, created_at, shared_attempts')
    .eq('share_token', token)
    .eq('is_published', true)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: 'Exam not found or no longer available' }, { status: 404 });
  }

  return NextResponse.json({ exam });
}
