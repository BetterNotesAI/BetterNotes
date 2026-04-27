'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Background from '@/app/components/Background'
import { useTranslation } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('auth.resetPassword.tooShort'))
      return
    }

    if (password !== confirm) {
      setError(t('auth.resetPassword.mismatch'))
      return
    }

    setLoading(true)

    const supabase = createClient()

    // Verify there is an active session (user arrived via magic link)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError(t('auth.resetPassword.invalidLink'))
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(t('common.error.generic'))
      setLoading(false)
      return
    }

    router.push('/home')
  }

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

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{t('auth.resetPassword.title')}</h1>
          <p className="text-sm text-white/60 mt-1">{t('auth.resetPassword.subtitle')}</p>
        </div>

        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-white/80 mb-1">
                {t('auth.resetPassword.newPassword')}
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
                placeholder={t('auth.signup.passwordPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm text-white/80 mb-1">
                {t('auth.resetPassword.confirmPassword')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-black/20 border border-white/20 rounded-xl text-white placeholder:text-white/45 focus:outline-none focus:border-indigo-400/60 disabled:opacity-50 transition-colors"
                placeholder="••••••••"
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
              {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/60">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
