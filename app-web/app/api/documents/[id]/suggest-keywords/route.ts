import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/suggest-keywords
 *
 * Calls OpenAI GPT-4o directly from the Next.js route (no hop to app-api)
 * to suggest 5-8 relevant keywords for a document based on its title and
 * a short excerpt of its LaTeX content.
 *
 * Returns: { keywords: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Fetch document title + current version latex for context
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, template_id, current_version_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let latexExcerpt = '';
  if (doc.current_version_id) {
    const { data: version } = await supabase
      .from('document_versions')
      .select('latex_content')
      .eq('id', doc.current_version_id)
      .eq('document_id', documentId)
      .maybeSingle();
    if (version?.latex_content) {
      // Use first 1500 chars to keep tokens low
      latexExcerpt = version.latex_content.slice(0, 1500);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  const prompt = `You are an academic keyword extractor. Given a study document's title and a LaTeX excerpt, suggest 6 concise keywords that describe its topic and subject area. Return ONLY a JSON array of strings, no explanation.

Title: ${doc.title}
Template: ${doc.template_id ?? 'unknown'}
LaTeX excerpt:
${latexExcerpt || '(no content yet)'}

Return format: ["keyword1", "keyword2", ...]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[suggest-keywords] OpenAI error:', errText);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '[]';

    // Parse the JSON array from the response
    let keywords: string[] = [];
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        keywords = parsed
          .map((k: unknown) => (typeof k === 'string' ? k.trim() : ''))
          .filter(Boolean)
          .slice(0, 10);
      }
    } catch {
      // If parsing fails, extract quoted strings as fallback
      const matches = raw.match(/"([^"]+)"/g);
      if (matches) {
        keywords = matches
          .map((m: string) => m.replace(/"/g, '').trim())
          .filter(Boolean)
          .slice(0, 10);
      }
    }

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error('[suggest-keywords] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
