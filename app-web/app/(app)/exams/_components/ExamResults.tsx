'use client';

import { useRef, useState } from 'react';
import type { Exam, ExamQuestion } from '../_types';
import { getLetterGrade, getGradeColor } from '../_utils';
import MathText from './MathText';
import { useTranslation } from '@/lib/i18n';

interface CognitiveBreakdownEntry {
  total: number;
  correct: number;
  pct: number;
}

interface ExamResultsProps {
  exam: Exam;
  questions: ExamQuestion[];
  stats: {
    total_questions: number;
    correct_answers: number;
    partial_answers: number;
    wrong_answers: number;
    unanswered: number;
    score_percentage: number;
    time_spent_seconds?: number | null;
    cognitive_breakdown?: Record<string, CognitiveBreakdownEntry> | null;
  };
  onNewExam: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  isPublishing: boolean;
  publishedUrl: string | null;
}

function QuestionReview({ question, index }: { question: ExamQuestion; index: number }) {
  const { t } = useTranslation();
  const isCorrect = question.is_correct === true;
  const ps = question.partial_score ?? null;
  const isPartial = !isCorrect && ps !== null && ps > 0.01 && ps < 0.99;
  const isWrong = question.is_correct === false && !isPartial;
  const partialPct = isPartial ? Math.round((ps ?? 0) * 100) : null;
  const isUnanswered = question.user_answer === null || question.user_answer === '';

  return (
    <div className={`rounded-xl border p-4 transition-colors
      ${isCorrect
        ? 'bg-green-500/5 border-green-500/20'
        : isPartial
        ? 'bg-amber-500/5 border-amber-500/20'
        : isWrong
        ? 'bg-red-500/5 border-red-500/20'
        : 'bg-white/4 border-white/10'
      }`}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Status icon */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5
          ${isCorrect
            ? 'bg-green-500/20'
            : isPartial
            ? 'bg-amber-500/20'
            : isWrong
            ? 'bg-red-500/20'
            : 'bg-white/10'
          }`}>
          {isCorrect && (
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isPartial && (
            <span className="text-[9px] text-amber-400 font-bold leading-none">{partialPct}%</span>
          )}
          {isWrong && (
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {isUnanswered && !isPartial && !isWrong && !isCorrect && (
            <span className="text-[9px] text-white/40 font-bold">—</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 mb-1">Question {index + 1}</p>
          <p className="text-sm text-white leading-relaxed"><MathText text={question.question} /></p>
        </div>
      </div>

      {/* Answer section */}
      <div className="ml-9 space-y-2">
        {/* User answer */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider shrink-0 w-16">
            Your answer
          </span>
          <span className={`text-sm ${
            isCorrect ? 'text-green-400' : isPartial ? 'text-amber-400' : isWrong ? 'text-red-400' : 'text-white/40 italic'
          }`}>
            {isUnanswered ? t('exam.results.notAnswered') : <MathText text={question.user_answer ?? ''} />}
          </span>
        </div>

        {/* Correct answer — only show if wrong, partial, or unanswered */}
        {(isWrong || isPartial || isUnanswered) && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider shrink-0 w-16">
              {t('exam.results.correct')}
            </span>
            <span className="text-sm text-green-400"><MathText text={question.correct_answer ?? ''} /></span>
          </div>
        )}

        {/* Explanation */}
        {question.explanation && (
          <div className={`mt-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed
            ${isCorrect ? 'bg-green-500/8 text-green-300/80' : isPartial ? 'bg-amber-500/8 text-amber-300/80' : 'bg-white/5 text-white/55'}`}>
            <MathText text={question.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const COGNITIVE_LABELS: Record<string, string> = {
  memory: 'Memory',
  logic: 'Logic',
  application: 'Application',
};

export default function ExamResults({
  exam,
  questions,
  stats,
  onNewExam,
  onPublish,
  onUnpublish,
  isPublishing,
  publishedUrl,
}: ExamResultsProps) {
  const { t } = useTranslation();
  const grade = getLetterGrade(stats.score_percentage);
  const gradeColor = getGradeColor(grade);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gradeBgMap: Record<string, string> = {
    A: 'bg-green-500/15 border-green-500/25',
    B: 'bg-blue-500/15 border-blue-500/25',
    C: 'bg-indigo-500/15 border-indigo-500/25',
    D: 'bg-orange-500/15 border-orange-500/25',
    F: 'bg-red-500/15 border-red-500/25',
  };

  // The effective published URL is either the freshly generated one or
  // reconstructed from the exam's existing share_token
  const effectiveShareUrl = publishedUrl
    || (exam.is_published && exam.share_token
      ? `${window.location.origin}/exam/${exam.share_token}`
      : null);

  const isShared = exam.is_published === true || !!effectiveShareUrl;
  // Only show share section for the original owner (not for shared copies)
  const isSharedCopy = !!exam.source_exam_id;

  function handleCopy() {
    if (!effectiveShareUrl) return;
    navigator.clipboard.writeText(effectiveShareUrl).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Score card */}
      <div className="bg-white/4 border border-white/10 rounded-2xl p-6 mb-6 text-center">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-4">{exam.title}</p>

        <div className="flex items-center justify-center gap-6 mb-5">
          {/* Percentage */}
          <div>
            <p className="text-5xl font-bold text-white">{stats.score_percentage}%</p>
            <p className="text-sm text-white/45 mt-1">
              {stats.correct_answers} / {stats.total_questions} {t('exam.results.correct').toLowerCase()}
              {stats.partial_answers > 0 && (
                <span className="text-amber-400/80"> · {stats.partial_answers} {t('exam.results.partial')}</span>
              )}
            </p>
          </div>

          {/* Grade letter */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${gradeBgMap[grade] ?? 'bg-white/8 border-white/15'}`}>
            <span className={`text-3xl font-bold ${gradeColor}`}>{grade}</span>
          </div>
        </div>

        {/* Stats row — 4 columns always, Partial dimmed when 0 */}
        <div className="grid grid-cols-4 gap-3 pt-4 border-t border-white/8">
          <div>
            <p className="text-lg font-bold text-green-400">{stats.correct_answers}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{t('exam.results.correct')}</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${stats.partial_answers > 0 ? 'text-amber-400' : 'text-white/20'}`}>
              {stats.partial_answers}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">{t('exam.results.partial')}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-400">{stats.wrong_answers}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{t('exam.results.incorrect')}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white/40">{stats.unanswered}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{t('exam.results.skipped')}</p>
          </div>
        </div>

        {/* Time spent */}
        {stats.time_spent_seconds != null && stats.time_spent_seconds > 0 && (
          <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-center gap-1.5 text-xs text-white/40">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('exam.results.completedIn')}{' '}
            <span className="font-medium text-white/60">{formatDuration(stats.time_spent_seconds)}</span>
          </div>
        )}

        {/* Shared attempts counter — only shown for the original owner */}
        {!isSharedCopy && typeof exam.shared_attempts === 'number' && exam.shared_attempts > 0 && (
          <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-center gap-1.5 text-xs text-white/40">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="font-medium text-white/60">{exam.shared_attempts}</span>
            {exam.shared_attempts === 1 ? ' person has' : ' people have'} taken this exam
          </div>
        )}
      </div>

      {/* Cognitive Breakdown */}
      {stats.cognitive_breakdown && Object.keys(stats.cognitive_breakdown).length > 0 && (
        <div className="bg-white/4 border border-white/10 rounded-2xl p-4 mb-6">
          <h3 className="text-xs font-medium text-white/45 uppercase tracking-wide mb-3">Cognitive Breakdown</h3>
          <div className="space-y-2.5">
            {Object.entries(stats.cognitive_breakdown).map(([key, val]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/60">{COGNITIVE_LABELS[key] ?? key}</span>
                  <span className="text-xs font-semibold text-white/80 tabular-nums">{val.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${val.pct}%`,
                      background:
                        val.pct >= 80
                          ? 'rgb(74 222 128)'
                          : val.pct >= 60
                          ? 'rgb(96 165 250)'
                          : val.pct >= 40
                          ? 'rgb(250 204 21)'
                          : 'rgb(248 113 113)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {Math.round(val.correct)} / {val.total} questions
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share section — only for original owner exams */}
      {!isSharedCopy && (
        <div className="mb-6">
          {/* Not yet published — show Publish + New exam buttons */}
          {!isShared && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onNewExam}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/8
                  text-sm font-medium text-white/70 hover:text-white py-2.5 transition-colors"
              >
                {t('exam.results.newExam')}
              </button>
              <button
                type="button"
                onClick={onPublish}
                disabled={isPublishing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 hover:border-indigo-400/50 bg-indigo-500/20 hover:bg-indigo-500/30 text-sm font-medium text-indigo-300 hover:text-indigo-200 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-300 rounded-full animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {t('exam.results.share')}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Published — show share URL card */}
          {isShared && effectiveShareUrl && (
            <div className="bg-indigo-500/8 border border-indigo-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-indigo-200">Exam shared</p>
              </div>

              {/* URL row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <p className="text-xs text-white/60 truncate font-mono">{effectiveShareUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onNewExam}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/8
                    text-sm font-medium text-white/70 hover:text-white py-2.5 transition-colors"
                >
                  New Exam
                </button>
                <button
                  type="button"
                  onClick={onUnpublish}
                  className="px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/15
                    text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  Unpublish
                </button>
              </div>
            </div>
          )}

          {/* Published but no URL in state (page reload case) */}
          {isShared && !effectiveShareUrl && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onNewExam}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/8
                  text-sm font-medium text-white/70 hover:text-white py-2.5 transition-colors"
              >
                New Exam
              </button>
              <button
                type="button"
                onClick={onUnpublish}
                className="flex-1 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/15
                  text-sm font-medium text-red-400 py-2.5 transition-colors"
              >
                Unpublish
              </button>
            </div>
          )}
        </div>
      )}

      {/* New exam button for shared copies (no share option) */}
      {isSharedCopy && (
        <div className="mb-8">
          <button
            type="button"
            onClick={onNewExam}
            className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/8
              text-sm font-medium text-white/70 hover:text-white py-2.5 transition-colors"
          >
            New Exam
          </button>
        </div>
      )}

      {/* Questions review */}
      <div>
        <h3 className="text-sm font-semibold text-white/70 mb-3">Answer Review</h3>
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionReview key={q.id} question={q} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
