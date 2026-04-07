import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/exam-public/[token]/start
 *
 * Creates a copy of a shared exam in the authenticated user's account.
 * - Requires authentication
 * - Copies exam metadata + questions (without user_answer, is_correct, partial_score)
 * - grading_mode is provided by the guest user in the request body
 * - Increments shared_attempts on the original exam
 * Returns { exam_id } so the client can redirect to /exams/[exam_id]
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await params;

  // Parse body for grading_mode choice
  let gradingMode: 'strict' | 'partial' = 'strict';
  try {
    const body = await req.json();
    if (body.grading_mode === 'partial' || body.grading_mode === 'strict') {
      gradingMode = body.grading_mode;
    }
  } catch {
    // default grading_mode stays 'strict'
  }

  // Use admin client to read the original exam (bypasses RLS — it belongs to another user)
  const adminClient = createAdminClient();

  const { data: originalExam, error: examError } = await adminClient
    .from('exams')
    .select('id, title, subject, level, language, question_count, cognitive_distribution')
    .eq('share_token', token)
    .eq('is_published', true)
    .single();

  if (examError || !originalExam) {
    return NextResponse.json({ error: 'Exam not found or no longer available' }, { status: 404 });
  }

  // Fetch questions from the original exam
  const { data: originalQuestions, error: questionsError } = await adminClient
    .from('exam_questions')
    .select('question_number, type, question, options, correct_answer, explanation, has_math')
    .eq('exam_id', originalExam.id)
    .order('question_number', { ascending: true });

  if (questionsError || !originalQuestions || originalQuestions.length === 0) {
    return NextResponse.json({ error: 'Failed to load exam questions' }, { status: 500 });
  }

  // Create a new exam for the guest user
  const { data: newExam, error: createError } = await supabase
    .from('exams')
    .insert({
      user_id: user.id,
      title: originalExam.title,
      subject: originalExam.subject,
      level: originalExam.level,
      language: originalExam.language ?? 'English',
      question_count: originalExam.question_count,
      status: 'pending',
      grading_mode: gradingMode,
      cognitive_distribution: originalExam.cognitive_distribution ?? null,
      source_exam_id: originalExam.id,
    })
    .select('id, user_id, title, subject, level, language, grading_mode, question_count, score, status, created_at, completed_at')
    .single();

  if (createError || !newExam) {
    return NextResponse.json({ error: 'Failed to create exam copy' }, { status: 500 });
  }

  // Copy questions — clean slate (no user_answer, is_correct, partial_score)
  const questionsPayload = originalQuestions.map((q) => ({
    exam_id: newExam.id,
    question_number: q.question_number,
    type: q.type,
    question: q.question,
    options: q.options ?? null,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? null,
    has_math: q.has_math ?? false,
  }));

  const { error: insertQuestionsError } = await supabase
    .from('exam_questions')
    .insert(questionsPayload);

  if (insertQuestionsError) {
    // Cleanup orphan exam
    await supabase.from('exams').delete().eq('id', newExam.id);
    return NextResponse.json({ error: 'Failed to copy exam questions' }, { status: 500 });
  }

  // Increment shared_attempts on the original exam (best-effort)
  const { data: currentRow } = await adminClient
    .from('exams')
    .select('shared_attempts')
    .eq('id', originalExam.id)
    .single();

  const currentAttempts = (currentRow as { shared_attempts: number } | null)?.shared_attempts ?? 0;

  await adminClient
    .from('exams')
    .update({ shared_attempts: currentAttempts + 1 })
    .eq('id', originalExam.id);

  return NextResponse.json({ exam_id: newExam.id }, { status: 201 });
}
