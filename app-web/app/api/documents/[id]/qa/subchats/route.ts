// GET  /api/documents/[id]/qa/subchats — list subchats with messages
// POST /api/documents/[id]/qa/subchats — create subchat

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isMissingDocumentQaTableError,
  qaPersistenceUnavailablePayload,
} from '@/lib/document-qa-persistence';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: subchats, error } = await supabase
    .from('document_qa_subchats')
    .select('id, block_index, context_text, created_at')
    .eq('document_id', documentId)
    .order('block_index', { ascending: true });

  if (error) {
    if (isMissingDocumentQaTableError(error)) {
      return NextResponse.json({ subchats: [], persistence: 'unavailable' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subchatIds = (subchats ?? []).map((s) => s.id);
  const messagesMap: Record<string, Array<{ id: string; role: string; content: string; created_at: string }>> = {};

  if (subchatIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from('document_qa_messages')
      .select('id, subchat_id, role, content, created_at')
      .in('subchat_id', subchatIds)
      .order('created_at', { ascending: true });

    if (messagesError && !isMissingDocumentQaTableError(messagesError)) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    for (const msg of messages ?? []) {
      if (!messagesMap[msg.subchat_id]) messagesMap[msg.subchat_id] = [];
      messagesMap[msg.subchat_id].push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      });
    }
  }

  const result = (subchats ?? []).map((sc) => ({
    ...sc,
    messages: messagesMap[sc.id] ?? [],
  }));

  return NextResponse.json({ subchats: result });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { blockIndex, contextText } = body as { blockIndex?: number; contextText?: string };

  if (typeof blockIndex !== 'number' || blockIndex < 0) {
    return NextResponse.json({ error: 'Invalid blockIndex' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('document_qa_subchats')
    .select('id, block_index, context_text, created_at')
    .eq('document_id', documentId)
    .eq('block_index', blockIndex)
    .maybeSingle();

  if (existingError) {
    if (isMissingDocumentQaTableError(existingError)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    const { data: existingMessages, error: existingMessagesError } = await supabase
      .from('document_qa_messages')
      .select('id, role, content, created_at')
      .eq('subchat_id', existing.id)
      .order('created_at', { ascending: true });

    if (existingMessagesError && !isMissingDocumentQaTableError(existingMessagesError)) {
      return NextResponse.json({ error: existingMessagesError.message }, { status: 500 });
    }

    return NextResponse.json({
      subchat: {
        ...existing,
        messages: existingMessages ?? [],
      },
    });
  }

  const { data: subchat, error } = await supabase
    .from('document_qa_subchats')
    .insert({
      document_id: documentId,
      block_index: blockIndex,
      context_text: contextText ?? '',
    })
    .select('id, block_index, context_text, created_at')
    .single();

  if (error) {
    if (isMissingDocumentQaTableError(error)) {
      return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
    }

    if (error.code === '23505') {
      const { data: raceExisting, error: raceExistingError } = await supabase
        .from('document_qa_subchats')
        .select('id, block_index, context_text, created_at')
        .eq('document_id', documentId)
        .eq('block_index', blockIndex)
        .maybeSingle();

      if (raceExistingError) {
        if (isMissingDocumentQaTableError(raceExistingError)) {
          return NextResponse.json(qaPersistenceUnavailablePayload(), { status: 503 });
        }
        return NextResponse.json({ error: raceExistingError.message }, { status: 500 });
      }

      if (raceExisting) {
        const { data: raceMessages, error: raceMessagesError } = await supabase
          .from('document_qa_messages')
          .select('id, role, content, created_at')
          .eq('subchat_id', raceExisting.id)
          .order('created_at', { ascending: true });

        if (raceMessagesError && !isMissingDocumentQaTableError(raceMessagesError)) {
          return NextResponse.json({ error: raceMessagesError.message }, { status: 500 });
        }

        return NextResponse.json({
          subchat: {
            ...raceExisting,
            messages: raceMessages ?? [],
          },
        });
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subchat: { ...subchat, messages: [] } }, { status: 201 });
}
