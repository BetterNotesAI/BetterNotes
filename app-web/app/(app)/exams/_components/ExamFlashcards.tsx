'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActiveQuestion } from './ExamInProgress';

interface ExamFlashcardsProps {
  questions: ActiveQuestion[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (
    answers: { question_id: string; answer: string }[],
    photos: Record<string, File>,
    timeSpentSeconds: number
  ) => void;
  onBack: () => void;
}

type Evaluation = 'got' | 'review';

export default function ExamFlashcards({
  questions,
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: ExamFlashcardsProps) {
  const startTimeRef = useRef<number>(Date.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [isDone, setIsDone] = useState(false);

  const total = questions.length;
  const current = questions[currentIndex];
  const gotCount = Object.values(evaluations).filter((v) => v === 'got').length;
  const reviewCount = Object.values(evaluations).filter((v) => v === 'review').length;
  const evaluatedCount = gotCount + reviewCount;

  function flip() {
    setIsFlipped((f) => !f);
  }

  function goTo(index: number) {
    if (index < 0 || index >= total) return;
    setCurrentIndex(index);
    setIsFlipped(false);
  }

  function evaluate(result: Evaluation) {
    setEvaluations((prev) => ({ ...prev, [current.id]: result }));
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setIsFlipped(false);
    } else {
      setIsDone(true);
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isDone) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      } else if (e.key === 'ArrowRight') {
        goTo(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        goTo(currentIndex - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, isDone]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSubmit() {
    const payload = questions.map((q) => ({
      question_id: q.id,
      answer: evaluations[q.id] === 'got' ? (q.correct_answer ?? 'correct') : '',
    }));
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    onSubmit(payload, {}, elapsed);
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (isDone) {
    const pct = total > 0 ? Math.round((gotCount / total) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center gap-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">Session complete!</h2>
          <p className="text-sm text-white/45 mt-1">You reviewed all {total} flashcards</p>
        </div>

        {/* Score circle */}
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={pct >= 80 ? 'rgb(74 222 128)' : pct >= 60 ? 'rgb(250 204 21)' : 'rgb(248 113 113)'}
              strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 263.9} 263.9`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{pct}%</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wide">knew it</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-green-400">{gotCount}</p>
            <p className="text-xs text-white/40 mt-0.5">Got it</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{reviewCount}</p>
            <p className="text-xs text-white/40 mt-0.5">Need review</p>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400
              text-black font-semibold text-sm py-3 transition-colors disabled:bg-indigo-500/40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save to Stats'
            )}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/12 bg-white/5 text-white/60
              hover:bg-white/8 hover:text-white/80 text-sm py-2.5 transition-colors disabled:opacity-50"
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  // ── Flashcard view ───────────────────────────────────────────────────────────
  const currentEval = evaluations[current?.id];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Card {currentIndex + 1} of {total}
          </p>
          <span className="text-xs text-white/40">
            {evaluatedCount}/{total} reviewed
          </span>
        </div>

        {/* Dot navigation */}
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const ev = evaluations[q.id];
            const isCurrent = i === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(i)}
                title={`Card ${i + 1}`}
                className={`w-6 h-6 rounded-md text-[10px] font-semibold transition-all duration-150 border
                  ${isCurrent
                    ? 'bg-indigo-500 border-indigo-500 text-black'
                    : ev === 'got'
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : ev === 'review'
                    ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                    : 'bg-white/6 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flashcard */}
      <div
        className="relative w-full cursor-pointer select-none"
        style={{ perspective: '1200px', minHeight: '260px' }}
        onClick={flip}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '260px',
          }}
        >
          {/* Front — question */}
          <div
            className="absolute inset-0 rounded-2xl border border-white/10 bg-white/4 p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 border border-white/12 text-white/50">
                Flashcard
              </span>
              <span />
            </div>
            <p className="text-white text-base leading-relaxed text-center">{current?.question}</p>
            <div className="flex items-center justify-center gap-1.5 text-white/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span className="text-xs">Space / Enter to flip</span>
            </div>
          </div>

          {/* Back — answer */}
          <div
            className="absolute inset-0 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/12 border border-indigo-500/20 text-indigo-400/70">
                Answer
              </span>
              <span className="text-xs text-white/25">How did you do?</span>
            </div>
            <p className="text-white text-base leading-relaxed text-center">
              {current?.correct_answer ?? '—'}
            </p>
            {/* Evaluation buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); evaluate('review'); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10
                  text-orange-300 text-sm font-medium py-2.5 hover:bg-orange-500/18 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Need review
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); evaluate('got'); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10
                  text-green-300 text-sm font-medium py-2.5 hover:bg-green-500/18 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/12 bg-white/5
            text-sm text-white/60 hover:bg-white/8 hover:text-white hover:border-white/20
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        {/* Current card eval badge */}
        {currentEval && (
          <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
            currentEval === 'got'
              ? 'bg-green-500/10 border-green-500/25 text-green-400'
              : 'bg-orange-500/10 border-orange-500/25 text-orange-400'
          }`}>
            {currentEval === 'got' ? 'Got it' : 'Need review'}
          </span>
        )}

        {currentIndex < total - 1 ? (
          <button
            type="button"
            onClick={() => goTo(currentIndex + 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/12 bg-white/5
              text-sm text-white/60 hover:bg-white/8 hover:text-white hover:border-white/20 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsDone(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30
              text-indigo-300 text-sm font-medium hover:bg-indigo-500/22 transition-colors"
          >
            Finish
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="mt-4 text-center text-xs text-white/20">
        Space / Enter to flip · ← → to navigate
      </p>
    </div>
  );
}
