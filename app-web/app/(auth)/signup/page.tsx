'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Background from '@/app/components/Background'

function humanizeAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Incorrect email or password'
  }
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email before signing in'
  }
  if (message.includes('User already registered')) {
    return 'An account with this email already exists'
  }
  return 'Something went wrong, please try again'
}

function SignupContent() {
  const searchParams = useSearchParams()
  const returnUrl = searchParams?.get('returnUrl')
  const safeReturnUrl = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/home'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturnUrl)}`,
      },
    })

    if (error) {
      setError(humanizeAuthError(error.message))
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleGoogleSignup() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturnUrl)}`,
      },
    })

    if (error) {
      setError(humanizeAuthError(error.message))
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <Background />
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/logo.png" alt="BetterNotes" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-semibold tracking-tight text-sm text-white">BetterNotes</span>
          </Link>
        </header>
        <div className="relative z-10 w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 bg-green-500/20 border border-green-400/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="text-white/60 text-sm">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link
            href={`/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`}
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Animated background */}
      <Background />

      {/* Logo header */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="BetterNotes" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="font-semibold tracking-tight text-sm text-white">BetterNotes</span>
        </Link>
      </header>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div>
          <Link
            href="/"
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
            Back to home
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="text-sm text-white/60 mt-1">Start generating study documents</p>
          </div>
        </div>

        {/* Glassmorphism card */}
        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-4">
          <form onSubmit={handleSignup} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="block text-sm text-white/80 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-indigo-400/60 disabled:opacity-50 transition-colors"
                placeholder="At least 8 characters"
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-white/40">
            <div className="flex-1 border-t border-white/15" />
            <span>or continue with</span>
            <div className="flex-1 border-t border-white/15" />
          </div>

          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full py-2 px-4 bg-black/20 border border-white/20 hover:bg-white/10 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </div>

        <p className="text-center text-sm text-white/60">
          Already have an account?{' '}
          <Link
            href={`/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`}
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

function SignupFallback() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Background />
      <div className="relative z-10 h-6 w-6 rounded-full border-2 border-white/25 border-t-white animate-spin" />
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  )
}
