'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlanFeature {
  text: string;
}

interface BillingEligibilityData {
  eligible: boolean;
  reason: string | null;
  message: string;
}

const FREE_FEATURES: PlanFeature[] = [
  { text: '20 generations / month' },
  { text: 'All templates' },
  { text: 'Version history' },
  { text: 'PDF download' },
];

const PRO_FEATURES: PlanFeature[] = [
  { text: 'Unlimited generations' },
  { text: 'Everything in Free' },
  { text: 'Priority queue' },
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<BillingEligibilityData | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadEligibility() {
      try {
        const resp = await fetch('/api/billing/eligibility');
        if (!resp.ok) return;
        const data = await resp.json() as { eligibility?: BillingEligibilityData };
        if (!ignore) {
          setEligibility(data.eligibility ?? null);
        }
      } catch {
        // Non-fatal: backend route still enforces billing eligibility.
      }
    }

    void loadEligibility();

    return () => {
      ignore = true;
    };
  }, []);

  function redirectToSignup() {
    const returnUrl = encodeURIComponent('/pricing');
    router.push(`/signup?returnUrl=${returnUrl}&reason=billing_account_required`);
  }

  async function handleUpgrade() {
    if (eligibility && !eligibility.eligible) {
      setCheckoutError(eligibility.message);
      return;
    }

    setIsCheckoutLoading(true);
    setCheckoutError(null);
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
      setCheckoutError(message);
      setIsCheckoutLoading(false);
    }
  }

  const canCheckout = eligibility ? eligibility.eligible : true;

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
        <h1 className="text-xl font-bold">Pricing</h1>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-400">Start for free, upgrade when you need more.</p>
        </div>

        {eligibility && !eligibility.eligible && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-amber-950/35 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-200 text-sm">
            <span>{eligibility.message}</span>
            <button
              onClick={redirectToSignup}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/50 text-amber-100 hover:bg-amber-500/20 transition-colors"
            >
              Create account to activate subscription
            </button>
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Free card */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Free</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-gray-500 text-sm">/ month</span>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Everything you need to get started.
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <CheckIcon />
                  {f.text}
                </li>
              ))}
            </ul>

            <div className="w-full text-center text-sm font-medium text-gray-500 py-2.5 rounded-xl
              border border-gray-700 cursor-default">
              Current plan
            </div>
          </div>

          {/* Pro card */}
          <div className="bg-blue-950/30 border border-blue-800/50 rounded-2xl p-6 flex flex-col
            relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />

            <div className="relative mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Pro</span>
                <span className="text-xs bg-blue-600/20 text-blue-300 border border-blue-700/50
                  rounded-full px-2 py-0.5 font-medium">
                  Recommended
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$9</span>
                <span className="text-gray-400 text-sm">/ month</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                No limits. Full speed ahead.
              </p>
            </div>

            <ul className="relative space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm text-gray-200">
                  <CheckIcon />
                  {f.text}
                </li>
              ))}
            </ul>

            {checkoutError && (
              <p className="relative text-xs text-red-400 mb-3">{checkoutError}</p>
            )}

            <button
              onClick={canCheckout ? handleUpgrade : redirectToSignup}
              disabled={isCheckoutLoading}
              className="relative w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60
                disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl
                transition-colors flex items-center justify-center gap-2"
            >
              {isCheckoutLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Redirecting...
                </>
              ) : (
                canCheckout ? 'Upgrade to Pro' : 'Create account to activate subscription'
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          Payments are processed securely by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
