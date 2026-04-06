'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

interface UsageData {
  plan: 'free' | 'pro';
  message_count: number;
  limit: number;
  remaining: number;
  period_start: string;
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successParam = searchParams?.get('success');

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsage() {
      setIsLoadingUsage(true);
      try {
        const resp = await fetch('/api/usage');
        if (resp.ok) {
          const data = await resp.json();
          setUsage(data);
        }
      } finally {
        setIsLoadingUsage(false);
      }
    }
    loadUsage();
  }, []);

  async function handleUpgrade() {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to start checkout');
      }
      const data = await resp.json();
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setActionError(message);
      setIsActionLoading(false);
    }
  }

  async function handleManageSubscription() {
    setIsActionLoading(true);
    setActionError(null);
    try {
      const resp = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to open portal');
      }
      const data = await resp.json();
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setActionError(message);
      setIsActionLoading(false);
    }
  }

  function formatPeriodStart(isoDate: string) {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const progressPct = usage
    ? Math.min(100, Math.round((usage.message_count / usage.limit) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Billing</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Success banner */}
        {successParam === 'true' && (
          <div className="flex items-center gap-3 bg-green-950/60 border border-green-900/60
            rounded-xl px-4 py-3 text-green-300 text-sm">
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Subscription activated! Welcome to Pro.</span>
          </div>
        )}

        {/* Plan card */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Current plan
          </h2>

          {isLoadingUsage ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">Loading...</span>
            </div>
          ) : usage ? (
            <div className="space-y-5">
              {/* Plan badge */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase
                  tracking-wider rounded-full px-3 py-1 border ${
                  usage.plan === 'pro'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {usage.plan === 'pro' ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : null}
                  {usage.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>

              {/* Usage */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-300">Generations this month</span>
                  <span className="text-gray-400 tabular-nums">
                    {usage.message_count}
                    {usage.plan === 'free' && (
                      <span className="text-gray-600"> / {usage.limit}</span>
                    )}
                  </span>
                </div>
                {usage.plan === 'free' && (
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progressPct >= 90 ? 'bg-red-500' :
                        progressPct >= 70 ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
                {usage.period_start && (
                  <p className="text-xs text-gray-600 mt-1.5">
                    Resets each month · started {formatPeriodStart(usage.period_start)}
                  </p>
                )}
              </div>

              {/* Action error */}
              {actionError && (
                <p className="text-xs text-red-400">{actionError}</p>
              )}

              {/* CTA button */}
              {usage.plan === 'free' ? (
                <div className="pt-1">
                  <button
                    onClick={handleUpgrade}
                    disabled={isActionLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed
                      text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors
                      flex items-center gap-2"
                  >
                    {isActionLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      'Upgrade to Pro'
                    )}
                  </button>
                  <p className="text-xs text-gray-600 mt-2">
                    See what&apos;s included in Pro on the{' '}
                    <Link href="/pricing" className="text-blue-400 hover:underline">
                      pricing page
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleManageSubscription}
                  disabled={isActionLoading}
                  className="text-sm font-medium text-gray-300 hover:text-white px-5 py-2.5 rounded-xl
                    border border-gray-700 hover:border-gray-500 transition-colors flex items-center gap-2
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isActionLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-500 border-t-gray-200 rounded-full animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    'Manage subscription'
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Could not load billing information.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
