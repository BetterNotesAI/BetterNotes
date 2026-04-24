import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/documents/published
 *
 * Returns ALL publicly published documents across all users, ordered by
 * published_at descending. This powers the My Studies community library.
 *
 * Enriches each doc with:
 *   - is_own        : true if the doc belongs to the current user
 *   - user_liked    : whether the current user has liked it
 *   - university_slug / program_slug : for explore page URL construction
 *   - author_name / author_avatar   : for attribution on community cards
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Auth is optional — anonymous users can still browse public docs
  // but won't get personalised is_own / user_liked enrichment.

  const { data: documents, error } = await supabase
    .from('documents')
    .select(
      'id, title, template_id, published_at, university, degree, subject, visibility, keywords, view_count, like_count, university_id, program_id, course_id, user_id'
    )
    .eq('is_published', true)
    .eq('visibility', 'public')
    .is('archived_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!documents || documents.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  // ── Fetch university and program slugs ────────────────────────────────────
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

  // ── Fetch author profiles ─────────────────────────────────────────────────
  const authorIds = [...new Set(documents.map((d) => d.user_id).filter(Boolean))] as string[];
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', authorIds)
    : { data: [] as { id: string; display_name: string | null; username: string | null; avatar_url: string | null }[] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // ── Fetch liked set for current user ──────────────────────────────────────
  let likedSet = new Set<string>();
  if (user) {
    const documentIds = documents.map((d) => d.id);
    const { data: likedRows } = await supabase
      .from('document_likes')
      .select('document_id')
      .eq('user_id', user.id)
      .in('document_id', documentIds);
    likedSet = new Set((likedRows ?? []).map((r) => r.document_id));
  }

  // ── Enrich ────────────────────────────────────────────────────────────────
  const enriched = documents.map((doc) => {
    const profile = profileMap[doc.user_id];
    return {
      ...doc,
      university_slug: doc.university_id ? (uniSlugs[doc.university_id] ?? null) : null,
      program_slug:    doc.program_id    ? (progSlugs[doc.program_id]    ?? null) : null,
      user_liked:  likedSet.has(doc.id),
      is_own:      user ? doc.user_id === user.id : false,
      author_name:   profile?.display_name || profile?.username || null,
      author_avatar: profile?.avatar_url ?? null,
    };
  });

  return NextResponse.json({ documents: enriched });
}
