import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { resolveBillingEligibilityForUser } from '@/lib/billing-eligibility';

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

  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const stripeCustomerId =
    (sub && typeof sub.stripe_customer_id === 'string' ? sub.stripe_customer_id : null)
    ?? (profile && typeof profile.stripe_customer_id === 'string' ? profile.stripe_customer_id : null);

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription found. Please subscribe first.' },
      { status: 400 }
    );
  }

  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  let portalSession: Stripe.BillingPortal.Session;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ url: portalSession.url });
}
