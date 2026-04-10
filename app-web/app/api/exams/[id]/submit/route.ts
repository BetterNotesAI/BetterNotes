import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

interface AnswerPayload {
  question_id: string;
  answer: string;
}

/**
 * POST /api/exams/[id]/submit
 *
 * Submits user answers for an exam, evaluates them, and marks the exam completed.
 * fill_in questions are semantically evaluated with GPT-4o.
 * Supports grading_mode: 'strict' (partial = 0) or 'partial' (partial = 0.5 points).
 * Returns the full result including correct_answer and explanations.
 *
 * Accepts either:
 *   - JSON body: { answers: { question_id, answer }[] }
 *   - FormData: answers (JSON string) + optional photo_{question_id} files
 *     Photos are uploaded to Supabase Storage bucket "exam-answers" and the
 *     public URL is passed to grade-fill-in for vision-based evaluation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: examId } = await params;

  // --- Parse body: JSON or FormData ---
  let answers: AnswerPayload[];
  // photoMap: question_id -> public image URL
  const photoMap = new Map<string, string>();

  const contentType = req.headers.get('content-type') ?? '';

  let timeSpentSeconds: number | null = null;

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
    }

    const answersRaw = formData.get('answers');
    if (typeof answersRaw !== 'string') {
      return NextResponse.json({ error: 'answers field is required' }, { status: 400 });
    }
    try {
      answers = JSON.parse(answersRaw);
    } catch {
      return NextResponse.json({ error: 'answers must be valid JSON' }, { status: 400 });
    }

    const tspRaw = formData.get('time_spent_seconds');
    if (tspRaw !== null) {
      const parsed = Number(tspRaw);
      if (Number.isFinite(parsed) && parsed >= 0) timeSpentSeconds = Math.round(parsed);
    }

    // Upload each photo file to Supabase Storage
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('photo_')) continue;
      if (!(value instanceof File)) continue;

      const questionId = key.slice('photo_'.length);
      const ext = value.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const storagePath = `${user.id}/${examId}/${questionId}.${ext}`;

      const arrayBuffer = await value.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('exam-answers')
        .upload(storagePath, buffer, {
          contentType: value.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        // Non-fatal: log and continue without photo for this question
        console.error(`[submit] Storage upload failed for ${questionId}:`, uploadError.message);
        continue;
      }

      // Private bucket — generate a signed URL valid for 300 s (only needed for AI grading)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('exam-answers')
        .createSignedUrl(storagePath, 300);

      if (signedError || !signedData?.signedUrl) {
        console.error(`[submit] Signed URL failed for ${questionId}:`, signedError?.message);
        continue;
      }

      photoMap.set(questionId, signedData.signedUrl);
    }
  } else {
    // Plain JSON body
    const body = await req.json().catch(() => ({}));
    const typedBody = body as { answers?: AnswerPayload[]; time_spent_seconds?: number };
    answers = typedBody.answers ?? [];
    if (typeof typedBody.time_spent_seconds === 'number' && Number.isFinite(typedBody.time_spent_seconds) && typedBody.time_spent_seconds >= 0) {
      timeSpentSeconds = Math.round(typedBody.time_spent_seconds);
    }
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'answers must be a non-empty array' }, { status: 400 });
  }
  for (const a of answers) {
    if (!a.question_id || typeof a.question_id !== 'string') {
      return NextResponse.json({ error: 'Each answer must include a valid question_id' }, { status: 400 });
    }
    if (typeof a.answer !== 'string') {
      return NextResponse.json({ error: 'Each answer.answer must be a string' }, { status: 400 });
    }
  }

  // --- Verify exam ownership and status ---
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, user_id, status, title, subject, level, grading_mode, question_count, score, created_at, completed_at, cognitive_distribution')
    .eq('id', examId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (examError || !exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }
  if (exam.status === 'completed') {
    return NextResponse.json({ error: 'Exam already completed' }, { status: 409 });
  }

  const isPartialMode = (exam as typeof exam & { grading_mode: string }).grading_mode === 'partial';

  // --- Fetch all questions for this exam ---
  const { data: questions, error: questionsError } = await supabase
    .from('exam_questions')
    .select('id, exam_id, question_number, type, question, options, correct_answer, explanation, user_answer, is_correct, created_at')
    .eq('exam_id', examId)
    .order('question_number', { ascending: true });

  if (questionsError || !questions || questions.length === 0) {
    return NextResponse.json({ error: 'Questions not found for this exam' }, { status: 404 });
  }

  // Build lookup map for submitted answers
  const answerMap = new Map<string, string>(
    answers.map((a) => [a.question_id, a.answer])
  );

  // --- Collect fill_in questions that need AI evaluation ---
  const fillInQuestions = questions.filter(
    (q) => q.type === 'fill_in' && (answerMap.has(q.id) || photoMap.has(q.id))
  );

  // Evaluate fill_in answers with GPT-4o if any exist
  // fillInScores: 0.0 = fully wrong, 1.0 = fully correct, in-between = partial
  const fillInScores = new Map<string, number>();

  if (fillInQuestions.length > 0) {
    const usageCheck = await checkCreditQuota(supabase, user.id);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
        { status: 402 }
      );
    }

    const fillInItems = fillInQuestions.map((q) => {
      const item: {
        id: string;
        question: string;
        correct_answer: string;
        user_answer: string;
        image_url?: string;
      } = {
        id: q.id,
        question: q.question,
        correct_answer: q.correct_answer,
        user_answer: answerMap.get(q.id) ?? '',
      };
      if (photoMap.has(q.id)) {
        item.image_url = photoMap.get(q.id);
      }
      return item;
    });

    try {
      const response = await fetch(`${API_URL}/exams/grade-fill-in`, {
        method: 'POST',
        headers: buildInternalApiHeaders(user.id, 'exam_grade_fill_in', API_INTERNAL_TOKEN),
        body: JSON.stringify({ items: fillInItems, gradingMode: isPartialMode ? 'partial' : 'strict' }),
      });

      if (response.ok) {
        const data = await response.json();
        const scores: Array<{ id: string; score: number }> = data.scores ?? [];
        for (const r of scores) {
          if (r.id && typeof r.score === 'number') {
            fillInScores.set(r.id, r.score);
          }
        }
      }
    } catch {
      // Non-fatal: fall through to string comparison for fill_in
    }
  }

  // --- Evaluate all answers ---
  const normalize = (s: string) => s.trim().toLowerCase();
  const normalizeMath = (s: string) => s
    .replace(/`([A-Za-zÀ-ÿ])/g, '$1').replace(/([A-Za-zÀ-ÿ])`/g, '$1')
    .replace(/\$+/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\left|\\right|\\,|\\;|\\!|\\cdot/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

  const evaluatedQuestions = questions.map((q) => {
    const userAnswer = answerMap.get(q.id) ?? null;
    const imageUrl = photoMap.get(q.id) ?? null;
    let isCorrect: boolean | null = null;
    let partialScore: number | null = null;

    // A question is considered answered if there's text OR a photo
    const hasResponse = (userAnswer !== null && userAnswer.trim() !== '') || imageUrl !== null;

    if (hasResponse) {
      if (q.type === 'fill_in') {
        if (fillInScores.has(q.id)) {
          const score = fillInScores.get(q.id)!;
          isCorrect = score >= 0.99;
          // Store partial_score whenever AI graded it (strict: only 0 or 1; partial: any value)
          partialScore = score;
        } else if (userAnswer !== null && userAnswer.trim() !== '') {
          // Fallback: case-insensitive string comparison (only when text present, no photo)
          isCorrect = normalize(userAnswer) === normalize(q.correct_answer);
          partialScore = isCorrect ? 1 : 0;
        }
      } else {
        isCorrect = userAnswer === q.correct_answer ||
          normalizeMath(userAnswer ?? '') === normalizeMath(q.correct_answer);
      }
    }

    return {
      ...q,
      user_answer: userAnswer,
      is_correct: isCorrect,
      partial_score: partialScore,
      answer_image_url: imageUrl,
    };
  });

  // --- Persist results in bulk ---
  const updateErrors = await Promise.all(
    evaluatedQuestions.map(({ id, user_answer, is_correct, partial_score, answer_image_url }) =>
      supabase
        .from('exam_questions')
        .update({ user_answer, is_correct, partial_score, answer_image_url })
        .eq('id', id)
        .eq('exam_id', examId)
    )
  );

  const firstUpdateError = updateErrors.find((r) => r.error);
  if (firstUpdateError?.error) {
    return NextResponse.json(
      { error: `Failed to save answers: ${firstUpdateError.error.message}` },
      { status: 500 }
    );
  }

  // --- Calculate score ---
  // In partial mode: use AI scores for fill_in. In strict mode: binary only.
  let totalPoints = 0;
  for (const q of evaluatedQuestions) {
    if (q.is_correct === null) continue; // unanswered
    if (q.type === 'fill_in' && q.partial_score !== null) {
      totalPoints += q.partial_score;
    } else {
      totalPoints += q.is_correct ? 1 : 0;
    }
  }
  const scorePercentage = Math.round((totalPoints / evaluatedQuestions.length) * 100);

  const correctCount = evaluatedQuestions.filter((q) => q.is_correct === true).length;
  const partialCount = isPartialMode
    ? evaluatedQuestions.filter((q) => q.type === 'fill_in' && q.partial_score !== null && q.partial_score > 0.01 && q.partial_score < 0.99).length
    : 0;
  const completedAt = new Date().toISOString();

  const examUpdatePayload: Record<string, unknown> = {
    status: 'completed',
    score: scorePercentage,
    completed_at: completedAt,
  };
  if (timeSpentSeconds !== null) {
    examUpdatePayload.time_spent_seconds = timeSpentSeconds;
  }

  const { data: updatedExam, error: examUpdateError } = await supabase
    .from('exams')
    .update(examUpdatePayload)
    .eq('id', examId)
    .select('id, user_id, title, subject, level, grading_mode, question_count, score, status, created_at, completed_at, time_spent_seconds')
    .single();

  if (examUpdateError || !updatedExam) {
    return NextResponse.json(
      { error: `Failed to complete exam: ${examUpdateError?.message}` },
      { status: 500 }
    );
  }

  // --- Cognitive breakdown (if exam was generated with cognitive_distribution) ---
  // cognitive_distribution keys: memory | logic | application
  // Map question index (modulo over categories) to infer which cognitive type each question targets.
  // Since the API doesn't tag individual questions with a cognitive type, we use the distribution
  // proportions to bucket questions in round-robin order (same order the AI received them).
  type CognitiveDist = { memory?: number; logic?: number; application?: number };
  const cogDist = (exam as typeof exam & { cognitive_distribution?: CognitiveDist }).cognitive_distribution;

  let cognitiveBreakdown: Record<string, { total: number; correct: number; pct: number }> | null = null;
  if (cogDist && typeof cogDist === 'object') {
    // Build ordered list of cognitive slots based on distribution percentages
    const categories = (['memory', 'logic', 'application'] as const).filter(
      (k) => typeof cogDist[k] === 'number' && (cogDist[k] ?? 0) > 0
    );
    if (categories.length > 0) {
      const total = evaluatedQuestions.length;
      // Assign each question a cognitive category proportionally
      const slots: string[] = [];
      for (const cat of categories) {
        const count = Math.round(((cogDist[cat] ?? 0) / 100) * total);
        for (let i = 0; i < count; i++) slots.push(cat);
      }
      // Pad or trim to match total
      while (slots.length < total) slots.push(categories[slots.length % categories.length]);
      slots.splice(total);

      const breakdown: Record<string, { total: number; correct: number }> = {};
      for (const cat of categories) breakdown[cat] = { total: 0, correct: 0 };

      evaluatedQuestions.forEach((q, idx) => {
        const cat = slots[idx];
        if (!cat || !breakdown[cat]) return;
        breakdown[cat].total += 1;
        if (q.type === 'fill_in' && q.partial_score !== null) {
          breakdown[cat].correct += q.partial_score;
        } else if (q.is_correct === true) {
          breakdown[cat].correct += 1;
        }
      });

      cognitiveBreakdown = Object.fromEntries(
        categories.map((cat) => {
          const b = breakdown[cat];
          return [cat, { total: b.total, correct: Math.round(b.correct * 100) / 100, pct: b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0 }];
        })
      );
    }
  }

  // --- Return full result including correct answers and explanations ---
  return NextResponse.json({
    exam: updatedExam,
    questions: evaluatedQuestions,
    stats: {
      total_questions: evaluatedQuestions.length,
      correct_answers: correctCount,
      partial_answers: partialCount,
      wrong_answers: evaluatedQuestions.filter(
        (q) => q.is_correct === false && !(q.type === 'fill_in' && q.partial_score !== null && q.partial_score > 0.01)
      ).length,
      unanswered: evaluatedQuestions.filter((q) => q.user_answer === null && !q.answer_image_url).length,
      score_percentage: scorePercentage,
      time_spent_seconds: timeSpentSeconds,
      cognitive_breakdown: cognitiveBreakdown,
    },
  });
}
