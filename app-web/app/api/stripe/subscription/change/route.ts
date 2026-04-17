import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BillingInterval,
  getStripePriceId,
  isBillingInterval,
  isPaidBillingTier,
  PaidBillingTier,
} from '@/lib/billing-plans';
import { resolveBillingEligibilityForUser } from '@/lib/billing-eligibility';
import { syncUserSubscriptionFromStripe } from '@/lib/stripe-subscription-sync';
import { loadManageableStripeSubscription } from '@/lib/stripe-subscription-actions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eligibility = await resolveBillingEligibilityForUser({ supabase, user });
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: eligibility.message, reason: eligibility.reason, eligibility },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({})) as {
    tier?: unknown;
    interval?: unknown;
  };

  const tierCandidate = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : null;
  if (!isPaidBillingTier(tierCandidate)) {
    return NextResponse.json(
      { error: 'Invalid plan. Supported plans are "better" and "best".' },
      { status: 400 }
    );
  }
  const tier: PaidBillingTier = tierCandidate;

  const intervalCandidate =
    typeof body.interval === 'string' ? body.interval.trim().toLowerCase() : 'monthly';
  const interval: BillingInterval = isBillingInterval(intervalCandidate) ? intervalCandidate : 'monthly';

  const priceId = getStripePriceId(tier, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured for ${tier} (${interval})` },
      { status: 500 }
    );
  }

  const supabaseAdmin = createAdminClient();

  const lookup = await loadManageableStripeSubscription({
    stripe,
    supabaseAdmin,
    userId: user.id,
  });

  if (!lookup) {
    return NextResponse.json(
      { error: 'No active subscription found. Please subscribe first.' },
      { status: 404 }
    );
  }

  const currentItem = lookup.subscription.items.data[0];
  if (!currentItem) {
    return NextResponse.json(
      { error: 'Subscription has no billable items.' },
      { status: 500 }
    );
  }

  if (currentItem.price.id === priceId && !lookup.subscription.cancel_at_period_end) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  try {
    await stripe.subscriptions.update(lookup.subscription.id, {
      items: [{ id: currentItem.id, price: priceId }],
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      metadata: {
        ...(lookup.subscription.metadata ?? {}),
        supabase_user_id: user.id,
        requested_tier: tier,
        requested_interval: interval,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to change subscription.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await syncUserSubscriptionFromStripe({ stripe, supabaseAdmin, userId: user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.warn('[stripe/subscription/change] sync failed:', message);
  }

  return NextResponse.json({ ok: true, tier, interval });
}
