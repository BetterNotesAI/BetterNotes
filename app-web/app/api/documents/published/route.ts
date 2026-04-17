import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/documents/published
 *
 * Returns all documents the current user has published (is_published = true),
 * ordered by published_at descending. Includes view_count, like_count,
 * and whether the current user has liked each document.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select(
      'id, title, template_id, published_at, university, degree, subject, visibility, keywords, view_count, like_count'
    )
    .eq('user_id', user.id)
    .eq('is_published', true)
    .is('archived_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!documents || documents.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  // Fetch which documents the current user has liked (single query)
  const documentIds = documents.map((d) => d.id);
  const { data: likedRows } = await supabase
    .from('document_likes')
    .select('document_id')
    .eq('user_id', user.id)
    .in('document_id', documentIds);

  const likedSet = new Set((likedRows ?? []).map((r) => r.document_id));

  const enriched = documents.map((doc) => ({
    ...doc,
    user_liked: likedSet.has(doc.id),
    is_own: true, // all docs from this endpoint are the current user's own
  }));

  return NextResponse.json({ documents: enriched });
}
