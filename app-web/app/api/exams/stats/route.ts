import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exams/stats
 *
 * Returns aggregate statistics for the authenticated user's completed exams.
 *
 * Response shape:
 * {
 *   total_exams: number,
 *   avg_score: number,
 *   subjects: SubjectStat[],
 *   recent: RecentAttempt[],
 *   streak: number
 * }
 */

interface CompletedExam {
  id: string;
  subject: string;
  level: string;
  language: string;
  score: number;
  question_count: number;
  completed_at: string;
}

interface SubjectExam {
  exam_id: string;
  score: number;
  level: string;
  language: string;
  completed_at: string;
}

interface HistoryPoint {
  date: string;
  score: number;
  level: string;
}

interface SubjectStat {
  subject: string;
  attempts: number;
  avg_score: number;
  best_score: number;
  last_attempt: string;
  exams: SubjectExam[];
  history: HistoryPoint[];
}

interface RecentAttempt {
  exam_id: string;
  subject: string;
  score: number;
  level: string;
  language: string;
  completed_at: string;
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

  // Timezone for streak calculation — accept header X-Timezone or query param tz
  const tz = req.nextUrl.searchParams.get('tz') ?? req.headers.get('x-timezone') ?? 'UTC';
  // Validate timezone — fallback to UTC if invalid
  let resolvedTz = 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    resolvedTz = tz;
  } catch {
    // Invalid timezone — use UTC
  }

  const { data: exams, error } = await supabase
    .from('exams')
    .select('id, subject, level, language, score, question_count, completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('score', 'is', null)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (exams ?? []) as CompletedExam[];

  if (rows.length === 0) {
    return NextResponse.json({
      total_exams: 0,
      avg_score: 0,
      avg_time_seconds: null,
      subjects: [],
      recent: [],
      streak: 0,
    });
  }

  // ─── Total and average ────────────────────────────────────────────────────

  const total_exams = rows.length;
  const avg_score = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / total_exams);

  const avg_time_seconds = null;

  // ─── Per-subject aggregation ──────────────────────────────────────────────

  const subjectMap = new Map<
    string,
    { scores: number[]; last_attempt: string; exams: SubjectExam[] }
  >();

  for (const row of rows) {
    const key = row.subject || 'Unknown';
    const existing = subjectMap.get(key);
    const entry: SubjectExam = {
      exam_id: row.id,
      score: row.score,
      level: row.level,
      language: row.language,
      completed_at: row.completed_at,
    };
    if (existing) {
      existing.scores.push(row.score);
      existing.exams.push(entry);
    } else {
      subjectMap.set(key, {
        scores: [row.score],
        last_attempt: row.completed_at,
        exams: [entry],
      });
    }
  }

  const subjects: SubjectStat[] = Array.from(subjectMap.entries())
    .map(([subject, { scores, last_attempt, exams }]) => {
      // history: sorted by date ascending for the chart
      const history: HistoryPoint[] = [...exams]
        .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
        .map((e) => ({ date: e.completed_at, score: e.score, level: e.level }));
      return {
        subject,
        attempts: scores.length,
        avg_score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        best_score: Math.max(...scores),
        last_attempt,
        exams,
        history,
      };
    })
    .sort((a, b) => b.avg_score - a.avg_score);

  // ─── Recent 10 ────────────────────────────────────────────────────────────

  const recent: RecentAttempt[] = rows.slice(0, 10).map((r) => ({
    exam_id: r.id,
    subject: r.subject || 'Unknown',
    score: r.score,
    level: r.level,
    language: r.language,
    completed_at: r.completed_at,
  }));

  // ─── Streak — consecutive calendar days with at least one exam (up to today) ──
  // Uses resolvedTz so users in e.g. GMT+2 don't lose their streak at midnight UTC.

  // Helper: get "YYYY-MM-DD" for a UTC timestamp interpreted in the given timezone
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
    rows.map((r) => toLocalDateKey(r.completed_at, resolvedTz))
  );

  // Today's date in user's timezone
  const todayKey = toLocalDateKey(new Date().toISOString(), resolvedTz);

  let streak = 0;
  // Walk backwards day-by-day
  const cursorDate = new Date(todayKey + 'T12:00:00Z'); // noon UTC ensures stable date math
  // If today has no exam, start from yesterday
  if (!dateDone.has(toLocalDateKey(cursorDate.toISOString(), resolvedTz))) {
    cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
  }

  while (dateDone.has(toLocalDateKey(cursorDate.toISOString(), resolvedTz))) {
    streak += 1;
    cursorDate.setUTCDate(cursorDate.getUTCDate() - 1);
  }

  return NextResponse.json({
    total_exams,
    avg_score,
    avg_time_seconds,
    subjects,
    recent,
    streak,
  });
}
