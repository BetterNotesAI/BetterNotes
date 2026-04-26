// POST /api/documents/[id]/qa/subchats/[subchatId]/chat
// Send a message in a document Q&A subchat and get AI reply

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';
import {
  isMissingDocumentQaTableError,
  qaPersistenceUnavailablePayload,
} from '@/lib/document-qa-persistence';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';
const MAX_HISTORY_MESSAGES = 24;

type RouteContext = { params: Promise<{ id: string; subchatId: string }> };

type OwnedDocument = {
  id: string;
  template_id: string | null;
  current_version_id: string | null;
};

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

async function getDocumentContextLatex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentVersionId: string | null,
): Promise<string> {
  if (!currentVersionId) return '';

  const { data: version } = await supabase
    .from('document_versions')
    .select('latex_content')
    .eq('id', currentVersionId)
    .maybeSingle();

  return version?.latex_content ?? '';
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, subchatId } = await params;

  const { data: doc } = await supabase
    .from('documents')
    .select('id, template_id, current_version_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const ownedDoc: OwnedDocument = doc;

  const { data: subchat, error: subchatError } = await supabase
    .from('document_qa_subchats')
    .select('id, context_text')
    .eq('id', subchatId)
    .eq('document_id', documentId)
    .single();

  if (subchatError) {
    if (isMissingDocumentQaTableError(subchatError)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }
    if (subchatError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Subchat not found' }, { status: 404 });
    }
    return NextResponse.json({ error: subchatError.message }, { status: 500 });
  }

  if (!subchat) {
    return NextResponse.json({ error: 'Subchat not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const userMessageTrimmed = content.trim();

  const { data: recentMessages, error: historyError } = await supabase
    .from('document_qa_messages')
    .select('role, content')
    .eq('subchat_id', subchatId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (historyError) {
    if (isMissingDocumentQaTableError(historyError)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  const history = (recentMessages ?? [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )
    .reverse();

  const { data: userMsg, error: userMsgError } = await supabase
    .from('document_qa_messages')
    .insert({ subchat_id: subchatId, role: 'user', content: userMessageTrimmed })
    .select('id, role, content, created_at')
    .single();

  if (userMsgError || !userMsg) {
    if (isMissingDocumentQaTableError(userMsgError)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }
    return NextResponse.json(
      { error: userMsgError?.message ?? 'Failed to save message' },
      { status: 500 },
    );
  }

  const contextPrefix = subchat.context_text
    ? `[Focusing on this section of the document:]\n${toQuoteBlock(subchat.context_text)}\n\n`
    : '';
  const userMessageForLLM = `${contextPrefix}${userMessageTrimmed}`;

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 },
    );
  }

  const fullDocumentContext = await getDocumentContextLatex(supabase, ownedDoc.current_version_id);
  const contentForLLM = subchat.context_text?.trim() || fullDocumentContext;

  let assistantContent: string;
  try {
    const projectContext = buildDocumentProjectContext(documentId, ownedDoc.template_id);
    const apiResp = await fetch(`${API_URL}/cheat-sheet/chat`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_qa_subchat_chat', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        contentMd: contentForLLM,
        history,
        userMessage: userMessageForLLM,
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
      return NextResponse.json(
        { error: errBody?.error ?? 'Failed to reach AI API' },
        { status: 502 },
      );
    }

    const respData = await apiResp.json() as { reply?: string };
    assistantContent = respData.reply ?? '';
  } catch (fetchErr: unknown) {
    const message = fetchErr instanceof Error ? fetchErr.message : 'Network error';
    return NextResponse.json({ error: `Failed to reach app-api: ${message}` }, { status: 502 });
  }

  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('document_qa_messages')
    .insert({ subchat_id: subchatId, role: 'assistant', content: assistantContent })
    .select('id, role, content, created_at')
    .single();

  if (assistantMsgError || !assistantMsg) {
    if (isMissingDocumentQaTableError(assistantMsgError)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }
    return NextResponse.json(
      { error: assistantMsgError?.message ?? 'Failed to save assistant message' },
      { status: 500 },
    );
  }

  return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg });
}
