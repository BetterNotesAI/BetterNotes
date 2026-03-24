import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

// Admin client bypasses RLS — only use server-side with service_role key
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

        const stripeSubscriptionId = session.subscription as string;
        const stripeCustomerId = session.customer as string;

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const periodEnd = getPeriodEnd(subscription);

        await supabaseAdmin.from('subscriptions').upsert(
          {
            user_id: supabaseUserId,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_price_id: subscription.items.data[0]?.price.id ?? null,
            status: subscription.status,
            plan: 'pro',
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

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

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        // Downgrade plan if subscription is no longer active
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();
        if (sub?.user_id) {
          await supabaseAdmin
            .from('profiles')
            .update({ plan: isActive ? 'pro' : 'free' })
            .eq('id', sub.user_id);
        }

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
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal webhook handler error';
    // Log server-side but still return 200 to prevent Stripe retries for application errors
    console.error('[stripe/webhook] Handler error:', message);
  }

  return NextResponse.json({ received: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  return (data?.id as string) ?? null;
}
