import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME_LENGTH = 100;

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

  // Verify document ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: folders, error: listError } = await supabase
    .from('attachment_folders')
    .select('id, name, created_at')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    folders: (folders ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.created_at,
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

  const { id: documentId } = await params;

  // Verify document ownership
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name } = body as { name?: unknown };

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be at most ${MAX_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  const { data: folder, error: insertError } = await supabase
    .from('attachment_folders')
    .insert({
      document_id: documentId,
      user_id: user.id,
      name: name.trim(),
    })
    .select('id, name, created_at')
    .single();

  if (insertError || !folder) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      folder: {
        id: folder.id,
        name: folder.name,
        createdAt: folder.created_at,
      },
    },
    { status: 201 }
  );
}
