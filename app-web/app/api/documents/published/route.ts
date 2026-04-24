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
      'id, title, template_id, published_at, university, degree, subject, visibility, keywords, view_count, like_count, university_id, program_id, course_id'
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

  // Fetch university and program slugs separately (avoids FK join issues)
  const uniIds  = [...new Set(documents.map((d) => d.university_id).filter(Boolean))] as string[];
  const progIds = [...new Set(documents.map((d) => d.program_id).filter(Boolean))]    as string[];

  const [uniResult, progResult] = await Promise.all([
    uniIds.length
      ? supabase.from('universities').select('id, slug').in('id', uniIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
    progIds.length
      ? supabase.from('degree_programs').select('id, slug').in('id', progIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);

  const uniSlugs  = Object.fromEntries((uniResult.data  ?? []).map((r) => [r.id, r.slug]));
  const progSlugs = Object.fromEntries((progResult.data ?? []).map((r) => [r.id, r.slug]));

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
    university_slug: doc.university_id ? (uniSlugs[doc.university_id] ?? null) : null,
    program_slug:    doc.program_id    ? (progSlugs[doc.program_id]    ?? null) : null,
    user_liked: likedSet.has(doc.id),
    is_own: true,
  }));

  return NextResponse.json({ documents: enriched });
}
