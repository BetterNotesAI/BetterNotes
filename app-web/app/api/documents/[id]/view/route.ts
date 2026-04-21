import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/view
 *
 * Increments the view_count of a published document by 1.
 * Requires the user to be authenticated (to avoid anonymous spam).
 * Counts all views including the owner's own — relevant while My Studies
 * only shows the user's own documents. Revisit once community docs are live.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Verify the document exists and is published
  const { data: doc } = await supabase
    .from('documents')
    .select('is_published')
    .eq('id', documentId)
    .maybeSingle();

  if (!doc || !doc.is_published) {
    return NextResponse.json({ error: 'Document not found or not published' }, { status: 404 });
  }

  const { error } = await supabase.rpc('increment_document_view', { doc_id: documentId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
