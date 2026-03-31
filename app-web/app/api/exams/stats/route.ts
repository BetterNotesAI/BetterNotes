import { NextResponse } from 'next/server';
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

interface SubjectStat {
  subject: string;
  attempts: number;
  avg_score: number;
  best_score: number;
  last_attempt: string;
  exams: SubjectExam[];
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      subjects: [],
      recent: [],
      streak: 0,
    });
  }

  // ─── Total and average ────────────────────────────────────────────────────

  const total_exams = rows.length;
  const avg_score = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / total_exams);

  // ─── Per-subject aggregation ──────────────────────────────────────────────

  const subjectMap = new Map<
    string,
    { scores: number[]; last_attempt: string; exams: SubjectExam[] }
  >();

  for (const row of rows) {
    const key = row.subject || 'Unknown';
    const existing = subjectMap.get(key);
    const entry: SubjectExam = { exam_id: row.id, score: row.score, level: row.level, language: row.language, completed_at: row.completed_at };
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
    .map(([subject, { scores, last_attempt, exams }]) => ({
      subject,
      attempts: scores.length,
      avg_score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      best_score: Math.max(...scores),
      last_attempt,
      exams,
    }))
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

  // Build a set of unique date strings "YYYY-MM-DD" for completed exams
  const dateDone = new Set<string>(
    rows.map((r) => r.completed_at.slice(0, 10))
  );

  let streak = 0;
  // Use current UTC date as reference (server-side)
  const today = new Date();
  const toKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  // Start from today; if today has no exam, check yesterday as the streak start
  let cursor = new Date(today);
  // If today has no exam, the streak can still be active from yesterday
  if (!dateDone.has(toKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (dateDone.has(toKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return NextResponse.json({
    total_exams,
    avg_score,
    subjects,
    recent,
    streak,
  });
}
