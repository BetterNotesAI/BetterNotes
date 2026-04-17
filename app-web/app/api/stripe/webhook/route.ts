import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  applyProfilePlanForSubscription,
  deriveTierAndIntervalFromSubscription,
  getSubscriptionPeriodStart,
  getSubscriptionPeriodEnd,
  isSubscriptionStatusActive,
  resolveUserIdByEmail,
  resolveUserIdByStripeCustomerId,
  upsertSubscriptionSnapshot,
} from '@/lib/stripe-subscription-sync';
import {
  getCheckoutSessionBinding,
  markCheckoutSessionCompleted,
  recordBillingIncident,
  remediateOrphanCheckoutSession,
} from '@/lib/stripe-checkout-guard';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Admin client bypasses RLS - only use server-side with service_role key
function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function asStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (typeof customer === 'string' && customer.trim()) return customer;
  if (
    customer
    && typeof customer === 'object'
    && 'id' in customer
    && typeof customer.id === 'string'
    && customer.id.trim()
  ) {
    return customer.id;
  }
  return null;
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeCode = 'code' in error ? String(error.code ?? '') : '';
  if (maybeCode === 'PGRST204' || maybeCode === '42703') return true;

  const maybeMessage = 'message' in error ? String(error.message ?? '').toLowerCase() : '';
  return (
    maybeMessage.includes('column')
    && (
      maybeMessage.includes('not found')
      || maybeMessage.includes('does not exist')
    )
  );
}

async function markPaidCreditsResetAnchor(
  supabaseAdmin: SupabaseAdmin,
  userId: string
): Promise<void> {
  const now = new Date();

  const existingRes = await supabaseAdmin
    .from('subscriptions')
    .select('credits_reset_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingRes.error) {
    if (isMissingColumnError(existingRes.error)) return;
    throw existingRes.error;
  }

  const currentAnchor =
    existingRes.data && typeof existingRes.data.credits_reset_at === 'string'
      ? existingRes.data.credits_reset_at
      : null;

  if (currentAnchor) {
    const parsed = new Date(currentAnchor);
    if (
      !Number.isNaN(parsed.getTime())
      && parsed.getUTCFullYear() === now.getUTCFullYear()
      && parsed.getUTCMonth() === now.getUTCMonth()
    ) {
      return;
    }
  }

  const updateRes = await supabaseAdmin
    .from('subscriptions')
    .update({ credits_reset_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('user_id', userId);

  if (updateRes.error && !isMissingColumnError(updateRes.error)) {
    throw updateRes.error;
  }
}

async function resolveSubscriptionOwner(
  supabaseAdmin: SupabaseAdmin,
  subscription: Stripe.Subscription
): Promise<{ userId: string | null; stripeCustomerId: string | null }> {
  const stripeCustomerId = asStripeCustomerId(subscription.customer);

  const { data: existingSub } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, stripe_customer_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  const userIdFromExisting =
    existingSub && typeof existingSub.user_id === 'string' ? existingSub.user_id : null;

  const userIdFromCustomer =
    !userIdFromExisting && stripeCustomerId
      ? await resolveUserIdByStripeCustomerId(supabaseAdmin, stripeCustomerId)
      : null;

  const stripeCustomerIdFromExisting =
    existingSub && typeof existingSub.stripe_customer_id === 'string'
      ? existingSub.stripe_customer_id
      : null;

  return {
    userId: userIdFromExisting ?? userIdFromCustomer,
    stripeCustomerId: stripeCustomerId ?? stripeCustomerIdFromExisting,
  };
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

        const checkoutSessionId = session.id;
        const stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const stripeCustomerId = asStripeCustomerId(session.customer);

        await markCheckoutSessionCompleted({
          supabaseAdmin,
          stripeCheckoutSessionId: checkoutSessionId,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
          stripeCustomerId,
        });

        const boundCheckout = await getCheckoutSessionBinding({
          supabaseAdmin,
          stripeCheckoutSessionId: checkoutSessionId,
        });
        const boundUserId = boundCheckout?.user_id ?? null;

        const metadataUserId = session.metadata?.supabase_user_id ?? null;

        if (boundUserId && metadataUserId && boundUserId !== metadataUserId) {
          await remediateOrphanCheckoutSession({
            stripe,
            supabaseAdmin,
            eventId: event.id,
            stripeCheckoutSessionId: checkoutSessionId,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscriptionId ?? null,
            session,
            details: {
              reason: 'bound_user_mismatch_metadata_user',
              bound_user_id: boundUserId,
              metadata_user_id: metadataUserId,
            },
          });
          break;
        }

        let supabaseUserId = boundUserId ?? metadataUserId;

        if (!supabaseUserId && stripeCustomerId) {
          supabaseUserId = await resolveUserIdByStripeCustomerId(supabaseAdmin, stripeCustomerId);
        }

        if (!supabaseUserId && session.customer_details?.email) {
          supabaseUserId = await resolveUserIdByEmail(
            supabaseAdmin,
            session.customer_details.email
          );
        }

        if (boundUserId && supabaseUserId && boundUserId !== supabaseUserId) {
          await remediateOrphanCheckoutSession({
            stripe,
            supabaseAdmin,
            eventId: event.id,
            stripeCheckoutSessionId: checkoutSessionId,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscriptionId ?? null,
            session,
            details: {
              reason: 'bound_user_mismatch_resolved_user',
              bound_user_id: boundUserId,
              resolved_user_id: supabaseUserId,
            },
          });
          break;
        }

        if (!supabaseUserId || !stripeSubscriptionId || !stripeCustomerId) {
          await remediateOrphanCheckoutSession({
            stripe,
            supabaseAdmin,
            eventId: event.id,
            stripeCheckoutSessionId: checkoutSessionId,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscriptionId ?? null,
            session,
            details: {
              reason: 'missing_resolvable_user_or_subscription',
              resolved_user_id: supabaseUserId,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
            },
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const resolved = deriveTierAndIntervalFromSubscription({
          subscription,
          fallbackTier: session.metadata?.requested_tier,
          fallbackInterval: session.metadata?.requested_interval,
        });

        await upsertSubscriptionSnapshot(supabaseAdmin, {
          userId: supabaseUserId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: subscription.status,
          priceId: resolved.priceId,
          tier: resolved.tier,
          interval: resolved.interval,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          periodStart: getSubscriptionPeriodStart(subscription),
          periodEnd: getSubscriptionPeriodEnd(subscription),
        });

        await supabaseAdmin.rpc('set_stripe_customer_id', {
          p_user_id: supabaseUserId,
          p_customer_id: stripeCustomerId,
        });

        await applyProfilePlanForSubscription(supabaseAdmin, {
          userId: supabaseUserId,
          tier: resolved.tier,
          isActive: isSubscriptionStatusActive(subscription.status),
        });

        if (isSubscriptionStatusActive(subscription.status)) {
          await markPaidCreditsResetAnchor(supabaseAdmin, supabaseUserId);
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const owner = await resolveSubscriptionOwner(supabaseAdmin, subscription);

        if (!owner.userId || !owner.stripeCustomerId) {
          await recordBillingIncident({
            supabaseAdmin,
            incidentType: 'subscription_without_resolvable_user',
            severity: 'critical',
            stripeEventId: event.id,
            stripeCustomerId: asStripeCustomerId(subscription.customer),
            stripeSubscriptionId: subscription.id,
            details: {
              event_type: event.type,
              subscription_status: subscription.status,
            },
          });

          try {
            await stripe.subscriptions.cancel(subscription.id, {}, {
              idempotencyKey: `unbound-subscription-cancel-${subscription.id}`,
            });
          } catch (cancelError) {
            const message = cancelError instanceof Error ? cancelError.message : 'Unknown cancellation error';
            console.warn('[stripe/webhook] Failed to cancel unbound subscription:', message);
          }

          break;
        }

        const resolved = deriveTierAndIntervalFromSubscription({ subscription });

        await upsertSubscriptionSnapshot(supabaseAdmin, {
          userId: owner.userId,
          stripeCustomerId: owner.stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: resolved.priceId,
          tier: resolved.tier,
          interval: resolved.interval,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          periodStart: getSubscriptionPeriodStart(subscription),
          periodEnd: getSubscriptionPeriodEnd(subscription),
        });

        await supabaseAdmin.rpc('set_stripe_customer_id', {
          p_user_id: owner.userId,
          p_customer_id: owner.stripeCustomerId,
        });

        await applyProfilePlanForSubscription(supabaseAdmin, {
          userId: owner.userId,
          tier: resolved.tier,
          isActive: isSubscriptionStatusActive(subscription.status),
        });

        if (event.type === 'customer.subscription.created' && isSubscriptionStatusActive(subscription.status)) {
          await markPaidCreditsResetAnchor(supabaseAdmin, owner.userId);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const owner = await resolveSubscriptionOwner(supabaseAdmin, subscription);

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_end: getSubscriptionPeriodEnd(subscription),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        if (owner.userId) {
          await applyProfilePlanForSubscription(supabaseAdmin, {
            userId: owner.userId,
            tier: 'better',
            isActive: false,
          });
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
