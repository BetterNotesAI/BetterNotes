export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import pdfParse from 'pdf-parse';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const PDF_TEXT_MAX_CHARS = 50_000;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();

  // --- Auth ---
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = params.id;

  // --- Ownership check ---
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Session not found or access denied' },
      { status: 404 },
    );
  }

  // --- Parse multipart form ---
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // --- Validate MIME type ---
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are accepted' },
      { status: 400 },
    );
  }

  // --- Validate size ---
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 20 MB.' },
      { status: 400 },
    );
  }

  // --- Upload to Supabase Storage ---
  const storagePath = `${user.id}/${sessionId}/${crypto.randomUUID()}.pdf`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('problem-solver-pdfs')
    .upload(storagePath, buffer, { contentType: 'application/pdf' });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // --- Update session: pdf_path + status 'extracting' ---
  const { error: updateExtractingError } = await supabase
    .from('problem_solver_sessions')
    .update({ pdf_path: storagePath, status: 'extracting' })
    .eq('id', sessionId);

  if (updateExtractingError) {
    // Non-fatal: storage already succeeded; log and continue
    console.error('[upload-pdf] Failed to set status=extracting:', updateExtractingError.message);
  }

  // --- Extract text with pdf-parse ---
  let pdfText: string;
  try {
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text ?? '';

    if (pdfText.length > PDF_TEXT_MAX_CHARS) {
      pdfText =
        pdfText.slice(0, PDF_TEXT_MAX_CHARS) +
        '\n\n[Texto truncado: el PDF supera el límite de 50.000 caracteres]';
    }
  } catch (parseError) {
    // Extraction failed — mark session as error but keep the PDF in storage
    await supabase
      .from('problem_solver_sessions')
      .update({ status: 'error' })
      .eq('id', sessionId);

    console.error('[upload-pdf] pdf-parse failed:', parseError);
    return NextResponse.json(
      {
        error: 'PDF text extraction failed. The file has been stored and can be retried.',
        pdf_path: storagePath,
      },
      { status: 422 },
    );
  }

  // --- Update session: pdf_text + status 'pending' ---
  const { error: updatePendingError } = await supabase
    .from('problem_solver_sessions')
    .update({ pdf_text: pdfText, status: 'pending' })
    .eq('id', sessionId);

  if (updatePendingError) {
    return NextResponse.json(
      { error: `Failed to save extracted text: ${updatePendingError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      pdf_path: storagePath,
      pdf_text_length: pdfText.length,
    },
    { status: 200 },
  );
}
