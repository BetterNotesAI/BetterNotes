import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Valid values for validation
const VALID_LEVELS = [
  'secondary_basic', 'secondary_intermediate', 'secondary_advanced',
  'highschool_basic', 'highschool_intermediate', 'highschool_advanced',
  'university_basic', 'university_intermediate', 'university_advanced',
] as const;
const VALID_FORMATS = ['multiple_choice', 'true_false', 'fill_in', 'flashcard'] as const;

type QuestionType = (typeof VALID_FORMATS)[number];

interface GeneratedQuestion {
  question: string;
  type: QuestionType;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  has_math?: boolean;
}

/** Distribute `total` questions as evenly as possible across `types`. */
function distributeQuestions(total: number, types: string[]): Record<string, number> {
  const base = Math.floor(total / types.length);
  const remainder = total % types.length;
  return Object.fromEntries(types.map((t, i) => [t, base + (i < remainder ? 1 : 0)]));
}

/**
 * POST /api/exams/generate
 *
 * Validates input, fetches document context from Supabase, delegates AI
 * generation to app-api, then persists the exam and questions.
 * Returns the exam with questions, omitting correct_answer.
 *
 * Body: { subject, level, question_count, format[], format_counts, language, document_ids, external_content }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Input validation ---
  const body = await req.json().catch(() => ({}));
  const { subject, level, question_count, format, format_counts, language, document_ids, external_content, grading_mode, cognitive_distribution, custom_instructions } = body as {
    subject?: string;
    level?: string;
    question_count?: number;
    format?: string[];
    format_counts?: Partial<Record<string, number>>;
    language?: string;
    document_ids?: string[];
    external_content?: string;
    grading_mode?: string;
    cognitive_distribution?: { memory: number; logic: number; application: number };
    custom_instructions?: string;
  };

  const hasDocuments =
    (Array.isArray(document_ids) && document_ids.length > 0) ||
    (typeof external_content === 'string' && external_content.trim().length > 0);
  const subjectTrimmed = (subject ?? '').trim();

  // Subject is required only when no documents are provided
  if (!hasDocuments && !subjectTrimmed) {
    return NextResponse.json({ error: 'subject is required when no documents are provided' }, { status: 400 });
  }
  if (!level || !VALID_LEVELS.includes(level as (typeof VALID_LEVELS)[number])) {
    return NextResponse.json(
      { error: `level must be one of: ${VALID_LEVELS.join(', ')}` },
      { status: 400 }
    );
  }
  if (
    !question_count ||
    typeof question_count !== 'number' ||
    !Number.isInteger(question_count) ||
    question_count < 1 ||
    question_count > 50
  ) {
    return NextResponse.json(
      { error: 'question_count must be an integer between 1 and 50' },
      { status: 400 }
    );
  }
  if (!Array.isArray(format) || format.length === 0) {
    return NextResponse.json({ error: 'format must be a non-empty array' }, { status: 400 });
  }
  const invalidFormats = format.filter(
    (f) => !VALID_FORMATS.includes(f as (typeof VALID_FORMATS)[number])
  );
  if (invalidFormats.length > 0) {
    return NextResponse.json(
      { error: `Invalid format values: ${invalidFormats.join(', ')}. Valid: ${VALID_FORMATS.join(', ')}` },
      { status: 400 }
    );
  }

  const lang = (language ?? 'english').trim().toLowerCase() || 'english';

  // --- Fetch document content if provided ---
  let documentContext = '';
  if (hasDocuments) {
    // Verify ownership + get current_version_id
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, current_version_id')
      .in('id', document_ids!)
      .eq('user_id', user.id);

    if (docs && docs.length > 0) {
      const versionIds = docs.map((d) => d.current_version_id).filter(Boolean) as string[];

      if (versionIds.length > 0) {
        const { data: versions } = await supabase
          .from('document_versions')
          .select('id, document_id, latex_content')
          .in('id', versionIds);

        if (versions && versions.length > 0) {
          const MAX_CHARS_PER_DOC = 6000;
          documentContext = docs
            .map((doc) => {
              const version = versions.find((v) => v.document_id === doc.id);
              const content = (version?.latex_content ?? '').slice(0, MAX_CHARS_PER_DOC);
              return `--- Document: "${doc.title}" ---\n${content}`;
            })
            .filter((s) => s.length > 30)
            .join('\n\n');
        }
      }
    }
  }

  // Append external file content if provided
  if (typeof external_content === 'string' && external_content.trim()) {
    const ext = external_content.trim().slice(0, 18000);
    documentContext = documentContext
      ? `${documentContext}\n\n--- Uploaded File ---\n${ext}`
      : `--- Uploaded File ---\n${ext}`;
  }

  // Use explicit format_counts if provided and valid, otherwise auto-distribute
  const rawCounts = format_counts ?? {};
  const providedSum = (format as string[]).reduce((s, f) => s + (rawCounts[f] ?? 0), 0);
  const distribution: Record<string, number> =
    providedSum === question_count
      ? Object.fromEntries((format as string[]).map((f) => [f, rawCounts[f] ?? 0]))
      : distributeQuestions(question_count, format as string[]);

  // --- Delegate AI generation to app-api ---
  const API_URL = process.env.API_URL ?? 'http://localhost:4000';
  const apiResp = await fetch(`${API_URL}/exams/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: subjectTrimmed, level, language: lang, distribution, format, documentContext, cognitiveDistribution: cognitive_distribution, customInstructions: custom_instructions }),
    signal: AbortSignal.timeout(300_000), // 5 min — AI generation + math solving
  });
  if (!apiResp.ok) {
    const err = await apiResp.json().catch(() => ({}));
    return NextResponse.json({ error: err.error ?? 'AI request failed' }, { status: 502 });
  }
  const { questions: generatedQuestions, canonical_subject } = await apiResp.json() as {
    questions: GeneratedQuestion[];
    canonical_subject?: string;
  };

  if (!generatedQuestions || generatedQuestions.length === 0) {
    return NextResponse.json({ error: 'AI returned no questions' }, { status: 502 });
  }

  // Use AI-normalized subject name if provided, fall back to user input
  const finalSubject = (canonical_subject ?? subjectTrimmed).trim() || subjectTrimmed;

  // --- Persist to Supabase ---
  const title = `${finalSubject} — ${level}`;

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      user_id: user.id,
      title,
      subject: finalSubject,
      level,
      language: lang,
      question_count: generatedQuestions.length,
      status: 'pending',
      grading_mode: grading_mode === 'partial' ? 'partial' : 'strict',
      cognitive_distribution: cognitive_distribution ?? null,
    })
    .select('id, user_id, title, subject, level, language, grading_mode, question_count, score, status, created_at, completed_at')
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: `Failed to create exam: ${examError?.message}` }, { status: 500 });
  }

  const questionsPayload = generatedQuestions.map((q, i) => ({
    exam_id: exam.id,
    question_number: i + 1,
    type: q.type,
    question: q.question,
    options: q.options ?? null,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? null,
    has_math: q.has_math ?? false,
  }));

  const { data: insertedQuestions, error: questionsError } = await supabase
    .from('exam_questions')
    .insert(questionsPayload)
    .select(
      'id, exam_id, question_number, type, question, options, correct_answer, user_answer, is_correct, has_math, created_at'
    );

  if (questionsError) {
    // Best-effort cleanup — delete orphan exam
    await supabase.from('exams').delete().eq('id', exam.id);
    return NextResponse.json(
      { error: `Failed to save questions: ${questionsError.message}` },
      { status: 500 }
    );
  }

  // Return exam + questions. Strip correct_answer except for flashcard type (needed to show answer on card back).
  const questionsForClient = (insertedQuestions ?? []).map((q) => {
    if (q.type === 'flashcard') return q;
    const { correct_answer: _ca, ...rest } = q as typeof q & { correct_answer: string };
    return rest;
  });
  return NextResponse.json({ exam, questions: questionsForClient }, { status: 201 });
}
