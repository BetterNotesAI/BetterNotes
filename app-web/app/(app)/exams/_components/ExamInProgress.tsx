'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Exam } from '../_types';
import MathText from './MathText';

// The questions returned by /generate do NOT include correct_answer or explanation,
// except for flashcard type (which needs it to show the answer on the card back).
export interface ActiveQuestion {
  id: string;
  exam_id: string;
  question_number: number;
  type: 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';
  question: string;
  options: string[] | null;
  correct_answer?: string; // only present for flashcard type
  user_answer: string | null;
  is_correct: boolean | null;
  has_math?: boolean;
  created_at: string;
}

interface ExamInProgressProps {
  exam: Exam;
  questions: ActiveQuestion[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (
    answers: { question_id: string; answer: string }[],
    photos: Record<string, File>
  ) => void;
  timerEnabled?: boolean;
  timerSeconds?: number;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const MATH_SYMBOLS: { label: string; symbols: string[] }[] = [
  {
    label: 'Basic',
    symbols: ['²', '³', '√', '±', '×', '÷', '=', '≠', '≤', '≥', '∞'],
  },
  {
    label: 'Greek',
    symbols: ['α', 'β', 'γ', 'δ', 'θ', 'π', 'σ', 'λ', 'μ', 'Σ', 'Δ', 'Ω'],
  },
  {
    label: 'Calculus',
    symbols: ['∫', '∂', '∇', 'lim', 'dy/dx'],
  },
  {
    label: 'Chemistry',
    symbols: ['→', '⇌', '°'],
  },
];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ExamInProgress({
  exam,
  questions,
  isSubmitting,
  error,
  onSubmit,
  timerEnabled = false,
  timerSeconds,
}: ExamInProgressProps) {
  // Local answers map: question id -> answer string
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Photo files map: question id -> File
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({});
  // Preview URLs map: question id -> object URL
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeMathCategory, setActiveMathCategory] = useState(0);
  const fillInRef = useRef<HTMLTextAreaElement>(null);
  // One hidden file input per fill_in question (keyed by question id)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    timerEnabled && timerSeconds ? timerSeconds : null
  );
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const photoFilesRef = useRef(photoFiles);
  photoFilesRef.current = photoFiles;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const autoSubmittedRef = useRef(false);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      Object.values(photoPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timerEnabled || !timerSeconds) return;
    const endAt = Date.now() + timerSeconds * 1000;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          const payload = questionsRef.current.map((q) => ({
            question_id: q.id,
            answer: answersRef.current[q.id] ?? '',
          }));
          onSubmitRef.current(payload, photoFilesRef.current);
        }
      }
    }, 500);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = questions.length;
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== '' || !!photoFiles[k]
  ).length;
  const allAnswered = answeredCount === total;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion?.id] ?? '';

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handlePhotoSelect(questionId: string, file: File) {
    // Revoke previous preview if any
    if (photoPreviews[questionId]) {
      URL.revokeObjectURL(photoPreviews[questionId]);
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotoFiles((prev) => ({ ...prev, [questionId]: file }));
    setPhotoPreviews((prev) => ({ ...prev, [questionId]: previewUrl }));
  }

  function handlePhotoRemove(questionId: string) {
    if (photoPreviews[questionId]) {
      URL.revokeObjectURL(photoPreviews[questionId]);
    }
    setPhotoFiles((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setPhotoPreviews((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    // Reset the hidden file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const insertSymbol = useCallback((symbol: string) => {
    const el = fillInRef.current;
    if (!el || !currentQuestion) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = before + symbol + after;
    setAnswer(currentQuestion.id, next);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + symbol.length;
      el.setSelectionRange(pos, pos);
    });
  }, [currentQuestion]);

  function handleSubmit() {
    const payload = questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id] ?? '',
    }));
    onSubmit(payload, photoFiles);
  }

  if (!currentQuestion) return null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Exam header */}
      <div className="mb-6">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{exam.title}</p>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white">
            Question {currentIndex + 1}{' '}
            <span className="text-white/40 font-normal">of {total}</span>
          </h2>
          <span className="text-xs text-white/50">
            {answeredCount} / {total} answered
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>

        {/* Timer bar */}
        {timerEnabled && secondsLeft !== null && timerSeconds && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/35 uppercase tracking-wide">Time remaining</span>
              <span className={`text-xs font-mono font-semibold tabular-nums transition-colors ${
                secondsLeft < 60
                  ? 'text-red-400 animate-pulse'
                  : secondsLeft < timerSeconds * 0.2
                  ? 'text-orange-400'
                  : 'text-white/60'
              }`}>
                {formatTime(secondsLeft)}
              </span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  secondsLeft < 60
                    ? 'bg-red-500'
                    : secondsLeft < timerSeconds * 0.2
                    ? 'bg-orange-400'
                    : secondsLeft < timerSeconds * 0.5
                    ? 'bg-indigo-400'
                    : 'bg-green-400'
                }`}
                style={{ width: `${(secondsLeft / timerSeconds) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Question dots */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const isAnswered = !!answers[q.id] || !!photoFiles[q.id];
            const isCurrent = i === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                title={`Question ${i + 1}`}
                className={`w-6 h-6 rounded-md text-[10px] font-semibold transition-all duration-150 border
                  ${isCurrent
                    ? 'bg-indigo-500 border-indigo-500 text-black'
                    : isAnswered
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                    : 'bg-white/6 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white/4 border border-white/10 rounded-2xl p-6 mb-4">
        {/* Type badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 border border-white/12 text-white/50 mb-4">
          {currentQuestion.type === 'multiple_choice' && 'Multiple Choice'}
          {currentQuestion.type === 'true_false' && 'True / False'}
          {currentQuestion.type === 'fill_in' && 'Fill in the Blank'}
        </span>

        {/* Question text */}
        <p className="text-white text-base leading-relaxed mb-6">
          <MathText text={currentQuestion.question} />
        </p>

        {/* Answer input based on type */}
        {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option, i) => {
              const isSelected = currentAnswer === option;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswer(currentQuestion.id, option)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150
                    ${isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                      : 'bg-white/4 border-white/10 text-white/70 hover:bg-white/7 hover:border-white/20 hover:text-white'
                    }`}
                >
                  <span className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 transition-colors
                    ${isSelected ? 'bg-indigo-500 border-indigo-500 text-black' : 'border-white/20 text-white/40'}`}>
                    {OPTION_LABELS[i]}
                  </span>
                  <MathText text={option} className="text-sm" />
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'true_false' && (
          <div className="flex gap-3">
            {['True', 'False'].map((val) => {
              const isSelected = currentAnswer === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswer(currentQuestion.id, val)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-all duration-150
                    ${isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-white/4 border-white/10 text-white/60 hover:bg-white/7 hover:border-white/20 hover:text-white/80'
                    }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'fill_in' && (
          <div className="space-y-3">
            {/* Text answer — optional when photo is attached */}
            <textarea
              ref={fillInRef}
              rows={2}
              value={currentAnswer}
              onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
              placeholder={
                photoFiles[currentQuestion.id]
                  ? 'Optional — photo attached'
                  : 'Type your answer...'
              }
              className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white
                placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/7
                transition-colors resize-none"
            />

            {/* Math symbols toolbar */}
            {currentQuestion.has_math && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-2.5">
                {/* Category tabs */}
                <div className="flex gap-1 mb-2">
                  {MATH_SYMBOLS.map((cat, ci) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setActiveMathCategory(ci)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        activeMathCategory === ci
                          ? 'bg-indigo-500/25 border border-indigo-500/40 text-indigo-300'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {/* Symbol buttons */}
                <div className="flex flex-wrap gap-1">
                  {MATH_SYMBOLS[activeMathCategory].symbols.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onMouseDown={(e) => {
                        // Prevent textarea from losing focus/selection
                        e.preventDefault();
                        insertSymbol(sym);
                      }}
                      className="min-w-[2rem] px-2 py-1.5 rounded-lg border border-white/12 bg-white/6
                        text-xs font-mono text-white/70 hover:bg-indigo-500/20 hover:border-indigo-500/35
                        hover:text-white transition-colors"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Photo upload section */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-3">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelect(currentQuestion.id, file);
                }}
              />

              {photoPreviews[currentQuestion.id] ? (
                /* Preview state */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/50 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Photo attached
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-white/8 border border-white/12
                          text-white/50 hover:bg-white/12 hover:text-white/80 transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhotoRemove(currentQuestion.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 border border-red-500/20
                          text-red-400/70 hover:bg-red-500/18 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {/* Image preview */}
                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreviews[currentQuestion.id]}
                      alt="Answer photo preview"
                      className="w-full max-h-48 object-contain"
                    />
                  </div>
                </div>
              ) : (
                /* Upload button state */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed
                    border-white/15 text-white/40 hover:border-indigo-500/40 hover:text-indigo-400/80
                    hover:bg-indigo-500/5 transition-all duration-150 text-xs font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload photo of handwritten work
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => i - 1)}
          disabled={!canGoPrev}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/12 bg-white/5
            text-sm text-white/60 hover:bg-white/8 hover:text-white hover:border-white/20
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        {canGoNext ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i + 1)}
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150
              ${allAnswered
                ? 'bg-indigo-500 hover:bg-indigo-400 text-black disabled:bg-indigo-500/40 disabled:cursor-not-allowed'
                : 'bg-white/8 border border-white/15 text-white/60 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed'
              }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Exam
                {!allAnswered && (
                  <span className="text-[10px] font-normal text-white/40">
                    ({answeredCount}/{total})
                  </span>
                )}
              </>
            )}
          </button>
        )}
      </div>

      {/* Submit button also visible from any slide if most questions are answered */}
      {canGoNext && answeredCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/8 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium
              bg-white/6 border border-white/12 text-white/50 hover:bg-white/10 hover:text-white/80
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit now (${answeredCount}/${total} answered)`
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
