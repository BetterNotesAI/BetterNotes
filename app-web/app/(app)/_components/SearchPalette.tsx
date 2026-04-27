'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { DocumentResult, ProgramResult, CourseResult } from '@/app/api/search/route';
import { useTranslation } from '@/lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

type ResultItem =
  | { kind: 'document'; data: DocumentResult }
  | { kind: 'program';  data: ProgramResult }
  | { kind: 'course';   data: CourseResult };

interface SearchResults {
  documents: DocumentResult[];
  programs:  ProgramResult[];
  courses:   CourseResult[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function GradCapIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchPalette() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);

  const debouncedQuery = useDebounce(query, 200);

  // ── Open / close ────────────────────────────────────────────────────────────

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setResults(null);
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);

  // Listen for custom event from Sidebar
  useEffect(() => {
    mounted.current = true;
    function onOpen() { openPalette(); }
    window.addEventListener('open-search-palette', onOpen);
    return () => window.removeEventListener('open-search-palette', onOpen);
  }, [openPalette]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) { closePalette(); } else { openPalette(); }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openPalette, closePalette]);

  // ── Search ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=4`)
      .then(r => r.ok ? r.json() : null)
      .then((data: SearchResults | null) => {
        if (cancelled) return;
        setResults(data);
        setActiveIndex(0);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, open]);

  // ── Flatten results for keyboard navigation ──────────────────────────────────

  const flatItems: ResultItem[] = [];
  if (results) {
    for (const d of results.documents) flatItems.push({ kind: 'document', data: d });
    for (const p of results.programs)  flatItems.push({ kind: 'program',  data: p });
    for (const c of results.courses)   flatItems.push({ kind: 'course',   data: c });
  }

  // ── Navigate to item ────────────────────────────────────────────────────────

  function navigateTo(item: ResultItem) {
    closePalette();
    if (item.kind === 'document') {
      router.push(`/documents/${item.data.id}`);
    } else if (item.kind === 'program') {
      router.push(`/my-studies?tab=community`);
    } else {
      router.push(`/my-studies?tab=community`);
    }
  }

  function openFullSearch() {
    closePalette();
    const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    router.push(`/search${qs}`);
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems.length > 0) {
        navigateTo(flatItems[activeIndex] ?? flatItems[0]);
      } else if (query.trim().length >= 2) {
        openFullSearch();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const totalResults = flatItems.length;
  const hasQuery = query.length >= 2;
  const noResults = hasQuery && !loading && results !== null && totalResults === 0;

  let globalIdx = 0;

  function renderDocumentItem(doc: DocumentResult) {
    const idx = globalIdx++;
    const active = idx === activeIndex;
    return (
      <button
        key={doc.id}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigateTo({ kind: 'document', data: doc })}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
          active ? 'bg-white/10' : 'hover:bg-white/6'
        }`}
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-300/20 flex items-center justify-center text-indigo-300/80">
          <DocumentIcon />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 truncate">{doc.title}</p>
          <p className="text-xs text-white/40 truncate">
            {[doc.university, doc.degree].filter(Boolean).join(' · ') || 'Document'}
          </p>
        </div>
        {active && (
          <kbd className="shrink-0 text-[10px] text-white/30 bg-white/8 px-1.5 py-0.5 rounded font-mono">
            Enter
          </kbd>
        )}
      </button>
    );
  }

  function renderProgramItem(prog: ProgramResult) {
    const idx = globalIdx++;
    const active = idx === activeIndex;
    return (
      <button
        key={prog.id}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigateTo({ kind: 'program', data: prog })}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
          active ? 'bg-white/10' : 'hover:bg-white/6'
        }`}
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-300/20 flex items-center justify-center text-teal-300/80">
          <GradCapIcon />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 truncate">{prog.title}</p>
          <p className="text-xs text-white/40 truncate">{prog.university_name} · {prog.tipo}</p>
        </div>
        {active && (
          <kbd className="shrink-0 text-[10px] text-white/30 bg-white/8 px-1.5 py-0.5 rounded font-mono">
            Enter
          </kbd>
        )}
      </button>
    );
  }

  function renderCourseItem(course: CourseResult) {
    const idx = globalIdx++;
    const active = idx === activeIndex;
    return (
      <button
        key={course.id}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigateTo({ kind: 'course', data: course })}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
          active ? 'bg-white/10' : 'hover:bg-white/6'
        }`}
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-300/20 flex items-center justify-center text-violet-300/80">
          <BookIcon />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 truncate">{course.name}</p>
          <p className="text-xs text-white/40 truncate">
            {course.program_title} · Y{course.year}
            {course.semester_label ? ` · ${course.semester_label}` : ''}
          </p>
        </div>
        {active && (
          <kbd className="shrink-0 text-[10px] text-white/30 bg-white/8 px-1.5 py-0.5 rounded font-mono">
            Enter
          </kbd>
        )}
      </button>
    );
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('search.closeSearch')}
        onClick={closePalette}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.ariaLabel')}
        className="relative z-10 w-full max-w-xl bg-neutral-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="shrink-0 text-white/40">
            {loading ? <SpinnerIcon /> : <SearchIcon />}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="shrink-0 text-white/35 hover:text-white/70 transition-colors text-xs"
              aria-label={t('search.clearSearch')}
            >
              {t('search.clearSearch')}
            </button>
          )}
          <kbd className="shrink-0 text-[10px] text-white/25 bg-white/6 px-1.5 py-0.5 rounded font-mono hidden sm:block">
            Esc
          </kbd>
        </div>

        {/* Results body */}
        <div className="max-h-[420px] overflow-y-auto p-2">
          {/* Empty / prompt state */}
          {!hasQuery && (
            <div className="py-8 text-center text-sm text-white/35">
              {t('search.empty')}
            </div>
          )}

          {/* Loading skeleton */}
          {hasQuery && loading && (
            <div className="space-y-1.5 p-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-white/6 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/6 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-white/4 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="py-8 text-center">
              <p className="text-sm text-white/40">{t('search.noResults', { query })}</p>
              <p className="text-xs text-white/25 mt-1">{t('search.noResultsHint')}</p>
            </div>
          )}

          {/* Results sections */}
          {!loading && results && totalResults > 0 && (
            <div className="space-y-1">
              {results.documents.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    {t('search.sectionDocuments')}
                  </p>
                  {results.documents.map(d => renderDocumentItem(d))}
                </div>
              )}

              {results.programs.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    {t('search.sectionDegrees')}
                  </p>
                  {results.programs.map(p => renderProgramItem(p))}
                </div>
              )}

              {results.courses.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    {t('search.sectionCourses')}
                  </p>
                  {results.courses.map(c => renderCourseItem(c))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasQuery && (
          <div className="border-t border-white/8 px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] text-white/30">
              {totalResults > 0
                ? t(totalResults !== 1 ? 'search.resultsPlural' : 'search.results', { count: totalResults })
                : loading ? t('search.searching') : ''}
            </span>
            <button
              onClick={openFullSearch}
              className="text-[11px] text-indigo-300/70 hover:text-indigo-200 transition-colors"
            >
              {t('search.viewAll')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
