import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/folders/[id]/download
// Returns a list of { title, signedUrl } for all documents in the folder
// that have a compiled PDF. The frontend downloads each one individually.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId } = await params;

  // Verify ownership of folder
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id, name')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (folderError) {
    return NextResponse.json({ error: folderError.message }, { status: 500 });
  }
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  // Get all documents in this folder with their current version
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, current_version_id')
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .is('archived_at', null);

  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }
  if (!docs || docs.length === 0) {
    return NextResponse.json({ folderName: folder.name, files: [] });
  }

  // For each doc, get the pdf_storage_path from its current version and generate a signed URL
  const files: { title: string; signedUrl: string }[] = [];

  for (const doc of docs) {
    if (!doc.current_version_id) continue;

    const { data: version } = await supabase
      .from('document_versions')
      .select('pdf_storage_path')
      .eq('id', doc.current_version_id)
      .eq('document_id', doc.id)
      .maybeSingle();

    if (!version?.pdf_storage_path) continue;

    const { data: signedUrlData } = await supabase.storage
      .from('documents-output')
      .createSignedUrl(version.pdf_storage_path, 3600);

    if (signedUrlData?.signedUrl) {
      files.push({ title: doc.title ?? 'document', signedUrl: signedUrlData.signedUrl });
    }
  }

  return NextResponse.json({ folderName: folder.name, files });
}
