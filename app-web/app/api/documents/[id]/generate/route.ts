import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';
import { buildTitleFromLatex, buildTitleFromPrompt, isDefaultDocumentTitle } from '@/lib/document-title';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

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

  // Verify ownership BEFORE consuming usage quota
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, template_id, title, status, current_version_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  const projectContext = buildDocumentProjectContext(documentId, doc.template_id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', user.id)
    .maybeSingle();
  const isAnonymous = Boolean(profile?.is_anonymous);

  if (isAnonymous) {
    return NextResponse.json(
      { error: 'account_required_for_generation' },
      { status: 403 }
    );
  }

  // Check guest limits before any expensive work (runs before the paid-plan quota check)
  const { data: guestCheck } = await supabase.rpc('check_guest_limits', {
    p_user_id: user.id,
  });
  if (guestCheck && guestCheck.messages_used >= guestCheck.messages_limit) {
    return NextResponse.json({ error: 'guest_message_limit' }, { status: 402 });
  }

  // Check credit quota before any expensive work
  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { prompt } = body as { prompt?: string };

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Mark document as generating
  await supabase.from('documents').update({ status: 'generating' }).eq('id', documentId);

  // Load attachments from DB and generate signed URLs
  const { data: attachmentRows } = await supabase
    .from('document_attachments')
    .select('id, name, storage_path, mime_type')
    .eq('document_id', documentId);

  const attachmentFiles = await Promise.all(
    (attachmentRows ?? []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from('document-attachments')
        .createSignedUrl(row.storage_path, 60);
      if (!urlData?.signedUrl) return null;
      return {
        name: row.name,
        mimeType: row.mime_type ?? 'application/octet-stream',
        url: urlData.signedUrl,
        embedInPdf: (row.mime_type ?? '').startsWith('image/'),
      };
    })
  );

  const validAttachments = attachmentFiles.filter(Boolean);

  // Call app-api to generate and compile
  let pdfBuffer: ArrayBuffer;
  let latexSource: string;

  try {
    const apiResp = await fetch(`${API_URL}/latex/generate-and-compile`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_generate', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        prompt,
        templateId: doc.template_id,
        files: validAttachments,
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' }));

      // If it was a chat message response, relay it
      if (errBody?.message) {
        await supabase.from('documents').update({ status: doc.status }).eq('id', documentId);
        return NextResponse.json({ message: errBody.message });
      }

      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return NextResponse.json(
        { error: errBody?.error ?? 'Generation failed', compileLog: errBody?.compileLog },
        { status: apiResp.status }
      );
    }

    // Check if it's a chat message (JSON) or PDF (binary)
    const contentType = apiResp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const jsonBody = await apiResp.json();
      if (jsonBody?.message) {
        await supabase.from('documents').update({ status: doc.status }).eq('id', documentId);
        return NextResponse.json({ message: jsonBody.message });
      }
    }

    pdfBuffer = await apiResp.arrayBuffer();

    // Decode latex from header
    const latexB64 = apiResp.headers.get('x-betternotes-latex') ?? '';
    latexSource = latexB64
      ? Buffer.from(latexB64, 'base64').toString('utf8')
      : '';

    // If auto mode: update template_id in DB with the resolved template
    const resolvedTemplate = apiResp.headers.get('x-betternotes-template');
    if (resolvedTemplate && doc.template_id === 'auto') {
      await supabase.from('documents').update({ template_id: resolvedTemplate }).eq('id', documentId);
      doc.template_id = resolvedTemplate;
    }
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

  // Upload PDF to Supabase Storage
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

  // Create signed URL (1 hour)
  const { data: signedUrlData } = await supabase.storage
    .from('documents-output')
    .createSignedUrl(storagePath, 3600);

  const pdfSignedUrl = signedUrlData?.signedUrl ?? null;

  // Insert document_version
  const { data: version, error: versionError } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: versionNumber,
      latex_content: latexSource,
      pdf_storage_path: storagePath,
      compile_status: 'success',
      prompt_used: prompt,
    })
    .select('id')
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: `Failed to save version: ${versionError?.message}` }, { status: 500 });
  }

  const autoTitle = isDefaultDocumentTitle(doc.title)
    ? buildTitleFromLatex(latexSource) ?? buildTitleFromPrompt(prompt)
    : null;

  // Update document status and current_version_id
  await supabase
    .from('documents')
    .update({
      status: 'ready',
      current_version_id: version.id,
      ...(autoTitle ? { title: autoTitle } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);


  // Save chat messages
  await supabase.from('chat_messages').insert([
    {
      document_id: documentId,
      user_id: user.id,
      role: 'user',
      content: prompt,
    },
    {
      document_id: documentId,
      user_id: user.id,
      role: 'assistant',
      content: 'Document generated successfully.',
      version_id: version.id,
    },
  ]);

  return NextResponse.json({
    documentId,
    versionId: version.id,
    pdfSignedUrl,
    latex: latexSource,
  });
}
