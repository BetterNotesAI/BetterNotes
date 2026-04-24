'use client';

import { useState, useEffect, useCallback } from 'react';

interface University { id: string; name: string; slug: string; }
interface Program    { id: string; tipo: string; title: string; }
interface Course     { id: string; name: string; year: number; semester: number | null; semester_label: string | null; }

interface PublishModalProps {
  documentId: string;
  documentTitle: string;
  isOpen: boolean;
  initialData?: {
    is_published: boolean;
    university?: string | null;
    degree?: string | null;
    subject?: string | null;
    visibility?: string;
    keywords?: string[];
    university_id?: string | null;
    program_id?: string | null;
    course_id?: string | null;
  };
  onClose: () => void;
  onSuccess: (published: boolean) => void;
}

type Mode = 'university' | 'independent';

// Group courses by year → semester/label for display
function groupCourses(courses: Course[]) {
  const map: Record<number, { label: string; courses: Course[] }[]> = {};
  for (const c of courses) {
    if (!map[c.year]) map[c.year] = [];
    const groupLabel = c.semester_label ?? `Semester ${c.semester}`;
    let group = map[c.year].find((g) => g.label === groupLabel);
    if (!group) { group = { label: groupLabel, courses: [] }; map[c.year].push(group); }
    group.courses.push(c);
  }
  return map;
}

export function PublishModal({
  documentId,
  documentTitle,
  isOpen,
  initialData,
  onClose,
  onSuccess,
}: PublishModalProps) {

  // ── Mode ──────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(
    initialData?.university_id ? 'university' : 'independent'
  );

  // ── Catalogue state ───────────────────────────────────────
  const [universities, setUniversities] = useState<University[]>([]);
  const [programs, setPrograms]         = useState<Program[]>([]);
  const [courses, setCourses]           = useState<Course[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingCourses, setLoadingCourses]   = useState(false);

  // ── Structured selections ─────────────────────────────────
  const [universityId, setUniversityId] = useState<string>(initialData?.university_id ?? '');
  const [programId, setProgramId]       = useState<string>(initialData?.program_id   ?? '');
  const [courseId, setCourseId]         = useState<string>(initialData?.course_id    ?? '');

  // ── Independent free-text ─────────────────────────────────
  const [university, setUniversity] = useState(initialData?.university ?? '');
  const [degree, setDegree]         = useState(initialData?.degree     ?? '');
  const [subject, setSubject]       = useState(initialData?.subject    ?? '');

  // ── Shared ────────────────────────────────────────────────
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    (initialData?.visibility as 'private' | 'public') ?? 'private'
  );
  const [keywords, setKeywords]         = useState<string[]>(initialData?.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving]         = useState(false);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Load universities once on first open ──────────────────
  useEffect(() => {
    if (!isOpen || universities.length > 0) return;
    fetch('/api/catalogue?resource=universities')
      .then((r) => r.json())
      .then((d) => setUniversities(d.universities ?? []))
      .catch(() => {});
  }, [isOpen, universities.length]);

  // ── Reset form when modal opens ───────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const hasStructured = !!(initialData?.university_id);
    setMode(hasStructured ? 'university' : 'independent');
    setUniversityId(initialData?.university_id ?? '');
    setProgramId(initialData?.program_id ?? '');
    setCourseId(initialData?.course_id ?? '');
    setUniversity(initialData?.university ?? '');
    setDegree(initialData?.degree ?? '');
    setSubject(initialData?.subject ?? '');
    setVisibility((initialData?.visibility as 'private' | 'public') ?? 'private');
    setKeywords(initialData?.keywords ?? []);
    setKeywordInput('');
    setError(null);
  }, [isOpen, initialData]);

  // ── Cascade: university → programs ───────────────────────
  useEffect(() => {
    if (!universityId) { setPrograms([]); setProgramId(''); setCourses([]); setCourseId(''); return; }
    setLoadingPrograms(true);
    fetch(`/api/catalogue?resource=programs&university_id=${universityId}`)
      .then((r) => r.json())
      .then((d) => { setPrograms(d.programs ?? []); setLoadingPrograms(false); })
      .catch(() => setLoadingPrograms(false));
  }, [universityId]);

  // ── Cascade: program → courses ────────────────────────────
  useEffect(() => {
    if (!programId) { setCourses([]); setCourseId(''); return; }
    setLoadingCourses(true);
    fetch(`/api/catalogue?resource=courses&program_id=${programId}`)
      .then((r) => r.json())
      .then((d) => { setCourses(d.courses ?? []); setLoadingCourses(false); })
      .catch(() => setLoadingCourses(false));
  }, [programId]);

  // ── Keywords helpers ──────────────────────────────────────
  const addKeyword = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setKeywords((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setKeywordInput('');
  }, []);

  const removeKeyword = useCallback((kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }, []);

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(keywordInput); }
    else if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const handleSuggestKeywords = async () => {
    setIsSuggestingKeywords(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/suggest-keywords`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Suggestion failed');
      const data = await res.json();
      if (Array.isArray(data.keywords)) {
        setKeywords((prev) => {
          const combined = [...prev];
          for (const kw of data.keywords as string[]) if (!combined.includes(kw)) combined.push(kw);
          return combined;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest keywords');
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  // ── Publish ───────────────────────────────────────────────
  const handlePublish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { action: 'publish', visibility, keywords };

      if (mode === 'university') {
        body.university_id = universityId || null;
        body.program_id    = programId    || null;
        body.course_id     = courseId     || null;
      } else {
        body.university = university;
        body.degree     = degree;
        body.subject    = subject;
      }

      const res = await fetch(`/api/documents/${documentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Publish failed');
      onSuccess(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Unpublish failed');
      onSuccess(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAlreadyPublished = initialData?.is_published ?? false;
  const groupedCourses = groupCourses(courses);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {isAlreadyPublished ? 'Update Publication' : 'Publish to My Studies'}
            </h2>
            <p className="text-xs text-white/45 mt-0.5 truncate max-w-[280px]">{documentTitle}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="px-5 py-4 space-y-4 flex-1">

          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/12 text-xs font-medium">
            <button
              onClick={() => setMode('university')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'university'
                  ? 'bg-indigo-500/25 text-indigo-300 border-r border-indigo-400/20'
                  : 'bg-white/4 text-white/40 hover:text-white/60 border-r border-white/10'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
              My University
            </button>
            <button
              onClick={() => setMode('independent')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'independent'
                  ? 'bg-white/10 text-white'
                  : 'bg-white/4 text-white/40 hover:text-white/60'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
              Independent
            </button>
          </div>

          {/* ── University structure ─────────────────────── */}
          {mode === 'university' && (
            <div className="space-y-3">
              {/* University select */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">University</label>
                <select
                  value={universityId}
                  onChange={(e) => { setUniversityId(e.target.value); setProgramId(''); setCourseId(''); }}
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                    outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors
                    appearance-none"
                >
                  <option value="" className="bg-neutral-900 text-white/50">Select university…</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id} className="bg-neutral-900 text-white">{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Program select */}
              {universityId && (
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Degree / Programme</label>
                  {loadingPrograms ? (
                    <div className="h-9 bg-white/6 border border-white/12 rounded-lg animate-pulse" />
                  ) : (
                    <select
                      value={programId}
                      onChange={(e) => { setProgramId(e.target.value); setCourseId(''); }}
                      className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                        outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors
                        appearance-none"
                    >
                      <option value="" className="bg-neutral-900 text-white/50">Select degree…</option>
                      {['Grado', 'Máster', 'PCEO (Doble Grado)', 'PCEO (Doble Máster)'].map((tipo) => {
                        const group = programs.filter((p) => p.tipo === tipo);
                        if (!group.length) return null;
                        return (
                          <optgroup key={tipo} label={tipo} className="bg-neutral-900">
                            {group.map((p) => (
                              <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                                {p.title}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}

              {/* Course select — grouped by year */}
              {programId && (
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Course / Subject</label>
                  {loadingCourses ? (
                    <div className="h-9 bg-white/6 border border-white/12 rounded-lg animate-pulse" />
                  ) : (
                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                        outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors
                        appearance-none"
                    >
                      <option value="" className="bg-neutral-900 text-white/50">Select course…</option>
                      {Object.entries(groupedCourses).map(([year, groups]) => (
                        groups.map((group) => (
                          <optgroup key={`${year}-${group.label}`} label={`Year ${year} — ${group.label}`} className="bg-neutral-900">
                            {group.courses.map((c) => (
                              <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                                {c.name}{c.ects ? ` (${c.ects} ECTS)` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Hint when nothing selected yet */}
              {!universityId && (
                <p className="text-[11px] text-white/30 text-center py-2">
                  Select your university to browse degrees and courses
                </p>
              )}
            </div>
          )}

          {/* ── Independent free-text ────────────────────── */}
          {mode === 'independent' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">
                  University <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. MIT, UCL, Universidad de Sevilla"
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                    placeholder:text-white/25 outline-none focus:border-indigo-400/60 focus:ring-1
                    focus:ring-indigo-400/30 transition-colors"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">
                  Degree / Programme <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="e.g. BSc Computer Science, MSc Mathematics"
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                    placeholder:text-white/25 outline-none focus:border-indigo-400/60 focus:ring-1
                    focus:ring-indigo-400/30 transition-colors"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">
                  Subject / Module <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Linear Algebra, Thermodynamics"
                  className="w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white
                    placeholder:text-white/25 outline-none focus:border-indigo-400/60 focus:ring-1
                    focus:ring-indigo-400/30 transition-colors"
                  maxLength={120}
                />
              </div>
            </div>
          )}

          {/* Keywords */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-white/60">
                Keywords <span className="text-white/30">(optional)</span>
              </label>
              <button
                onClick={handleSuggestKeywords}
                disabled={isSuggestingKeywords}
                className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
              >
                {isSuggestingKeywords ? (
                  <><span className="animate-spin inline-block">⟳</span> Suggesting…</>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Suggest with AI
                  </>
                )}
              </button>
            </div>
            <div className="min-h-[44px] bg-white/6 border border-white/12 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 items-center
              focus-within:border-indigo-400/60 focus-within:ring-1 focus-within:ring-indigo-400/30 transition-colors cursor-text">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-full px-2 py-0.5 text-xs">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="text-indigo-400/60 hover:text-indigo-300 transition-colors ml-0.5" aria-label={`Remove ${kw}`}>×</button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => addKeyword(keywordInput)}
                placeholder={keywords.length === 0 ? 'Type a keyword and press Enter' : ''}
                className="flex-1 min-w-[100px] bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
              />
            </div>
            <p className="text-[10px] text-white/30 mt-1">Press Enter or comma to add</p>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Visibility</label>
            <div className="flex gap-2">
              {(['private', 'public'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    visibility === v
                      ? v === 'public'
                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                        : 'bg-white/10 border-white/25 text-white'
                      : 'bg-white/4 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                  }`}
                >
                  {v === 'private' ? 'Private (only me)' : 'Public (discoverable)'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2 shrink-0">
          {isAlreadyPublished && (
            <button
              onClick={handleUnpublish}
              disabled={isSaving}
              className="flex-1 py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <><span className="animate-spin inline-block">⟳</span> Saving…</>
            ) : isAlreadyPublished ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
