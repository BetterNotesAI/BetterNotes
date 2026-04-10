// DELETE /api/cheat-sheets/sessions/[id]/subchats/[subchatId]/messages/[messageId]

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string; subchatId: string; messageId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sessionId, subchatId, messageId } = await params;

  // Verify ownership via session
  const { data: session } = await supabase
    .from('cheat_sheet_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { error } = await supabase
    .from('cheat_sheet_messages')
    .delete()
    .eq('id', messageId)
    .eq('subchat_id', subchatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
