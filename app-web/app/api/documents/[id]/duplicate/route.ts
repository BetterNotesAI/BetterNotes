import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUniqueCopyTitle(supabase: any, userId: string, originalTitle: string): Promise<string> {
  // Strip existing " (copy N)" suffix to get the base title
  const base = originalTitle.replace(/ \(copy(?: \d+)?\)$/, '');

  const { data: existing } = await supabase
    .from('documents')
    .select('title')
    .eq('user_id', userId)
    .ilike('title', `${base} (copy%`);

  const titles = new Set((existing ?? []).map((d: { title: string }) => d.title));

  if (!titles.has(`${base} (copy)`)) return `${base} (copy)`;

  let n = 2;
  while (titles.has(`${base} (copy ${n})`)) n++;
  return `${base} (copy ${n})`;
}

// POST /api/documents/[id]/duplicate
// Creates a full copy of a document including its current version's latex content and PDF.
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

  // Fetch source document
  const { data: source, error: sourceError } = await supabase
    .from('documents')
    .select('id, title, template_id, folder_id, current_version_id, status')
    .eq('id', sourceId)
    .eq('user_id', user.id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Fetch current version (latex + pdf path)
  let latexContent: string | null = null;
  let sourcePdfPath: string | null = null;

  if (source.current_version_id) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('latex_content, pdf_storage_path')
      .eq('id', source.current_version_id)
      .eq('document_id', sourceId)
      .maybeSingle();
    latexContent = version?.latex_content ?? null;
    sourcePdfPath = version?.pdf_storage_path ?? null;
  }

  const hasContent = !!latexContent;

  // Create new document
  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    template_id: source.template_id,
    title: await getUniqueCopyTitle(supabase, user.id, source.title),
    status: hasContent ? 'ready' : 'draft',
  };
  if (source.folder_id) insertPayload.folder_id = source.folder_id;

  const { data: newDoc, error: insertError } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select('id, title, template_id, status')
    .single();

  if (insertError || !newDoc) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create document' }, { status: 500 });
  }

  // Copy version content + PDF if available
  if (hasContent) {
    let newPdfPath: string | null = null;

    // Copy PDF using admin client (bypasses RLS on storage)
    if (sourcePdfPath) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const ext = sourcePdfPath.split('.').pop() ?? 'pdf';
      newPdfPath = `${user.id}/${newDoc.id}/v1.${ext}`;
      const { error: copyError } = await admin.storage
        .from('documents-output')
        .copy(sourcePdfPath, newPdfPath);
      if (copyError) {
        newPdfPath = null;
      }
    }

    const versionPayload: Record<string, unknown> = {
      document_id: newDoc.id,
      latex_content: latexContent,
      version_number: 1,
      compile_status: newPdfPath ? 'success' : 'pending',
      prompt_used: '[duplicated]',
    };
    if (newPdfPath) versionPayload.pdf_storage_path = newPdfPath;

    const { data: newVersion, error: versionError } = await supabase
      .from('document_versions')
      .insert(versionPayload)
      .select('id')
      .single();

    if (!versionError && newVersion) {
      await supabase
        .from('documents')
        .update({ current_version_id: newVersion.id })
        .eq('id', newDoc.id);
    }
  }

  return NextResponse.json({ document: newDoc }, { status: 201 });
}
