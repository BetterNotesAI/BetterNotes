import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface DeleteAccountBody {
  confirmation?: unknown;
}

const REQUIRED_CONFIRMATION = 'DELETE';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as DeleteAccountBody;
  const confirmation = typeof body.confirmation === 'string' ? body.confirmation.trim() : '';

  if (confirmation !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      { error: `Confirmation must be exactly \"${REQUIRED_CONFIRMATION}\".` },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Unable to delete account. Check server configuration.' },
      { status: 500 }
    );
  }
}
