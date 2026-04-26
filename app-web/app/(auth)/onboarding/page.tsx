'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Background from '@/app/components/Background'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface University {
  id: string
  name: string
  slug: string
  country: string
}

interface DegreeProgram {
  id: string
  tipo: string
  title: string
  slug: string
}

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------

const STEPS = ['terms', 'university', 'degree'] as const
type Step = typeof STEPS[number]

function ProgressDots({ currentStep }: { currentStep: Step }) {
  const idx = STEPS.indexOf(currentStep)
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`rounded-full transition-all ${
            i <= idx
              ? 'w-2.5 h-2.5 bg-indigo-400'
              : 'w-2 h-2 bg-white/20'
          }`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Terms
// ---------------------------------------------------------------------------

function TermsStep({ onComplete }: { onComplete: () => void }) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!accepted) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms_accepted_at: new Date().toISOString(),
          terms_version: '2026-04-26',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onComplete()
    } catch {
      setError('Something went wrong. You can skip and accept later.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">Before you continue</h1>
        <p className="text-sm text-white/60">
          By using BetterNotes you agree to our Terms of Use and Privacy Policy. You are solely
          responsible for any content you upload or generate.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        <ul className="space-y-2">
          {[
            'You retain ownership of your content but grant BetterNotes a license to process it',
            'AI-generated output may be inaccurate — always review before using academically',
            'You must not upload copyrighted content you don’t have rights to',
            'You are responsible for compliance with your institution’s academic integrity rules',
          ].map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-white/70">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-4 h-4 rounded border transition-colors ${
              accepted
                ? 'bg-indigo-500 border-indigo-500'
                : 'bg-black/20 border-white/30 group-hover:border-white/50'
            }`}
          >
            {accepted && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-white/60 leading-relaxed">
          I have read and agree to the{' '}
          <a
            href="/support/terms-of-use"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Terms of Use
          </a>
          {' '}and{' '}
          <a
            href="/support/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </a>
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <button
        onClick={handleContinue}
        disabled={!accepted || loading}
        className={`w-full py-2 px-4 bg-white text-neutral-950 font-semibold rounded-xl transition-colors ${
          !accepted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/90'
        }`}
      >
        {loading ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: University
// ---------------------------------------------------------------------------

function UniversityStep({
  onSelect,
  onSkip,
}: {
  onSelect: (university: University) => void
  onSkip: () => void
}) {
  const [universities, setUniversities] = useState<University[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)

  useEffect(() => {
    fetch('/api/catalogue?resource=universities', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setUniversities(d.universities ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load universities.')
        setLoading(false)
      })
  }, [])

  const filtered = universities.filter(
    (u) =>
      query.trim() === '' ||
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.country.toLowerCase().includes(query.toLowerCase())
  )

  async function handleSkip() {
    setSkipping(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
      })
    } catch {
      // non-blocking
    }
    onSkip()
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white">Where do you study?</h1>
        <p className="text-sm text-white/60">
          We&apos;ll personalise My Studies for your university
        </p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search universities..."
        className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-indigo-400/60 transition-colors"
      />

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-4">No universities found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelect(u)}
                className="w-full text-left px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white group-hover:text-white truncate">
                    {u.name}
                  </span>
                  <span className="text-xs text-white/40 flex-shrink-0">{u.country}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="text-center">
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          {skipping ? 'Saving...' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Degree
// ---------------------------------------------------------------------------

const DEGREE_YEAR_LIMITS: Record<string, number> = {
  Grado: 4,
  Máster: 2,
  PCEO: 6,
}

function DegreeStep({
  university,
  onComplete,
  onBack,
  onSkip,
}: {
  university: University
  onComplete: (programId: string, year: number) => void
  onBack: () => void
  onSkip: () => void
}) {
  const [programs, setPrograms] = useState<DegreeProgram[]>([])
  const [query, setQuery] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<DegreeProgram | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/catalogue?resource=programs&university_id=${university.id}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        setPrograms(d.programs ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load programmes.')
        setLoading(false)
      })
  }, [university.id])

  const filteredPrograms = programs.filter(
    (p) =>
      query.trim() === '' ||
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.tipo.toLowerCase().includes(query.toLowerCase())
  )

  const groupedPrograms: Record<string, DegreeProgram[]> = {}
  for (const p of filteredPrograms) {
    if (!groupedPrograms[p.tipo]) groupedPrograms[p.tipo] = []
    groupedPrograms[p.tipo].push(p)
  }

  const maxYear = selectedProgram ? (DEGREE_YEAR_LIMITS[selectedProgram.tipo] ?? 4) : 4

  async function handleFinish() {
    if (!selectedProgram || !selectedYear) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_university_id: university.id,
          profile_program_id: selectedProgram.id,
          profile_year: selectedYear,
          onboarding_completed_at: new Date().toISOString(),
          university: university.name,
          degree: selectedProgram.title,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onComplete(selectedProgram.id, selectedYear)
    } catch {
      setError('Something went wrong. You can skip and set this later in settings.')
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
      })
    } catch {
      // non-blocking
    }
    onSkip()
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white">What are you studying?</h1>
        <p className="text-sm text-white/60">at {university.name}</p>
      </div>

      {!selectedProgram ? (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programmes..."
            className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-indigo-400/60 transition-colors"
          />

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-4 pr-1">
              {Object.entries(groupedPrograms).map(([tipo, progs]) => (
                <div key={tipo}>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-1">
                    {tipo}
                  </p>
                  <div className="space-y-1.5">
                    {progs.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProgram(p)
                          setSelectedYear(null)
                        }}
                        className="w-full text-left px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl transition-colors"
                      >
                        <span className="text-sm text-white">{p.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredPrograms.length === 0 && !loading && (
                <p className="text-center text-white/40 text-sm py-4">No programmes found</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <div>
              <p className="text-xs text-indigo-400 font-medium">{selectedProgram.tipo}</p>
              <p className="text-sm text-white font-medium">{selectedProgram.title}</p>
            </div>
            <button
              onClick={() => {
                setSelectedProgram(null)
                setSelectedYear(null)
              }}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <p className="text-sm text-white/70 mb-3">What year are you in?</p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: maxYear }, (_, i) => i + 1).map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors ${
                    selectedYear === yr
                      ? 'bg-indigo-500 text-white border border-indigo-400'
                      : 'bg-white/5 border border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            onClick={handleFinish}
            disabled={!selectedYear || saving}
            className={`w-full py-2 px-4 bg-white text-neutral-950 font-semibold rounded-xl transition-colors ${
              !selectedYear ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/90'
            }`}
          >
            {saving ? 'Saving...' : 'Finish'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          {skipping ? 'Saving...' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stepParam = searchParams?.get('step') as Step | null
  const step: Step = STEPS.includes(stepParam as Step) ? (stepParam as Step) : 'terms'

  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null)

  const goToStep = useCallback(
    (s: Step) => {
      router.push(`/onboarding?step=${s}`)
    },
    [router]
  )

  const goHome = useCallback(() => {
    router.push('/home')
  }, [router])

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Background />

      {/* Logo header */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="BetterNotes" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="font-semibold tracking-tight text-sm text-white">BetterNotes</span>
        </Link>
      </header>

      <div className="relative z-10 w-full max-w-sm">
        <ProgressDots currentStep={step} />

        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6">
          {step === 'terms' && (
            <TermsStep onComplete={() => goToStep('university')} />
          )}
          {step === 'university' && (
            <UniversityStep
              onSelect={(uni) => {
                setSelectedUniversity(uni)
                goToStep('degree')
              }}
              onSkip={goHome}
            />
          )}
          {step === 'degree' && (
            <>
              {selectedUniversity ? (
                <DegreeStep
                  university={selectedUniversity}
                  onComplete={goHome}
                  onBack={() => goToStep('university')}
                  onSkip={goHome}
                />
              ) : (
                // If university state is lost (e.g. page refresh), go back to university step
                <UniversityStep
                  onSelect={(uni) => {
                    setSelectedUniversity(uni)
                    goToStep('degree')
                  }}
                  onSkip={goHome}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function OnboardingFallback() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Background />
      <div className="relative z-10 h-6 w-6 rounded-full border-2 border-white/25 border-t-white animate-spin" />
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  )
}
