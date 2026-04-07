'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface PublicExamInfo {
  id: string;
  title: string;
  subject: string;
  level: string;
  question_count: number;
  grading_mode: 'strict' | 'partial';
  created_at: string;
  shared_attempts: number;
}

const LEVEL_LABELS: Record<string, string> = {
  secondary_basic: 'Secondary — Basic',
  secondary_intermediate: 'Secondary — Intermediate',
  secondary_advanced: 'Secondary — Advanced',
  highschool_basic: 'High School — Basic',
  highschool_intermediate: 'High School — Intermediate',
  highschool_advanced: 'High School — Advanced',
  university_basic: 'University — Basic',
  university_intermediate: 'University — Intermediate',
  university_advanced: 'University — Advanced',
};

export default function SharedExamPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? '';

  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [exam, setExam] = useState<PublicExamInfo | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [gradingMode, setGradingMode] = useState<'strict' | 'partial'>('strict');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setAuthState('unauthenticated');
        // Redirect to login, come back here after
        router.replace(`/login?returnUrl=/exam/${token}`);
      } else {
        setAuthState('authenticated');
      }
    });
  }, [token, router]);

  // Fetch exam info once authenticated
  useEffect(() => {
    if (authState !== 'authenticated') return;

    fetch(`/api/exam-public/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setExamError(data.error);
        } else {
          setExam(data.exam);
          // Pre-select the exam's default grading_mode, but user can override
          if (data.exam.grading_mode) {
            setGradingMode(data.exam.grading_mode);
          }
        }
      })
      .catch(() => setExamError('Failed to load exam'));
  }, [authState, token]);

  async function handleStart() {
    setIsStarting(true);
    setStartError(null);

    try {
      const res = await fetch(`/api/exam-public/${token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grading_mode: gradingMode }),
      });
      const data = await res.json();

      if (!res.ok || !data.exam_id) {
        setStartError(data.error ?? 'Failed to start exam');
        setIsStarting(false);
        return;
      }

      // Redirect to the exam — the exams page handles loading by exam id
      // For now we navigate to the app's exams section; in the future a direct
      // /exams/[id] deep-link can be added.
      router.push(`/exams?shared=${data.exam_id}`);
    } catch {
      setStartError('Network error. Please try again.');
      setIsStarting(false);
    }
  }

  // Show nothing while checking auth (prevents flash)
  if (authState === 'loading' || authState === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-950/90 backdrop-blur sticky top-0 z-20">
        <a href="/exams" className="flex items-center gap-1.5 group">
          <span className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
            BetterNotes
          </span>
        </a>
        <a
          href="/exams"
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Go to My Exams
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Error state */}
          {examError && (
            <div className="bg-white/4 border border-white/10 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-white">Exam not found</h1>
              <p className="text-sm text-white/50">
                This exam link may have expired or been unpublished.
              </p>
              <a
                href="/exams"
                className="inline-block mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                Create your own exam
              </a>
            </div>
          )}

          {/* Loading state */}
          {!examError && !exam && (
            <div className="flex flex-col items-center gap-4 py-24">
              <div className="w-10 h-10 border-2 border-white/15 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-white/40">Loading exam...</p>
            </div>
          )}

          {/* Exam info card */}
          {exam && (
            <div className="bg-white/4 border border-white/10 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-5 border-b border-white/8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-xs text-indigo-300 font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Shared exam
                  </span>
                </div>
                <h1 className="text-xl font-semibold text-white leading-snug">{exam.title}</h1>
                <p className="text-sm text-white/50 mt-1">{exam.subject}</p>
              </div>

              {/* Details */}
              <div className="px-6 py-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/45">Level</span>
                  <span className="text-white/80 font-medium">{LEVEL_LABELS[exam.level] ?? exam.level}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/45">Questions</span>
                  <span className="text-white/80 font-medium">{exam.question_count}</span>
                </div>
                {exam.shared_attempts > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/45">Attempts</span>
                    <span className="text-white/80 font-medium">{exam.shared_attempts} {exam.shared_attempts === 1 ? 'person' : 'people'} took this exam</span>
                  </div>
                )}
              </div>

              {/* Grading mode selector */}
              <div className="px-6 pb-5 border-t border-white/8 pt-4">
                <p className="text-xs font-medium text-white/45 uppercase tracking-wider mb-3">Grading mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGradingMode('strict')}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      gradingMode === 'strict'
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                        : 'bg-white/3 border-white/10 text-white/50 hover:bg-white/6 hover:text-white/70'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-0.5">Strict</p>
                    <p className="text-[11px] leading-snug opacity-70">All or nothing — partial answers score 0</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradingMode('partial')}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      gradingMode === 'partial'
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                        : 'bg-white/3 border-white/10 text-white/50 hover:bg-white/6 hover:text-white/70'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-0.5">Partial</p>
                    <p className="text-[11px] leading-snug opacity-70">Partial answers earn half credit</p>
                  </button>
                </div>
              </div>

              {/* Start button */}
              <div className="px-6 pb-6">
                {startError && (
                  <p className="text-xs text-red-400 mb-3 text-center">{startError}</p>
                )}
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isStarting}
                  className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40
                    text-sm font-semibold text-white py-3 transition-colors disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Preparing exam...
                    </>
                  ) : (
                    'Take this exam'
                  )}
                </button>
                <p className="text-[11px] text-white/30 text-center mt-2">
                  A copy will be added to your exams
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
