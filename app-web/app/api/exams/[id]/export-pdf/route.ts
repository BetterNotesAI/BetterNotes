import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams/[id]/export-pdf
 *
 * Fetches the exam report from Supabase, sends it to app-api /exams/export-pdf
 * (which calls Pandoc), and streams the resulting PDF back to the client.
 *
 * The client receives a raw application/pdf response it can turn into a Blob URL
 * for preview or trigger as a file download.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: examId } = await params;

  // 1. Fetch exam metadata
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

  // 2. Fetch questions (with correct answers — this is a server-side route)
  const { data: questions, error: qError } = await supabase
    .from('exam_questions')
    .select(
      'id, question_number, type, question, options, correct_answer, user_answer, is_correct, partial_score, explanation'
    )
    .eq('exam_id', examId)
    .order('question_number', { ascending: true });

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // 3. Forward to app-api /exams/export-pdf
  const API_URL = process.env.API_URL ?? 'http://localhost:4000';
  const report = { exam, questions: questions ?? [] };

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/exams/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(60_000), // 1 min — PDF generation
    });
  } catch (err: any) {
    console.error('[export-pdf proxy] fetch error:', err?.message);
    return NextResponse.json(
      { error: 'Could not reach PDF service' },
      { status: 502 }
    );
  }

  if (!apiRes.ok) {
    const text = await apiRes.text().catch(() => '');
    console.error('[export-pdf proxy] app-api error:', apiRes.status, text.slice(0, 300));
    return NextResponse.json(
      { error: 'PDF generation failed on server' },
      { status: 500 }
    );
  }

  // 4. Stream PDF back to client
  const pdfBuffer = await apiRes.arrayBuffer();
  const safeName = (exam.subject || exam.title || 'exam').replace(/[/\\:*?"<>|]/g, '_');

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  });
}
