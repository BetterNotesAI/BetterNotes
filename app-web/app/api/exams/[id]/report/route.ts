import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams/[id]/report
 *
 * Returns full exam data including questions, user answers, correct answers
 * and explanations for PDF report generation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: examId } = await params;

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, subject, level, score, status, question_count, created_at, completed_at')
    .eq('id', examId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (examError || !exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  if (exam.status !== 'completed') {
    return NextResponse.json({ error: 'Exam not completed yet' }, { status: 400 });
  }

  const { data: questions, error: qError } = await supabase
    .from('exam_questions')
    .select('id, question_number, type, question, options, correct_answer, user_answer, is_correct, explanation')
    .eq('exam_id', examId)
    .order('question_number', { ascending: true });

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  return NextResponse.json({ exam, questions: questions ?? [] });
}
