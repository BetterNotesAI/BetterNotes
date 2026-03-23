'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export interface GuestSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function humanizeError(message: string): string {
  if (message.includes('User already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Log in instead.';
  }
  if (message.includes('Password should be')) {
    return 'Password must be at least 6 characters.';
  }
  if (message.includes('Unable to validate email')) {
    return 'Please enter a valid email address.';
  }
  return 'Something went wrong. Please try again.';
}

export function GuestSignupModal({ isOpen, onClose }: GuestSignupModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  async function handleGoogleLink() {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
        },
      });
      if (linkError) {
        setError(humanizeError(linkError.message));
        setIsGoogleLoading(false);
      }
      // On success the browser is redirected — no cleanup needed
    } catch {
      setError('Something went wrong. Please try again.');
      setIsGoogleLoading(false);
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      // updateUser converts the anonymous account to a permanent one while
      // preserving the same user_id (and therefore all existing documents).
      const { error: updateError } = await supabase.auth.updateUser({ email, password });
      if (updateError) {
        setError(humanizeError(updateError.message));
        setIsLoading(false);
        return;
      }
      // Reload so the app picks up the new permanent session
      window.location.reload();
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f0f0f] border border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Save your work</h2>
            <p className="text-sm text-white/55 mt-1 leading-snug">
              Create a free account to keep your document and get unlimited generations
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors ml-4 shrink-0 mt-0.5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogleLink}
          disabled={isLoading || isGoogleLoading}
          className="w-full py-2.5 px-4 bg-white hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed
            text-neutral-950 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mb-4"
        >
          {isGoogleLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-neutral-400/40 border-t-neutral-700 rounded-full animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-white/35 mb-4">
          <div className="flex-1 border-t border-white/12" />
          <span>or</span>
          <div className="flex-1 border-t border-white/12" />
        </div>

        {/* Email + password form */}
        <form onSubmit={handleEmailSignup} className="space-y-3">
          <div>
            <label htmlFor="guest-email" className="block text-xs text-white/65 mb-1">
              Email
            </label>
            <input
              id="guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isGoogleLoading}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-black/25 border border-white/15 rounded-xl text-white text-sm
                placeholder:text-white/30 focus:outline-none focus:border-indigo-400/60
                disabled:opacity-50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="guest-password" className="block text-xs text-white/65 mb-1">
              Password
            </label>
            <input
              id="guest-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={isLoading || isGoogleLoading}
              placeholder="Min. 6 characters"
              className="w-full px-3 py-2 bg-black/25 border border-white/15 rounded-xl text-white text-sm
                placeholder:text-white/30 focus:outline-none focus:border-indigo-400/60
                disabled:opacity-50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading || !email.trim() || !password.trim()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-violet-500
              hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold text-sm rounded-xl transition-all
              shadow-[0_2px_8px_rgba(99,102,241,0.35)] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Log in link */}
        <p className="text-center text-xs text-white/45 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
