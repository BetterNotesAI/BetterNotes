import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let latex: unknown;
  try {
    ({ latex } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof latex !== 'string' || latex.trim().length === 0) {
    return NextResponse.json({ error: 'Missing latex' }, { status: 400 });
  }
  if (latex.length > 500_000) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // Verify ownership
  const { data: doc } = await supabase
    .from('documents')
    .select('id, folder_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch project-global attachments when present; loose documents keep
  // document-level attachments for backwards compatibility.
  const attachmentQuery = doc.folder_id
    ? supabase
      .from('folder_inputs')
      .select('name, storage_path, mime_type')
      .eq('folder_id', doc.folder_id)
      .eq('user_id', user.id)
    : supabase
      .from('document_attachments')
      .select('name, storage_path, mime_type')
      .eq('document_id', documentId)
      .eq('user_id', user.id);

  const { data: attachmentRows } = await attachmentQuery;

  const attachmentFiles = await Promise.all(
    (attachmentRows ?? []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from('document-attachments')
        .createSignedUrl(row.storage_path, 60);
      if (!urlData?.signedUrl) return null;
      return {
        name: row.name,
        mimeType: row.mime_type ?? 'application/octet-stream',
        url: urlData.signedUrl,
        embedInPdf: (row.mime_type ?? '').startsWith('image/'),
      };
    })
  );
  const validAttachments = attachmentFiles.filter(Boolean);

  // Call app-api compile-only endpoint
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiUrl}/latex/compile-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex, files: validAttachments }),
  });

  if (!response.ok) {
    const isClientError = response.status >= 400 && response.status < 500;
    return NextResponse.json(
      { error: 'Compilation failed' },
      { status: isClientError ? response.status : 422 }
    );
  }

  // Response is the PDF binary
  const pdfBuffer = await response.arrayBuffer();

  // Save new version to Supabase Storage
  const versionPath = `${user.id}/${documentId}/v_manual_${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('documents-output')
    .upload(versionPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  // Determine next version number
  const { data: lastVersion } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

  // Save new document_version record
  const { data: version, error: versionError } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: nextVersionNumber,
      latex_content: latex,
      pdf_storage_path: versionPath,
      compile_status: 'success',
    })
    .select()
    .single();

  if (versionError) {
    return NextResponse.json({ error: 'Version save failed' }, { status: 500 });
  }

  // Update document's current_version_id
  await supabase
    .from('documents')
    .update({ current_version_id: version.id })
    .eq('id', documentId);

  // Get signed URL
  const { data: signedData } = await supabase.storage
    .from('documents-output')
    .createSignedUrl(versionPath, 3600);

  return NextResponse.json({
    versionId: version.id,
    pdfUrl: signedData?.signedUrl,
  });
}
