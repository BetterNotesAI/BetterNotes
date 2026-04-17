import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isBillingInterval,
  normalizeSubscriptionTier,
  resolveTierAndIntervalByPriceId,
} from '@/lib/billing-plans';
import {
  isSubscriptionStatusActive,
  syncUserSubscriptionFromStripe,
} from '@/lib/stripe-subscription-sync';
import { resolveBillingEligibilityForUser } from '@/lib/billing-eligibility';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

async function loadUsageAndSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ usageRes: any; subscriptionRes: any }> {
  const [usageRes, subscriptionRes] = await Promise.all([
    supabase.rpc('get_usage_status', { p_user_id: userId }),
    supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  return { usageRes, subscriptionRes };
}

function normalizeSubscriptionRecord(subscriptionData: unknown): Record<string, unknown> | null {
  return subscriptionData && typeof subscriptionData === 'object'
    ? (subscriptionData as Record<string, unknown>)
    : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eligibility = await resolveBillingEligibilityForUser({ supabase, user });

  let { usageRes, subscriptionRes } = await loadUsageAndSubscription(supabase, user.id);

  if (usageRes.error) {
    return NextResponse.json({ error: usageRes.error.message }, { status: 500 });
  }

  if (subscriptionRes.error) {
    return NextResponse.json({ error: subscriptionRes.error.message }, { status: 500 });
  }

  let rawSubscription = normalizeSubscriptionRecord(subscriptionRes.data);

  let priceId =
    asString(rawSubscription?.stripe_price_id)
    ?? asString(rawSubscription?.price_id);
  let explicitTier = normalizeSubscriptionTier(rawSubscription?.plan);
  let resolvedTierInterval = resolveTierAndIntervalByPriceId(priceId);

  const usageRecord =
    usageRes.data && typeof usageRes.data === 'object'
      ? (usageRes.data as Record<string, unknown>)
      : null;
  const usagePlan = asString(usageRecord?.plan);
  const subscriptionStatus = asString(rawSubscription?.status);
  const subscriptionTier = explicitTier ?? resolvedTierInterval.tier;

  const shouldAttemptStripeSync =
    !isSubscriptionStatusActive(subscriptionStatus)
    || !subscriptionTier
    || usagePlan === 'free';

  if (shouldAttemptStripeSync) {
    try {
      const supabaseAdmin = createAdminClient();
      const syncResult = await syncUserSubscriptionFromStripe({
        stripe,
        supabaseAdmin,
        userId: user.id,
      });

      if (syncResult) {
        ({ usageRes, subscriptionRes } = await loadUsageAndSubscription(supabase, user.id));

        if (!usageRes.error && !subscriptionRes.error) {
          rawSubscription = normalizeSubscriptionRecord(subscriptionRes.data);
          priceId =
            asString(rawSubscription?.stripe_price_id)
            ?? asString(rawSubscription?.price_id);
          explicitTier = normalizeSubscriptionTier(rawSubscription?.plan);
          resolvedTierInterval = resolveTierAndIntervalByPriceId(priceId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.warn('[billing/summary] Stripe sync fallback failed:', message);
    }
  }

  if (usageRes.error) {
    return NextResponse.json({ error: usageRes.error.message }, { status: 500 });
  }

  if (subscriptionRes.error) {
    return NextResponse.json({ error: subscriptionRes.error.message }, { status: 500 });
  }

  const rawInterval = isBillingInterval(rawSubscription?.billing_interval)
    ? rawSubscription.billing_interval
    : null;

  return NextResponse.json({
    usage: usageRes.data,
    subscription: {
      status: asString(rawSubscription?.status),
      tier: explicitTier ?? resolvedTierInterval.tier,
      interval: rawInterval ?? resolvedTierInterval.interval,
      price_id: priceId,
      cancel_at_period_end: Boolean(rawSubscription?.cancel_at_period_end),
      current_period_start: asString(rawSubscription?.current_period_start),
      current_period_end: asString(rawSubscription?.current_period_end),
    },
    eligibility,
  });
}
