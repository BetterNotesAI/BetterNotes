'use client';

type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'template';

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
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-white/10 bg-black/20 backdrop-blur">
      {/* Sort select */}
      <div className="relative">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="appearance-none bg-white/8 hover:bg-white/12 border border-white/15 text-white/80
            text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 outline-none cursor-pointer
            focus:border-white/30 focus:bg-white/12 transition-colors"
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="title_asc">A &#8594; Z</option>
          <option value="template">By template</option>
        </select>
        {/* Chevron icon */}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Starred toggle */}
      <button
        onClick={() => setFilterStarred(!filterStarred)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border
          transition-colors ${
            filterStarred
              ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-300'
              : 'bg-white/8 border-white/15 text-white/60 hover:bg-white/12 hover:text-white/80'
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
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border
          transition-colors ${
            showArchived
              ? 'bg-white/15 border-white/30 text-white'
              : 'bg-white/8 border-white/15 text-white/60 hover:bg-white/12 hover:text-white/80'
          }`}
        aria-pressed={showArchived}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        Show archived
      </button>

      {/* Active filters summary */}
      {(filterStarred || showArchived) && (
        <button
          onClick={() => {
            setFilterStarred(false);
            setShowArchived(false);
          }}
          className="text-xs text-white/40 hover:text-white/60 transition-colors ml-1 underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
