import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    .select('id, name, color, is_starred, created_at')
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

  // Build a map of folder_id → count in JS
  const countMap: Record<string, number> = {};
  for (const row of countRows ?? []) {
    if (row.folder_id) {
      countMap[row.folder_id] = (countMap[row.folder_id] ?? 0) + 1;
    }
  }

  const result = folders.map((folder) => ({
    ...folder,
    document_count: countMap[folder.id] ?? 0,
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
  const { name, color, description } = body as {
    name?: string;
    color?: string;
    description?: string;
  };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const cleanedDescription =
    typeof description === 'string' && description.trim().length > 0
      ? description.trim()
      : null;

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

  return NextResponse.json({ folder }, { status: 201 });
}
