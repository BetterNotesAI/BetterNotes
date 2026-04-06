import { NextRequest, NextResponse } from 'next/server';
import { zipSync } from 'fflate';
import { createClient } from '@/lib/supabase/server';

// GET /api/folders/[id]/download
// Downloads all compiled PDFs in the folder as a single ZIP file.
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

  // Get all non-archived documents in this folder that have a current version
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, current_version_id')
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .is('archived_at', null);

  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }

  const docsWithVersion = (docs ?? []).filter((d) => d.current_version_id);

  if (docsWithVersion.length === 0) {
    return NextResponse.json(
      { error: 'No compiled PDFs found in this folder. Generate documents first.' },
      { status: 404 }
    );
  }

  // Fetch each PDF from storage and add to ZIP
  const zipEntries: Record<string, Uint8Array> = {};

  for (const doc of docsWithVersion) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('pdf_storage_path')
      .eq('id', doc.current_version_id)
      .eq('document_id', doc.id)
      .maybeSingle();

    if (!version?.pdf_storage_path) continue;

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents-output')
      .download(version.pdf_storage_path);

    if (downloadError || !fileBlob) continue;

    const buffer = await fileBlob.arrayBuffer();
    // Sanitize filename to avoid ZIP path issues
    const safeName = (doc.title ?? 'document').replace(/[/\\:*?"<>|]/g, '_');
    zipEntries[`${safeName}.pdf`] = new Uint8Array(buffer);
  }

  if (Object.keys(zipEntries).length === 0) {
    return NextResponse.json(
      { error: 'Could not retrieve any PDFs. Try again later.' },
      { status: 500 }
    );
  }

  const zipped = zipSync(zipEntries);
  const zipArrayBuffer = zipped.buffer as ArrayBuffer;
  const safeFolderName = folder.name.replace(/[/\\:*?"<>|]/g, '_');

  return new Response(zipArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeFolderName}.zip"`,
    },
  });
}
