import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; inputId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId, inputId } = await params;

  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (folderError) return NextResponse.json({ error: folderError.message }, { status: 500 });
  if (!folder) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });

  const { data: input, error: lookupError } = await supabase
    .from('folder_inputs')
    .select('id, storage_path')
    .eq('id', inputId)
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!input) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const { error: deleteError } = await supabase
    .from('folder_inputs')
    .delete()
    .eq('id', inputId)
    .eq('folder_id', folderId)
    .eq('user_id', user.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (input.storage_path) {
    await supabase.storage.from('document-attachments').remove([input.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
