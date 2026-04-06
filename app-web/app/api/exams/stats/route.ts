import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams/stats
 *
 * Returns aggregate statistics for the authenticated user's completed exams.
 * Aggregation (total_exams, avg_score, avg_time_seconds, per-subject stats) is
 * delegated to the Supabase RPC `get_exam_stats` so we avoid pulling every row
 * across the network.
 *
 * Streak and per-subject history[] are still computed in Node because they
 * require timezone-aware calendar-day resolution that is simpler in JavaScript.
 *
 * Response shape:
 * {
 *   total_exams:       number,
 *   avg_score:         number,
 *   avg_time_seconds:  number | null,
 *   subjects:          SubjectStat[],
 *   recent:            RecentAttempt[],
 *   streak:            number
 * }
 */

interface SubjectStatRPC {
  subject: string;
  attempts: number;
  avg_score: number;
  best_score: number;
  last_attempt: string;
}

interface RPCResult {
  total_exams: number;
  avg_score: number | null;
  avg_time_seconds: number | null;
  subjects: SubjectStatRPC[];
}

interface SubjectStat extends SubjectStatRPC {
  exams: SubjectExam[];
  history: HistoryPoint[];
}

interface HistoryPoint {
  date: string;
  score: number;
  level: string;
}

interface SubjectExam {
  exam_id: string;
  score: number;
  level: string;
  language: string;
  completed_at: string;
  time_spent_seconds: number | null;
}

interface RecentAttempt {
  exam_id: string;
  subject: string;
  score: number;
  level: string;
  language: string;
  completed_at: string;
}

interface CompletedExamRow {
  id: string;
  subject: string;
  level: string;
  language: string;
  score: number;
  completed_at: string;
  time_spent_seconds: number | null;
}

/**
 * DELETE /api/exams/stats
 * Deletes all completed exams (and cascaded questions) for the user, resetting their stats.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'completed');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Timezone for streak calculation — accept query param tz or header X-Timezone
  const tz = req.nextUrl.searchParams.get('tz') ?? req.headers.get('x-timezone') ?? 'UTC';
  let resolvedTz = 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    resolvedTz = tz;
  } catch {
    // Invalid timezone — use UTC
  }

  // ── Call RPC for aggregated totals and per-subject stats ────────────────────
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_exam_stats', { p_user_id: user.id })
    .single() as { data: RPCResult | null; error: { message: string } | null };

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const rpc = rpcData as RPCResult | null;

  if (!rpc || !rpc.total_exams || rpc.total_exams === 0) {
    return NextResponse.json({
      total_exams: 0,
      avg_score: 0,
      avg_time_seconds: null,
      subjects: [],
      recent: [],
      streak: 0,
    });
  }

  // ── Fetch lightweight rows for streak + history + recent ───────────────────
  // We only need: id, subject, level, language, score, completed_at, time_spent_seconds
  const { data: rows, error: rowsError } = await supabase
    .from('exams')
    .select('id, subject, level, language, score, completed_at, time_spent_seconds')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('score', 'is', null)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  const examRows = (rows ?? []) as CompletedExamRow[];

  // ── Recent 10 ──────────────────────────────────────────────────────────────
  const recent: RecentAttempt[] = examRows.slice(0, 10).map((r) => ({
    exam_id: r.id,
    subject: r.subject || 'Unknown',
    score: r.score,
    level: r.level,
    language: r.language,
    completed_at: r.completed_at,
  }));

  // ── Per-subject history[] and exams[] — built from local rows ────────────
  const historyMap = new Map<string, HistoryPoint[]>();
  const examsMap = new Map<string, SubjectExam[]>();

  for (const r of [...examRows].reverse()) {
    const key = r.subject || 'Unknown';
    if (!historyMap.has(key)) historyMap.set(key, []);
    historyMap.get(key)!.push({ date: r.completed_at, score: r.score, level: r.level });
    if (!examsMap.has(key)) examsMap.set(key, []);
    examsMap.get(key)!.push({
      exam_id: r.id,
      score: r.score,
      level: r.level,
      language: r.language,
      completed_at: r.completed_at,
      time_spent_seconds: r.time_spent_seconds ?? null,
    });
  }

  const subjects: SubjectStat[] = (rpc.subjects ?? []).map((s) => ({
    ...s,
    exams: examsMap.get(s.subject) ?? [],
    history: historyMap.get(s.subject) ?? [],
  }));

  // ── Streak — consecutive calendar days with at least one exam ─────────────
  const toLocalDateKey = (isoString: string, timezone: string): string => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString.slice(0, 10);
    }
  };

  const dateDone = new Set<string>(
    examRows.map((r) => toLocalDateKey(r.completed_at, resolvedTz))
  );

  const todayKey = toLocalDateKey(new Date().toISOString(), resolvedTz);
  let streak = 0;
  const cursorDate = new Date(todayKey + 'T12:00:00Z');
  if (!dateDone.has(toLocalDateKey(cursorDate.toISOString(), resolvedTz))) {
    cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
  }
  while (dateDone.has(toLocalDateKey(cursorDate.toISOString(), resolvedTz))) {
    streak += 1;
    cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
  }

  return NextResponse.json({
    total_exams: rpc.total_exams,
    avg_score: rpc.avg_score !== null ? Math.round(rpc.avg_score) : 0,
    avg_time_seconds: rpc.avg_time_seconds !== null ? Math.round(rpc.avg_time_seconds) : null,
    subjects,
    recent,
    streak,
  });
}
