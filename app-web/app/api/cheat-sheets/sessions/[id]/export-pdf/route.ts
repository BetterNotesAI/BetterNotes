// POST /api/cheat-sheets/sessions/[id]/export-pdf
// Body: { templateId: string }
// Returns: application/pdf binary

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN ?? '';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sessionId } = await params;
  const body = await req.json().catch(() => ({})) as { templateId?: string; contentMd?: string };
  const templateId = body.templateId ?? '2cols_portrait';

  const { data: session } = await supabase
    .from('cheat_sheet_sessions')
    .select('title, content_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const contentMd = body.contentMd?.trim() || session.content_md;
  if (!contentMd) return NextResponse.json({ error: 'No content yet' }, { status: 400 });

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/latex/cheatsheet-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_INTERNAL_TOKEN ? { Authorization: `Bearer ${API_INTERNAL_TOKEN}` } : {}),
      },
      body: JSON.stringify({ contentMd, templateId, title: session.title }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err: unknown) {
    console.error('[cheatsheet export-pdf] fetch error:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not reach PDF service' }, { status: 502 });
  }

  if (!apiRes.ok) {
    const text = await apiRes.text().catch(() => '');
    console.error('[cheatsheet export-pdf] app-api error:', apiRes.status, text.slice(0, 300));
    let detail = 'PDF generation failed';
    try { detail = (JSON.parse(text) as { error?: string }).error ?? detail; } catch { /* ignore */ }
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  const pdfBuffer = await apiRes.arrayBuffer();
  const safeName = session.title.replace(/[/\\:*?"<>|]/g, '_');

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  });
}
