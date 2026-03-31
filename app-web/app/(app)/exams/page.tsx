'use client';

import { useReducer, useRef, useState } from 'react';
import type { Exam, ExamQuestion, ExamQuestionType } from './_types';
import ExamSetup, { type ExamSetupValues } from './_components/ExamSetup';
import ExamInProgress, { type ActiveQuestion } from './_components/ExamInProgress';
import ExamFlashcards from './_components/ExamFlashcards';
import ExamResults from './_components/ExamResults';
import ExamStats, { type ExamStatsHandle } from './_components/ExamStats';

// ─── State machine ────────────────────────────────────────────────────────────

type Screen = 'setup' | 'loading' | 'exam' | 'submitting' | 'results';

interface ExamSessionStats {
  total_questions: number;
  correct_answers: number;
  partial_answers: number;
  wrong_answers: number;
  unanswered: number;
  score_percentage: number;
}

interface State {
  screen: Screen;
  exam: Exam | null;
  questions: ActiveQuestion[];
  resultQuestions: ExamQuestion[];
  stats: ExamSessionStats | null;
  generateError: string | null;
  submitError: string | null;
  isPublishing: boolean;
}

type Action =
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; exam: Exam; questions: ActiveQuestion[] }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'SUBMIT_START' }
  | {
      type: 'SUBMIT_SUCCESS';
      exam: Exam;
      questions: ExamQuestion[];
      stats: ExamSessionStats;
    }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'PUBLISH_START' }
  | { type: 'PUBLISH_DONE' }
  | { type: 'RESET' };

const initialState: State = {
  screen: 'setup',
  exam: null,
  questions: [],
  resultQuestions: [],
  stats: null,
  generateError: null,
  submitError: null,
  isPublishing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GENERATE_START':
      return { ...state, screen: 'loading', generateError: null, submitError: null };
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        screen: 'exam',
        exam: action.exam,
        questions: action.questions,
        generateError: null,
      };
    case 'GENERATE_ERROR':
      return { ...state, screen: 'setup', generateError: action.error };
    case 'SUBMIT_START':
      return { ...state, screen: 'submitting', submitError: null };
    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        screen: 'results',
        exam: action.exam,
        resultQuestions: action.questions,
        stats: action.stats,
        submitError: null,
      };
    case 'SUBMIT_ERROR':
      return { ...state, screen: 'exam', submitError: action.error };
    case 'PUBLISH_START':
      return { ...state, isPublishing: true };
    case 'PUBLISH_DONE':
      return { ...state, isPublishing: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

type Tab = 'generate' | 'stats';

export default function ExamsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const statsRef = useRef<ExamStatsHandle>(null);
  const [timerSettings, setTimerSettings] = useState<{ enabled: boolean; minutes: number }>({
    enabled: false,
    minutes: 30,
  });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // --- Generate exam ---
  async function handleGenerate(values: ExamSetupValues) {
    setTimerSettings({ enabled: values.timerEnabled, minutes: values.timerMinutes });
    dispatch({ type: 'GENERATE_START' });
    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: values.subject,
          level: values.level,
          question_count: values.questionCount,
          format: values.formats as ExamQuestionType[],
          format_counts: values.formatCounts,
          language: values.language,
          document_ids: values.documentIds,
          external_content: values.externalContent || undefined,
          cognitive_distribution: values.cognitiveDistribution,
          grading_mode: values.gradingMode,
          custom_instructions: values.customInstructions,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        dispatch({ type: 'GENERATE_ERROR', error: data.error ?? 'Failed to generate exam' });
        return;
      }

      dispatch({
        type: 'GENERATE_SUCCESS',
        exam: data.exam as Exam,
        questions: (data.questions ?? []) as ActiveQuestion[],
      });
    } catch {
      dispatch({ type: 'GENERATE_ERROR', error: 'Network error. Please try again.' });
    }
  }

  // --- Submit exam ---
  async function handleSubmit(
    answers: { question_id: string; answer: string }[],
    photos: Record<string, File>
  ) {
    if (!state.exam) return;
    dispatch({ type: 'SUBMIT_START' });

    const photoEntries = Object.entries(photos);

    try {
      let res: Response;

      if (photoEntries.length > 0) {
        // Use FormData when photos are present so files can be transported
        const formData = new FormData();
        formData.append('answers', JSON.stringify(answers));
        for (const [questionId, file] of photoEntries) {
          formData.append(`photo_${questionId}`, file);
        }
        res = await fetch(`/api/exams/${state.exam.id}/submit`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`/api/exams/${state.exam.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        dispatch({ type: 'SUBMIT_ERROR', error: data.error ?? 'Failed to submit exam' });
        return;
      }

      dispatch({
        type: 'SUBMIT_SUCCESS',
        exam: data.exam as Exam,
        questions: (data.questions ?? []) as ExamQuestion[],
        stats: data.stats as ExamSessionStats,
      });
      // Refresh historical stats so they're current when user returns to setup
      statsRef.current?.refresh();
    } catch {
      dispatch({ type: 'SUBMIT_ERROR', error: 'Network error. Please try again.' });
    }
  }

  // --- Reset stats ---
  async function handleResetStats() {
    if (!resetConfirm) { setResetConfirm(true); return; }
    setIsResetting(true);
    try {
      await fetch('/api/exams/stats', { method: 'DELETE' });
      statsRef.current?.refresh();
    } finally {
      setIsResetting(false);
      setResetConfirm(false);
    }
  }

  // --- Publish to My Studies (placeholder) ---
  async function handlePublish() {
    dispatch({ type: 'PUBLISH_START' });
    // Placeholder — actual integration with /api/studies TBD
    await new Promise((resolve) => setTimeout(resolve, 800));
    dispatch({ type: 'PUBLISH_DONE' });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 h-14 flex items-center shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {/* Back button when in exam or results */}
            {(state.screen === 'exam' || state.screen === 'submitting' || state.screen === 'results') && (
              <button
                type="button"
                onClick={() => { dispatch({ type: 'RESET' }); setActiveTab('generate'); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40
                  hover:text-white/80 hover:bg-white/8 transition-colors"
                title="Back"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-semibold">Exams</h1>

            {/* Tab menu — only visible on setup screen */}
            {state.screen === 'setup' && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 ml-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('generate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    activeTab === 'generate'
                      ? 'bg-white/12 text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('stats'); statsRef.current?.refresh(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    activeTab === 'stats'
                      ? 'bg-white/12 text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  Stats
                </button>
              </div>
            )}
          </div>

          {/* Reset stats button — only on stats tab */}
          {state.screen === 'setup' && activeTab === 'stats' && (
            <button
              type="button"
              onClick={handleResetStats}
              onBlur={() => setResetConfirm(false)}
              disabled={isResetting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                ${resetConfirm
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/22'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8'
                }`}
            >
              {isResetting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              )}
              {resetConfirm ? 'Confirm reset?' : 'Reset stats'}
            </button>
          )}

          {/* Breadcrumb when in exam/results */}
          {(state.screen === 'exam' || state.screen === 'submitting' || state.screen === 'results') && (
            <span className="text-xs text-white/40">
              {state.screen === 'results' ? 'Results' : state.exam?.title}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* SETUP — Generate tab */}
        {state.screen === 'setup' && activeTab === 'generate' && (
          <ExamSetup
            onSubmit={handleGenerate}
            isLoading={false}
            error={state.generateError}
          />
        )}

        {/* SETUP — Stats tab */}
        {state.screen === 'setup' && activeTab === 'stats' && (
          <div className="max-w-xl mx-auto px-4 py-8">
            <ExamStats ref={statsRef} />
          </div>
        )}

        {/* LOADING — generating exam */}
        {state.screen === 'loading' && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25">
              <div className="w-6 h-6 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Generating your exam...</p>
              <p className="text-white/40 text-sm mt-1">This may take a few seconds</p>
            </div>
          </div>
        )}

        {/* EXAM IN PROGRESS — flashcard mode */}
        {(state.screen === 'exam' || state.screen === 'submitting') && state.exam &&
          state.questions.every((q) => q.type === 'flashcard') && (
          <ExamFlashcards
            questions={state.questions}
            isSubmitting={state.screen === 'submitting'}
            error={state.submitError}
            onSubmit={handleSubmit}
            onBack={() => { dispatch({ type: 'RESET' }); setActiveTab('generate'); }}
          />
        )}

        {/* EXAM IN PROGRESS — regular mode */}
        {(state.screen === 'exam' || state.screen === 'submitting') && state.exam &&
          !state.questions.every((q) => q.type === 'flashcard') && (
          <ExamInProgress
            exam={state.exam}
            questions={state.questions}
            isSubmitting={state.screen === 'submitting'}
            error={state.submitError}
            onSubmit={handleSubmit}
            timerEnabled={timerSettings.enabled}
            timerSeconds={timerSettings.enabled ? timerSettings.minutes * 60 : undefined}
          />
        )}

        {/* RESULTS */}
        {state.screen === 'results' && state.exam && state.stats && (
          <ExamResults
            exam={state.exam}
            questions={state.resultQuestions}
            stats={state.stats}
            onNewExam={() => dispatch({ type: 'RESET' })}
            onPublish={handlePublish}
            isPublishing={state.isPublishing}
          />
        )}

      </div>
    </div>
  );
}
