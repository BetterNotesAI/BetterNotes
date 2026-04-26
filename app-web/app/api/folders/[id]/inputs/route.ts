import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_BYTES,
  MAX_PROJECT_TOTAL_UPLOAD_MB,
} from '@/lib/upload-limits';
import { dedupeFolderInputsByStoragePath } from '@/lib/folder-inputs';

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

async function verifyFolderOwner(folderId: string, userId: string) {
  const supabase = await createClient();
  const { data: folder, error } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', userId)
    .maybeSingle();

  return { supabase, folder, error };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId } = await params;
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (folderError) return NextResponse.json({ error: folderError.message }, { status: 500 });
  if (!folder) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });

  const { data: inputs, error } = await supabase
    .from('folder_inputs')
    .select('id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({ inputs: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inputs: dedupeFolderInputsByStoragePath(inputs ?? []).map((input) => ({
      id: input.id,
      name: input.name,
      mimeType: input.mime_type,
      sizeBytes: input.size_bytes,
      createdAt: input.created_at,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId } = await params;
  const { folder, error: folderError } = await verifyFolderOwner(folderId, user.id);
  if (folderError) return NextResponse.json({ error: folderError.message }, { status: 500 });
  if (!folder) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { storagePath, name, mimeType, sizeBytes } = body as {
    storagePath?: unknown;
    name?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };

  if (typeof storagePath !== 'string' || !storagePath.trim()) {
    return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
  }
  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (typeof mimeType !== 'string' || !mimeType.trim()) {
    return NextResponse.json({ error: 'mimeType is required' }, { status: 400 });
  }
  if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
    return NextResponse.json({ error: 'sizeBytes must be a non-negative number' }, { status: 400 });
  }
  if (sizeBytes > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.` },
      { status: 400 }
    );
  }

  const { data: existingSizes, error: sizesError } = await supabase
    .from('folder_inputs')
    .select('id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
    .eq('folder_id', folderId)
    .eq('user_id', user.id);

  if (sizesError) {
    if (isMissingRelationError(sizesError)) {
      return NextResponse.json({ error: 'Notebook attachments table is not ready' }, { status: 500 });
    }
    return NextResponse.json({ error: sizesError.message }, { status: 500 });
  }

  const uniqueExistingInputs = dedupeFolderInputsByStoragePath(existingSizes ?? []);
  const existingInput = uniqueExistingInputs.find((input) => input.storage_path?.trim() === storagePath.trim());
  if (existingInput) {
    return NextResponse.json(
      {
        input: {
          id: existingInput.id,
          name: existingInput.name,
          mimeType: existingInput.mime_type,
          sizeBytes: existingInput.size_bytes,
          createdAt: existingInput.created_at,
        },
      },
      { status: 200 }
    );
  }

  const currentTotalBytes = uniqueExistingInputs.reduce(
    (acc, row) => acc + (typeof row.size_bytes === 'number' ? row.size_bytes : 0),
    0
  );

  if (currentTotalBytes + sizeBytes > MAX_PROJECT_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Notebook file limit exceeded. Maximum total upload size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB per notebook.` },
      { status: 400 }
    );
  }

  const { data: input, error: insertError } = await supabase
    .from('folder_inputs')
    .insert({
      folder_id: folderId,
      user_id: user.id,
      storage_path: storagePath.trim(),
      name: name.trim(),
      mime_type: mimeType.trim(),
      size_bytes: sizeBytes,
    })
    .select('id, name, mime_type, size_bytes, created_at')
    .single();

  if (insertError || !input) {
    if (insertError?.code === '23505') {
      const { data: existingInputAfterConflict } = await supabase
        .from('folder_inputs')
        .select('id, name, mime_type, size_bytes, created_at')
        .eq('folder_id', folderId)
        .eq('user_id', user.id)
        .eq('storage_path', storagePath.trim())
        .maybeSingle();

      if (existingInputAfterConflict) {
        return NextResponse.json(
          {
            input: {
              id: existingInputAfterConflict.id,
              name: existingInputAfterConflict.name,
              mimeType: existingInputAfterConflict.mime_type,
              sizeBytes: existingInputAfterConflict.size_bytes,
              createdAt: existingInputAfterConflict.created_at,
            },
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      { error: insertError?.message ?? 'Insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      input: {
        id: input.id,
        name: input.name,
        mimeType: input.mime_type,
        sizeBytes: input.size_bytes,
        createdAt: input.created_at,
      },
    },
    { status: 201 }
  );
}
