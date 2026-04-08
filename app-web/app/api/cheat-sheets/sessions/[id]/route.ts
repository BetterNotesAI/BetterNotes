// GET   /api/cheat-sheets/sessions/[id]
// PATCH /api/cheat-sheets/sessions/[id]
// DELETE /api/cheat-sheets/sessions/[id]

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { data: session, error } = await supabase
    .from('cheat_sheet_sessions')
    .select('id, title, status, subject, language, source_doc_ids, external_content, content_md, created_at, updated_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const { title, subject, language } = body as {
    title?: string;
    subject?: string;
    language?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title && typeof title === 'string' && title.trim()) {
    updates.title = title.trim();
  }
  if (typeof subject === 'string') updates.subject = subject;
  if (typeof language === 'string' && language.trim()) updates.language = language.trim();

  const { data: session, error } = await supabase
    .from('cheat_sheet_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id, title, status, subject, language')
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const { error } = await supabase
    .from('cheat_sheet_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
