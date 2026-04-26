'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { DocumentResult, ProgramResult, CourseResult } from '@/app/api/search/route';

// ── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'documents' | 'programs' | 'courses';

interface SearchResults {
  documents: DocumentResult[];
  programs:  ProgramResult[];
  courses:   CourseResult[];
  query:     string;
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

function pluralise(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-5 h-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3v9m0 0a3 3 0 100 6 3 3 0 000-6zm9-9v3m0 0a3 3 0 100 6 3 3 0 000-6zm0 0v1.5M7.5 12h9" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-black/25 backdrop-blur-sm border border-white/10 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-white/8 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-1/2" />
      <div className="h-3 bg-white/5 rounded w-1/3" />
    </div>
  );
}

// ── Document card ────────────────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: DocumentResult }) {
  const initials = doc.author_name
    ? doc.author_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <Link
      href={`/documents/${doc.id}`}
      className="block bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl p-4 hover:border-white/25 hover:bg-white/5 transition-all group"
    >
      <h3 className="text-sm font-semibold text-white truncate mb-2 group-hover:text-indigo-200 transition-colors">
        {doc.title}
      </h3>

      {/* Author */}
      <div className="flex items-center gap-2 mb-3">
        {doc.author_avatar ? (
          <Image
            src={doc.author_avatar}
            alt={doc.author_name ?? 'Author'}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 border border-white/15 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-medium text-white/80">{initials}</span>
          </div>
        )}
        <span className="text-xs text-white/50 truncate">
          {doc.author_name ?? doc.author_username ?? 'Unknown'}
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {doc.university && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/12 border border-indigo-300/20 text-indigo-300/80">
            {doc.university}
          </span>
        )}
        {doc.degree && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-teal-500/12 border border-teal-300/20 text-teal-300/80">
            {doc.degree}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-white/35">
        <span className="flex items-center gap-1">
          <HeartIcon />
          {doc.like_count}
        </span>
        <span className="flex items-center gap-1">
          <EyeIcon />
          {doc.view_count}
        </span>
        <span className="flex items-center gap-1">
          <ForkIcon />
          {doc.fork_count}
        </span>
      </div>
    </Link>
  );
}

// ── Program card ─────────────────────────────────────────────────────────────

function ProgramCard({ prog }: { prog: ProgramResult }) {
  const tipoColors: Record<string, string> = {
    Grado:   'bg-sky-500/12 border-sky-300/20 text-sky-300/80',
    Máster:  'bg-violet-500/12 border-violet-300/20 text-violet-300/80',
  };
  const tipoClass = tipoColors[prog.tipo] ?? 'bg-white/8 border-white/15 text-white/60';

  return (
    <Link
      href="/my-studies?tab=community"
      className="block bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl p-4 hover:border-white/25 hover:bg-white/5 transition-all group"
    >
      <h3 className="text-sm font-semibold text-white truncate mb-2 group-hover:text-teal-200 transition-colors">
        {prog.title}
      </h3>
      <p className="text-xs text-white/50 mb-3 truncate">{prog.university_name}</p>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${tipoClass}`}>
        {prog.tipo}
      </span>
    </Link>
  );
}

// ── Course row ────────────────────────────────────────────────────────────────

function CourseRow({ course }: { course: CourseResult }) {
  return (
    <Link
      href="/my-studies?tab=community"
      className="flex items-center gap-4 px-4 py-3 bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl hover:border-white/25 hover:bg-white/5 transition-all group"
    >
      {/* Year badge */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-300/20 flex items-center justify-center">
        <span className="text-xs font-bold text-violet-300/80">Y{course.year}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 truncate group-hover:text-violet-200 transition-colors">
          {course.name}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">
          {course.program_title} · {course.university_name}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {course.semester_label && (
          <span className="hidden sm:block text-[11px] px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-white/50">
            {course.semester_label}
          </span>
        )}
        {course.ects != null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-white/50">
            {course.ects} ECTS
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-sm font-semibold text-white/80">{label}</h2>
      <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-white/50">
        {pluralise(count, 'result', 'results')}
      </span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') ?? '';

  const [query, setQuery] = useState(initialQ);
  const [filter, setFilter] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Push q to URL
  useEffect(() => {
    const qs = debouncedQuery.trim()
      ? `?q=${encodeURIComponent(debouncedQuery.trim())}`
      : '';
    router.replace(`/search${qs}`, { scroll: false });
  }, [debouncedQuery, router]);

  // Autofocus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ q, type: filter, limit: '12' });
    fetch(`/api/search?${params.toString()}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: SearchResults | null) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => { if (!cancelled) setResults(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery, filter]);

  const hasQuery = query.trim().length >= 2;
  const totalCount = results
    ? results.documents.length + results.programs.length + results.courses.length
    : 0;
  const noResults = hasQuery && !loading && results !== null && totalCount === 0;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'documents', label: 'Documents' },
    { key: 'programs',  label: 'Degrees' },
    { key: 'courses',   label: 'Courses' },
  ];

  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
    setResults(null);
  }, []);

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Search</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Search bar */}
          <div className="relative mb-5">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/40">
              {loading ? <SpinnerIcon /> : <SearchIcon />}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search documents, degrees, courses..."
              className="w-full bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-3 flex items-center px-1 text-white/35 hover:text-white/70 transition-colors text-xs"
                aria-label="Clear"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-7">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f.key
                    ? 'bg-indigo-500/25 border border-indigo-300/40 text-indigo-200'
                    : 'bg-white/6 border border-white/12 text-white/55 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-teal-500/15 border border-teal-500/25 mb-6">
                <SearchIcon className="w-7 h-7 text-teal-400" />
              </div>
              <p className="text-white/45 text-sm max-w-xs">
                Start typing to search across BetterNotes — documents, degree programmes, and courses.
              </p>
              <p className="text-white/25 text-xs mt-3">
                Tip: use <kbd className="font-mono px-1.5 py-0.5 bg-white/8 border border-white/12 rounded text-[10px]">Cmd K</kbd> to open search from anywhere.
              </p>
            </div>
          )}

          {/* Loading skeletons */}
          {hasQuery && loading && (
            <div className="space-y-8">
              <div>
                <div className="h-4 bg-white/6 rounded w-24 mb-3 animate-pulse" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                </div>
              </div>
              <div>
                <div className="h-4 bg-white/6 rounded w-20 mb-3 animate-pulse" />
                <div className="space-y-2">
                  {[1, 2].map(i => <SkeletonCard key={i} />)}
                </div>
              </div>
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/6 border border-white/10 mb-4">
                <SearchIcon className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-sm text-white/50">
                No results for &quot;{query.trim()}&quot;
              </p>
              <p className="text-xs text-white/30 mt-1">
                Try different keywords or a broader search.
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && results && totalCount > 0 && (
            <div className="space-y-10">

              {/* Documents */}
              {results.documents.length > 0 && (
                <section>
                  <SectionHeader label="Documents" count={results.documents.length} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {results.documents.map(d => (
                      <DocumentCard key={d.id} doc={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* Degree programmes */}
              {results.programs.length > 0 && (
                <section>
                  <SectionHeader label="Degrees" count={results.programs.length} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {results.programs.map(p => (
                      <ProgramCard key={p.id} prog={p} />
                    ))}
                  </div>
                </section>
              )}

              {/* Courses */}
              {results.courses.length > 0 && (
                <section>
                  <SectionHeader label="Courses" count={results.courses.length} />
                  <div className="space-y-2">
                    {results.courses.map(c => (
                      <CourseRow key={c.id} course={c} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
