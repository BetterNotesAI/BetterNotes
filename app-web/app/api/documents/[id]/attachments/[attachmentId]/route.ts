import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, attachmentId } = await params;

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

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { folderId } = body as { folderId?: unknown };

  if (folderId !== undefined && folderId !== null && typeof folderId !== 'string') {
    return NextResponse.json({ error: 'folderId must be a string or null' }, { status: 400 });
  }

  // If a folderId is provided, verify it belongs to the same document and user
  if (typeof folderId === 'string') {
    const { data: folder, error: folderError } = await supabase
      .from('attachment_folders')
      .select('id')
      .eq('id', folderId)
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (folderError) {
      return NextResponse.json({ error: folderError.message }, { status: 500 });
    }
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
  }

  // Verify attachment exists and belongs to this document and user
  const { data: attachment, error: attachmentFetchError } = await supabase
    .from('document_attachments')
    .select('id')
    .eq('id', attachmentId)
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (attachmentFetchError) {
    return NextResponse.json({ error: attachmentFetchError.message }, { status: 500 });
  }
  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('document_attachments')
    .update({ folder_id: folderId ?? null })
    .eq('id', attachmentId)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, attachmentId } = await params;

  // Fetch the attachment, verifying user ownership explicitly
  const { data: attachment, error: fetchError } = await supabase
    .from('document_attachments')
    .select('id, storage_path')
    .eq('id', attachmentId)
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  // Remove from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('document-attachments')
    .remove([attachment.storage_path]);

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Remove from database
  const { error: deleteError } = await supabase
    .from('document_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
