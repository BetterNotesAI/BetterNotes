import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';
import { decideDocumentGenerationIntent } from '@/lib/document-generation-intent';
import { dedupeFolderInputsByStoragePath } from '@/lib/folder-inputs';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function persistChatTurn(
  supabase: SupabaseClient,
  {
    documentId,
    userId,
    userContent,
    assistantContent,
  }: {
    documentId: string;
    userId: string;
    userContent: string;
    assistantContent: string;
  },
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert([
    {
      document_id: documentId,
      user_id: userId,
      role: 'user',
      content: userContent,
    },
    {
      document_id: documentId,
      user_id: userId,
      role: 'assistant',
      content: assistantContent,
    },
  ]);

  if (error) {
    console.warn('[documents/chat] Failed to persist chat turn:', error.message);
  }
}

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
    .select('id, template_id, status, current_version_id, folder_id')
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

  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }
  const userContent = content.trim();
  if (!userContent) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(8);

  const intentDecision = decideDocumentGenerationIntent({
    prompt: userContent,
    templateId: doc.template_id,
    mode: doc.current_version_id ? 'refine' : 'draft',
    recentMessages: recentMessages ?? [],
  });

  if (!intentDecision.shouldGenerate && intentDecision.reply) {
    await persistChatTurn(supabase, {
      documentId,
      userId: user.id,
      userContent,
      assistantContent: intentDecision.reply,
    });
    return NextResponse.json({ message: intentDecision.reply });
  }

  // Check guest limits before calling app-api (runs before the paid-plan quota check)
  const { data: guestCheck } = await supabase.rpc('check_guest_limits', {
    p_user_id: user.id,
  });
  if (guestCheck && guestCheck.messages_used >= guestCheck.messages_limit) {
    return NextResponse.json({ error: 'guest_message_limit' }, { status: 402 });
  }

  // Check credit quota before calling app-api
  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
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

  // Load project-global attachments when the document belongs to a project.
  const attachmentQuery = doc.folder_id
    ? supabase
      .from('folder_inputs')
      .select('id, name, storage_path, mime_type')
      .eq('folder_id', doc.folder_id)
      .eq('user_id', user.id)
    : supabase
      .from('document_attachments')
      .select('id, name, storage_path, mime_type')
      .eq('document_id', documentId)
      .eq('user_id', user.id);

  const { data: attachmentRows } = await attachmentQuery;

  const uniqueAttachmentRows = doc.folder_id
    ? dedupeFolderInputsByStoragePath(attachmentRows ?? [])
    : attachmentRows ?? [];

  const attachmentFiles = await Promise.all(
    uniqueAttachmentRows.map(async (row) => {
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

  // Save user message
  await supabase.from('chat_messages').insert({
    document_id: documentId,
    user_id: user.id,
    role: 'user',
    content: userContent,
  });

  // Mark as generating
  await supabase.from('documents').update({ status: 'generating' }).eq('id', documentId);

  // Call app-api
  let pdfBuffer: ArrayBuffer;
  let latexSource: string;
  let aiSummary: string | null = null;

  try {
    const apiResp = await fetch(`${API_URL}/latex/generate-and-compile`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_chat', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        prompt: userContent,
        templateId: doc.template_id,
        baseLatex,
        files: validAttachments,
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
    const summaryB64 = apiResp.headers.get('x-betternotes-summary') ?? '';
    aiSummary = summaryB64 ? Buffer.from(summaryB64, 'base64').toString('utf8') : null;
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
      prompt_used: userContent,
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
    content: aiSummary ?? `Document updated (version ${versionNumber}).`,
    version_id: version.id,
  });

  return NextResponse.json({
    versionId: version.id,
    pdfSignedUrl,
    latex: latexSource,
  });
}
