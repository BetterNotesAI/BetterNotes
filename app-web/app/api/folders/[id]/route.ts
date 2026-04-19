import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/folders/[id] — fetch single folder metadata
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

  const { data: folder, error } = await supabase
    .from('folders')
    .select('id, name, color, description, is_starred, archived_at, created_at, updated_at')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  return NextResponse.json({ folder });
}

// PATCH /api/folders/[id] — rename folder, change color, or toggle starred
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, color, description, is_starred, archived_at } = body as {
    name?: string;
    color?: string;
    description?: string | null;
    is_starred?: boolean;
    archived_at?: string | null;
  };

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (color !== undefined) updates.color = color?.trim() || null;
  if (description !== undefined) {
    updates.description =
      typeof description === 'string' && description.trim().length > 0
        ? description.trim()
        : null;
  }
  if (is_starred !== undefined) updates.is_starred = Boolean(is_starred);
  if (archived_at !== undefined) updates.archived_at = archived_at ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Verify ownership and apply update (RLS also enforces this)
  const { error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/folders/[id] — delete folder
// Documents with this folder_id will have folder_id set to NULL (FK ON DELETE SET NULL)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId } = await params;

  // Verify the folder exists and belongs to the user before deleting (RLS also enforces this)
  const { data: folder, error: lookupError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
