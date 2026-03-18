import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`
      id,
      title,
      template_id,
      status,
      is_starred,
      current_version_id,
      created_at,
      updated_at
    `)
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let pdfSignedUrl: string | null = null;
  let latexContent: string | null = null;
  let versionNumber: number | null = null;

  if (doc.current_version_id) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('id, latex_content, pdf_storage_path, version_number')
      .eq('id', doc.current_version_id)
      .maybeSingle();

    if (version?.pdf_storage_path) {
      const { data: signedUrlData } = await supabase.storage
        .from('documents-output')
        .createSignedUrl(version.pdf_storage_path, 3600);
      pdfSignedUrl = signedUrlData?.signedUrl ?? null;
      latexContent = version.latex_content;
      versionNumber = version.version_number;
    }
  }

  return NextResponse.json({
    document: doc,
    pdfSignedUrl,
    latexContent,
    versionNumber,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const body = await req.json().catch(() => ({}));
  const { title, is_starred } = body as { title?: string; is_starred?: boolean };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (is_starred !== undefined) updates.is_starred = is_starred;

  const { error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
