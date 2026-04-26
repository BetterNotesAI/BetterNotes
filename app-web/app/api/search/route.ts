/**
 * GET /api/search
 *
 * Cross-platform keyword search across documents, degree programmes and courses.
 *
 * Query params:
 *   q      — search query string (required, min 2 chars)
 *   type   — "all" | "documents" | "programs" | "courses"  (default: "all")
 *   limit  — results per type (default: 8, max: 20)
 *
 * Public results do not require auth.
 * If the user is authenticated, their own private documents are also included.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

type SearchType = 'all' | 'documents' | 'programs' | 'courses';

export interface DocumentResult {
  id: string;
  title: string;
  subject: string | null;
  degree: string | null;
  university: string | null;
  keywords: string[];
  like_count: number;
  view_count: number;
  fork_count: number;
  published_at: string | null;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
}

export interface ProgramResult {
  id: string;
  title: string;
  tipo: string;
  slug: string;
  university_name: string;
  university_slug: string;
}

export interface CourseResult {
  id: string;
  name: string;
  year: number;
  semester_label: string | null;
  ects: number | null;
  tipo: string | null;
  program_title: string;
  program_slug: string;
  university_name: string;
  university_slug: string;
}

export interface SearchResponse {
  documents: DocumentResult[];
  programs: ProgramResult[];
  courses: CourseResult[];
  query: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const type = (searchParams.get('type') ?? 'all') as SearchType;
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT);

  // Short-circuit for empty/too-short queries
  if (q.length < 2) {
    return NextResponse.json({ documents: [], programs: [], courses: [], query: q });
  }

  const supabase = await createClient();

  // Determine if the current user is authenticated (for private doc inclusion)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // ── Build tsquery ────────────────────────────────────────────────────────────
  // Single word: prefix match via `word:*`  (matches partial typing)
  // Multiple words: use plainto_tsquery (AND logic, no prefix)
  const words = q.split(/\s+/).filter(Boolean);
  const isMultiWord = words.length > 1;
  const tsqueryExpr = isMultiWord
    ? `plainto_tsquery('simple', '${q.replace(/'/g, "''")}')`
    : `to_tsquery('simple', '${words[0].replace(/'/g, "''")}:*')`;

  const runDocuments = type === 'all' || type === 'documents';
  const runPrograms  = type === 'all' || type === 'programs';
  const runCourses   = type === 'all' || type === 'courses';

  // ── Helper: ILIKE fallback for a single table ────────────────────────────────
  async function ilikeFallbackDocuments(): Promise<DocumentResult[]> {
    const { data } = await supabase.rpc('search_documents_ilike', {
      search_term: q,
      result_limit: limit,
    });
    // If the RPC doesn't exist we just return empty — the RPC is optional
    return (data as DocumentResult[] | null) ?? [];
  }

  // ── Query builders ───────────────────────────────────────────────────────────

  async function fetchDocuments(): Promise<DocumentResult[]> {
    // Public documents
    const { data: publicDocs, error } = await supabase
      .from('documents')
      .select(`
        id, title, subject, degree, university, keywords,
        like_count, view_count, fork_count, published_at,
        profiles!documents_user_id_fkey (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('is_published', true)
      .eq('visibility', 'public')
      .is('archived_at', null)
      .textSearch('search_vector', tsqueryExpr, { type: 'websearch', config: 'simple' })
      .order('like_count', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(limit);

    let docs = publicDocs ?? [];

    // If tsvector search returns nothing and query is long enough, try ILIKE
    if ((!docs.length || error) && q.length >= 3) {
      const { data: ilikeDocs } = await supabase
        .from('documents')
        .select(`
          id, title, subject, degree, university, keywords,
          like_count, view_count, fork_count, published_at,
          profiles!documents_user_id_fkey (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('is_published', true)
        .eq('visibility', 'public')
        .is('archived_at', null)
        .ilike('title', `%${q}%`)
        .order('like_count', { ascending: false })
        .limit(limit);
      docs = ilikeDocs ?? [];
    }

    // If authenticated, also include user's own private documents
    if (userId) {
      const { data: privateDocs } = await supabase
        .from('documents')
        .select(`
          id, title, subject, degree, university, keywords,
          like_count, view_count, fork_count, published_at,
          profiles!documents_user_id_fkey (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .eq('visibility', 'private')
        .is('archived_at', null)
        .or(`title.ilike.%${q}%, subject.ilike.%${q}%`)
        .limit(Math.ceil(limit / 2));

      if (privateDocs?.length) {
        // Merge, dedup by id, keep public ones first
        const seen = new Set(docs.map((d) => (d as { id: string }).id));
        for (const d of privateDocs) {
          if (!seen.has((d as { id: string }).id)) {
            docs.push(d);
          }
        }
      }
    }

    return docs.map((d) => {
      const profile = Array.isArray((d as Record<string, unknown>).profiles)
        ? ((d as Record<string, unknown>).profiles as Array<{
            display_name?: string | null;
            username?: string | null;
            avatar_url?: string | null;
          }>)[0]
        : ((d as Record<string, unknown>).profiles as {
            display_name?: string | null;
            username?: string | null;
            avatar_url?: string | null;
          } | null);

      return {
        id: (d as { id: string }).id,
        title: (d as { title: string }).title,
        subject: (d as { subject?: string | null }).subject ?? null,
        degree: (d as { degree?: string | null }).degree ?? null,
        university: (d as { university?: string | null }).university ?? null,
        keywords: (d as { keywords?: string[] }).keywords ?? [],
        like_count: (d as { like_count?: number }).like_count ?? 0,
        view_count: (d as { view_count?: number }).view_count ?? 0,
        fork_count: (d as { fork_count?: number }).fork_count ?? 0,
        published_at: (d as { published_at?: string | null }).published_at ?? null,
        author_name: profile?.display_name ?? null,
        author_username: profile?.username ?? null,
        author_avatar: profile?.avatar_url ?? null,
      };
    });
  }

  async function fetchPrograms(): Promise<ProgramResult[]> {
    const { data, error } = await supabase
      .from('degree_programs')
      .select(`
        id, title, tipo, slug,
        universities!degree_programs_university_id_fkey (
          name,
          slug
        )
      `)
      .textSearch('search_vector', tsqueryExpr, { type: 'websearch', config: 'simple' })
      .limit(limit);

    let programs = data ?? [];

    if ((!programs.length || error) && q.length >= 3) {
      const { data: ilikeData } = await supabase
        .from('degree_programs')
        .select(`
          id, title, tipo, slug,
          universities!degree_programs_university_id_fkey (
            name,
            slug
          )
        `)
        .ilike('title', `%${q}%`)
        .limit(limit);
      programs = ilikeData ?? [];
    }

    return programs.map((p) => {
      const uni = Array.isArray((p as Record<string, unknown>).universities)
        ? ((p as Record<string, unknown>).universities as Array<{ name: string; slug: string }>)[0]
        : (p as Record<string, unknown>).universities as { name: string; slug: string } | null;

      return {
        id: (p as { id: string }).id,
        title: (p as { title: string }).title,
        tipo: (p as { tipo: string }).tipo,
        slug: (p as { slug: string }).slug,
        university_name: uni?.name ?? '',
        university_slug: uni?.slug ?? '',
      };
    });
  }

  async function fetchCourses(): Promise<CourseResult[]> {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        id, name, year, semester_label, ects, tipo,
        degree_programs!courses_degree_program_id_fkey (
          title,
          slug,
          universities!degree_programs_university_id_fkey (
            name,
            slug
          )
        )
      `)
      .textSearch('search_vector', tsqueryExpr, { type: 'websearch', config: 'simple' })
      .limit(limit);

    let courses = data ?? [];

    if ((!courses.length || error) && q.length >= 3) {
      const { data: ilikeData } = await supabase
        .from('courses')
        .select(`
          id, name, year, semester_label, ects, tipo,
          degree_programs!courses_degree_program_id_fkey (
            title,
            slug,
            universities!degree_programs_university_id_fkey (
              name,
              slug
            )
          )
        `)
        .ilike('name', `%${q}%`)
        .limit(limit);
      courses = ilikeData ?? [];
    }

    return courses.map((c) => {
      const dp = Array.isArray((c as Record<string, unknown>).degree_programs)
        ? ((c as Record<string, unknown>).degree_programs as Array<{
            title: string;
            slug: string;
            universities?: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
          }>)[0]
        : (c as Record<string, unknown>).degree_programs as {
            title: string;
            slug: string;
            universities?: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
          } | null;

      const uni = dp?.universities
        ? Array.isArray(dp.universities)
          ? dp.universities[0]
          : dp.universities
        : null;

      return {
        id: (c as { id: string }).id,
        name: (c as { name: string }).name,
        year: (c as { year: number }).year,
        semester_label: (c as { semester_label?: string | null }).semester_label ?? null,
        ects: (c as { ects?: number | null }).ects ?? null,
        tipo: (c as { tipo?: string | null }).tipo ?? null,
        program_title: dp?.title ?? '',
        program_slug: dp?.slug ?? '',
        university_name: uni?.name ?? '',
        university_slug: uni?.slug ?? '',
      };
    });
  }

  // ── Execute in parallel ──────────────────────────────────────────────────────
  const [documents, programs, courses] = await Promise.all([
    runDocuments ? fetchDocuments() : Promise.resolve([]),
    runPrograms  ? fetchPrograms()  : Promise.resolve([]),
    runCourses   ? fetchCourses()   : Promise.resolve([]),
  ]);

  // Silence unused helper warning
  void ilikeFallbackDocuments;

  const response: SearchResponse = { documents, programs, courses, query: q };
  return NextResponse.json(response);
}
