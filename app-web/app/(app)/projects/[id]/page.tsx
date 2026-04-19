'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface FolderMeta {
  id: string;
  name: string;
  color: string | null;
}

interface ProjectOption {
  id: 'cheat-sheets' | 'lecture-notes' | 'problem-solver' | 'exams';
  title: string;
  description: string;
  accent: string;
  href: string;
}

export default function ProjectHubPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? '';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<FolderMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadFolder() {
      if (!projectId) return;
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/folders/${projectId}`);
        const data = (await res.json().catch(() => ({}))) as { error?: string; folder?: FolderMeta };
        if (!res.ok) {
          throw new Error(data.error ?? 'Project not found');
        }
        if (!cancelled) setFolder(data.folder ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadFolder();
    return () => { cancelled = true; };
  }, [projectId]);

  const options = useMemo<ProjectOption[]>(() => ([
    {
      id: 'cheat-sheets',
      title: 'Cheat Sheet',
      description: 'Generate compact formula and concept sheets.',
      accent: 'from-indigo-500/25 to-violet-500/20',
      href: `/cheat-sheets/new?projectId=${encodeURIComponent(projectId)}`,
    },
    {
      id: 'lecture-notes',
      title: 'Extended Lecture Notes',
      description: 'Create long-form notes (Extended Lecture Notes template).',
      accent: 'from-blue-500/25 to-cyan-500/20',
      href: `/projects/${encodeURIComponent(projectId)}/lecture-notes/new`,
    },
    {
      id: 'problem-solver',
      title: 'Problem Solver',
      description: 'Upload a PDF and solve problems step by step.',
      accent: 'from-orange-500/25 to-amber-500/20',
      href: `/problem-solver?projectId=${encodeURIComponent(projectId)}`,
    },
    {
      id: 'exams',
      title: 'Exams',
      description: 'Generate and take exams in the same project.',
      accent: 'from-emerald-500/25 to-teal-500/20',
      href: `/exams?projectId=${encodeURIComponent(projectId)}`,
    },
  ]), [projectId]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white">
        <div className="border-b border-white/10 px-6 h-14 flex items-center shrink-0">
          <div className="h-5 w-44 rounded-lg bg-white/10 animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error ?? 'Project not found'}</p>
        <button
          onClick={() => router.push('/documents')}
          className="text-xs text-white/50 hover:text-white underline"
        >
          Back to documents
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      <div className="border-b border-white/10 px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => {
              localStorage.setItem('bn_active_folder', folder.id);
              router.push('/documents');
            }}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/45 hover:text-white transition-colors"
            title="Back to documents"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold truncate">{folder.name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-3xl font-semibold tracking-tight mb-2">
            What would you like to{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
              create?
            </span>
          </h2>
          <p className="text-white/50 text-sm mb-8">
            Choose one workflow. Everything will be saved inside this project.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => router.push(option.href)}
                className={`group text-left rounded-2xl border border-white/15 bg-gradient-to-br ${option.accent}
                  hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all p-5`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white">{option.title}</h3>
                  <span className="text-white/30 group-hover:text-white/65 transition-colors">→</span>
                </div>
                <p className="text-xs text-white/55 leading-relaxed">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
