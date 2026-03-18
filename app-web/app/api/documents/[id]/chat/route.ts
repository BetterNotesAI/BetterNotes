import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Verify ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, version_id, attachments, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Load document and verify ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, template_id, status, current_version_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, files } = body as { content?: string; files?: unknown[] };

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Check and increment usage limit before calling app-api
  const { data: usageCheck } = await supabase.rpc('check_and_increment_usage', {
    p_user_id: user.id,
  });
  if (!usageCheck?.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck?.plan ?? 'free', remaining: 0 },
      { status: 402 }
    );
  }

  // Load current latex if available
  let baseLatex: string | undefined;
  if (doc.current_version_id) {
    const { data: currentVersion } = await supabase
      .from('document_versions')
      .select('latex_content')
      .eq('id', doc.current_version_id)
      .maybeSingle();
    baseLatex = currentVersion?.latex_content ?? undefined;
  }

  // Save user message
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'user',
    content,
  });

  // Mark as generating
  await supabase.from('documents').update({ status: 'generating' }).eq('id', documentId);

  // Call app-api
  let pdfBuffer: ArrayBuffer;
  let latexSource: string;

  try {
    const apiResp = await fetch(`${API_URL}/latex/generate-and-compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        prompt: content,
        templateId: doc.template_id,
        baseLatex,
        files: files ?? [],
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' }));

      // Chat message (not a document generation)
      if (errBody?.message) {
        await supabase.from('documents').update({ status: doc.status }).eq('id', documentId);
        await supabase.from('chat_messages').insert({
          document_id: documentId,
          user_id: user.id,
          role: 'assistant',
          content: errBody.message,
        });
        return NextResponse.json({ message: errBody.message });
      }

      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return NextResponse.json(
        { error: errBody?.error ?? 'Generation failed', compileLog: errBody?.compileLog },
        { status: apiResp.status }
      );
    }

    // Check if JSON (chat message) or PDF
    const contentType = apiResp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const jsonBody = await apiResp.json();
      if (jsonBody?.message) {
        await supabase.from('documents').update({ status: doc.status }).eq('id', documentId);
        await supabase.from('chat_messages').insert({
          document_id: documentId,
          user_id: user.id,
          role: 'assistant',
          content: jsonBody.message,
        });
        return NextResponse.json({ message: jsonBody.message });
      }
    }

    pdfBuffer = await apiResp.arrayBuffer();
    const latexB64 = apiResp.headers.get('x-betternotes-latex') ?? '';
    latexSource = latexB64 ? Buffer.from(latexB64, 'base64').toString('utf8') : baseLatex ?? '';
  } catch (fetchErr: any) {
    await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
    return NextResponse.json({ error: `Failed to reach app-api: ${fetchErr.message}` }, { status: 502 });
  }

  // Determine next version number
  const { data: lastVersion } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (lastVersion?.version_number ?? 0) + 1;

  // Upload PDF
  const storagePath = `${user.id}/${documentId}/${versionNumber}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('documents-output')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
    return NextResponse.json({ error: `PDF upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: signedUrlData } = await supabase.storage
    .from('documents-output')
    .createSignedUrl(storagePath, 3600);

  const pdfSignedUrl = signedUrlData?.signedUrl ?? null;

  // Insert version
  const { data: version, error: versionError } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: versionNumber,
      latex_content: latexSource,
      pdf_storage_path: storagePath,
      compile_status: 'success',
      prompt_used: content,
    })
    .select('id')
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: `Failed to save version: ${versionError?.message}` }, { status: 500 });
  }

  // Update document
  await supabase
    .from('documents')
    .update({
      status: 'ready',
      current_version_id: version.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  // Save assistant message
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'assistant',
    content: 'Document updated.',
    version_id: version.id,
  });

  return NextResponse.json({
    versionId: version.id,
    pdfSignedUrl,
    latex: latexSource,
  });
}
