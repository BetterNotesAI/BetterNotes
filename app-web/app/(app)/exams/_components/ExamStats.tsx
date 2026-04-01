'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getLetterGrade, getGradeColor, formatExamDate } from '../_utils';
import ExamReportModal from './ExamReportModal';

// ─── Local types ──────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface StatsData {
  total_exams: number;
  avg_score: number;
  subjects: SubjectStat[];
  recent: RecentAttempt[];
  streak: number;
}

export interface ExamStatsHandle {
  refresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  // Current values
  secondary_basic: 'Secondary · Basic',
  secondary_intermediate: 'Secondary · Intermediate',
  secondary_advanced: 'Secondary · Advanced',
  highschool_basic: 'High School · Basic',
  highschool_intermediate: 'High School · Intermediate',
  highschool_advanced: 'High School · Advanced',
  university_basic: 'University · Basic',
  university_intermediate: 'University · Intermediate',
  university_advanced: 'University · Advanced',
  // Legacy fallbacks
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function ScoreBadge({ score }: { score: number }) {
  const grade = getLetterGrade(score);
  const color = getGradeColor(grade);
  return (
    <span className={`font-semibold tabular-nums ${color}`}>
      {score}%
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-white/5 border border-white/8"
          />
        ))}
      </div>
      {/* Subject bars */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/5 border border-white/8" />
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function StatsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
        <svg
          className="w-5 h-5 text-white/30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-white/60">No exams yet</p>
        <p className="text-xs text-white/30 mt-0.5">
          Generate your first exam above!
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ExamStats = forwardRef<ExamStatsHandle>((_, ref) => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const url = `/api/exams/stats?tz=${encodeURIComponent(tz)}`;
      const res = await fetch(url);
      if (!res.ok) {
        setFetchError(true);
        return;
      }
      const json = (await res.json()) as StatsData;
      setData(json);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  const isEmpty = !loading && data !== null && data.total_exams === 0;

  return (
    <section aria-label="Exam statistics">
      {/* Section divider + heading */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-white/8" />
        <div className="flex items-center gap-2 shrink-0">
          <svg
            className="w-4 h-4 text-white/35"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs font-medium text-white/35 uppercase tracking-wide">
            Your Stats
          </span>
        </div>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {loading ? (
        <StatsSkeleton />
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <p className="text-sm font-medium text-white/50">Could not load stats</p>
          <button
            type="button"
            onClick={load}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : isEmpty ? (
        <StatsEmpty />
      ) : data ? (
        <div className="space-y-5">
          {/* ── Summary cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Total Exams"
              value={String(data.total_exams)}
            />
            <SummaryCard
              label="Avg Score"
              value={`${data.avg_score}%`}
              valueColor={getGradeColor(getLetterGrade(data.avg_score))}
            />
            <SummaryCard
              label="Day Streak"
              value={String(data.streak)}
              suffix={data.streak === 1 ? 'day' : 'days'}
              highlight={data.streak >= 3}
            />
          </div>

          {/* ── By subject ────────────────────────────────────────────── */}
          {data.subjects.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-xs font-medium text-white/45 uppercase tracking-wide">
                  By Subject
                </p>
              </div>
              <ul className="divide-y divide-white/6">
                {data.subjects.map((s) => (
                  <SubjectRow key={s.subject} stat={s} onOpen={setPreviewExamId} />
                ))}
              </ul>
            </div>
          )}

          {/* ── Recent exams ──────────────────────────────────────────── */}
          {data.recent.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-xs font-medium text-white/45 uppercase tracking-wide">
                  Recent
                </p>
              </div>
              <ul className="divide-y divide-white/6">
                {data.recent.slice(0, 5).map((r, i) => (
                  <RecentRow key={i} attempt={r} onOpen={setPreviewExamId} />
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* PDF preview modal */}
      {previewExamId && (
        <ExamReportModal
          examId={previewExamId}
          onClose={() => setPreviewExamId(null)}
        />
      )}
    </section>
  );
});

ExamStats.displayName = 'ExamStats';
export default ExamStats;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  suffix,
  valueColor,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  valueColor?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 flex flex-col gap-1 ${
        highlight
          ? 'bg-indigo-500/8 border-indigo-500/20'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <p className="text-xs text-white/40 truncate">{label}</p>
      <p className={`text-lg font-bold leading-none ${valueColor ?? (highlight ? 'text-indigo-400' : 'text-white')}`}>
        {value}
        {suffix && (
          <span className="text-xs font-normal text-white/35 ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}

const LEVEL_LABELS_ROW: Record<string, string> = {
  // Current values
  secondary_basic: 'Secondary · Basic',
  secondary_intermediate: 'Secondary · Intermediate',
  secondary_advanced: 'Secondary · Advanced',
  highschool_basic: 'High School · Basic',
  highschool_intermediate: 'High School · Intermediate',
  highschool_advanced: 'High School · Advanced',
  university_basic: 'University · Basic',
  university_intermediate: 'University · Intermediate',
  university_advanced: 'University · Advanced',
  // Legacy fallbacks
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const LANG_CODES: Record<string, string> = {
  english:    'EN',
  spanish:    'ES',
  catalan:    'CA',
  french:     'FR',
  german:     'DE',
  portuguese: 'PT',
  italian:    'IT',
};

function LangBadge({ language }: { language?: string }) {
  if (!language) return null;
  const code = LANG_CODES[language];
  if (!code) return null;
  return (
    <span className="inline-flex items-center rounded px-1 py-px text-[9px] font-bold tracking-wider
      bg-white/8 text-white/45 border border-white/10 leading-none shrink-0">
      {code}
    </span>
  );
}

function SubjectRow({ stat, onOpen }: { stat: SubjectStat; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      {/* Header row — clickable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 text-left hover:bg-white/4 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <svg
              className={`w-3.5 h-3.5 shrink-0 text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/85 truncate">{stat.subject}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/35">
                <span>{stat.attempts} {stat.attempts === 1 ? 'attempt' : 'attempts'}</span>
                <span className="opacity-40">·</span>
                <span>Best <ScoreBadge score={stat.best_score} /></span>
              </div>
            </div>
          </div>
          <ScoreBadge score={stat.avg_score} />
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/8 overflow-hidden ml-5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${stat.avg_score}%`, background: scoreToBarColor(stat.avg_score) }}
          />
        </div>
      </button>

      {/* Expanded exam list */}
      {open && (
        <div className="border-t border-white/6 bg-white/2">
          {/* Score history chart — only if 2+ attempts */}
          {stat.history && stat.history.length >= 2 && (
            <div className="px-4 pt-3 pb-1">
              <ScoreHistoryChart history={stat.history} />
            </div>
          )}
          <ul>
            {stat.exams.map((ex, i) => (
              <ExamRow key={i} exam={ex} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

// ── ExamRow (inside expanded subject) ────────────────────────────────────────

function ExamRow({ exam, onOpen }: { exam: SubjectExam; onOpen: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 pl-10">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <LangBadge language={exam.language} />
          <span>{LEVEL_LABELS_ROW[exam.level] ?? exam.level}</span>
          <span className="opacity-40">·</span>
          <span>{formatExamDate(exam.completed_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScoreBadge score={exam.score} />
        <button
          type="button"
          onClick={() => onOpen(exam.exam_id)}
          title="View report"
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/25
            hover:text-white/70 hover:bg-white/8 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </li>
  );
}

// ── RecentRow ─────────────────────────────────────────────────────────────────

function RecentRow({ attempt, onOpen }: { attempt: RecentAttempt; onOpen: (id: string) => void }) {
  const levelLabel = LEVEL_LABELS[attempt.level] ?? attempt.level;

  return (
    <li className="px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white/80 truncate">{attempt.subject}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/35">
          <LangBadge language={attempt.language} />
          <span>{levelLabel}</span>
          <span className="opacity-40">·</span>
          <span>{formatExamDate(attempt.completed_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScoreBadge score={attempt.score} />
        <button
          type="button"
          onClick={() => onOpen(attempt.exam_id)}
          title="View report"
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/25
            hover:text-white/70 hover:bg-white/8 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </li>
  );
}

/** Returns a CSS color string for the progress bar based on score. */
function scoreToBarColor(score: number): string {
  if (score >= 90) return 'rgb(74 222 128)';   // green-400
  if (score >= 80) return 'rgb(96 165 250)';   // blue-400
  if (score >= 70) return 'rgb(250 204 21)';   // yellow-400
  if (score >= 60) return 'rgb(251 146 60)';   // orange-400
  return 'rgb(248 113 113)';                    // red-400
}

/** Formats seconds into "Xm Ys" or "Xs" */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── ScoreHistoryChart — inline SVG line chart ─────────────────────────────────

function ScoreHistoryChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;

  const W = 280;
  const H = 48;
  const PAD = 6;

  const scores = history.map((h) => h.score);
  const minScore = Math.max(0, Math.min(...scores) - 5);
  const maxScore = Math.min(100, Math.max(...scores) + 5);
  const range = maxScore - minScore || 1;

  const toX = (i: number) => PAD + ((W - PAD * 2) * i) / (history.length - 1);
  const toY = (score: number) => PAD + (H - PAD * 2) * (1 - (score - minScore) / range);

  const points = history.map((h, i) => ({ x: toX(i), y: toY(h.score), score: h.score }));

  // Build polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Build filled area path
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(H - PAD).toFixed(1)} L${points[0].x.toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  const lastScore = scores[scores.length - 1];
  const lineColor = scoreToBarColor(lastScore);

  return (
    <div className="ml-5 mt-2 mb-1">
      <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1">Score history</p>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
        aria-label="Score history chart"
      >
        {/* Area fill */}
        <path d={areaPath} fill={lineColor} fillOpacity="0.08" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={lineColor} fillOpacity="0.9" />
        ))}
        {/* Score labels on first and last point */}
        {[0, points.length - 1].map((i) => {
          const p = points[i];
          const anchor = i === 0 ? 'start' : 'end';
          const dy = p.y < PAD + 10 ? 12 : -4;
          return (
            <text
              key={i}
              x={p.x}
              y={p.y + dy}
              textAnchor={anchor}
              fontSize="8"
              fill="rgba(255,255,255,0.4)"
              fontFamily="ui-monospace, monospace"
            >
              {p.score}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}
