// GET  /api/documents/[id]/qa/chat — load Q&A inline chat messages
// POST /api/documents/[id]/qa/chat — send message, get AI reply

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalApiHeaders, checkCreditQuota } from '@/lib/ai-usage';
import { buildDocumentProjectContext } from '@/lib/usage-project';
import {
  createQaPersistenceUnavailableError,
  isMissingDocumentQaTableError,
  isQaPersistenceUnavailableError,
} from '@/lib/document-qa-persistence';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';
const INLINE_CHAT_SUBCHAT_BLOCK_INDEX = 2_000_000;

type RouteContext = { params: Promise<{ id: string }> };

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type OwnedDocument = {
  id: string;
  template_id: string | null;
  current_version_id: string | null;
};

type QaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type QaHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function createTransientMessage(role: 'user' | 'assistant', content: string): QaMessage {
  return {
    id: `transient-${role}-${crypto.randomUUID()}`,
    role,
    content,
    created_at: new Date().toISOString(),
  };
}

function toQuoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

async function getOwnedDocument(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<OwnedDocument | null> {
  const { data } = await supabase
    .from('documents')
    .select('id, template_id, current_version_id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle();

  return data ?? null;
}

async function getDocumentContextLatex(
  supabase: SupabaseClient,
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

async function getOrCreateInlineSubchat(
  supabase: SupabaseClient,
  documentId: string,
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('document_qa_subchats')
    .select('id')
    .eq('document_id', documentId)
    .eq('block_index', INLINE_CHAT_SUBCHAT_BLOCK_INDEX)
    .maybeSingle();

  if (isMissingDocumentQaTableError(existingError)) {
    throw createQaPersistenceUnavailableError();
  }
  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('document_qa_subchats')
    .insert({
      document_id: documentId,
      block_index: INLINE_CHAT_SUBCHAT_BLOCK_INDEX,
      context_text: '',
    })
    .select('id')
    .single();

  if (isMissingDocumentQaTableError(error)) {
    throw createQaPersistenceUnavailableError();
  }
  if (!error && created) return created.id;

  const { data: raceExisting, error: raceError } = await supabase
    .from('document_qa_subchats')
    .select('id')
    .eq('document_id', documentId)
    .eq('block_index', INLINE_CHAT_SUBCHAT_BLOCK_INDEX)
    .maybeSingle();

  if (isMissingDocumentQaTableError(raceError)) {
    throw createQaPersistenceUnavailableError();
  }
  if (raceError) {
    throw new Error(raceError.message);
  }
  if (raceExisting) return raceExisting.id;
  throw new Error(error?.message ?? 'Failed to create inline Q&A chat');
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const doc = await getOwnedDocument(supabase, documentId, user.id);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: subchat, error: subchatError } = await supabase
    .from('document_qa_subchats')
    .select('id')
    .eq('document_id', documentId)
    .eq('block_index', INLINE_CHAT_SUBCHAT_BLOCK_INDEX)
    .maybeSingle();

  if (isMissingDocumentQaTableError(subchatError)) {
    return NextResponse.json({ messages: [], persistence: 'unavailable' });
  }
  if (subchatError) {
    return NextResponse.json({ error: subchatError.message }, { status: 500 });
  }
  if (!subchat) {
    return NextResponse.json({ messages: [] });
  }

  const { data: messages, error } = await supabase
    .from('document_qa_messages')
    .select('id, role, content, created_at')
    .eq('subchat_id', subchat.id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingDocumentQaTableError(error)) {
      return NextResponse.json({ messages: [], persistence: 'unavailable' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const doc = await getOwnedDocument(supabase, documentId, user.id);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, selectedTexts } = body as { content?: string; selectedTexts?: string[] };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const contexts = Array.isArray(selectedTexts)
    ? selectedTexts.map((t) => t.trim()).filter(Boolean)
    : [];

  const quoteBlocks = contexts.map((ctx) => toQuoteBlock(ctx));
  const userMessageForLLM = quoteBlocks.length > 0
    ? `${quoteBlocks.join('\n\n')}\n\n${content.trim()}`
    : content.trim();

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 },
    );
  }

  let subchatId: string | null = null;
  let persistenceUnavailable = false;
  try {
    subchatId = await getOrCreateInlineSubchat(supabase, documentId);
  } catch (err: unknown) {
    if (isQaPersistenceUnavailableError(err)) {
      persistenceUnavailable = true;
    } else {
      const message = err instanceof Error ? err.message : 'Failed to create chat';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  let userMsg: QaMessage = createTransientMessage('user', userMessageForLLM);
  let history: QaHistoryMessage[] = [];

  if (!persistenceUnavailable && subchatId) {
    const { data: savedUserMsg, error: userMsgError } = await supabase
      .from('document_qa_messages')
      .insert({ subchat_id: subchatId, role: 'user', content: userMessageForLLM })
      .select('id, role, content, created_at')
      .single();

    if (userMsgError || !savedUserMsg) {
      if (isMissingDocumentQaTableError(userMsgError)) {
        persistenceUnavailable = true;
      } else {
        return NextResponse.json({ error: userMsgError?.message ?? 'Failed to save message' }, { status: 500 });
      }
    } else {
      userMsg = {
        id: savedUserMsg.id,
        role: savedUserMsg.role as 'user' | 'assistant',
        content: savedUserMsg.content,
        created_at: savedUserMsg.created_at,
      };
    }
  }

  if (!persistenceUnavailable && subchatId) {
    const { data: allMessages, error: historyError } = await supabase
      .from('document_qa_messages')
      .select('role, content')
      .eq('subchat_id', subchatId)
      .order('created_at', { ascending: true });

    if (historyError) {
      if (isMissingDocumentQaTableError(historyError)) {
        persistenceUnavailable = true;
      } else {
        return NextResponse.json({ error: historyError.message }, { status: 500 });
      }
    } else {
      history = (allMessages ?? [])
        .filter((m): m is QaHistoryMessage =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
        )
        .slice(0, -1);
    }
  }

  if (persistenceUnavailable) {
    userMsg = createTransientMessage('user', userMessageForLLM);
    history = [];
  }

  const fullDocumentContext = await getDocumentContextLatex(supabase, doc.current_version_id);
  const contentForLLM = contexts.length > 0 ? contexts.join('\n\n') : fullDocumentContext;

  let assistantContent: string;
  try {
    const projectContext = buildDocumentProjectContext(documentId, doc.template_id);
    const apiResp = await fetch(`${API_URL}/cheat-sheet/chat`, {
      method: 'POST',
      headers: buildInternalApiHeaders(user.id, 'document_qa_chat', API_INTERNAL_TOKEN, projectContext),
      body: JSON.stringify({
        contentMd: contentForLLM,
        history,
        userMessage: userMessageForLLM,
      }),
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.json().catch(() => ({ error: 'API error' })) as { error?: string };
      return NextResponse.json({ error: errBody?.error ?? 'Failed to reach AI API' }, { status: 502 });
    }

    const respData = await apiResp.json() as { reply?: string };
    assistantContent = respData.reply ?? '';
  } catch (fetchErr: unknown) {
    const message = fetchErr instanceof Error ? fetchErr.message : 'Network error';
    return NextResponse.json({ error: `Failed to reach app-api: ${message}` }, { status: 502 });
  }

  if (persistenceUnavailable || !subchatId) {
    return NextResponse.json({
      userMessage: userMsg,
      assistantMessage: createTransientMessage('assistant', assistantContent),
      persistence: 'unavailable',
    });
  }

  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('document_qa_messages')
    .insert({ subchat_id: subchatId, role: 'assistant', content: assistantContent })
    .select('id, role, content, created_at')
    .single();

  if (assistantMsgError || !assistantMsg) {
    if (isMissingDocumentQaTableError(assistantMsgError)) {
      return NextResponse.json({
        userMessage: userMsg,
        assistantMessage: createTransientMessage('assistant', assistantContent),
        persistence: 'unavailable',
      });
    }
    return NextResponse.json({ error: assistantMsgError?.message ?? 'Failed to save assistant message' }, { status: 500 });
  }

  return NextResponse.json({ userMessage: userMsg, assistantMessage: assistantMsg });
}
