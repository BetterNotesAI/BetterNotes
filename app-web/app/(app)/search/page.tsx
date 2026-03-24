'use client';

export default function SearchPage() {
  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Search</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-teal-500/15 border border-teal-500/25 mb-6">
              <svg
                className="w-7 h-7 text-teal-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-white mb-2">Search</h2>
            <p className="text-white/55 text-sm mb-4 max-w-sm">
              Coming soon — search across all your documents and notes with
              AI-powered semantic search.
            </p>

            {/* Coming soon badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/70" />
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
