import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/documents — list user's documents
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select(`
      id,
      title,
      template_id,
      status,
      is_starred,
      created_at,
      updated_at,
      current_version_id
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

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
  const { template_id, title } = body as { template_id?: string; title?: string };

  if (!template_id || typeof template_id !== 'string') {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      template_id,
      title: title?.trim() || 'Untitled Document',
      status: 'draft',
    })
    .select('id, title, template_id, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
