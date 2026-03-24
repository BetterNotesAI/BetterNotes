'use client';

export default function ExamsPage() {
  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Exams</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-yellow-500/15 border border-yellow-500/25 mb-6">
              <svg
                className="w-7 h-7 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 9h-1.5A3.375 3.375 0 007.875 12.375v1.5m4.125 4.875v-1.5m0 0h-4.5m4.5 0V15M3 9.375C3 8.339 3.84 7.5 4.875 7.5h14.25C20.16 7.5 21 8.34 21 9.375v7.5C21 17.909 20.16 18.75 19.125 18.75H4.875C3.839 18.75 3 17.91 3 16.875v-7.5z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-white mb-2">Exams</h2>
            <p className="text-white/55 text-sm mb-4 max-w-sm">
              Coming soon — generate practice exams from your notes and assess your
              level of preparation before each test.
            </p>

            {/* Coming soon badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
