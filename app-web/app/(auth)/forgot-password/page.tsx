'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Background from '@/app/components/Background'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const expiredError = searchParams.get('error') === 'link_expired'

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(expiredError ? 'Your reset link has expired. Please request a new one.' : null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError('Something went wrong, please try again')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <Background />
        <div className="relative z-10 w-full max-w-sm text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/brand/logo.png" alt="BetterNotes" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-semibold tracking-tight text-sm text-white">BetterNotes</span>
          </div>
          <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-400/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="text-white/60 text-sm">
            We sent a password reset link to <strong className="text-white">{email}</strong>.
            Click it to set a new password.
          </p>
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Background />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/80 transition-colors mb-6"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Back to login
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Image src="/brand/logo.png" alt="BetterNotes" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="font-semibold tracking-tight text-sm text-white">BetterNotes</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
            <p className="text-sm text-white/60 mt-1">We&apos;ll send you a reset link</p>
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-white/80 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-indigo-400/60 disabled:opacity-50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-white hover:bg-white/90 disabled:opacity-50 text-neutral-950 font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/60">
          Remembered your password?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
