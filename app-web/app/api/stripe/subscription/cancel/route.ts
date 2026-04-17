import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBillingEligibilityForUser } from '@/lib/billing-eligibility';
import { syncUserSubscriptionFromStripe } from '@/lib/stripe-subscription-sync';
import { loadManageableStripeSubscription } from '@/lib/stripe-subscription-actions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export async function POST() {
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

  const supabaseAdmin = createAdminClient();

  const lookup = await loadManageableStripeSubscription({
    stripe,
    supabaseAdmin,
    userId: user.id,
  });

  if (!lookup) {
    return NextResponse.json(
      { error: 'No active subscription found.' },
      { status: 404 }
    );
  }

  if (lookup.subscription.cancel_at_period_end) {
    return NextResponse.json({ ok: true, already_scheduled: true });
  }

  try {
    await stripe.subscriptions.update(lookup.subscription.id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await syncUserSubscriptionFromStripe({ stripe, supabaseAdmin, userId: user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.warn('[stripe/subscription/cancel] sync failed:', message);
  }

  return NextResponse.json({ ok: true });
}
