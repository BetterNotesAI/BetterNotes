/**
 * GET /api/explore/courses/[courseId]
 *
 * Returns course metadata + all publicly published documents for that course,
 * sorted by like_count desc, view_count desc.
 * Auth optional — if authenticated we include whether the user liked each doc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient();
  const { courseId } = await params;

  // Current user (optional — not required for public explore)
  const { data: { user } } = await supabase.auth.getUser();

  // ── Course metadata (with program + university) ────────────────────────────
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select(`
      id,
      name,
      year,
      semester,
      semester_label,
      ects,
      tipo,
      degree_program_id,
      degree_programs (
        id,
        title,
        tipo,
        slug,
        university_id,
        universities (
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', courseId)
    .maybeSingle();

  if (courseErr || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  // ── Public documents for this course ──────────────────────────────────────
  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('id, title, template_id, published_at, university, degree, subject, keywords, view_count, like_count, user_id')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .eq('visibility', 'public')
    .is('archived_at', null)
    .order('like_count', { ascending: false })
    .order('view_count', { ascending: false });

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const documents = docs ?? [];

  // ── Enrich with user-specific data (liked, is_own) ────────────────────────
  let likedSet = new Set<string>();
  if (user && documents.length > 0) {
    const { data: likedRows } = await supabase
      .from('document_likes')
      .select('document_id')
      .eq('user_id', user.id)
      .in('document_id', documents.map((d) => d.id));
    likedSet = new Set((likedRows ?? []).map((r) => r.document_id));
  }

  const enriched = documents.map((doc) => ({
    id:           doc.id,
    title:        doc.title,
    template_id:  doc.template_id,
    published_at: doc.published_at,
    university:   doc.university,
    degree:       doc.degree,
    subject:      doc.subject,
    keywords:     doc.keywords ?? [],
    view_count:   doc.view_count ?? 0,
    like_count:   doc.like_count ?? 0,
    user_liked:   likedSet.has(doc.id),
    is_own:       user ? doc.user_id === user.id : false,
  }));

  return NextResponse.json({ course, documents: enriched });
}
