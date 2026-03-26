import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/share/[token]
 * Public endpoint — no auth required.
 * Returns document metadata + a signed PDF URL for a given share_token.
 * Uses the service-role client to bypass RLS.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Look up document by share_token
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, template_id, current_version_id')
    .eq('share_token', token)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!doc.current_version_id) {
    return NextResponse.json({
      document: { id: doc.id, title: doc.title, template_id: doc.template_id },
      pdfSignedUrl: null,
    });
  }

  // Fetch the current version's PDF storage path
  const { data: version } = await supabase
    .from('document_versions')
    .select('pdf_storage_path')
    .eq('id', doc.current_version_id)
    .eq('document_id', doc.id)
    .maybeSingle();

  let pdfSignedUrl: string | null = null;

  if (version?.pdf_storage_path) {
    const { data: signedUrlData } = await supabase.storage
      .from('documents-output')
      .createSignedUrl(version.pdf_storage_path, 3600);
    pdfSignedUrl = signedUrlData?.signedUrl ?? null;
  }

  return NextResponse.json({
    document: { id: doc.id, title: doc.title, template_id: doc.template_id },
    pdfSignedUrl,
  });
}
