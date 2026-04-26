'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublishedDocument {
  id: string;
  title: string;
  template_id: string;
  published_at: string;
  university: string | null;
  degree: string | null;
  subject: string | null;
  visibility: string;
  keywords: string[];
  view_count: number;
  like_count: number;
  user_liked: boolean;
  is_own: boolean;
  university_id: string | null;
  program_id: string | null;
  course_id: string | null;
  university_slug: string | null;
  program_slug: string | null;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
}

type SelectedNode =
  | { type: 'all' }
  | { type: 'university'; id: string }
  | { type: 'program'; id: string }
  | { type: 'course'; id: string }
  | { type: 'independent' };

interface MyCourse {
  id: string;
  name: string;
  semester: number | null;
  semester_label: string | null;
  ects: number | null;
  tipo: string | null;
  document_count: number;
}

interface MyYear {
  year: number;
  courses: MyCourse[];
}

interface MyProgram {
  id: string;
  title: string;
  tipo: string;
  university: { name: string; slug: string } | null;
}

interface MyUniversityData {
  program: MyProgram | null;
  profile_year: number | null;
  years: MyYear[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  '2cols_portrait': '2-Col Cheat Sheet',
  landscape_3col_maths: 'Compact 3 Columns Landscape',
  clean_3cols_landscape: 'Clean 3 Columns Landscape',
  cornell: 'Cornell Review Notes',
  problem_solving: 'Problem Set',
  zettelkasten: 'Zettelkasten',
  academic_paper: 'Academic Paper',
  lab_report: 'Lab Report',
  data_analysis: 'Data Analysis',
  study_form: 'Study Form',
  lecture_notes: 'Extended Lecture Notes',
  classic_lecture_notes: 'Classic Lecture Notes',
  long_template: 'Long Document',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HeartIcon({ className, filled }: { className?: string; filled: boolean }) {
  return filled ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3v4.5m0 0a3 3 0 100 6 3 3 0 000-6zm0 0V21M16.5 3v4.5m0 0a3 3 0 100 6 3 3 0 000-6zm0 0V9m0 5.25V21" />
    </svg>
  );
}

function ChevronIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={`${className} transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Document card (Community tab) ─────────────────────────────────────────────

function DocumentCard({
  doc, onOpen, onLikeToggle, onFork, onAuthorClick,
}: {
  doc: PublishedDocument;
  onOpen: () => void;
  onLikeToggle: (id: string) => void;
  onFork: (id: string) => Promise<void>;
  onAuthorClick: (userId: string) => void;
}) {
  const templateLabel = TEMPLATE_LABELS[doc.template_id] ?? doc.template_id;
  const [isLiking, setIsLiking] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const visibleKeywords = doc.keywords.slice(0, 2);
  const hiddenKeywordCount = Math.max(0, doc.keywords.length - visibleKeywords.length);

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try { await onLikeToggle(doc.id); } finally { setIsLiking(false); }
  }

  async function handleFork(e: React.MouseEvent) {
    e.stopPropagation();
    if (isForking) return;
    setIsForking(true);
    try { await onFork(doc.id); } finally { setIsForking(false); }
  }

  const authorInitial = (doc.author_name ?? '?')[0].toUpperCase();

  return (
    <div
      className="group bg-white/4 hover:bg-white/7 border border-white/10
        hover:border-white/20 rounded-2xl p-5 transition-all duration-200 flex flex-col gap-3"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3
          role="button" tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
          className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 flex-1 cursor-pointer"
        >
          {doc.title}
        </h3>
        {doc.is_own && (
          <span className="shrink-0 text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-400/25 rounded-full px-2 py-0.5">
            Yours
          </span>
        )}
      </div>

      {/* Author + compact keywords */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); onAuthorClick(doc.user_id); }}
          className="flex items-center gap-1.5 group/author min-w-0 shrink"
        >
          <div
            className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40
              border border-white/15 flex items-center justify-center shrink-0 bg-cover bg-center"
            style={doc.author_avatar ? { backgroundImage: `url(${doc.author_avatar})` } : undefined}
          >
            {!doc.author_avatar && <span className="text-[9px] font-semibold text-white/70">{authorInitial}</span>}
          </div>
          <span className="text-[11px] text-white/40 group-hover/author:text-white/70 transition-colors truncate max-w-[120px]">
            {doc.is_own ? 'You' : (doc.author_name ?? 'Anonymous')}
          </span>
        </button>

        {visibleKeywords.length > 0 && (
          <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 overflow-hidden whitespace-nowrap">
            {visibleKeywords.map((kw) => (
              <span key={kw} className="min-w-0 max-w-[112px] truncate text-[10px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-400/20 rounded-full px-2 py-0.5">
                {kw}
              </span>
            ))}
            {hiddenKeywordCount > 0 && (
              <span className="shrink-0 text-[10px] text-white/35">+{hiddenKeywordCount}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">{templateLabel}</span>
          <span className="text-[10px] text-white/30">{formatDate(doc.published_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <EyeIcon className="w-3 h-3" />{doc.view_count}
          </span>
          <button
            onClick={handleLike} disabled={isLiking}
            aria-label={doc.user_liked ? 'Unlike' : 'Like'}
            className={`flex items-center gap-1 text-[10px] transition-colors rounded px-1 py-0.5 disabled:opacity-50
              ${doc.user_liked ? 'text-pink-400 hover:text-pink-300' : 'text-white/30 hover:text-pink-400'}`}
          >
            <HeartIcon className="w-3.5 h-3.5" filled={doc.user_liked} />{doc.like_count}
          </button>
          {doc.is_own ? (
            <button
              onClick={onOpen}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-white/70
                hover:text-white border border-white/10 hover:border-white/25 transition-colors"
            >
              Open
            </button>
          ) : (
            <button
              onClick={handleFork} disabled={isForking}
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg
                bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/25
                hover:border-indigo-400/40 transition-colors disabled:opacity-50"
            >
              {isForking
                ? <span className="w-3 h-3 border border-indigo-400/40 border-t-indigo-300 rounded-full animate-spin" />
                : <ForkIcon className="w-3.5 h-3.5" />}
              Fork
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tree sidebar (Community tab) ──────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  count: number;
  children: TreeNode[];
}

function buildTree(documents: PublishedDocument[]): {
  universities: TreeNode[];
  independentCount: number;
} {
  const uniMap = new Map<string, { name: string; programs: Map<string, { name: string; courses: Map<string, { name: string; count: number }> }> }>();

  for (const doc of documents) {
    if (!doc.university_id) continue;
    if (!uniMap.has(doc.university_id)) {
      uniMap.set(doc.university_id, { name: doc.university ?? doc.university_id, programs: new Map() });
    }
    const uni = uniMap.get(doc.university_id)!;

    if (doc.program_id) {
      if (!uni.programs.has(doc.program_id)) {
        uni.programs.set(doc.program_id, { name: doc.degree ?? doc.program_id, courses: new Map() });
      }
      const prog = uni.programs.get(doc.program_id)!;

      if (doc.course_id) {
        const cur = prog.courses.get(doc.course_id);
        prog.courses.set(doc.course_id, { name: doc.subject ?? doc.course_id, count: (cur?.count ?? 0) + 1 });
      }
    }
  }

  const universities: TreeNode[] = [];
  for (const [uniId, uni] of uniMap) {
    const programs: TreeNode[] = [];
    for (const [progId, prog] of uni.programs) {
      const courses: TreeNode[] = [];
      for (const [courseId, course] of prog.courses) {
        courses.push({ id: courseId, name: course.name, count: course.count, children: [] });
      }
      const progCount = documents.filter((d) => d.program_id === progId).length;
      programs.push({ id: progId, name: prog.name, count: progCount, children: courses });
    }
    const uniCount = documents.filter((d) => d.university_id === uniId).length;
    universities.push({ id: uniId, name: uni.name, count: uniCount, children: programs });
  }

  const independentCount = documents.filter((d) => !d.university_id).length;
  return { universities, independentCount };
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="ml-auto text-[10px] text-white/30 bg-white/6 rounded-full px-1.5 py-0.5 tabular-nums shrink-0">
      {n}
    </span>
  );
}

function TreeSidebar({
  documents,
  selected,
  onSelect,
}: {
  documents: PublishedDocument[];
  selected: SelectedNode;
  onSelect: (node: SelectedNode) => void;
}) {
  const { universities, independentCount } = useMemo(() => buildTree(documents), [documents]);
  const [openUniversities, setOpenUniversities] = useState<Set<string>>(new Set());
  const [openPrograms, setOpenPrograms] = useState<Set<string>>(new Set());

  // Auto-expand when a node is selected, and auto-expand the only university on load
  useEffect(() => {
    if (universities.length === 1) {
      setOpenUniversities(new Set([universities[0].id]));
    }
  }, [universities]);

  // Only auto-open PARENT nodes when a child is selected externally.
  // Never re-open a node that the click handler may have just collapsed.
  useEffect(() => {
    if (selected.type === 'program') {
      const uni = universities.find((u) => u.children.some((p) => p.id === selected.id));
      if (uni) setOpenUniversities((s) => new Set([...s, uni.id]));
      // do NOT auto-expand the program itself — the click row handler toggles it
    }
    if (selected.type === 'course') {
      for (const uni of universities) {
        for (const prog of uni.children) {
          if (prog.children.some((c) => c.id === selected.id)) {
            setOpenUniversities((s) => new Set([...s, uni.id]));
            setOpenPrograms((s) => new Set([...s, prog.id]));
          }
        }
      }
    }
  }, [selected, universities]);

  function toggleUni(id: string) {
    setOpenUniversities((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleProg(id: string) {
    setOpenPrograms((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function isActive(node: SelectedNode): boolean {
    return JSON.stringify(node) === JSON.stringify(selected);
  }

  function rowClass(active: boolean) {
    return `flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left
      ${active ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/50 hover:text-white hover:bg-white/6'}`;
  }

  return (
    <div className="flex flex-col gap-1 py-3 px-2">
      {/* All */}
      <button className={rowClass(isActive({ type: 'all' }))} onClick={() => onSelect({ type: 'all' })}>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        All documents
        <CountBadge n={documents.length} />
      </button>

      {/* Universities */}
      {universities.map((uni) => (
        <div key={uni.id}>
          {/* University row — click selects + toggles expand */}
          <button
            className={`${rowClass(isActive({ type: 'university', id: uni.id }))} justify-between`}
            onClick={() => { onSelect({ type: 'university', id: uni.id }); toggleUni(uni.id); }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
              <span className="truncate">{uni.name}</span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0 ml-1">
              <CountBadge n={uni.count} />
              <ChevronIcon className="w-3 h-3 text-white/30" open={openUniversities.has(uni.id)} />
            </span>
          </button>

          {/* Degree programmes */}
          {openUniversities.has(uni.id) && (
            <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
              {uni.children.map((prog) => (
                <div key={prog.id}>
                  {/* Program row — click selects + toggles expand if has courses */}
                  <button
                    className={`${rowClass(isActive({ type: 'program', id: prog.id }))} justify-between`}
                    onClick={() => { onSelect({ type: 'program', id: prog.id }); if (prog.children.length > 0) toggleProg(prog.id); }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <svg className="w-3 h-3 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                      </svg>
                      <span className="truncate">{prog.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 ml-1">
                      <CountBadge n={prog.count} />
                      {prog.children.length > 0 && (
                        <ChevronIcon className="w-3 h-3 text-white/30" open={openPrograms.has(prog.id)} />
                      )}
                    </span>
                  </button>

                  {/* Courses */}
                  {openPrograms.has(prog.id) && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
                      {prog.children.map((course) => (
                        <button
                          key={course.id}
                          className={rowClass(isActive({ type: 'course', id: course.id }))}
                          onClick={() => onSelect({ type: 'course', id: course.id })}
                        >
                          <svg className="w-3 h-3 shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="truncate">{course.name}</span>
                          <CountBadge n={course.count} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Independent */}
      {independentCount > 0 && (
        <>
          <div className="mx-3 my-1 border-t border-white/8" />
          <button
            className={rowClass(isActive({ type: 'independent' }))}
            onClick={() => onSelect({ type: 'independent' })}
          >
            <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            Independent
            <CountBadge n={independentCount} />
          </button>
        </>
      )}
    </div>
  );
}

// ── My University tab ─────────────────────────────────────────────────────────

function MyUniversityTab({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [data, setData] = useState<MyUniversityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/my-university');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
        const json = await res.json() as MyUniversityData;
        setData(json);

        // Auto-expand the user's current year, or year 1 if not set
        if (json.program && json.years.length > 0) {
          const defaultYear = json.profile_year ?? json.years[0].year;
          setOpenYears(new Set([defaultYear]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function toggleYear(year: number) {
    setOpenYears((s) => {
      const n = new Set(s);
      n.has(year) ? n.delete(year) : n.add(year);
      return n;
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        <div className="h-8 w-72 bg-white/6 rounded-xl animate-pulse" />
        <div className="h-4 w-48 bg-white/4 rounded animate-pulse" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/4 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-center px-6">
        <div className="space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-white/50 hover:text-white underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No program set — show prompt
  if (!data?.program) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25 mb-6">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Set your university</h2>
        <p className="text-white/50 text-sm mb-8 max-w-sm">
          Personalise My Studies with your curriculum. See every course in your degree and find notes from your peers.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/settings')}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
          >
            Go to Settings
          </button>
          <button
            onClick={() => onNavigate('/onboarding?step=university')}
            className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white text-sm font-medium border border-white/15 hover:border-white/25 transition-colors"
          >
            Set it now
          </button>
        </div>
      </div>
    );
  }

  const { program, profile_year, years } = data;
  const uniName = program.university?.name ?? 'University';
  const uniSlug = program.university?.slug ?? '';

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
            <span className="text-xs text-indigo-400 font-medium">{uniName}</span>
            {program.tipo && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-xs text-white/40">{program.tipo}</span>
              </>
            )}
          </div>
          <h2 className="text-lg font-semibold text-white">{program.title}</h2>
          {profile_year && (
            <p className="text-xs text-white/40 mt-0.5">Year {profile_year}</p>
          )}
        </div>
        <button
          onClick={() => onNavigate('/settings')}
          className="shrink-0 text-[11px] text-white/40 hover:text-white/70 transition-colors underline"
        >
          Change degree
        </button>
      </div>

      {/* Year sections */}
      <div className="space-y-3">
        {years.map(({ year, courses }) => {
          const isOpen = openYears.has(year);
          const isCurrentYear = year === profile_year;
          const totalDocs = courses.reduce((sum, c) => sum + c.document_count, 0);

          return (
            <div
              key={year}
              className="bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl overflow-hidden"
            >
              {/* Year header */}
              <button
                onClick={() => toggleYear(year)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white">Year {year}</span>
                  {isCurrentYear && (
                    <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-400/25 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white/30">
                    {courses.length} course{courses.length !== 1 ? 's' : ''}
                    {totalDocs > 0 && ` · ${totalDocs} note${totalDocs !== 1 ? 's' : ''}`}
                  </span>
                  <ChevronIcon className="w-4 h-4 text-white/40" open={isOpen} />
                </div>
              </button>

              {/* Courses list */}
              {isOpen && (
                <div className="border-t border-white/8">
                  {courses.map((course, idx) => {
                    const hasNotes = course.document_count > 0;
                    const semesterLabel = course.semester_label ?? (course.semester ? `S${course.semester}` : null);

                    return (
                      <div
                        key={course.id}
                        className={`flex items-center gap-4 px-5 py-3.5 transition-colors
                          ${idx < courses.length - 1 ? 'border-b border-white/6' : ''}
                          ${hasNotes ? 'cursor-pointer hover:bg-white/5 group' : 'opacity-70'}`}
                        onClick={() => {
                          if (hasNotes && uniSlug) {
                            onNavigate(`/explore/${uniSlug}/${course.id}`);
                          }
                        }}
                        role={hasNotes ? 'button' : undefined}
                        tabIndex={hasNotes ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (hasNotes && (e.key === 'Enter' || e.key === ' ') && uniSlug) {
                            onNavigate(`/explore/${uniSlug}/${course.id}`);
                          }
                        }}
                      >
                        {/* Course name */}
                        <span className={`flex-1 text-sm min-w-0 truncate transition-colors
                          ${hasNotes ? 'text-white group-hover:text-indigo-300' : 'text-white/60'}`}>
                          {course.name}
                        </span>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {semesterLabel && (
                            <span className="text-[10px] text-white/40 bg-white/6 border border-white/10 rounded-full px-2 py-0.5">
                              {semesterLabel}
                            </span>
                          )}
                          {course.ects && (
                            <span className="text-[10px] text-white/40 bg-white/6 border border-white/10 rounded-full px-2 py-0.5">
                              {course.ects} ECTS
                            </span>
                          )}
                          {course.tipo && (
                            <span className="text-[10px] text-white/30 hidden sm:inline">
                              {course.tipo}
                            </span>
                          )}
                          {/* Document count pill */}
                          {hasNotes ? (
                            <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-400/25 rounded-full px-2.5 py-0.5">
                              {course.document_count} note{course.document_count !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/25 bg-white/4 border border-white/8 rounded-full px-2.5 py-0.5">
                              No notes yet
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

type ActiveTab = 'mine' | 'community';

function TabSwitcher({ active, onChange }: { active: ActiveTab; onChange: (tab: ActiveTab) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/6 border border-white/10 rounded-xl p-1">
      {(['mine', 'community'] as ActiveTab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
            ${active === tab
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-white/50 hover:text-white/80'
            }`}
        >
          {tab === 'mine' ? 'My University' : 'Community'}
        </button>
      ))}
    </div>
  );
}

// ── Community tab (original My Studies content) ───────────────────────────────

function CommunityTab() {
  const router = useRouter();
  const [documents, setDocuments] = useState<PublishedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedNode>({ type: 'all' });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/documents/published');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
        const data = await res.json();
        setDocuments(data.documents ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filteredDocs = useMemo(() => {
    if (selected.type === 'all') return documents;
    if (selected.type === 'university') return documents.filter((d) => d.university_id === selected.id);
    if (selected.type === 'program') return documents.filter((d) => d.program_id === selected.id);
    if (selected.type === 'course') return documents.filter((d) => d.course_id === selected.id);
    if (selected.type === 'independent') return documents.filter((d) => !d.university_id);
    return documents;
  }, [documents, selected]);

  const sectionLabel = useMemo(() => {
    if (selected.type === 'all') return 'All documents';
    if (selected.type === 'independent') return 'Independent';
    const doc = documents.find((d) =>
      selected.type === 'university' ? d.university_id === selected.id :
      selected.type === 'program'    ? d.program_id    === selected.id :
                                       d.course_id     === selected.id
    );
    if (!doc) return 'Documents';
    if (selected.type === 'university') return doc.university ?? 'University';
    if (selected.type === 'program')    return doc.degree    ?? 'Degree';
    if (selected.type === 'course')     return doc.subject   ?? 'Course';
    return 'Documents';
  }, [selected, documents]);

  const handleLikeToggle = useCallback(async (documentId: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? { ...doc, user_liked: !doc.user_liked, like_count: doc.user_liked ? doc.like_count - 1 : doc.like_count + 1 }
          : doc
      )
    );
    try {
      const res = await fetch(`/api/documents/${documentId}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setDocuments((prev) =>
        prev.map((doc) => doc.id === documentId ? { ...doc, user_liked: data.liked, like_count: data.like_count } : doc)
      );
    } catch (err) {
      console.error('[Like toggle failed]', err);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, user_liked: !doc.user_liked, like_count: doc.user_liked ? doc.like_count - 1 : doc.like_count + 1 }
            : doc
        )
      );
    }
  }, []);

  const handleFork = useCallback(async (documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/fork`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.push(`/documents/${data.document_id}`);
    } catch (err) {
      console.error('[Fork failed]', err);
    }
  }, [router]);

  const handleOpen = useCallback(async (doc: PublishedDocument) => {
    router.push(`/documents/${doc.id}`);
    fetch(`/api/documents/${doc.id}/view`, { method: 'POST' }).catch(() => {});
  }, [router]);

  const handleAuthorClick = useCallback((userId: string) => {
    router.push(`/profile/${userId}`);
  }, [router]);

  const hasSidebar = !isLoading && !error && documents.length > 0;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* Tree sidebar */}
      {hasSidebar && (
        <>
          {/* Desktop sidebar */}
          <div className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/10 overflow-y-auto">
            <TreeSidebar documents={documents} selected={selected} onSelect={setSelected} />
          </div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="md:hidden fixed inset-0 z-40 flex">
              <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
              <div className="relative w-72 bg-neutral-950 border-r border-white/15 overflow-y-auto z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-sm font-medium text-white">Filter</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <TreeSidebar
                  documents={documents}
                  selected={selected}
                  onSelect={(node) => { setSelected(node); setSidebarOpen(false); }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile filter button */}
        {hasSidebar && (
          <div className="md:hidden px-6 pt-4">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              Filter
            </button>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-5 h-44" />
              ))}
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex items-center justify-center py-20 text-center">
              <div className="space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={() => window.location.reload()} className="text-xs text-white/50 hover:text-white underline">Try again</button>
              </div>
            </div>
          )}

          {/* Empty state — no published docs at all */}
          {!isLoading && !error && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-pink-500/15 border border-pink-500/25 mb-6">
                <svg className="w-7 h-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No public notes yet</h2>
              <p className="text-white/50 text-sm mb-6 max-w-sm">
                Be the first — open any document, click <span className="text-indigo-400 font-medium">Publish</span>, and set visibility to <span className="text-indigo-400 font-medium">Public</span>.
              </p>
              <button
                onClick={() => router.push('/documents')}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
              >
                Browse my documents
              </button>
            </div>
          )}

          {/* Section header + grid */}
          {!isLoading && !error && documents.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-white">{sectionLabel}</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {/* Community button — visible when a course is selected */}
                {selected.type === 'course' && (() => {
                  const ref = documents.find((d) => d.course_id === selected.id);
                  if (!ref?.university_slug || !ref?.program_slug) return null;
                  const href = `/explore/${ref.university_slug}/${ref.program_slug}/${selected.id}`;
                  return (
                    <button
                      onClick={() => router.push(href)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                        bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/25
                        hover:border-indigo-400/40 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      Community notes
                    </button>
                  );
                })()}
              </div>

              {/* Empty filtered state */}
              {filteredDocs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-white/30 text-sm">No documents in this section yet.</p>
                  <button
                    onClick={() => router.push('/documents')}
                    className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Go publish a document
                  </button>
                </div>
              )}

              {/* Grid */}
              {filteredDocs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      onOpen={() => handleOpen(doc)}
                      onLikeToggle={handleLikeToggle}
                      onFork={handleFork}
                      onAuthorClick={handleAuthorClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inner page (reads URL params, must be inside Suspense) ────────────────────

function MyStudiesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab');
  const activeTab: ActiveTab = tabParam === 'community' ? 'community' : 'mine';

  function handleTabChange(tab: ActiveTab) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', tab);
    router.push(`/my-studies?${params.toString()}`);
  }

  function handleNavigate(href: string) {
    router.push(href);
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Studies</h1>
        </div>
        <TabSwitcher active={activeTab} onChange={handleTabChange} />
      </div>

      {/* Tab panels */}
      {activeTab === 'mine' ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <MyUniversityTab onNavigate={handleNavigate} />
        </div>
      ) : (
        <CommunityTab />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyStudiesPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex flex-col bg-transparent text-white overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 shrink-0">
          <h1 className="text-xl font-semibold">My Studies</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    }>
      <MyStudiesInner />
    </Suspense>
  );
}
