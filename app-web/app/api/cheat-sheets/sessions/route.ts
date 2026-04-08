// GET  /api/cheat-sheets/sessions — list user sessions
// POST /api/cheat-sheets/sessions — create new session

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: sessions, error } = await supabase
    .from('cheat_sheet_sessions')
    .select('id, title, status, subject, language, source_doc_ids, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    source_doc_ids,
    external_content,
    language,
    subject,
  } = body as {
    title?: string;
    source_doc_ids?: string[];
    external_content?: string;
    language?: string;
    subject?: string;
  };

  const { data: session, error } = await supabase
    .from('cheat_sheet_sessions')
    .insert({
      user_id: user.id,
      title: title?.trim() || 'Untitled Cheat Sheet',
      source_doc_ids: source_doc_ids ?? [],
      external_content: external_content ?? null,
      language: language ?? 'english',
      subject: subject ?? null,
      status: 'pending',
    })
    .select('id, title, status, subject, language, source_doc_ids, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session }, { status: 201 });
}
