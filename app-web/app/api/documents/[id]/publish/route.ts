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

  if (university !== undefined) updates.university = university.trim() || null;
  if (degree !== undefined) updates.degree = degree.trim() || null;
  if (subject !== undefined) updates.subject = subject.trim() || null;

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
