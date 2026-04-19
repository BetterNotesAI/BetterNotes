'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type WorkflowId = 'cheat-sheets' | 'lecture-notes' | 'problem-solver' | 'exams';

interface WorkflowOption {
  id: WorkflowId;
  title: string;
  description: string;
  accent: string;
  hrefFor: (projectId: string) => string;
}

interface ProjectColorOption {
  value: string;
  label: string;
}

const PROJECT_COLOR_OPTIONS: ProjectColorOption[] = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#94a3b8', label: 'Slate' },
];

const WORKFLOWS: WorkflowOption[] = [
  {
    id: 'cheat-sheets',
    title: 'Cheat Sheet',
    description: 'Generate compact formula and concept sheets.',
    accent: 'from-indigo-500/25 to-violet-500/20',
    hrefFor: (id) => `/cheat-sheets/new?projectId=${encodeURIComponent(id)}`,
  },
  {
    id: 'lecture-notes',
    title: 'Extended Lecture Notes',
    description: 'Create long-form notes (Extended Lecture Notes template).',
    accent: 'from-blue-500/25 to-cyan-500/20',
    hrefFor: (id) => `/projects/${encodeURIComponent(id)}/lecture-notes/new`,
  },
  {
    id: 'problem-solver',
    title: 'Problem Solver',
    description: 'Upload a PDF and solve problems step by step.',
    accent: 'from-orange-500/25 to-amber-500/20',
    hrefFor: (id) => `/problem-solver?projectId=${encodeURIComponent(id)}`,
  },
  {
    id: 'exams',
    title: 'Exams',
    description: 'Generate and take exams in the same project.',
    accent: 'from-emerald-500/25 to-teal-500/20',
    hrefFor: (id) => `/exams?projectId=${encodeURIComponent(id)}`,
  },
];

export default function NewProjectPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkflowId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(
    () => title.trim().length > 0 && selected !== null && !isSubmitting,
    [title, selected, isSubmitting]
  );

  async function handleContinue() {
    if (!canContinue || !selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title.trim(),
          description: description.trim() || undefined,
          color: labelColor ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        folder?: { id?: string };
        error?: string;
      };
      if (!res.ok || !data.folder?.id) {
        throw new Error(data.error ?? 'Failed to create project');
      }
      window.dispatchEvent(new Event('folders:updated'));
      const workflow = WORKFLOWS.find((w) => w.id === selected)!;
      router.push(workflow.hrefFor(data.folder.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      <div className="border-b border-white/10 px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => router.push('/documents')}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
            title="Back to documents"
            aria-label="Back to documents"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold truncate">New Project</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-3xl font-semibold tracking-tight mb-2">
            Create a new{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
              project
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-10">
            Everything you create here will live inside this project.
          </p>

          {/* Title */}
          <div className="mb-6">
            <label htmlFor="project-title" className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
              Title
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Thermodynamics — Semester 3"
              maxLength={120}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white
                placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/8"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="mb-8">
            <label htmlFor="project-description" className="block text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
              Description <span className="text-white/35 normal-case font-normal tracking-normal">— optional, used as context for AI-generated documents</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the subject, level or scope (e.g. Undergraduate thermodynamics course covering the three laws, ideal gases, and thermodynamic cycles)."
              rows={4}
              maxLength={800}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white
                placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/8 resize-none leading-relaxed"
            />
            <div className="text-[11px] text-white/35 mt-1.5 text-right tabular-nums">
              {description.length} / 800
            </div>
          </div>

          {/* Label color */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
              Label color <span className="text-white/35 normal-case font-normal tracking-normal">— optional</span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setLabelColor(null)}
                aria-pressed={labelColor === null}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  labelColor === null
                    ? 'border-indigo-400/70 bg-indigo-500/18 text-indigo-200'
                    : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white/45" />
                Default
              </button>

              {PROJECT_COLOR_OPTIONS.map((option) => {
                const isSelected = labelColor === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLabelColor(option.value)}
                    aria-label={`Set label color to ${option.label}`}
                    aria-pressed={isSelected}
                    className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full border transition-all ${
                      isSelected
                        ? 'border-white/70 shadow-[0_0_0_2px_rgba(99,102,241,0.45)]'
                        : 'border-white/20 hover:border-white/45'
                    }`}
                    style={{ backgroundColor: option.value }}
                    title={option.label}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workflow selection */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
              What would you like to create?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WORKFLOWS.map((option) => {
                const isSelected = selected === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelected(option.id)}
                    aria-pressed={isSelected}
                    className={`group relative text-left rounded-2xl border bg-gradient-to-br ${option.accent}
                      transition-all p-5 ${
                        isSelected
                          ? 'border-indigo-400/80 shadow-[0_0_0_1px_rgba(129,140,248,0.6),0_10px_30px_rgba(79,70,229,0.25)]'
                          : 'border-white/15 hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-base font-semibold text-white">{option.title}</h3>
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-400/90 text-white'
                            : 'border-white/30 bg-transparent text-transparent group-hover:border-white/50'
                        }`}
                        aria-hidden
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-xs text-white/55 leading-relaxed">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Continue */}
          {error && (
            <div className="mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-white/40">
              {!title.trim() && 'Add a title to continue.'}
              {title.trim() && !selected && 'Select a workflow to continue.'}
            </div>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                canContinue
                  ? 'bg-gradient-to-r from-[#b04cff] via-[#7d5cff] to-[#3d7dff] text-white shadow-[0_4px_14px_rgba(96,82,255,0.45)] hover:shadow-[0_6px_18px_rgba(85,116,255,0.52)]'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
