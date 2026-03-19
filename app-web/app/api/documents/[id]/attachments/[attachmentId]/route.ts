import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
