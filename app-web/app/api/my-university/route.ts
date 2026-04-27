/**
 * GET /api/my-university
 *
 * Returns the authenticated user's personalised curriculum tree:
 * - Their degree program (title, tipo, university name/slug)
 * - All courses grouped by year, each with a published-document count
 *
 * Returns { program: null } when the user has no profile_program_id set.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CourseRow {
  id: string;
  name: string;
  year: number;
  semester: number | null;
  semester_label: string | null;
  ects: number | null;
  tipo: string | null;
}

interface ProgramRow {
  id: string;
  title: string;
  tipo: string;
  universities: {
    name: string;
    slug: string;
  } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user profile to get program_id, profile_year and university text
  const { data: profileRaw, error: profileError } = await supabase
    .from('profiles')
    .select('profile_program_id, profile_year, university')
    .eq('id', user.id)
    .single();

  if (profileError || !profileRaw) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const profile = profileRaw as { profile_program_id: string | null; profile_year: number | null; university: string | null };

  // Independent user: no university affiliation — fetch unaffiliated public documents
  const isIndependent = profile.university === 'Independent' && !profile.profile_program_id;
  if (isIndependent) {
    const { data: docsRaw, error: docsError } = await supabase
      .from('documents')
      .select('id, title, template_id, published_at, university, degree, subject, visibility, keywords, view_count, like_count, user_id, university_id, program_id, course_id, university_slug, program_slug, profiles!documents_user_id_fkey(display_name, avatar_url)')
      .eq('is_published', true)
      .eq('visibility', 'public')
      .is('archived_at', null)
      .is('university_id', null)
      .order('published_at', { ascending: false })
      .limit(60);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    const docs = (docsRaw ?? []).map((d: Record<string, unknown>) => {
      const profile = Array.isArray(d.profiles)
        ? (d.profiles as Array<{ display_name?: string | null; avatar_url?: string | null }>)[0]
        : (d.profiles as { display_name?: string | null; avatar_url?: string | null } | null);
      return {
        ...d,
        profiles: undefined,
        author_name: profile?.display_name ?? null,
        author_avatar: profile?.avatar_url ?? null,
        user_liked: false,
        is_own: d.user_id === user.id,
      };
    });

    return NextResponse.json({ independent: true, documents: docs });
  }

  if (!profile.profile_program_id) {
    return NextResponse.json({ program: null });
  }

  const programId = profile.profile_program_id;

  // Fetch the degree program + joined university
  const { data: programRaw, error: programError } = await supabase
    .from('degree_programs')
    .select('id, title, tipo, universities(name, slug)')
    .eq('id', programId)
    .single();

  if (programError || !programRaw) {
    return NextResponse.json({ error: 'Degree program not found' }, { status: 404 });
  }

  const program = programRaw as unknown as ProgramRow;

  // Fetch all courses for this program
  const { data: coursesRaw, error: coursesError } = await supabase
    .from('courses')
    .select('id, name, year, semester, semester_label, ects, tipo')
    .eq('degree_program_id', programId)
    .order('year', { ascending: true })
    .order('semester', { ascending: true });

  if (coursesError) {
    return NextResponse.json({ error: coursesError.message }, { status: 500 });
  }

  const courses: CourseRow[] = (coursesRaw ?? []) as CourseRow[];

  // Fetch document counts per course for this program
  // Count published, public, non-archived documents
  const { data: countsRaw, error: countsError } = await supabase
    .from('documents')
    .select('course_id')
    .eq('program_id', programId)
    .eq('is_published', true)
    .eq('visibility', 'public')
    .is('archived_at', null);

  if (countsError) {
    return NextResponse.json({ error: countsError.message }, { status: 500 });
  }

  // Build course_id → count map in JS
  const countMap = new Map<string, number>();
  for (const row of (countsRaw ?? []) as { course_id: string | null }[]) {
    if (row.course_id) {
      countMap.set(row.course_id, (countMap.get(row.course_id) ?? 0) + 1);
    }
  }

  // Group courses by year
  const yearMap = new Map<number, CourseRow[]>();
  for (const course of courses) {
    const yr = course.year ?? 1;
    if (!yearMap.has(yr)) yearMap.set(yr, []);
    yearMap.get(yr)!.push(course);
  }

  const years = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, yearCourses]) => ({
      year,
      courses: yearCourses.map((c) => ({
        id: c.id,
        name: c.name,
        semester: c.semester,
        semester_label: c.semester_label,
        ects: c.ects,
        tipo: c.tipo,
        document_count: countMap.get(c.id) ?? 0,
      })),
    }));

  return NextResponse.json({
    program: {
      id: program.id,
      title: program.title,
      tipo: program.tipo,
      university: program.universities
        ? { name: program.universities.name, slug: program.universities.slug }
        : null,
    },
    profile_year: profile.profile_year,
    years,
  });
}
