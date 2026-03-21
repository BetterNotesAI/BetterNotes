import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import Background from './components/Background'
import { LandingInteractive } from './components/LandingInteractive'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="relative min-h-screen text-white">
      {/* Background behind everything */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Background />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto max-w-6xl px-4 py-5 flex items-center">
        <div className="flex-1 flex items-center gap-2.5">
          <Image
            src="/brand/logo.png"
            alt="BetterNotes"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="font-semibold tracking-tight text-sm">BetterNotes</span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <Link href="/login" className="hover:text-white transition-colors">Workspace</Link>
          <Link href="/login" className="hover:text-white transition-colors">Templates</Link>
          <Link href="/login" className="hover:text-white transition-colors">Pricing</Link>
        </nav>

        <div className="flex-1 flex items-center justify-end gap-2">
          <Link
            href="/login"
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/15 backdrop-blur transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 pt-16 pb-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          AI-powered LaTeX documents
        </div>

        {/* H1 */}
        <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight">
          Turn messy notes into{' '}
          <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-400 bg-clip-text text-transparent">
            clean LaTeX
          </span>{' '}
          + PDF
        </h1>

        <p className="mt-4 text-base text-white/70 max-w-xl mx-auto">
          Choose a template, describe your content, and get a print-ready academic PDF in seconds — powered by AI.
        </p>

        <LandingInteractive />
      </section>

      {/* Features / Steps */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white">How it works</h2>
          <p className="text-sm text-white/65 mt-1">Three steps to a polished document</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Choose a template & set up',
              desc: 'Pick from 10+ academic templates, attach PDFs or images as context, and optionally tune pages, density, and language.',
              color: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
            },
            {
              step: '02',
              title: 'Describe your content',
              desc: 'Tell the AI what to write. Paste your notes, topics, or formulas — it handles the LaTeX.',
              color: 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-400',
            },
            {
              step: '03',
              title: 'Download your PDF',
              desc: 'Get a print-ready PDF with proper typesetting. Refine it with follow-up chat.',
              color: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
            },
          ].map(({ step, title, desc, color }) => (
            <div
              key={step}
              className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)]"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-bold mb-4 ${color}`}>
                {step}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-white/65">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-xl px-4 pb-20 text-center">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-10 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.35)]">
          <h2 className="text-2xl font-semibold text-white mb-2">Ready to study smarter?</h2>
          <p className="text-sm text-white/65 mb-6">Free to start. No credit card required.</p>
          <Link
            href="/signup"
            className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-white/90 transition-colors"
          >
            Create your first document
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-white/50">
        © {new Date().getFullYear()} BetterNotes
      </footer>
    </main>
  )
}
