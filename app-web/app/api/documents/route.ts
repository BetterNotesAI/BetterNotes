import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildTitleFromPrompt } from '@/lib/document-title';
import { MAX_PROJECT_TOTAL_UPLOAD_BYTES, MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';
import { inferFolderIdFromRequest } from '@/lib/request-project-context';
import { dedupeFolderInputsByStoragePath, dedupeUploadsByStoragePath } from '@/lib/folder-inputs';

// GET /api/documents — list user's documents
// Query params:
//   sort       = date_desc (default) | date_asc | title_asc | template
//   starred    = true   → only starred documents
//   archived   = true   → include archived documents (default excludes them)
//   folder_id  = <uuid> → filter by folder
//   section_id = <uuid> → filter by internal notebook folder
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
  const sectionId = searchParams.get('section_id');

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
      section_id,
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

  if (sectionId) {
    query = query.eq('section_id', sectionId);
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
  const { template_id, title, prompt, attachments, folder_id, section_id } = body as {
    template_id?: string;
    title?: string;
    prompt?: string;
    folder_id?: string | null;
    section_id?: string | null;
    attachments?: Array<{
      storagePath: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };
  const requestedFolderId = typeof folder_id === 'string' ? folder_id.trim() || null : folder_id ?? null;
  const requestedSectionId = typeof section_id === 'string' ? section_id.trim() || null : section_id ?? null;
  const inferredFolderId = inferFolderIdFromRequest(req);
  const folderId = requestedFolderId ?? inferredFolderId;

  if (!template_id || typeof template_id !== 'string') {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  }

  if (attachments && !Array.isArray(attachments)) {
    return NextResponse.json({ error: 'attachments must be an array' }, { status: 400 });
  }

  const cleanedAttachments = dedupeUploadsByStoragePath(attachments ?? []);
  let projectAttachmentsToInsert = cleanedAttachments;

  const totalAttachmentBytes = cleanedAttachments.reduce((acc, a) => {
    const size = typeof a?.sizeBytes === 'number' && Number.isFinite(a.sizeBytes) ? a.sizeBytes : 0;
    return acc + Math.max(0, size);
  }, 0);

  if (totalAttachmentBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Notebook file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per notebook.` },
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

    if (cleanedAttachments.length > 0) {
      const { data: existingProjectInputs, error: projectInputsError } = await supabase
        .from('folder_inputs')
        .select('folder_id, storage_path, size_bytes')
        .eq('folder_id', folderId)
        .eq('user_id', user.id);

      if (projectInputsError) {
        return NextResponse.json({ error: projectInputsError.message }, { status: 500 });
      }

      const uniqueExistingProjectInputs = dedupeFolderInputsByStoragePath(existingProjectInputs ?? []);
      const existingStoragePaths = new Set(
        uniqueExistingProjectInputs
          .map((row) => row.storage_path?.trim())
          .filter((path): path is string => Boolean(path))
      );

      projectAttachmentsToInsert = cleanedAttachments.filter(
        (attachment) => !existingStoragePaths.has(attachment.storagePath.trim())
      );

      const currentProjectBytes = uniqueExistingProjectInputs.reduce(
        (acc, row) => acc + (typeof row.size_bytes === 'number' ? row.size_bytes : 0),
        0
      );
      const newProjectBytes = projectAttachmentsToInsert.reduce((acc, attachment) => acc + attachment.sizeBytes, 0);

      if (currentProjectBytes + newProjectBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `Notebook file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per notebook.` },
          { status: 400 }
        );
      }
    }
  }

  if (requestedSectionId) {
    if (!folderId) {
      return NextResponse.json({ error: 'section_id requires folder_id' }, { status: 400 });
    }

    const { data: section, error: sectionError } = await supabase
      .from('folder_sections')
      .select('id, folder_id')
      .eq('id', requestedSectionId)
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sectionError) {
      return NextResponse.json({ error: sectionError.message }, { status: 500 });
    }
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
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
  if (requestedSectionId) insertPayload.section_id = requestedSectionId;

  const { data: doc, error } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select('id, title, template_id, status, folder_id, section_id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (cleanedAttachments.length > 0) {
    if (folderId) {
      if (projectAttachmentsToInsert.length > 0) {
        const { error: inputsInsertError } = await supabase.from('folder_inputs').insert(
          projectAttachmentsToInsert.map((a) => ({
            folder_id: folderId,
            user_id: user.id,
            name: a.name,
            storage_path: a.storagePath,
            mime_type: a.mimeType,
            size_bytes: a.sizeBytes,
          }))
        );

        if (inputsInsertError && inputsInsertError.code !== '23505') {
          return NextResponse.json({ error: inputsInsertError.message }, { status: 500 });
        }
      }
    } else {
      await supabase.from('document_attachments').insert(
        cleanedAttachments.map((a) => ({
          document_id: doc.id,
          user_id: user.id,
          name: a.name,
          storage_path: a.storagePath,
          mime_type: a.mimeType,
          size_bytes: a.sizeBytes,
        }))
      );
    }
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
