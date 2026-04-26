import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/fork
 *
 * Creates a copy of a published document in the current user's All Documents.
 * The fork:
 *   - Gets the latest version's LaTeX source
 *   - Is prefixed "Fork of …" in the title
 *   - Starts as private draft (not published, no PDF)
 *   - Carries forked_from_id pointing to the original
 *   - Pre-fills university / degree / subject / keywords from the original
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sourceId } = await params;

  // 1. Load source document — must be published
  const { data: source, error: sourceError } = await supabase
    .from('documents')
    .select('id, user_id, title, template_id, current_version_id, university, degree, subject, keywords, is_published')
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (!source.is_published) {
    return NextResponse.json({ error: 'Document is not published' }, { status: 403 });
  }

  // Option A: block forking own documents
  if (source.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot fork your own document' }, { status: 403 });
  }

  // 2. Load latest version's LaTeX source + PDF path
  let latexContent: string | null = null;
  let sourcePdfPath: string | null = null;
  if (source.current_version_id) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('latex_content, pdf_storage_path')
      .eq('id', source.current_version_id)
      .maybeSingle();
    latexContent  = version?.latex_content    ?? null;
    sourcePdfPath = version?.pdf_storage_path ?? null;
  }

  // 3. Create forked document (current_version_id set after version creation)
  const { data: newDoc, error: insertDocError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      template_id: source.template_id,
      title: `Fork of ${source.title}`,
      status: latexContent ? 'ready' : 'draft',
      forked_from_id: source.id,
      is_published: false,
      visibility: 'private',
      university: source.university ?? null,
      degree: source.degree ?? null,
      subject: source.subject ?? null,
      keywords: source.keywords ?? [],
    })
    .select('id')
    .single();

  if (insertDocError || !newDoc) {
    return NextResponse.json({ error: insertDocError?.message ?? 'Failed to create fork' }, { status: 500 });
  }

  // 4. Copy the source PDF into this user's storage namespace (so they can
  //    view it immediately without recompiling). If anything fails, we still
  //    create the version with latex only and mark it pending.
  let newPdfPath: string | null = null;
  if (sourcePdfPath) {
    const { data: pdfBlob, error: dlError } = await supabase.storage
      .from('documents-output')
      .download(sourcePdfPath);
    if (!dlError && pdfBlob) {
      const candidatePath = `${user.id}/${newDoc.id}/v_fork_${Date.now()}.pdf`;
      const { error: upError } = await supabase.storage
        .from('documents-output')
        .upload(candidatePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (!upError) newPdfPath = candidatePath;
    }
  }

  // 5. Create first version with the forked LaTeX content (if any)
  if (latexContent) {
    const { data: newVersion, error: insertVersionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: newDoc.id,
        latex_content: latexContent,
        pdf_storage_path: newPdfPath,
        version_number: 1,
        compile_status: newPdfPath ? 'success' : 'pending',
        prompt_used: `Forked from "${source.title}"`,
      })
      .select('id')
      .single();

    if (insertVersionError || !newVersion) {
      // Clean up the document if version creation fails
      await supabase.from('documents').delete().eq('id', newDoc.id);
      return NextResponse.json({ error: insertVersionError?.message ?? 'Failed to create version' }, { status: 500 });
    }

    // 6. Point document to its first version
    await supabase
      .from('documents')
      .update({ current_version_id: newVersion.id })
      .eq('id', newDoc.id);
  }

  // Increment fork_count on the source document.
  // Uses a SECURITY DEFINER function so the forking user (who doesn't own the
  // source document) can still update that column atomically.
  await supabase.rpc('increment_document_fork_count', { p_document_id: sourceId });

  return NextResponse.json({ ok: true, document_id: newDoc.id });
}
