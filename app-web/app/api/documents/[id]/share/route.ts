import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/share
 * Generates a share_token for the document (idempotent — returns existing token if already set).
 * Requires auth — only the document owner can generate a share link.
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

  // Fetch existing token (idempotent — no need to regenerate if already set)
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, share_token')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.share_token) {
    return NextResponse.json({ token: doc.share_token });
  }

  // Generate new token and persist
  const newToken = crypto.randomUUID();
  const { error: updateError } = await supabase
    .from('documents')
    .update({ share_token: newToken })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ token: newToken });
}
