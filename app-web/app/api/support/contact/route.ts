import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ContactBody {
  subject?: unknown;
  message?: unknown;
  category?: unknown;
  pagePath?: unknown;
}

const ALLOWED_CATEGORIES = new Set([
  'general',
  'billing',
  'account',
  'bug',
  'feature-request',
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as ContactBody;

  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const categoryRaw = typeof body.category === 'string' ? body.category.trim().toLowerCase() : 'general';
  const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : 'general';
  const pagePath = typeof body.pagePath === 'string' ? body.pagePath.trim().slice(0, 255) : '/support';

  if (subject.length < 3) {
    return NextResponse.json({ error: 'Subject must be at least 3 characters.' }, { status: 400 });
  }

  if (message.length < 10) {
    return NextResponse.json({ error: 'Message must be at least 10 characters.' }, { status: 400 });
  }

  if (message.length > 1800) {
    return NextResponse.json({ error: 'Message cannot exceed 1800 characters.' }, { status: 400 });
  }

  const composedMessage = `[Support:${category}] ${subject}\n\n${message}`;

  const { data: feedback, error } = await supabase
    .from('user_feedback')
    .insert({
      user_id: user.id,
      message: composedMessage,
      page_path: pagePath,
      source: 'support-form',
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ticket: feedback }, { status: 201 });
}
