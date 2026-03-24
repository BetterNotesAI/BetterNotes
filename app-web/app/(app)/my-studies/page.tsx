'use client';

export default function MyStudiesPage() {
  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">My Studies</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-pink-500/15 border border-pink-500/25 mb-6">
              <svg
                className="w-7 h-7 text-pink-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-white mb-2">My Studies</h2>
            <p className="text-white/55 text-sm mb-4 max-w-sm">
              Proximamente — visualiza tu progreso de estudio, estadisticas de
              actividad y todas tus materias organizadas en un dashboard personal.
            </p>

            {/* Coming soon badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400/70" />
              Proximamente
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
