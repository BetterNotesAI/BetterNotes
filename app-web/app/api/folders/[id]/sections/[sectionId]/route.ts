import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SectionPatchPayload {
  name?: string;
  color?: string | null;
  sort_order?: number;
}

async function requireSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  folderId: string,
  sectionId: string,
  userId: string
) {
  const { data: section, error } = await supabase
    .from('folder_sections')
    .select('id, folder_id')
    .eq('id', sectionId)
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { error };
  return { section };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId, sectionId } = await params;
  const body = await req.json().catch(() => ({})) as SectionPatchPayload;

  const result = await requireSection(supabase, folderId, sectionId, user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.color !== undefined) {
    updates.color = typeof body.color === 'string' && body.color.trim().length > 0
      ? body.color.trim()
      : null;
  }

  if (body.sort_order !== undefined) {
    if (!Number.isFinite(body.sort_order)) {
      return NextResponse.json({ error: 'sort_order must be a number' }, { status: 400 });
    }
    updates.sort_order = Math.trunc(body.sort_order);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: section, error } = await supabase
    .from('folder_sections')
    .update(updates)
    .eq('id', sectionId)
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .select('id, folder_id, name, color, sort_order, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: folderId, sectionId } = await params;

  const result = await requireSection(supabase, folderId, sectionId, user.id);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  }

  const { error: clearDocsError } = await supabase
    .from('documents')
    .update({ section_id: null, updated_at: new Date().toISOString() })
    .eq('folder_id', folderId)
    .eq('section_id', sectionId)
    .eq('user_id', user.id);

  if (clearDocsError) {
    return NextResponse.json({ error: clearDocsError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from('folder_sections')
    .delete()
    .eq('id', sectionId)
    .eq('folder_id', folderId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
