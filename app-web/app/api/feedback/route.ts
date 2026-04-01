import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface FeedbackRequestBody {
  message?: unknown;
  pagePath?: unknown;
  source?: unknown;
}

// POST /api/feedback — submit product feedback/suggestions
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as FeedbackRequestBody;
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const pagePath = typeof body.pagePath === 'string' ? body.pagePath.slice(0, 255) : null;
  const source = typeof body.source === 'string' ? body.source.slice(0, 50) : 'sidebar';

  if (message.length < 5) {
    return NextResponse.json({ error: 'Message must be at least 5 characters' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message cannot exceed 2000 characters' }, { status: 400 });
  }

  const { data: feedback, error } = await supabase
    .from('user_feedback')
    .insert({
      user_id: user.id,
      message,
      page_path: pagePath,
      source,
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback }, { status: 201 });
}

