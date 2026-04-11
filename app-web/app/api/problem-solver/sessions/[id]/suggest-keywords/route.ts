import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCreditQuota, recordAiUsage } from '@/lib/ai-usage';

/**
 * POST /api/problem-solver/sessions/[id]/suggest-keywords
 *
 * Calls OpenAI GPT-4o directly from the Next.js route to suggest 6 relevant
 * keywords for a problem-solver session based on its title and solution_md.
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

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.4-nano';
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ps suggest-keywords] OpenAI error:', errText);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const raw = (data.choices?.[0]?.message?.content ?? '[]') as string;

    await recordAiUsage({
      supabase,
      userId: user.id,
      provider: 'openai',
      model,
      usage: data.usage,
      feature: 'problem_solver_suggest_keywords',
      projectType: 'problem_solver',
      projectId: sessionId,
      metadata: { session_id: sessionId },
    });

    let keywords: string[] = [];
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const parsed: unknown = JSON.parse(cleaned);
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
    console.error('[ps suggest-keywords] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
