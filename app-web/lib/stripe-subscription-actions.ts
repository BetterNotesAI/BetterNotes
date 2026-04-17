import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface ActiveSubscriptionLookup {
  stripeCustomerId: string;
  subscription: Stripe.Subscription;
}

const MANAGEABLE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
]);

export async function loadManageableStripeSubscription(args: {
  stripe: Stripe;
  supabaseAdmin: AnySupabaseClient;
  userId: string;
}): Promise<ActiveSubscriptionLookup | null> {
  const [{ data: sub }, { data: profile }] = await Promise.all([
    args.supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', args.userId)
      .maybeSingle(),
    args.supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', args.userId)
      .maybeSingle(),
  ]);

  const stripeCustomerId =
    (sub && typeof sub.stripe_customer_id === 'string' ? sub.stripe_customer_id : null)
    ?? (profile && typeof profile.stripe_customer_id === 'string' ? profile.stripe_customer_id : null);

  if (!stripeCustomerId) return null;

  const storedSubscriptionId =
    sub && typeof sub.stripe_subscription_id === 'string' ? sub.stripe_subscription_id : null;

  if (storedSubscriptionId) {
    try {
      const subscription = await args.stripe.subscriptions.retrieve(storedSubscriptionId);
      if (MANAGEABLE_STATUSES.has(subscription.status)) {
        return { stripeCustomerId, subscription };
      }
    } catch {
      // Fall through to customer-wide lookup below.
    }
  }

  const subscriptions = await args.stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 20,
  });

  const manageable = subscriptions.data
    .filter((s) => MANAGEABLE_STATUSES.has(s.status))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];

  if (!manageable) return null;
  return { stripeCustomerId, subscription: manageable };
}
