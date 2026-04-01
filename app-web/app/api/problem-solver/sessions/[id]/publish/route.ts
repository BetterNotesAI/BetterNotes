import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/problem-solver/sessions/[id]/publish
 *
 * Publishes (or unpublishes) a problem-solver session to the user's My Studies page.
 *
 * Body (all optional except action):
 *   action      : 'publish' | 'unpublish'
 *   university  : string
 *   degree      : string
 *   subject     : string
 *   visibility  : 'private' | 'public'   (default: 'private')
 *   keywords    : string[]
 *
 * Returns: { ok: true, session: { id, is_published, published_at } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    action = 'publish',
    university,
    degree,
    subject,
    visibility = 'private',
    keywords = [],
  } = body as {
    action?: 'publish' | 'unpublish';
    university?: string;
    degree?: string;
    subject?: string;
    visibility?: 'private' | 'public';
    keywords?: string[];
  };

  // Verify the session belongs to this user
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (action === 'unpublish') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('problem_solver_sessions')
      .update({
        is_published: false,
        published_at: null,
        updated_at: now,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      session: { id: sessionId, is_published: false, published_at: null },
    });
  }

  // action === 'publish'
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    is_published: true,
    published_at: now,
    visibility: visibility === 'public' ? 'public' : 'private',
    keywords: Array.isArray(keywords)
      ? keywords.map((k) => k.trim()).filter(Boolean)
      : [],
    updated_at: now,
  };

  if (university !== undefined) updates.university = university.trim() || null;
  if (degree !== undefined) updates.degree = degree.trim() || null;
  if (subject !== undefined) updates.subject = subject.trim() || null;

  const { error } = await supabase
    .from('problem_solver_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session: { id: sessionId, is_published: true, published_at: now },
  });
}
