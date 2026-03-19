import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Support' }

export default function SupportPage() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="rounded-2xl border border-white/20 bg-white/10 p-10 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-white mb-2">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
            Support
          </span>
        </h1>

        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Questions? Reach out and we&apos;ll get back to you.
        </p>

        <a
          href="mailto:hello@better-notes.ai"
          className="inline-block rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white/85 hover:bg-white/15 backdrop-blur transition-colors"
        >
          hello@better-notes.ai
        </a>
      </div>
    </div>
  )
}
