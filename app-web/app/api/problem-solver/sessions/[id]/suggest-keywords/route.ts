import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCreditQuota, recordAiUsage } from '@/lib/ai-usage';
import { parseKeywordSuggestions, suggestKeywordsWithAi } from '@/lib/keyword-suggestions';

/**
 * POST /api/problem-solver/sessions/[id]/suggest-keywords
 *
 * Suggests 6 relevant keywords for a problem-solver session based on its title
 * and solution_md.
 *
 * Returns: { keywords: string[] }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Fetch session title + solution_md for context
  const { data: session, error: sessionError } = await supabase
    .from('problem_solver_sessions')
    .select('id, title, solution_md')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Use first 1500 chars of solution_md to keep tokens low
  const solutionExcerpt = session.solution_md
    ? (session.solution_md as string).slice(0, 1500)
    : '';

  const usageCheck = await checkCreditQuota(supabase, user.id);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: 'limit_reached', plan: usageCheck.plan ?? 'free', remaining: usageCheck.remaining ?? 0 },
      { status: 402 }
    );
  }

  const prompt = `You are an academic keyword extractor. Given a problem-solving session's title and a solution excerpt (in Markdown), suggest 6 concise keywords that describe the topic, subject area, and mathematical/scientific concepts involved. Return ONLY a JSON array of strings, no explanation.

Title: ${session.title}
Solution excerpt:
${solutionExcerpt || '(no solution yet)'}

Return format: ["keyword1", "keyword2", ...]`;

  try {
    const suggestion = await suggestKeywordsWithAi(prompt);

    await recordAiUsage({
      supabase,
      userId: user.id,
      provider: suggestion.provider,
      model: suggestion.model,
      usage: suggestion.usage,
      feature: 'problem_solver_suggest_keywords',
      projectType: 'problem_solver',
      projectId: sessionId,
      metadata: { session_id: sessionId },
    });

    const keywords = parseKeywordSuggestions(suggestion.raw);

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error('[ps suggest-keywords] AI error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
