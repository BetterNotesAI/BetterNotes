'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
  current_period_start: string | null;
  current_period_end: string | null;
}

interface BillingEligibilityData {
  eligible: boolean;
  reason: string | null;
  message: string;
  is_anonymous: boolean;
  has_email: boolean;
  email_verified: boolean;
}

interface BillingSummary {
  usage: UsageData;
  subscription: SubscriptionData;
  eligibility?: BillingEligibilityData;
}

interface PlanSpec {
  id: BillingTier;
  title: string;
  monthlyPrice: string;
  quarterlyPrice: string | null;
  credits: string;
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
    models: ['All Free models', '+ All Pro models', '+ Claude Opus 4.6'],
    summary: 'Full model catalogue. No restrictions.',
    features: ['All Better features', '+ (to be defined)', '+ (to be defined)', '+ (to be defined)'],
  },
];

type ModalKind =
  | { kind: 'cancel' }
  | { kind: 'resume' }
  | { kind: 'change'; tier: PaidBillingTier; interval: BillingInterval }
  | { kind: 'downgrade' };

type ActionKey = 'checkout-better' | 'checkout-best' | 'portal' | 'cancel' | 'resume' | 'change';

function isActiveSubscriptionStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

const BILLING_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return BILLING_DATE_FORMATTER.format(parsed);
}

function tierLabel(tier: BillingTier | PaidBillingTier): string {
  if (tier === 'better') return 'Better';
  if (tier === 'best') return 'Best';
  return 'Free';
}

function intervalLabel(interval: BillingInterval): string {
  return interval === 'monthly' ? 'monthly' : 'quarterly';
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
  const successSessionIdParam = searchParams?.get('session_id');

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('monthly');
  const [isVerifyingCheckout, setIsVerifyingCheckout] = useState(false);

  const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);

  const loadSummary = useCallback(async (): Promise<BillingSummary | null> => {
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

      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load billing information.';
      setActionError(message);
      return null;
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (successParam !== 'true' || !successSessionIdParam) return;

    let ignore = false;

    async function verifyCheckoutSession() {
      setIsVerifyingCheckout(true);
      try {
        const resp = await fetch('/api/stripe/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: successSessionIdParam }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Could not verify billing session.');
        }

        if (!ignore) {
          await loadSummary();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not verify billing session.';
        if (!ignore) {
          setActionError(message);
        }
      } finally {
        if (!ignore) {
          setIsVerifyingCheckout(false);
        }
      }
    }

    void verifyCheckoutSession();

    return () => {
      ignore = true;
    };
  }, [successParam, successSessionIdParam, loadSummary]);

  function redirectToSignup() {
    const returnUrl = encodeURIComponent('/settings/billing');
    router.push(`/signup?returnUrl=${returnUrl}&reason=billing_account_required`);
  }

  async function handleCheckout(tier: PaidBillingTier) {
    if (summary?.eligibility && !summary.eligibility.eligible) {
      setActionError(summary.eligibility.message);
      return;
    }

    const key: ActionKey = tier === 'better' ? 'checkout-better' : 'checkout-best';
    setLoadingAction(key);
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

  async function handleOpenPortal() {
    if (summary?.eligibility && !summary.eligibility.eligible) {
      setActionError(summary.eligibility.message);
      return;
    }

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

  async function handleCancel() {
    setLoadingAction('cancel');
    setActionError(null);
    setActionSuccess(null);

    try {
      const resp = await fetch('/api/stripe/subscription/cancel', { method: 'POST' });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to cancel subscription.');
      }
      const refreshedSummary = await loadSummary();
      const endLabel = formatDate(refreshedSummary?.subscription.current_period_end ?? null);
      setActionSuccess(
        endLabel
          ? `Your subscription is canceled and will remain active until ${endLabel}.`
          : 'Your subscription will be cancelled at the end of the current period.'
      );
      setModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setActionError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResume() {
    setLoadingAction('resume');
    setActionError(null);
    setActionSuccess(null);

    try {
      const resp = await fetch('/api/stripe/subscription/resume', { method: 'POST' });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to resume subscription.');
      }
      await loadSummary();
      setActionSuccess('Subscription resumed. Your plan stays active.');
      setModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setActionError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleChange(tier: PaidBillingTier, interval: BillingInterval) {
    setLoadingAction('change');
    setActionError(null);
    setActionSuccess(null);

    try {
      const resp = await fetch('/api/stripe/subscription/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to change plan.');
      }
      await loadSummary();
      setActionSuccess(`Plan switched to ${tierLabel(tier)} (${intervalLabel(interval)}).`);
      setModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setActionError(message);
    } finally {
      setLoadingAction(null);
    }
  }

  const usage = summary?.usage ?? null;
  const subscription = summary?.subscription ?? null;
  const eligibility = summary?.eligibility ?? null;
  const canUseBillingActions = eligibility ? eligibility.eligible : true;

  const isPaidUser = useMemo(() => {
    if (!summary) return false;
    return summary.usage.plan !== 'free' || isActiveSubscriptionStatus(summary.subscription.status);
  }, [summary]);

  const currentTier: BillingTier = useMemo(() => {
    if (!isPaidUser) return 'free';
    if (subscription?.tier === 'better' || subscription?.tier === 'best') return subscription.tier;
    return usage?.plan === 'best' ? 'best' : 'better';
  }, [isPaidUser, subscription?.tier, usage?.plan]);

  const currentInterval: BillingInterval | null = subscription?.interval ?? null;

  const creditsUsed = usage ? usage.credits_used ?? usage.message_count : 0;
  const creditsLimit = usage ? usage.credits_limit ?? usage.limit : 0;
  const creditsRemaining = usage
    ? Math.max(0, usage.credits_remaining ?? creditsLimit - creditsUsed)
    : 0;

  const progressPct = usage && creditsLimit > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / creditsLimit) * 100)))
    : 0;

  const periodStartLabel = formatDate(subscription?.current_period_start ?? usage?.period_start ?? null);
  const periodEndLabel = formatDate(subscription?.current_period_end ?? null);

  const successTier =
    successTierParam === 'better' || successTierParam === 'best' ? successTierParam : null;
  const successInterval =
    successIntervalParam === 'monthly' || successIntervalParam === 'quarterly'
      ? successIntervalParam
      : null;

  const modalTargetPlan =
    modal?.kind === 'change'
      ? PLAN_SPECS.find((p) => p.id === modal.tier) ?? null
      : null;

  const modalPriceLabel =
    modal?.kind === 'change' && modalTargetPlan
      ? modal.interval === 'monthly'
        ? `${modalTargetPlan.monthlyPrice} / month`
        : `${modalTargetPlan.quarterlyPrice} / quarter`
      : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            >
              <span aria-hidden>←</span>
              Back
            </button>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Billing &amp; Plan</h1>
            <p className="mt-1 text-sm text-white/60 max-w-2xl">
              Manage your subscription, switch plans or cancel — no need to leave the app.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/support"
              className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Support
            </Link>
          </div>
        </div>

        {successParam === 'true' && isVerifyingCheckout && successSessionIdParam && (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            <span className="w-4 h-4 border-2 border-indigo-300/40 border-t-indigo-200 rounded-full animate-spin shrink-0" />
            <span>Validating payment session...</span>
          </div>
        )}

        {successParam === 'true' && !isVerifyingCheckout && !actionError && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Subscription activated
            {successTier ? `: ${tierLabel(successTier)} (${successInterval ?? 'monthly'})` : ''}.
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {actionError}
          </div>
        )}

        {eligibility && !eligibility.eligible && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span>{eligibility.message}</span>
            <button
              type="button"
              onClick={redirectToSignup}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300/40 text-amber-50 hover:bg-amber-500/20 transition-colors"
            >
              Create account to activate subscription
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-5">
          {isLoadingSummary ? (
            <div className="flex items-center gap-3 py-2">
              <span className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-white/60">Loading billing data...</span>
            </div>
          ) : usage ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-white/45">Current plan</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-semibold text-white">{tierLabel(currentTier)}</span>
                    {currentInterval && currentTier !== 'free' && (
                      <span className="text-xs text-white/55 rounded-full border border-white/15 px-2 py-0.5">
                        {intervalLabel(currentInterval)}
                      </span>
                    )}
                    {subscription?.cancel_at_period_end && (
                      <span className="text-[11px] font-medium rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">
                        Cancels at period end
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">
                    {periodStartLabel ? `Cycle started ${periodStartLabel}` : 'Monthly cycle'}
                    {periodEndLabel
                      ? subscription?.cancel_at_period_end
                        ? ` · Ends ${periodEndLabel}`
                        : ` · Renews ${periodEndLabel}`
                      : ''}
                  </p>
                </div>

                {isPaidUser && canUseBillingActions && (
                  <div className="flex flex-wrap items-center gap-2">
                    {subscription?.cancel_at_period_end ? (
                      <button
                        type="button"
                        onClick={() => setModal({ kind: 'resume' })}
                        disabled={loadingAction !== null}
                        className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition-colors"
                      >
                        Resume subscription
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModal({ kind: 'cancel' })}
                        disabled={loadingAction !== null}
                        className="px-4 py-2 rounded-xl border border-white/20 text-white/85 hover:text-white hover:border-white/35 text-sm transition-colors disabled:opacity-60"
                      >
                        Cancel plan
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/70">Credits remaining</span>
                  <span className="text-white/55 tabular-nums">
                    {formatCredits(creditsRemaining)} / {creditsLimit}
                  </span>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPct <= 10
                        ? 'bg-red-400'
                        : progressPct <= 30
                          ? 'bg-amber-400'
                          : 'bg-indigo-400'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/55">Could not load billing information.</p>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-white">Choose your plan</h2>
            <p className="text-sm text-white/55">
              Switch anytime. Upgrades apply immediately with prorated charges.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/15 p-1 bg-black/25">
            <button
              type="button"
              onClick={() => setSelectedInterval('monthly')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedInterval === 'monthly'
                  ? 'bg-white text-neutral-950'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSelectedInterval('quarterly')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedInterval === 'quarterly'
                  ? 'bg-white text-neutral-950'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PLAN_SPECS.map((plan) => {
            const isSameTier = currentTier === plan.id;
            const isCurrentPlan =
              isSameTier
              && (plan.id === 'free'
                || !currentInterval
                || currentInterval === selectedInterval);

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
                  ? `or ${plan.quarterlyPrice} / quarter`
                  : `or ${plan.monthlyPrice} / month`;

            let buttonText = '';
            let buttonAction: (() => void) | null = null;
            let buttonBusy = false;
            let buttonStyle: 'primary' | 'secondary' | 'disabled' = 'secondary';

            if (!canUseBillingActions) {
              buttonText = 'Create account to activate';
              buttonAction = redirectToSignup;
              buttonStyle = 'secondary';
            } else if (plan.id === 'free') {
              if (isCurrentPlan) {
                buttonText = 'Current plan';
                buttonStyle = 'disabled';
              } else {
                buttonText = 'Downgrade to Free';
                buttonAction = () => setModal({ kind: 'downgrade' });
                buttonStyle = 'secondary';
              }
            } else if (isCurrentPlan) {
              buttonText = 'Current plan';
              buttonStyle = 'disabled';
            } else if (!isPaidUser) {
              const key: ActionKey = plan.id === 'better' ? 'checkout-better' : 'checkout-best';
              buttonBusy = loadingAction === key;
              buttonText = buttonBusy ? 'Redirecting...' : `Choose ${plan.title}`;
              buttonAction = () => handleCheckout(plan.id as PaidBillingTier);
              buttonStyle = plan.highlighted ? 'primary' : 'secondary';
            } else {
              const sameTierDifferentInterval =
                isSameTier && currentInterval && currentInterval !== selectedInterval;
              buttonText = sameTierDifferentInterval
                ? `Switch to ${intervalLabel(selectedInterval)}`
                : `Switch to ${plan.title}`;
              buttonAction = () =>
                setModal({
                  kind: 'change',
                  tier: plan.id as PaidBillingTier,
                  interval: selectedInterval,
                });
              buttonStyle = plan.highlighted ? 'primary' : 'secondary';
            }

            const buttonClasses =
              buttonStyle === 'primary'
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-60 disabled:cursor-not-allowed'
                : buttonStyle === 'disabled'
                  ? 'bg-white/5 text-white/45 cursor-default border border-white/10'
                  : 'border border-white/20 text-white/85 hover:text-white hover:border-white/35 disabled:opacity-60 disabled:cursor-not-allowed';

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 flex flex-col gap-5 backdrop-blur-sm transition-colors ${
                  plan.highlighted
                    ? 'border-indigo-400/40 bg-indigo-500/10'
                    : 'border-white/15 bg-black/25'
                } ${isCurrentPlan ? 'ring-1 ring-white/25' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-white">{plan.title}</h3>
                    {plan.highlighted && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full border border-indigo-300/50 px-2 py-0.5 text-indigo-100">
                        Popular
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full border border-white/25 px-2 py-0.5 text-white/80">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-3xl font-bold text-white mt-3">{priceLabel}</p>
                  {secondaryPrice && (
                    <p className="text-xs text-white/50 mt-1">{secondaryPrice}</p>
                  )}
                </div>

                <p className="text-base font-medium text-white/90">{plan.credits}</p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
                    Available models
                  </p>
                  <ul className="space-y-1 text-sm text-white/70">
                    {plan.models.map((model, modelIndex) => (
                      <li key={`${plan.id}-model-${modelIndex}`}>{model}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-white/55 leading-relaxed">{plan.summary}</p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
                    Features
                  </p>
                  <ul className="space-y-1 text-sm text-white/70">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={`${plan.id}-feature-${featureIndex}`}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={buttonAction ?? undefined}
                  disabled={!buttonAction || loadingAction !== null || isLoadingSummary}
                  className={`mt-auto rounded-xl py-2.5 text-sm font-semibold transition-colors ${buttonClasses}`}
                >
                  {buttonText}
                </button>
              </div>
            );
          })}
        </div>

        {isPaidUser && canUseBillingActions && (
          <div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4 text-sm text-white/65 flex flex-wrap items-center justify-between gap-3">
            <span>Need invoices, receipts or to update your payment method?</span>
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={loadingAction !== null}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white/80 hover:text-white hover:border-white/30 transition-colors disabled:opacity-60"
            >
              {loadingAction === 'portal' ? 'Opening Stripe...' : 'Open Stripe billing portal'}
            </button>
          </div>
        )}
      </div>

      {modal && (
        <ConfirmModal
          modal={modal}
          onClose={() => {
            if (loadingAction === null) setModal(null);
          }}
          onConfirm={async () => {
            if (modal.kind === 'cancel' || modal.kind === 'downgrade') await handleCancel();
            else if (modal.kind === 'resume') await handleResume();
            else if (modal.kind === 'change') await handleChange(modal.tier, modal.interval);
          }}
          busy={loadingAction === 'cancel' || loadingAction === 'resume' || loadingAction === 'change'}
          periodEndLabel={periodEndLabel}
          modalPriceLabel={modalPriceLabel}
        />
      )}
    </div>
  );
}

interface ConfirmModalProps {
  modal: ModalKind;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
  periodEndLabel: string | null;
  modalPriceLabel: string | null;
}

function ConfirmModal({ modal, onClose, onConfirm, busy, periodEndLabel, modalPriceLabel }: ConfirmModalProps) {
  const { title, body, confirmLabel, tone } = useMemo(() => {
    if (modal.kind === 'cancel') {
      return {
        title: 'Cancel subscription?',
        body:
          periodEndLabel
            ? `Your plan remains active until ${periodEndLabel}. You can resume anytime before then without losing anything.`
            : 'Your plan remains active until the end of the current period. You can resume anytime before then.',
        confirmLabel: 'Cancel plan',
        tone: 'danger' as const,
      };
    }

    if (modal.kind === 'downgrade') {
      return {
        title: 'Downgrade to Free?',
        body:
          periodEndLabel
            ? `Your paid plan will keep working until ${periodEndLabel}. After that you move to Free automatically.`
            : 'Your paid plan will keep working until the end of the current period. After that you move to Free automatically.',
        confirmLabel: 'Downgrade to Free',
        tone: 'danger' as const,
      };
    }

    if (modal.kind === 'resume') {
      return {
        title: 'Resume subscription?',
        body: 'We\'ll cancel the scheduled cancellation. Your plan will keep renewing normally.',
        confirmLabel: 'Resume subscription',
        tone: 'primary' as const,
      };
    }

    return {
      title: `Switch to ${modal.tier === 'better' ? 'Better' : 'Best'} (${modal.interval})?`,
      body:
        modalPriceLabel
          ? `Your new plan costs ${modalPriceLabel}. The switch applies immediately and we charge the prorated difference for the rest of the current period.`
          : 'The switch applies immediately. We\'ll charge the prorated difference for the rest of the current period.',
      confirmLabel: 'Confirm switch',
      tone: 'primary' as const,
    };
  }, [modal, periodEndLabel, modalPriceLabel]);

  const confirmClasses =
    tone === 'primary'
      ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
      : 'bg-red-500/80 hover:bg-red-500 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/95 p-6 shadow-xl">
        <h3 id="billing-modal-title" className="text-lg font-semibold text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm text-white/70 leading-relaxed">{body}</p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-white/15 text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors disabled:opacity-60"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${confirmClasses}`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-white/25 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
