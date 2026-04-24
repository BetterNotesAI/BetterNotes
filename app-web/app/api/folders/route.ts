import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_PROJECT_TOTAL_UPLOAD_BYTES, MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';

interface FolderInputPayload {
  name?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    Boolean(
      message?.includes('folder_inputs') &&
      (message.includes('schema cache') || message.includes('does not exist'))
    )
  );
}

// GET /api/folders — list user's folders with non-archived document count
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch folders belonging to the user
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('id, name, color, is_starred, archived_at, created_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (foldersError) {
    return NextResponse.json({ error: foldersError.message }, { status: 500 });
  }

  if (!folders || folders.length === 0) {
    return NextResponse.json({ folders: [] });
  }

  // Fetch non-archived document counts grouped by folder_id
  const folderIds = folders.map((f) => f.id);

  const { data: countRows, error: countError } = await supabase
    .from('documents')
    .select('folder_id')
    .eq('user_id', user.id)
    .in('folder_id', folderIds)
    .is('archived_at', null);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data: inputCountRows, error: inputCountError } = await supabase
    .from('folder_inputs')
    .select('folder_id')
    .eq('user_id', user.id)
    .in('folder_id', folderIds);

  if (inputCountError && !isMissingRelationError(inputCountError)) {
    return NextResponse.json({ error: inputCountError.message }, { status: 500 });
  }

  // Build a map of folder_id → count in JS
  const countMap: Record<string, number> = {};
  for (const row of countRows ?? []) {
    if (row.folder_id) {
      countMap[row.folder_id] = (countMap[row.folder_id] ?? 0) + 1;
    }
  }

  const inputCountMap: Record<string, number> = {};
  for (const row of inputCountRows ?? []) {
    if (row.folder_id) {
      inputCountMap[row.folder_id] = (inputCountMap[row.folder_id] ?? 0) + 1;
    }
  }

  const result = folders.map((folder) => ({
    ...folder,
    document_count: countMap[folder.id] ?? 0,
    input_count: inputCountMap[folder.id] ?? 0,
  }));

  return NextResponse.json({ folders: result });
}

// POST /api/folders — create a new folder
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, color, description, inputs } = body as {
    name?: string;
    color?: string;
    description?: string;
    inputs?: FolderInputPayload[];
  };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const cleanedDescription =
    typeof description === 'string' && description.trim().length > 0
      ? description.trim()
      : null;

  if (inputs !== undefined && !Array.isArray(inputs)) {
    return NextResponse.json({ error: 'inputs must be an array' }, { status: 400 });
  }

  const cleanedInputs = (inputs ?? []).map((input) => {
    const cleanedName = typeof input?.name === 'string' ? input.name.trim() : '';
    const cleanedPath = typeof input?.storagePath === 'string' ? input.storagePath.trim() : '';
    const cleanedMimeType = typeof input?.mimeType === 'string' && input.mimeType.trim().length > 0
      ? input.mimeType.trim()
      : null;
    const cleanedSize = typeof input?.sizeBytes === 'number' && Number.isFinite(input.sizeBytes)
      ? Math.max(0, input.sizeBytes)
      : null;

    return {
      name: cleanedName,
      storagePath: cleanedPath,
      mimeType: cleanedMimeType,
      sizeBytes: cleanedSize,
    };
  });

  for (const input of cleanedInputs) {
    if (!input.name || !input.storagePath || input.sizeBytes === null) {
      return NextResponse.json({ error: 'Each input must include name, storagePath and sizeBytes' }, { status: 400 });
    }
    if (!input.storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Invalid input storage path' }, { status: 400 });
    }
  }

  const totalInputBytes = cleanedInputs.reduce((acc, input) => acc + (input.sizeBytes ?? 0), 0);
  if (totalInputBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Project input file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.` },
      { status: 400 }
    );
  }

  const { data: folder, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name: name.trim(),
      color: color?.trim() || null,
      description: cleanedDescription,
    })
    .select('id, name, color, description, is_starred, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (cleanedInputs.length > 0) {
    const { error: inputsInsertError } = await supabase
      .from('folder_inputs')
      .insert(
        cleanedInputs.map((input) => ({
          folder_id: folder.id,
          user_id: user.id,
          name: input.name,
          storage_path: input.storagePath,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
        }))
      );

    if (inputsInsertError) {
      // Best effort cleanup to avoid leaving a half-created project.
      await supabase
        .from('folders')
        .delete()
        .eq('id', folder.id)
        .eq('user_id', user.id);
      return NextResponse.json({ error: inputsInsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ folder }, { status: 201 });
}
