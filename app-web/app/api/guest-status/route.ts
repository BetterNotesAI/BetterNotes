import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/guest-status
// Returns guest usage status for the currently authenticated user.
// Unauthenticated requests return { is_guest: false }.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ is_guest: false });
  }

  const { data, error } = await supabase.rpc('get_guest_status');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
