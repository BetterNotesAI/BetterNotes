import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/guest-status
// Returns guest usage status for the currently authenticated user.
// Unauthenticated requests return { is_guest: false, is_authenticated: false, generation_allowed: false }.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({
      is_guest: false,
      is_authenticated: false,
      generation_allowed: false,
    });
  }

  const { data, error } = await supabase.rpc('get_guest_status');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isGuest = Boolean((data as { is_guest?: boolean } | null)?.is_guest);

  return NextResponse.json({
    ...(typeof data === 'object' && data ? data : {}),
    is_guest: isGuest,
    is_authenticated: true,
    generation_allowed: !isGuest,
  });
}
