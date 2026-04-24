/**
 * GET /api/catalogue
 *
 * Lightweight catalogue endpoint for cascading selects in PublishModal.
 *
 * ?resource=universities
 * ?resource=programs&university_id=<uuid>
 * ?resource=courses&program_id=<uuid>
 *
 * Public-read — no auth required (catalogue is open data).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource');

  if (resource === 'universities') {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, slug, country')
      .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ universities: data ?? [] });
  }

  if (resource === 'programs') {
    const universityId = searchParams.get('university_id');
    if (!universityId) return NextResponse.json({ error: 'university_id required' }, { status: 400 });
    const { data, error } = await supabase
      .from('degree_programs')
      .select('id, tipo, title, slug')
      .eq('university_id', universityId)
      .order('tipo')
      .order('title');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ programs: data ?? [] });
  }

  if (resource === 'courses') {
    const programId = searchParams.get('program_id');
    if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 });
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, year, semester, semester_label, ects, tipo')
      .eq('degree_program_id', programId)
      .order('year')
      .order('semester');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ courses: data ?? [] });
  }

  return NextResponse.json({ error: 'resource must be universities | programs | courses' }, { status: 400 });
}
