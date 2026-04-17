import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getCheckoutSessionBinding,
  markCheckoutSessionCompleted,
  markCheckoutSessionVerified,
  recordBillingIncident,
} from '@/lib/stripe-checkout-guard';
import { syncUserSubscriptionFromStripe } from '@/lib/stripe-subscription-sync';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

function asStripeId(value: string | { id?: string | null } | null | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
    return value.id;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { session_id?: unknown };
  const sessionId =
    typeof body.session_id === 'string' && body.session_id.trim().length > 0
      ? body.session_id.trim()
      : null;

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  let binding: Awaited<ReturnType<typeof getCheckoutSessionBinding>>;
  try {
    binding = await getCheckoutSessionBinding({
      supabaseAdmin,
      stripeCheckoutSessionId: sessionId,
      failOnMissingTable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown checkout verification error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!binding) {
    await recordBillingIncident({
      supabaseAdmin,
      incidentType: 'checkout_verify_missing_binding',
      severity: 'critical',
      userId: user.id,
      stripeCheckoutSessionId: sessionId,
      details: {
        source: 'checkout_verify_route',
      },
    });

    return NextResponse.json(
      { error: 'Billing session not recognized. Please contact support.' },
      { status: 404 }
    );
  }

  if (binding.user_id !== user.id) {
    await recordBillingIncident({
      supabaseAdmin,
      incidentType: 'checkout_verify_user_mismatch',
      severity: 'critical',
      userId: user.id,
      stripeCheckoutSessionId: sessionId,
      stripeCustomerId: binding.stripe_customer_id,
      stripeSubscriptionId: binding.stripe_subscription_id,
      details: {
        bound_user_id: binding.user_id,
        requester_user_id: user.id,
      },
    });

    return NextResponse.json(
      { error: 'Billing session does not belong to this account.' },
      { status: 403 }
    );
  }

  if (binding.status === 'orphaned') {
    return NextResponse.json(
      { error: 'This billing session was voided for safety. Please start a new checkout.' },
      { status: 409 }
    );
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const stripeCustomerId = asStripeId(
    checkoutSession.customer as unknown as string | { id?: string | null } | null
  );

  if (binding.stripe_customer_id && stripeCustomerId && binding.stripe_customer_id !== stripeCustomerId) {
    await recordBillingIncident({
      supabaseAdmin,
      incidentType: 'checkout_verify_customer_mismatch',
      severity: 'critical',
      userId: user.id,
      stripeCheckoutSessionId: sessionId,
      stripeCustomerId,
      stripeSubscriptionId: binding.stripe_subscription_id,
      details: {
        bound_customer_id: binding.stripe_customer_id,
        observed_customer_id: stripeCustomerId,
      },
    });

    return NextResponse.json(
      { error: 'Billing session validation failed. Please contact support.' },
      { status: 409 }
    );
  }

  const stripeSubscriptionId = asStripeId(
    checkoutSession.subscription as unknown as string | { id?: string | null } | null
  );

  await markCheckoutSessionVerified({
    supabaseAdmin,
    stripeCheckoutSessionId: sessionId,
  });

  if (stripeSubscriptionId || checkoutSession.status === 'complete') {
    await markCheckoutSessionCompleted({
      supabaseAdmin,
      stripeCheckoutSessionId: sessionId,
      stripeSubscriptionId: stripeSubscriptionId ?? binding.stripe_subscription_id,
      stripeCustomerId: stripeCustomerId ?? binding.stripe_customer_id,
    });

    try {
      await syncUserSubscriptionFromStripe({
        stripe,
        supabaseAdmin,
        userId: user.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.warn('[stripe/checkout/verify] sync fallback failed:', message);
    }
  }

  return NextResponse.json({
    ok: true,
    status: checkoutSession.status,
    payment_status: checkoutSession.payment_status,
    subscription_id: stripeSubscriptionId ?? null,
  });
}
