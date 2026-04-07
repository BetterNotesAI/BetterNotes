import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/exams/[id]/publish
 *
 * Publishes an exam: sets is_published=true and generates a share_token (UUID).
 * Only the owner of the exam can publish it.
 * The exam must be in 'completed' status.
 * Returns { share_token, share_url }.
 */
function getAppUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: examId } = await params;

  // Verify the exam belongs to the user and is completed
  const { data: exam, error: fetchError } = await supabase
    .from('exams')
    .select('id, user_id, status, is_published, share_token')
    .eq('id', examId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  if (exam.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed exams can be published' }, { status: 400 });
  }

  // If already published, just return the existing token
  const existingExam = exam as typeof exam & { is_published?: boolean; share_token?: string };
  if (existingExam.is_published && existingExam.share_token) {
    const shareUrl = `${getAppUrl(req)}/exam/${existingExam.share_token}`;
    return NextResponse.json({ share_token: existingExam.share_token, share_url: shareUrl });
  }

  // Generate UUID token (crypto.randomUUID is available in Node 18+)
  const token: string = crypto.randomUUID();

  const { error: updateError } = await supabase
    .from('exams')
    .update({ is_published: true, share_token: token })
    .eq('id', examId)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to publish exam' }, { status: 500 });
  }

  const shareUrl = `${getAppUrl(req)}/exam/${token}`;
  return NextResponse.json({ share_token: token, share_url: shareUrl });
}
