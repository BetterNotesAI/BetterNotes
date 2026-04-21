// DELETE /api/documents/[id]/qa/subchats/[subchatId]

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string; subchatId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, subchatId } = await params;

  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('document_qa_subchats')
    .delete()
    .eq('id', subchatId)
    .eq('document_id', documentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
