import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/publish
 *
 * Publishes (or unpublishes) a document to the user's My Studies page.
 *
 * Body (all optional except action):
 *   action      : 'publish' | 'unpublish'
 *   university  : string
 *   degree      : string
 *   subject     : string
 *   visibility  : 'private' | 'public'   (default: 'private')
 *   keywords    : string[]
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

  const { id: documentId } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    action = 'publish',
    university,
    degree,
    subject,
    university_id,
    program_id,
    course_id,
    visibility = 'private',
    keywords = [],
  } = body as {
    action?: 'publish' | 'unpublish';
    university?: string;
    degree?: string;
    subject?: string;
    university_id?: string | null;
    program_id?: string | null;
    course_id?: string | null;
    visibility?: 'private' | 'public';
    keywords?: string[];
  };

  // Verify the document belongs to this user
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, user_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (action === 'unpublish') {
    const { error } = await supabase
      .from('documents')
      .update({
        is_published: false,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, published: false });
  }

  // action === 'publish'
  const updates: Record<string, unknown> = {
    is_published: true,
    published_at: new Date().toISOString(),
    visibility: visibility === 'public' ? 'public' : 'private',
    keywords: Array.isArray(keywords)
      ? keywords.map((k) => k.trim()).filter(Boolean)
      : [],
    updated_at: new Date().toISOString(),
  };

  // Structured catalogue path — resolve display names from IDs
  // When university_id is provided (even null), always overwrite text + FK columns together
  // so they never get out of sync.
  const isStructuredMode = university_id !== undefined; // sent in body = university mode

  if (isStructuredMode) {
    // University
    if (university_id) {
      const { data: uniRow } = await supabase
        .from('universities')
        .select('name')
        .eq('id', university_id)
        .maybeSingle();
      updates.university_id = university_id;
      updates.university = uniRow?.name ?? null;
    } else {
      updates.university_id = null;
      updates.university = null;
    }
    // Program
    if (program_id) {
      const { data: progRow } = await supabase
        .from('degree_programs')
        .select('title')
        .eq('id', program_id)
        .maybeSingle();
      updates.program_id = program_id;
      updates.degree = progRow?.title ?? null;
    } else {
      updates.program_id = null;
      updates.degree = null;
    }
    // Course
    if (course_id) {
      const { data: courseRow } = await supabase
        .from('courses')
        .select('name')
        .eq('id', course_id)
        .maybeSingle();
      updates.course_id = course_id;
      updates.subject = courseRow?.name ?? null;
    } else {
      updates.course_id = null;
      updates.subject = null;
    }
  } else {
    // Independent / free-text mode — clear FK columns, use text values
    updates.university_id = null;
    updates.program_id    = null;
    updates.course_id     = null;
    updates.university = typeof university === 'string' ? university.trim() || null : null;
    updates.degree     = typeof degree     === 'string' ? degree.trim()     || null : null;
    updates.subject    = typeof subject    === 'string' ? subject.trim()    || null : null;
  }

  const { error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, published: true });
}
