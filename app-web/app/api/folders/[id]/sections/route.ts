import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SectionPayload {
  name?: string;
  color?: string | null;
}

async function requireFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  folderId: string,
  userId: string
) {
  const { data: folder, error } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { error };
  return { folder };
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
  const folderResult = await requireFolder(supabase, folderId, user.id);
  if (folderResult.error) {
    return NextResponse.json({ error: folderResult.error.message }, { status: 500 });
  }
  if (!folderResult.folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('folder_sections')
    .select('id, folder_id, name, color, sort_order, created_at, updated_at')
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  const sectionIds = (sections ?? []).map((section) => section.id);
  const countMap: Record<string, number> = {};

  if (sectionIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('section_id')
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .in('section_id', sectionIds)
      .is('archived_at', null);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    for (const doc of docs ?? []) {
      if (doc.section_id) {
        countMap[doc.section_id] = (countMap[doc.section_id] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    sections: (sections ?? []).map((section) => ({
      ...section,
      document_count: countMap[section.id] ?? 0,
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
  const body = await req.json().catch(() => ({})) as SectionPayload;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const color = typeof body.color === 'string' && body.color.trim().length > 0
    ? body.color.trim()
    : null;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const folderResult = await requireFolder(supabase, folderId, user.id);
  if (folderResult.error) {
    return NextResponse.json({ error: folderResult.error.message }, { status: 500 });
  }
  if (!folderResult.folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { count } = await supabase
    .from('folder_sections')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId)
    .eq('user_id', user.id);

  const { data: section, error } = await supabase
    .from('folder_sections')
    .insert({
      folder_id: folderId,
      user_id: user.id,
      name,
      color,
      sort_order: count ?? 0,
    })
    .select('id, folder_id, name, color, sort_order, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section: { ...section, document_count: 0 } }, { status: 201 });
}
