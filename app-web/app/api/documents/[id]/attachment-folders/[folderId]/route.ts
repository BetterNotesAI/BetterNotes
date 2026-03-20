import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME_LENGTH = 100;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, folderId } = await params;

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

  const { name } = body as { name?: unknown };

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be at most ${MAX_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Verify folder belongs to this document and user
  const { data: existingFolder, error: folderFetchError } = await supabase
    .from('attachment_folders')
    .select('id')
    .eq('id', folderId)
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (folderFetchError) {
    return NextResponse.json({ error: folderFetchError.message }, { status: 500 });
  }
  if (!existingFolder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { data: updatedFolder, error: updateError } = await supabase
    .from('attachment_folders')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('user_id', user.id)
    .select('id, name')
    .single();

  if (updateError || !updatedFolder) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Update failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    folder: {
      id: updatedFolder.id,
      name: updatedFolder.name,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, folderId } = await params;

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

  // Verify folder belongs to this document and user
  const { data: folder, error: folderFetchError } = await supabase
    .from('attachment_folders')
    .select('id')
    .eq('id', folderId)
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (folderFetchError) {
    return NextResponse.json({ error: folderFetchError.message }, { status: 500 });
  }
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('attachment_folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
