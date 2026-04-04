// Subchat — DELETE

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string; subchatId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId, subchatId } = await params;

  const { data: session } = await supabase
    .from('problem_solver_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('problem_solver_subchats')
    .delete()
    .eq('id', subchatId)
    .eq('session_id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
