import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/documents/[id]/like
 *
 * Returns whether the current user has liked this document
 * and the current like count.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Get like_count from documents and check if user has liked
  const [docResult, likeResult] = await Promise.all([
    supabase
      .from('documents')
      .select('like_count')
      .eq('id', documentId)
      .maybeSingle(),
    supabase
      .from('document_likes')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (docResult.error) {
    return NextResponse.json({ error: docResult.error.message }, { status: 500 });
  }

  if (!docResult.data) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({
    liked: !!likeResult.data,
    like_count: docResult.data.like_count ?? 0,
  });
}

/**
 * POST /api/documents/[id]/like
 *
 * Toggles the current user's like on this document.
 * Returns the new liked status and updated like_count.
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

  const { data, error } = await supabase.rpc('toggle_document_like', {
    doc_id: documentId,
  });

  if (error) {
    console.error('[toggle_document_like RPC error]', error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  // data is the jsonb returned by the RPC: { liked, like_count }
  const result = data as { liked: boolean; like_count: number } | null;
  if (!result || typeof result.liked !== 'boolean') {
    console.error('[toggle_document_like unexpected response]', data);
    return NextResponse.json({ error: 'Unexpected RPC response', raw: data }, { status: 500 });
  }

  return NextResponse.json({ ok: true, liked: result.liked, like_count: result.like_count });
}
