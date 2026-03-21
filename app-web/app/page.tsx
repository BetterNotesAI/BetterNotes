import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import Background from './components/Background'
import { LandingCreationBar } from './components/LandingCreationBar'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/documents')

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

        {/* Creation bar */}
        <div className="mt-8 max-w-3xl mx-auto">
          <LandingCreationBar />
        </div>

        {/* Secondary CTA */}
        <p className="mt-4 text-xs text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
            Sign in
          </Link>
        </p>
      </section>

      {/* Recommended Templates */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-2">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white">Popular templates</h2>
          <p className="text-sm text-white/65 mt-1">Start with a proven layout, customized by AI for your content</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* 2-Col Cheat Sheet */}
          <Link href="/signup" className="group rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] backdrop-blur p-4 transition-all hover:border-white/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] block">
            <div className="aspect-[4/3] rounded-xl mb-3 overflow-hidden border border-white/8 group-hover:border-white/15 transition-colors"
              style={{ background: 'linear-gradient(135deg, #6366f112, transparent)' }}>
              <div className="w-full h-full p-3 group-hover:scale-[1.02] transition-transform duration-300">
                <LandingTwoColSchematic />
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-white/90">2-Column Cheat Sheet</span>
              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#6366f122', color: '#6366f1' }}>Notes</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">Compact portrait layout with 2 columns for formulas, definitions and key results. Perfect for exam prep.</p>
            <p className="mt-2.5 text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">Use template →</p>
          </Link>

          {/* 3-Col Landscape */}
          <Link href="/signup" className="group rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] backdrop-blur p-4 transition-all hover:border-white/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] block">
            <div className="aspect-[4/3] rounded-xl mb-3 overflow-hidden border border-white/8 group-hover:border-white/15 transition-colors"
              style={{ background: 'linear-gradient(135deg, #8b5cf612, transparent)' }}>
              <div className="w-full h-full p-3 group-hover:scale-[1.02] transition-transform duration-300">
                <LandingThreeColSchematic />
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-white/90">3-Column Landscape</span>
              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#8b5cf622', color: '#8b5cf6' }}>Notes</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">A4 landscape with 3 dense columns — ideal for math reference sheets and formula summaries.</p>
            <p className="mt-2.5 text-xs text-violet-400 group-hover:text-violet-300 transition-colors">Use template →</p>
          </Link>

          {/* Lecture Notes */}
          <Link href="/signup" className="group rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] backdrop-blur p-4 transition-all hover:border-white/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] block">
            <div className="aspect-[4/3] rounded-xl mb-3 overflow-hidden border border-white/8 group-hover:border-white/15 transition-colors"
              style={{ background: 'linear-gradient(135deg, #3b82f612, transparent)' }}>
              <div className="w-full h-full p-3 group-hover:scale-[1.02] transition-transform duration-300">
                <LandingLectureSchematic />
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-white/90">Lecture Notes</span>
              <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#3b82f622', color: '#3b82f6' }}>Notes</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">Multi-page structured notes with objectives, sections, examples and a summary box. Great for long lectures.</p>
            <p className="mt-2.5 text-xs text-blue-400 group-hover:text-blue-300 transition-colors">Use template →</p>
          </Link>
        </div>

        <p className="text-center mt-6 text-xs text-white/40">
          And{' '}
          <Link href="/signup" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
            7 more templates
          </Link>
          {' '}including Cornell Notes, Lab Reports, Academic Papers and more.
        </p>
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

/* ── Landing schematic previews (server-safe, no hooks) ── */

function SLn({ w, bold }: { w: number; bold?: boolean }) {
  return (
    <div
      className={`h-[2px] rounded-full mb-[3px] ${bold ? 'bg-white/35' : 'bg-white/15'}`}
      style={{ width: `${w}%` }}
    />
  );
}

function SBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-white/20 rounded p-1 mb-1">{children}</div>;
}

function SImg() {
  return (
    <div className="rounded bg-white/10 border border-white/15 mb-[3px] flex items-center justify-center" style={{ width: '85%', height: '18px' }}>
      <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    </div>
  );
}

function LandingTwoColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={55} bold />
      <div className="flex-1 flex gap-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={70} bold />
            <SLn w={90} />
            <SLn w={75} />
            <SLn w={85} />
            <SBox><SLn w={80} bold /><SLn w={60} /></SBox>
            <SLn w={95} />
            <SLn w={70} />
            <SLn w={65} bold />
            <SLn w={88} />
            <SLn w={72} />
            <SBox><SLn w={75} bold /><SLn w={55} /><SLn w={65} /></SBox>
            <SLn w={90} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingThreeColSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={40} bold />
      <div className="flex-1 flex gap-1.5">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col">
            <SLn w={80} bold />
            <SLn w={90} />
            <SLn w={70} />
            <SLn w={85} />
            <SBox><SLn w={75} bold /><SLn w={60} /></SBox>
            <SLn w={95} />
            <SLn w={65} />
            <SLn w={88} />
            <SLn w={72} bold />
            <SLn w={90} />
            <SBox><SLn w={85} /><SLn w={55} /></SBox>
            <SLn w={75} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingLectureSchematic() {
  return (
    <div className="w-full h-full flex flex-col gap-1">
      <SLn w={55} bold />
      <SLn w={35} />
      <SBox><SLn w={40} bold /><SLn w={82} /><SLn w={75} /></SBox>
      <SLn w={48} bold />
      <SLn w={90} />
      <SLn w={78} />
      <SLn w={85} />
      <SImg />
      <SLn w={65} />
      <SLn w={52} bold />
      <SLn w={92} />
      <SLn w={72} />
      <SLn w={80} />
      <div className="border-t border-white/20 pt-1 mt-0.5">
        <SLn w={30} bold />
        <SLn w={88} />
        <SLn w={70} />
      </div>
    </div>
  );
}
