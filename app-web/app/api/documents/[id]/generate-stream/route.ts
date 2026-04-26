import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota, recordAiUsage } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';
import {
  buildTitleFromLatex,
  buildTitleFromPrompt,
  isDefaultDocumentTitle,
  isPromptDerivedDocumentTitle,
} from '@/lib/document-title';
import { decideDocumentGenerationIntent } from '@/lib/document-generation-intent';
import { dedupeFolderInputsByStoragePath } from '@/lib/folder-inputs';
import { supportsRealtimeGeneration } from '@/lib/document-realtime-templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface StreamEvent {
  chunk?: string;
  done?: boolean;
  error?: string;
  message?: string;
  latex?: string;
  summary?: string;
  templateId?: string;
  usage?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  } | null;
}

type UpstreamUsage = NonNullable<StreamEvent['usage']>;

async function persistChatTurn(
  supabase: SupabaseClient,
  {
    documentId,
    userId,
    userContent,
    assistantContent,
    versionId,
  }: {
    documentId: string;
    userId: string;
    userContent: string;
    assistantContent: string;
    versionId?: string;
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
      ...(versionId ? { version_id: versionId } : {}),
    },
  ]);

  if (error) {
    console.warn('[documents/generate-stream] Failed to persist chat turn:', error.message);
  }
}

async function readSseEvents(
  response: Response,
  onEvent: (event: StreamEvent) => Promise<void>,
): Promise<void> {
  if (!response.body) throw new Error('Streaming response had no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim());
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      if (!payload) continue;
      await onEvent(JSON.parse(payload) as StreamEvent);
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    await onEvent(JSON.parse(tail.slice('data:'.length).trim()) as StreamEvent);
  }
}

async function compileWithRepair(
  latex: string,
  attachments: Array<Record<string, unknown>>,
  templateId: string,
): Promise<{ pdfBuffer: ArrayBuffer; latex: string }> {
  async function compile(source: string) {
    const resp = await fetch(`${API_URL}/latex/compile-only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: source, files: attachments, templateId }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body?.compileLog ?? body?.error ?? 'Compilation failed');
    }

    const latexB64 = resp.headers.get('x-betternotes-latex') ?? '';
    const compiledLatex = latexB64
      ? Buffer.from(latexB64, 'base64').toString('utf8')
      : source;
    return { pdfBuffer: await resp.arrayBuffer(), latex: compiledLatex };
  }

  try {
    return await compile(latex);
  } catch (compileErr) {
    const log = compileErr instanceof Error ? compileErr.message : 'Compilation failed';
    const fixResp = await fetch(`${API_URL}/latex/fix-latex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex, log }),
    });
    if (!fixResp.ok) throw compileErr;
    const fixed = await fixResp.json().catch(() => ({}));
    if (!fixed?.fixedLatex || typeof fixed.fixedLatex !== 'string') throw compileErr;
    return await compile(fixed.fixedLatex);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, template_id, title, status, current_version_id, folder_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!supportsRealtimeGeneration(doc.template_id)) {
    return NextResponse.json({ error: 'streaming_generation_not_supported_for_template' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_anonymous) {
    return NextResponse.json({ error: 'account_required_for_generation' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { prompt } = body as { prompt?: string };
  const userPrompt = typeof prompt === 'string' ? prompt.trim() : '';

  if (!userPrompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(8);

  const intentDecision = decideDocumentGenerationIntent({
    prompt: userPrompt,
    templateId: doc.template_id,
    mode: 'draft',
    recentMessages: recentMessages ?? [],
  });

  if (!intentDecision.shouldGenerate && intentDecision.reply) {
    await persistChatTurn(supabase, {
      documentId,
      userId: user.id,
      userContent: userPrompt,
      assistantContent: intentDecision.reply,
    });
    return NextResponse.json({ message: intentDecision.reply });
  }

  const { data: guestCheck } = await supabase.rpc('check_guest_limits', {
    p_user_id: user.id,
  });
  if (guestCheck && guestCheck.messages_used >= guestCheck.messages_limit) {
    return NextResponse.json({ error: 'guest_message_limit' }, { status: 402 });
  }

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 },
    );
  }

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
    }),
  );

  const validAttachments = attachmentFiles.filter(Boolean) as Array<Record<string, unknown>>;
  const projectContext = buildDocumentProjectContext(documentId, doc.template_id);
  await supabase.from('documents').update({ status: 'generating' }).eq('id', documentId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send({ phase: 'calling_ai' });

        const apiResp = await fetch(`${API_URL}/latex/generate-stream`, {
          method: 'POST',
          headers: buildInternalApiHeaders(user.id, 'document_generate_stream', API_INTERNAL_TOKEN, projectContext),
          body: JSON.stringify({
            prompt: userPrompt,
            templateId: doc.template_id,
            files: validAttachments,
            forceDocument: true,
          }),
        });

        if (!apiResp.ok) {
          const body = await apiResp.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Generation failed');
        }

        let finalLatex = '';
        let finalSummary: string | undefined;
        let upstreamUsage: UpstreamUsage | null = null;

        await readSseEvents(apiResp, async (event) => {
          if (event.error) throw new Error(event.error);
          if (event.chunk) send({ chunk: event.chunk });
          if (event.message) {
            await supabase.from('documents').update({ status: doc.status }).eq('id', documentId);
            await persistChatTurn(supabase, {
              documentId,
              userId: user.id,
              userContent: userPrompt,
              assistantContent: event.message,
            });
            send({ done: true, message: event.message });
          }
          if (event.done && event.latex) {
            finalLatex = event.latex;
            finalSummary = event.summary;
            upstreamUsage = event.usage ?? null;
            send({ latex: finalLatex });
          }
        });

        if (!finalLatex) return;

        const usageForRecord = upstreamUsage as UpstreamUsage | null;
        if (usageForRecord?.provider && usageForRecord?.model) {
          await recordAiUsage({
            supabase,
            userId: user.id,
            provider: usageForRecord.provider,
            model: usageForRecord.model,
            usage: {
              prompt_tokens: (usageForRecord.inputTokens ?? 0) + (usageForRecord.cachedInputTokens ?? 0),
              completion_tokens: usageForRecord.outputTokens ?? 0,
              prompt_tokens_details: { cached_tokens: usageForRecord.cachedInputTokens ?? 0 },
            },
            feature: 'document_generate_stream',
            projectType: projectContext.projectType ?? null,
            projectId: projectContext.projectId ?? null,
            metadata: { source: 'app-web-stream-relay' },
          });
        }

        send({ phase: 'compiling' });
        const compiled = await compileWithRepair(finalLatex, validAttachments, doc.template_id);

        const { data: lastVersion } = await supabase
          .from('document_versions')
          .select('version_number')
          .eq('document_id', documentId)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const versionNumber = (lastVersion?.version_number ?? 0) + 1;
        const storagePath = `${user.id}/${documentId}/${versionNumber}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('documents-output')
          .upload(storagePath, compiled.pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

        const { data: signedUrlData } = await supabase.storage
          .from('documents-output')
          .createSignedUrl(storagePath, 3600);

        const pdfSignedUrl = signedUrlData?.signedUrl ?? null;

        const { data: version, error: versionError } = await supabase
          .from('document_versions')
          .insert({
            document_id: documentId,
            version_number: versionNumber,
            latex_content: compiled.latex,
            pdf_storage_path: storagePath,
            compile_status: 'success',
            prompt_used: userPrompt,
          })
          .select('id')
          .single();

        if (versionError || !version) {
          throw new Error(`Failed to save version: ${versionError?.message ?? 'unknown error'}`);
        }

        const shouldReplaceAutoTitle =
          isDefaultDocumentTitle(doc.title) || isPromptDerivedDocumentTitle(doc.title, userPrompt);
        const autoTitle = shouldReplaceAutoTitle
          ? buildTitleFromLatex(compiled.latex) ?? buildTitleFromPrompt(userPrompt)
          : null;

        await supabase
          .from('documents')
          .update({
            status: 'ready',
            current_version_id: version.id,
            ...(autoTitle ? { title: autoTitle } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId);

        await persistChatTurn(supabase, {
          documentId,
          userId: user.id,
          userContent: userPrompt,
          assistantContent: finalSummary || 'Document generated successfully.',
          versionId: version.id,
        });

        send({
          done: true,
          documentId,
          versionId: version.id,
          pdfSignedUrl,
          latex: compiled.latex,
        });
      } catch (error) {
        await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
        const message = error instanceof Error ? error.message : 'Generation failed';
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
