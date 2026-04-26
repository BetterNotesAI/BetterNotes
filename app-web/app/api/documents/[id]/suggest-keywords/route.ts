import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCreditQuota, recordAiUsage } from '@/lib/ai-usage';
import { parseKeywordSuggestions, suggestKeywordsWithAi } from '@/lib/keyword-suggestions';
import { inferDocumentProjectType } from '@/lib/usage-project';

/**
 * POST /api/documents/[id]/suggest-keywords
 *
 * Suggests 5-8 relevant keywords for a document based on its title and a
 * short excerpt of its LaTeX content.
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

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 }
    );
  }

  const prompt = `You are an academic keyword extractor. Given a study document's title and a LaTeX excerpt, suggest 6 concise keywords that describe its topic and subject area. Return ONLY a JSON array of strings, no explanation.

Title: ${doc.title}
Template: ${doc.template_id ?? 'unknown'}
LaTeX excerpt:
${latexExcerpt || '(no content yet)'}

  Return format: ["keyword1", "keyword2", ...]`;

  try {
    const suggestion = await suggestKeywordsWithAi(prompt);

    await recordAiUsage({
      supabase,
      userId: user.id,
      provider: suggestion.provider,
      model: suggestion.model,
      usage: suggestion.usage,
      feature: 'document_suggest_keywords',
      projectType: inferDocumentProjectType(doc.template_id ?? null),
      projectId: documentId,
      metadata: { document_id: documentId },
    });

    const keywords = parseKeywordSuggestions(suggestion.raw);

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error('[suggest-keywords] AI error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
