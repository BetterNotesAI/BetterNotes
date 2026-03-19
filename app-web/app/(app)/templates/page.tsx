import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Templates' }

export default function TemplatesPage() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="rounded-2xl border border-white/20 bg-white/10 p-10 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-white mb-2">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-transparent">
            Templates
          </span>
        </h1>

        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Template gallery coming soon — for now, create a new document to choose your template.
        </p>

        <Link
          href="/documents"
          className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white/90 transition-colors"
        >
          New Document
        </Link>
      </div>
    </div>
  )
}
