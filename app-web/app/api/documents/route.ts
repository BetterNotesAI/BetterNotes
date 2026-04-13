import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildTitleFromPrompt } from '@/lib/document-title';
import { MAX_PROJECT_TOTAL_UPLOAD_BYTES, MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';

// GET /api/documents — list user's documents
// Query params:
//   sort       = date_desc (default) | date_asc | title_asc | template
//   starred    = true   → only starred documents
//   archived   = true   → include archived documents (default excludes them)
//   folder_id  = <uuid> → filter by folder
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') ?? 'date_desc';
  const starred = searchParams.get('starred') === 'true';
  const archived = searchParams.get('archived') === 'true';
  const folderId = searchParams.get('folder_id');

  let query = supabase
    .from('documents')
    .select(`
      id,
      title,
      template_id,
      status,
      is_starred,
      archived_at,
      folder_id,
      created_at,
      updated_at,
      current_version_id
    `)
    .eq('user_id', user.id);

  // Exclude archived documents unless explicitly requested
  if (!archived) {
    query = query.is('archived_at', null);
  } else {
    query = query.not('archived_at', 'is', null);
  }

  if (starred) {
    query = query.eq('is_starred', true);
  }

  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  switch (sort) {
    case 'date_asc':
      query = query.order('updated_at', { ascending: true });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    case 'template':
      query = query.order('template_id', { ascending: true });
      break;
    case 'date_desc':
    default:
      query = query.order('updated_at', { ascending: false });
      break;
  }

  const { data: documents, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents });
}

// POST /api/documents — create a new empty document
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { template_id, title, prompt, attachments, folder_id } = body as {
    template_id?: string;
    title?: string;
    prompt?: string;
    folder_id?: string | null;
    attachments?: Array<{
      storagePath: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };
  const folderId = typeof folder_id === 'string' ? folder_id.trim() || null : folder_id ?? null;

  if (!template_id || typeof template_id !== 'string') {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  }

  if (attachments && !Array.isArray(attachments)) {
    return NextResponse.json({ error: 'attachments must be an array' }, { status: 400 });
  }

  const totalAttachmentBytes = (attachments ?? []).reduce((acc, a) => {
    const size = typeof a?.sizeBytes === 'number' && Number.isFinite(a.sizeBytes) ? a.sizeBytes : 0;
    return acc + Math.max(0, size);
  }, 0);

  if (totalAttachmentBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Project file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per project.` },
      { status: 400 }
    );
  }

  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (folderError) {
      return NextResponse.json({ error: folderError.message }, { status: 500 });
    }
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
  }

  // Check guest limits before creating the document
  const { data: guestCheck } = await supabase.rpc('check_guest_limits', {
    p_user_id: user.id,
  });
  if (guestCheck && !guestCheck.allowed && guestCheck.reason === 'guest_doc_limit') {
    return NextResponse.json({ error: 'guest_doc_limit' }, { status: 402 });
  }

  const resolvedTitle =
    title?.trim() ||
    buildTitleFromPrompt(prompt) ||
    'Untitled Document';

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    template_id,
    title: resolvedTitle,
    status: 'draft',
  };
  if (folderId) insertPayload.folder_id = folderId;

  const { data: doc, error } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select('id, title, template_id, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (attachments && attachments.length > 0) {
    await supabase.from('document_attachments').insert(
      attachments.map((a) => ({
        document_id: doc.id,
        user_id: user.id,
        name: a.name,
        storage_path: a.storagePath,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
      }))
    );
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
