'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type UsagePlan = 'free' | 'pro' | 'better' | 'best';
type BillingTier = 'free' | 'better' | 'best';
type PaidBillingTier = Exclude<BillingTier, 'free'>;
type BillingInterval = 'monthly' | 'quarterly';

interface UsageData {
  plan: UsagePlan;
  message_count: number;
  limit: number;
  remaining: number;
  credits_used?: number;
  credits_limit?: number;
  credits_remaining?: number;
  usd_used?: number;
  usd_limit?: number;
  usd_remaining?: number;
  period_start: string;
}

interface SubscriptionData {
  status: string | null;
  tier: PaidBillingTier | null;
  interval: BillingInterval | null;
  price_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

interface BillingSummary {
  usage: UsageData;
  subscription: SubscriptionData;
}

interface PlanSpec {
  id: BillingTier;
  title: string;
  monthlyPrice: string;
  quarterlyPrice: string | null;
  credits: string;
  internalCost: string;
  models: string[];
  summary: string;
  features: string[];
  highlighted?: boolean;
}

const PLAN_SPECS: PlanSpec[] = [
  {
    id: 'free',
    title: 'Free',
    monthlyPrice: '€0',
    quarterlyPrice: null,
    credits: '10 credits / month',
    internalCost: 'Max internal cost: $0.10',
    models: ['GPT-5.4-nano', 'Gemini 2.5 Flash-Lite', 'Grok 4.1 Fast', 'DeepSeek V3.2'],
    summary: 'Low-cost models only. Ideal for trying the product and light usage.',
    features: ['-'],
  },
  {
    id: 'better',
    title: 'Better',
    monthlyPrice: '€6.99',
    quarterlyPrice: '€16.99',
    credits: '200 credits / month',
    internalCost: 'Max internal cost: $2.00',
    models: [
      'All Free models',
      '+ GPT-5.4',
      '+ Gemini 3.1 Pro',
      '+ Claude Sonnet 4.6',
      '+ Grok 4.20',
    ],
    summary: 'Free + Pro models. User choice.',
    features: ['All Free features', '+ (to be defined)', '+ (to be defined)', '+ (to be defined)'],
    highlighted: true,
  },
  {
    id: 'best',
    title: 'Best',
    monthlyPrice: '€12.99',
    quarterlyPrice: '€31.99',
    credits: '500 credits / month',
    internalCost: 'Max internal cost: $5.00',
    models: ['All Free models', '+ All Pro models', '+ Claude Opus 4.6'],
    summary: 'Full model catalogue. No restrictions.',
    features: ['All Better features', '+ (to be defined)', '+ (to be defined)', '+ (to be defined)'],
  },
];

function isActiveSubscriptionStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

function formatDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function tierLabel(tier: BillingTier | PaidBillingTier): string {
  if (tier === 'better') return 'Better';
  if (tier === 'best') return 'Best';
  return 'Free';
}

function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const successParam = searchParams?.get('success');
  const successTierParam = searchParams?.get('tier');
  const successIntervalParam = searchParams?.get('interval');

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('monthly');

  const [loadingAction, setLoadingAction] = useState<'better' | 'best' | 'portal' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      setIsLoadingSummary(true);
      try {
        const resp = await fetch('/api/billing/summary');
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Could not load billing information.');
        }

        const data = (await resp.json()) as BillingSummary;
        setSummary(data);

        if (data.subscription.interval) {
          setSelectedInterval(data.subscription.interval);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not load billing information.';
        setActionError(message);
      } finally {
        setIsLoadingSummary(false);
      }
    }

    void loadSummary();
  }, []);

  async function handleCheckout(tier: PaidBillingTier) {
    setLoadingAction(tier);
    setActionError(null);

    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval: selectedInterval }),
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
      setLoadingAction(null);
    }
  }

  async function handleManageSubscription() {
    setLoadingAction('portal');
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
      setLoadingAction(null);
    }
  }

  const usage = summary?.usage ?? null;
  const subscription = summary?.subscription ?? null;

  const isPaidUser = useMemo(() => {
    if (!summary) return false;
    return summary.usage.plan !== 'free' || isActiveSubscriptionStatus(summary.subscription.status);
  }, [summary]);

  const currentTier: BillingTier = useMemo(() => {
    if (!isPaidUser) return 'free';
    if (subscription?.tier === 'better' || subscription?.tier === 'best') return subscription.tier;
    return usage?.plan === 'best' ? 'best' : 'better';
  }, [isPaidUser, subscription?.tier, usage?.plan]);

  const creditsUsed = usage ? usage.credits_used ?? usage.message_count : 0;
  const creditsLimit = usage ? usage.credits_limit ?? usage.limit : 0;
  const creditsRemaining = usage
    ? Math.max(0, usage.credits_remaining ?? creditsLimit - creditsUsed)
    : 0;

  const progressPct = usage && creditsLimit > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / creditsLimit) * 100)))
    : 0;

  const periodStartLabel = formatDate(usage?.period_start ?? null);
  const periodEndLabel = formatDate(subscription?.current_period_end ?? null);

  const successTier =
    successTierParam === 'better' || successTierParam === 'best' ? successTierParam : null;
  const successInterval =
    successIntervalParam === 'monthly' || successIntervalParam === 'quarterly'
      ? successIntervalParam
      : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
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
        <h1 className="text-xl font-bold">Billing Plans</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/support"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            Support
          </Link>
        </div>

        {successParam === 'true' && (
          <div
            className="flex items-center gap-3 bg-green-950/60 border border-green-900/60
            rounded-xl px-4 py-3 text-green-300 text-sm"
          >
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Subscription activated
              {successTier ? `: ${tierLabel(successTier)} (${successInterval ?? 'monthly'})` : ''}.
            </span>
          </div>
        )}

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
          {isLoadingSummary ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">Loading billing data...</span>
            </div>
          ) : usage ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-400">Current plan:</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1 border ${
                    currentTier === 'free'
                      ? 'bg-gray-800 text-gray-300 border-gray-700'
                      : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                  }`}
                >
                  {tierLabel(currentTier)}
                </span>
                {subscription?.status && (
                  <span className="text-xs text-gray-500">
                    Stripe status: {subscription.status}
                    {subscription?.interval ? ` (${subscription.interval})` : ''}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-300">Credits remaining</span>
                  <span className="text-gray-400 tabular-nums">
                    {formatCredits(creditsRemaining)} / {creditsLimit}
                  </span>
                </div>

                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPct <= 10 ? 'bg-red-500' : progressPct <= 30 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <p className="text-xs text-gray-600 mt-1.5">
                  {periodStartLabel ? `Cycle started ${periodStartLabel}` : 'Monthly cycle'}
                  {periodEndLabel ? ` · Ends ${periodEndLabel}` : ''}
                  {subscription?.cancel_at_period_end ? ' · Cancels at period end' : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Could not load billing information.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Choose your plan</h2>
            <p className="text-sm text-gray-500">You can switch billing cadence for paid plans.</p>
          </div>

          <div className="inline-flex rounded-xl border border-gray-700 p-1 bg-gray-900/70">
            <button
              onClick={() => setSelectedInterval('monthly')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedInterval === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval('quarterly')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedInterval === 'quarterly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>

        {actionError && <p className="text-sm text-red-400">{actionError}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PLAN_SPECS.map((plan) => {
            const isCurrentPlan = currentTier === plan.id;
            const priceLabel =
              plan.id === 'free'
                ? `${plan.monthlyPrice} / month`
                : selectedInterval === 'monthly'
                  ? `${plan.monthlyPrice} / month`
                  : `${plan.quarterlyPrice} / quarter`;

            const secondaryPrice =
              plan.id === 'free'
                ? null
                : selectedInterval === 'monthly'
                  ? `(or ${plan.quarterlyPrice} / quarter)`
                  : `(or ${plan.monthlyPrice} / month)`;

            const buttonDisabled = loadingAction !== null || isLoadingSummary || !usage;
            let buttonText = 'Current plan';
            let buttonAction: (() => void) | null = null;

            if (plan.id === 'free') {
              if (isCurrentPlan) {
                buttonText = 'Current plan';
              } else {
                buttonText = loadingAction === 'portal' ? 'Redirecting...' : 'Manage in Stripe';
                buttonAction = handleManageSubscription;
              }
            } else if (isCurrentPlan) {
              buttonText = 'Current plan';
            } else if (!isPaidUser) {
              if (loadingAction === plan.id) {
                buttonText = 'Redirecting...';
              } else {
                buttonText = `Choose ${plan.title}`;
              }
              if (plan.id === 'better' || plan.id === 'best') {
                buttonAction = () => handleCheckout(plan.id as PaidBillingTier);
              }
            } else {
              buttonText = loadingAction === 'portal' ? 'Redirecting...' : 'Change in Stripe';
              buttonAction = handleManageSubscription;
            }

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 flex flex-col gap-5 ${
                  plan.highlighted
                    ? 'border-blue-700/60 bg-blue-950/20'
                    : 'border-gray-800 bg-gray-900/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-white">{plan.title}</h3>
                    {plan.highlighted && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full border border-blue-700/60 px-2 py-1 text-blue-300">
                        Popular
                      </span>
                    )}
                  </div>

                  <p className="text-3xl font-bold text-white mt-3">{priceLabel}</p>
                  {secondaryPrice && <p className="text-sm text-gray-500 mt-1">{secondaryPrice}</p>}
                </div>

                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-100">{plan.credits}</p>
                  <p className="text-sm text-gray-500">{plan.internalCost}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-200">Available models</p>
                  <ul className="space-y-1.5 text-sm text-gray-400">
                    {plan.models.map((model, modelIndex) => (
                      <li key={`${plan.id}-model-${modelIndex}`}>{model}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-gray-500 leading-relaxed">{plan.summary}</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-200">Features</p>
                  <ul className="space-y-1.5 text-sm text-gray-400">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={`${plan.id}-feature-${featureIndex}`}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={buttonAction ?? undefined}
                  disabled={buttonDisabled || !buttonAction}
                  className={`mt-auto rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    !buttonAction
                      ? 'bg-gray-800 text-gray-500 cursor-default'
                      : plan.highlighted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 disabled:cursor-not-allowed'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed'
                  }`}
                >
                  {buttonText}
                </button>
              </div>
            );
          })}
        </div>

        {isPaidUser && (
          <p className="text-xs text-gray-500">
            Plan changes and cancellations for active subscriptions are managed through Stripe Portal.
          </p>
        )}
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
