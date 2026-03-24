'use client';

export default function ProblemSolverPage() {
  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Problem Solver</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-500/15 border border-orange-500/25 mb-6">
              <svg
                className="w-7 h-7 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.98 14.98 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-white mb-2">Problem Solver</h2>
            <p className="text-white/55 text-sm mb-4 max-w-sm">
              Proximamente — resuelve problemas paso a paso con ayuda de IA, y genera
              hojas de practica personalizadas.
            </p>

            {/* Coming soon badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400/70" />
              Proximamente
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
