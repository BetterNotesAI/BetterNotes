import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_ATTACHMENTS_PER_DOCUMENT = 10;

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

  // Verify document ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: attachments, error: listError } = await supabase
    .from('document_attachments')
    .select('id, name, mime_type, size_bytes, created_at')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    attachments: (attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
      createdAt: a.created_at,
    })),
  });
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

  // Verify document ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Validate request body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { storagePath, name, mimeType, sizeBytes } = body as {
    storagePath?: unknown;
    name?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };

  if (typeof storagePath !== 'string' || !storagePath.trim()) {
    return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (typeof mimeType !== 'string' || !mimeType.trim()) {
    return NextResponse.json({ error: 'mimeType is required' }, { status: 400 });
  }
  if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
    return NextResponse.json({ error: 'sizeBytes must be a non-negative number' }, { status: 400 });
  }

  // Enforce per-document attachment limit
  const { count, error: countError } = await supabase
    .from('document_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('user_id', user.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_DOCUMENT) {
    return NextResponse.json(
      { error: 'Maximum 10 attachments per document' },
      { status: 400 }
    );
  }

  const { data: attachment, error: insertError } = await supabase
    .from('document_attachments')
    .insert({
      document_id: documentId,
      user_id: user.id,
      storage_path: storagePath.trim(),
      name: name.trim(),
      mime_type: mimeType.trim(),
      size_bytes: sizeBytes,
    })
    .select('id, name, mime_type, size_bytes, created_at')
    .single();

  if (insertError || !attachment) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      attachment: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mime_type,
        sizeBytes: attachment.size_bytes,
        createdAt: attachment.created_at,
      },
    },
    { status: 201 }
  );
}
