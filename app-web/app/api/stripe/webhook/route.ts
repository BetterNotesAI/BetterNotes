import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  BillingInterval,
  isBillingInterval,
  normalizeSubscriptionTier,
  resolveTierAndIntervalByPriceId,
} from '@/lib/billing-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

interface SubscriptionSnapshot {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  tier: 'better' | 'best';
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Admin client bypasses RLS - only use server-side with service_role key
function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Derives the current period end from a subscription.
 * In Stripe API 2026-02-25.clover, `current_period_end` was removed.
 * We use `cancel_at` (populated when cancel_at_period_end=true) or
 * fall back to null if the subscription has no explicit end date.
 */
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
  const ts = subscription.cancel_at ?? null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function isActiveSubscriptionStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeCode = 'code' in error ? String(error.code ?? '') : '';
  if (maybeCode === 'PGRST204' || maybeCode === '42703') return true;

  const maybeMessage = 'message' in error ? String(error.message ?? '').toLowerCase() : '';
  return maybeMessage.includes('column') && maybeMessage.includes('not found');
}

async function upsertSubscriptionSnapshot(
  supabaseAdmin: SupabaseAdmin,
  snapshot: SubscriptionSnapshot
) {
  const basePayload = {
    user_id: snapshot.userId,
    stripe_customer_id: snapshot.stripeCustomerId,
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    status: snapshot.status,
    price_id: snapshot.priceId,
    cancel_at_period_end: snapshot.cancelAtPeriodEnd,
    current_period_end: snapshot.periodEnd,
    updated_at: new Date().toISOString(),
  };

  const modernPayload = {
    ...basePayload,
    stripe_price_id: snapshot.priceId,
    plan: snapshot.tier,
    billing_interval: snapshot.interval,
  };

  const primary = await supabaseAdmin
    .from('subscriptions')
    .upsert(modernPayload, { onConflict: 'user_id' });

  if (!primary.error) {
    return;
  }

  if (!isMissingColumnError(primary.error)) {
    throw primary.error;
  }

  const fallback = await supabaseAdmin
    .from('subscriptions')
    .upsert(basePayload, { onConflict: 'user_id' });

  if (fallback.error) {
    throw fallback.error;
  }
}

async function updateSubscriptionSnapshotByStripeId(
  supabaseAdmin: SupabaseAdmin,
  snapshot: SubscriptionSnapshot
) {
  const basePayload = {
    status: snapshot.status,
    price_id: snapshot.priceId,
    cancel_at_period_end: snapshot.cancelAtPeriodEnd,
    current_period_end: snapshot.periodEnd,
    updated_at: new Date().toISOString(),
  };

  const modernPayload = {
    ...basePayload,
    stripe_price_id: snapshot.priceId,
    plan: snapshot.tier,
    billing_interval: snapshot.interval,
  };

  const primary = await supabaseAdmin
    .from('subscriptions')
    .update(modernPayload)
    .eq('stripe_subscription_id', snapshot.stripeSubscriptionId);

  if (!primary.error) {
    return;
  }

  if (!isMissingColumnError(primary.error)) {
    throw primary.error;
  }

  const fallback = await supabaseAdmin
    .from('subscriptions')
    .update(basePayload)
    .eq('stripe_subscription_id', snapshot.stripeSubscriptionId);

  if (fallback.error) {
    throw fallback.error;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const supabaseUserId =
          session.metadata?.supabase_user_id ??
          (session.customer_details?.email
            ? await resolveUserIdByEmail(supabaseAdmin, session.customer_details.email)
            : null);

        if (!supabaseUserId) break;

        const stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;

        if (!stripeSubscriptionId || !stripeCustomerId) break;

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const periodEnd = getPeriodEnd(subscription);
        const stripePriceId = subscription.items.data[0]?.price.id ?? null;

        const resolvedTierInterval = resolveTierAndIntervalByPriceId(stripePriceId);
        const metadataTier = normalizeSubscriptionTier(session.metadata?.requested_tier);
        const metadataInterval = isBillingInterval(session.metadata?.requested_interval)
          ? session.metadata.requested_interval
          : null;

        const tier = resolvedTierInterval.tier ?? metadataTier ?? 'better';
        const interval = resolvedTierInterval.interval ?? metadataInterval;

        await upsertSubscriptionSnapshot(supabaseAdmin, {
          userId: supabaseUserId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: subscription.status,
          priceId: stripePriceId,
          tier,
          interval,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          periodEnd,
        });

        // Update plan and, idempotently, stripe_customer_id in profiles.
        // Using set_stripe_customer_id RPC: only writes if not already set,
        // avoiding overwriting a valid customer_id with a potential duplicate.
        await supabaseAdmin.rpc('set_stripe_customer_id', {
          p_user_id: supabaseUserId,
          p_customer_id: stripeCustomerId,
        });

        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'pro' })
          .eq('id', supabaseUserId);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd = getPeriodEnd(subscription);
        const stripePriceId = subscription.items.data[0]?.price.id ?? null;
        const resolvedTierInterval = resolveTierAndIntervalByPriceId(stripePriceId);
        const tier = resolvedTierInterval.tier ?? 'better';

        const { data: existingSub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, stripe_customer_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        if (!existingSub?.user_id || !existingSub?.stripe_customer_id) {
          break;
        }

        await updateSubscriptionSnapshotByStripeId(supabaseAdmin, {
          userId: existingSub.user_id,
          stripeCustomerId: existingSub.stripe_customer_id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: stripePriceId,
          tier,
          interval: resolvedTierInterval.interval,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          periodEnd,
        });

        // Downgrade plan if subscription is no longer active
        const isActive = isActiveSubscriptionStatus(subscription.status);
        await supabaseAdmin
          .from('profiles')
          .update({ plan: isActive ? 'pro' : 'free' })
          .eq('id', existingSub.user_id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        if (sub?.user_id) {
          await supabaseAdmin
            .from('profiles')
            .update({ plan: 'free' })
            .eq('id', sub.user_id);
        }

        break;
      }

      default:
        // Unhandled event type - ignore
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal webhook handler error';
    // Log server-side but still return 200 to prevent Stripe retries for application errors
    console.error('[stripe/webhook] Handler error:', message);
  }

  return NextResponse.json({ received: true });
}

async function resolveUserIdByEmail(
  supabaseAdmin: SupabaseAdmin,
  email: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  return (data?.id as string) ?? null;
}
