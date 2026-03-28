import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/documents/published
 *
 * Returns all documents the current user has published (is_published = true),
 * ordered by published_at descending.
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
      'id, title, template_id, published_at, university, degree, subject, visibility, keywords'
    )
    .eq('user_id', user.id)
    .eq('is_published', true)
    .is('archived_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: documents ?? [] });
}
