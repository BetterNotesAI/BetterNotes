import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams/[id]
 *
 * Returns an exam and its questions for the authenticated owner.
 * For pending exams: strips correct_answer (except flashcards).
 * For completed exams: returns all fields including correct_answer.
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
    .select('id, user_id, title, subject, level, language, grading_mode, question_count, score, status, created_at, completed_at, is_published, share_token, shared_attempts, source_exam_id')
    .eq('id', examId)
    .eq('user_id', user.id)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from('exam_questions')
    .select('id, exam_id, question_number, type, question, options, correct_answer, user_answer, is_correct, partial_score, explanation, has_math, created_at')
    .eq('exam_id', examId)
    .order('question_number', { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }

  const questionsForClient = (questions ?? []).map((q) => {
    // For pending exams, strip correct_answer (except flashcards)
    if (exam.status === 'pending' && q.type !== 'flashcard') {
      const { correct_answer: _ca, ...rest } = q as typeof q & { correct_answer: string };
      return rest;
    }
    return q;
  });

  return NextResponse.json({ exam, questions: questionsForClient });
}
