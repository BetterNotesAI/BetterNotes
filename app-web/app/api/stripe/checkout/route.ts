import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import {
  BillingInterval,
  getStripePriceId,
  isBillingInterval,
  isPaidBillingTier,
  PaidBillingTier,
} from '@/lib/billing-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

function getSupabaseAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  const body = await req.json().catch(() => ({})) as {
    tier?: unknown;
    interval?: unknown;
    plan?: unknown;
  };

  const tierCandidate = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : null;
  const legacyPlanCandidate = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : null;

  const normalizedTierCandidate =
    tierCandidate ??
    (legacyPlanCandidate === 'pro' ? 'better' : legacyPlanCandidate);

  if (!isPaidBillingTier(normalizedTierCandidate)) {
    return NextResponse.json(
      { error: 'Invalid plan. Supported plans are "better" and "best".' },
      { status: 400 }
    );
  }

  const intervalCandidate =
    typeof body.interval === 'string' ? body.interval.trim().toLowerCase() : 'monthly';
  const interval: BillingInterval = isBillingInterval(intervalCandidate) ? intervalCandidate : 'monthly';
  const tier: PaidBillingTier = normalizedTierCandidate;

  const priceId = getStripePriceId(tier, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured for ${tier} (${interval})` },
      { status: 500 }
    );
  }

  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  // ─── Obtener o crear Stripe customer de forma atómica ──────────────────────
  // get_or_reserve_stripe_customer usa SELECT FOR UPDATE sobre profiles para
  // serializar requests concurrentes del mismo usuario. Si dos requests llegan
  // en paralelo, la segunda espera a que la primera termine su transacción antes
  // de continuar, evitando la creación de clientes duplicados en Stripe.
  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingCustomerId, error: rpcReadError } = await supabaseAdmin.rpc(
    'get_or_reserve_stripe_customer',
    { p_user_id: user.id }
  );

  if (rpcReadError) {
    console.error('[stripe/checkout] get_or_reserve_stripe_customer error:', rpcReadError);
    return NextResponse.json({ error: 'Failed to retrieve customer information' }, { status: 500 });
  }

  let stripeCustomerId = existingCustomerId as string | null;

  if (!stripeCustomerId) {
    // No hay customer todavía — crear uno en Stripe
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });

    // Persistir de forma idempotente en profiles. Si una request paralela ya
    // creó y guardó un customer_id mientras esta request esperaba, set_stripe_customer_id
    // devuelve el valor ganador (el primero en escribir) sin sobreescribir.
    const { data: finalCustomerId, error: rpcWriteError } = await supabaseAdmin.rpc(
      'set_stripe_customer_id',
      { p_user_id: user.id, p_customer_id: customer.id }
    );

    if (rpcWriteError) {
      console.error('[stripe/checkout] set_stripe_customer_id error:', rpcWriteError);
      // No es fatal — usar el customer recién creado igualmente. El webhook
      // sincronizará subscriptions con el customer correcto al completar el pago.
      stripeCustomerId = customer.id;
    } else {
      stripeCustomerId = finalCustomerId as string;

      // Si el customer ganador difiere del que acabamos de crear, el nuestro es
      // un duplicado — eliminarlo en Stripe para mantener limpia la cuenta.
      if (stripeCustomerId !== customer.id) {
        stripe.customers.del(customer.id).catch((err) => {
          console.warn('[stripe/checkout] Failed to delete duplicate Stripe customer:', err);
        });
      }
    }
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/settings/billing?success=true&tier=${tier}&interval=${interval}`,
      cancel_url: `${origin}/settings/billing`,
      metadata: {
        supabase_user_id: user.id,
        requested_tier: tier,
        requested_interval: interval,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!session.url) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
