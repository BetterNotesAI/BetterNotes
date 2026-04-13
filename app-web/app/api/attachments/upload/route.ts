import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_ATTACHMENT_FILE_SIZE_BYTES, MAX_PROJECT_TOTAL_UPLOAD_MB } from '@/lib/upload-limits';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse multipart form data
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate mime type
  const mimeType = file.type;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, WEBP' },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_PROJECT_TOTAL_UPLOAD_MB} MB.` },
      { status: 400 }
    );
  }

  const ext = MIME_TO_EXT[mimeType] ?? 'bin';
  const storagePath = `${user.id}/tmp/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('document-attachments')
    .upload(storagePath, buffer, { contentType: mimeType });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json(
    { storagePath, name: file.name, mimeType, sizeBytes: file.size },
    { status: 201 }
  );
}
