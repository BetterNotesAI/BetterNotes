'use client';

import { useEffect, useRef, useState } from 'react';

type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'template';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc',  label: 'Oldest first' },
  { value: 'title_asc', label: 'A → Z' },
  { value: 'template',  label: 'By template' },
];

interface DocumentFiltersProps {
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  filterStarred: boolean;
  setFilterStarred: (value: boolean) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
}

export function DocumentFilters({
  sortBy,
  setSortBy,
  filterStarred,
  setFilterStarred,
  showArchived,
  setShowArchived,
}: DocumentFiltersProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const currentLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur">

      {/* Custom sort dropdown */}
      <div ref={sortRef} className="relative">
        <button
          onClick={() => setSortOpen(o => !o)}
          className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/25
            text-indigo-200/80 text-xs font-medium rounded-xl pl-3 pr-2.5 py-1.5 transition-colors"
        >
          {currentLabel}
          <svg
            className={`w-3 h-3 text-indigo-300/50 transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {sortOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 min-w-[130px] rounded-xl border border-white/15
            bg-neutral-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 overflow-hidden">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                className={`flex items-center w-full px-3 py-1.5 text-xs transition-colors ${
                  sortBy === opt.value
                    ? 'text-indigo-300 bg-indigo-500/15'
                    : 'text-white/70 hover:text-white hover:bg-white/8'
                }`}
              >
                {sortBy === opt.value && (
                  <svg className="w-3 h-3 mr-1.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {sortBy !== opt.value && <span className="w-3 mr-1.5 shrink-0" />}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Starred toggle */}
      <button
        onClick={() => setFilterStarred(!filterStarred)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
          filterStarred
            ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-300'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-indigo-200/80'
        }`}
        aria-pressed={filterStarred}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill={filterStarred ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={filterStarred ? 0 : 1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        Starred only
      </button>

      {/* Show archived toggle */}
      <button
        onClick={() => setShowArchived(!showArchived)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
          showArchived
            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-indigo-200/80'
        }`}
        aria-pressed={showArchived}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        Show archived
      </button>

      {/* Clear filters */}
      {(filterStarred || showArchived) && (
        <button
          onClick={() => { setFilterStarred(false); setShowArchived(false); }}
          className="text-xs text-indigo-400/60 hover:text-indigo-300 transition-colors ml-1 underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
