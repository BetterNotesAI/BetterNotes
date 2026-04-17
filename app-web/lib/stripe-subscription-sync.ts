import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  BillingInterval,
  isBillingInterval,
  normalizeSubscriptionTier,
  resolveTierAndIntervalByPriceId,
} from '@/lib/billing-plans';

type PaidSubscriptionTier = 'better' | 'best';
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface SubscriptionSnapshot {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  tier: PaidSubscriptionTier;
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

interface DeriveTierAndIntervalArgs {
  subscription: Stripe.Subscription;
  fallbackTier?: unknown;
  fallbackInterval?: unknown;
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeCode = 'code' in error ? String(error.code ?? '') : '';
  if (maybeCode === 'PGRST204' || maybeCode === '42703') return true;

  const maybeMessage = 'message' in error ? String(error.message ?? '').toLowerCase() : '';
  return maybeMessage.includes('column') && maybeMessage.includes('not found');
}

function isPlanValidationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  if (code === '23514') return true;

  const message = 'message' in error ? String(error.message ?? '').toLowerCase() : '';
  return (
    message.includes('plan')
    && (
      message.includes('constraint')
      || message.includes('check')
      || message.includes('invalid')
    )
  );
}

function resolveIntervalFromRecurringPrice(
  recurring: Stripe.Price.Recurring | null | undefined
): BillingInterval | null {
  if (!recurring) return null;

  if (recurring.interval === 'month') {
    if (recurring.interval_count === 3) return 'quarterly';
    if (recurring.interval_count === 1) return 'monthly';
  }

  return null;
}

export function isSubscriptionStatusActive(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const raw = subscription as unknown as {
    current_period_end?: number | null;
    cancel_at?: number | null;
  };

  const ts =
    typeof raw.current_period_end === 'number'
      ? raw.current_period_end
      : raw.cancel_at ?? null;

  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

export function getSubscriptionPeriodStart(subscription: Stripe.Subscription): string | null {
  const raw = subscription as unknown as {
    current_period_start?: number | null;
    start_date?: number | null;
  };

  const ts =
    typeof raw.current_period_start === 'number'
      ? raw.current_period_start
      : raw.start_date ?? null;

  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

export function deriveTierAndIntervalFromSubscription({
  subscription,
  fallbackTier,
  fallbackInterval,
}: DeriveTierAndIntervalArgs): {
  tier: PaidSubscriptionTier;
  interval: BillingInterval | null;
  priceId: string | null;
} {
  const primaryPrice = subscription.items.data[0]?.price;
  const priceId = primaryPrice?.id ?? null;

  const resolved = resolveTierAndIntervalByPriceId(priceId);
  const metadataTier = normalizeSubscriptionTier(subscription.metadata?.requested_tier);
  const metadataInterval = isBillingInterval(subscription.metadata?.requested_interval)
    ? subscription.metadata.requested_interval
    : null;

  const fallbackTierNormalized = normalizeSubscriptionTier(fallbackTier);
  const fallbackIntervalNormalized = isBillingInterval(fallbackInterval)
    ? fallbackInterval
    : null;

  return {
    tier: resolved.tier ?? metadataTier ?? fallbackTierNormalized ?? 'better',
    interval:
      resolved.interval
      ?? resolveIntervalFromRecurringPrice(primaryPrice?.recurring)
      ?? metadataInterval
      ?? fallbackIntervalNormalized,
    priceId,
  };
}

export async function upsertSubscriptionSnapshot(
  supabaseAdmin: AnySupabaseClient,
  snapshot: SubscriptionSnapshot
): Promise<void> {
  const basePayload = {
    user_id: snapshot.userId,
    stripe_customer_id: snapshot.stripeCustomerId,
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    status: snapshot.status,
    price_id: snapshot.priceId,
    cancel_at_period_end: snapshot.cancelAtPeriodEnd,
    current_period_start: snapshot.periodStart,
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

export async function applyProfilePlanForSubscription(
  supabaseAdmin: AnySupabaseClient,
  args: { userId: string; tier: PaidSubscriptionTier; isActive: boolean }
): Promise<void> {
  const planCandidates = args.isActive
    ? (args.tier === 'best' ? ['best', 'pro'] : ['better', 'pro'])
    : ['free'];

  let lastError: unknown = null;

  for (const plan of planCandidates) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ plan })
      .eq('id', args.userId);

    if (!error) {
      return;
    }

    lastError = error;

    if (!isPlanValidationError(error)) {
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

export async function resolveUserIdByStripeCustomerId(
  supabaseAdmin: AnySupabaseClient,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  return typeof data?.id === 'string' ? data.id : null;
}

export async function resolveUserIdByEmail(
  supabaseAdmin: AnySupabaseClient,
  email: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  return typeof data?.id === 'string' ? data.id : null;
}

export function pickMostRelevantSubscription(
  subscriptions: Stripe.Subscription[]
): Stripe.Subscription | null {
  if (subscriptions.length === 0) return null;

  return [...subscriptions]
    .sort((a, b) => {
      const activeRankA = isSubscriptionStatusActive(a.status) ? 1 : 0;
      const activeRankB = isSubscriptionStatusActive(b.status) ? 1 : 0;
      if (activeRankA !== activeRankB) return activeRankB - activeRankA;

      return (b.created ?? 0) - (a.created ?? 0);
    })[0] ?? null;
}

export async function syncUserSubscriptionFromStripe(args: {
  stripe: Stripe;
  supabaseAdmin: AnySupabaseClient;
  userId: string;
}): Promise<SubscriptionSnapshot | null> {
  const { data: profile, error: profileError } = await args.supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', args.userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const stripeCustomerId =
    profile && typeof profile === 'object' && typeof profile.stripe_customer_id === 'string'
      ? profile.stripe_customer_id
      : null;

  if (!stripeCustomerId) {
    return null;
  }

  const subscriptions = await args.stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 20,
  });

  const subscription = pickMostRelevantSubscription(subscriptions.data);
  if (!subscription) {
    return null;
  }

  const resolved = deriveTierAndIntervalFromSubscription({ subscription });

  const snapshot: SubscriptionSnapshot = {
    userId: args.userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: resolved.priceId,
    tier: resolved.tier,
    interval: resolved.interval,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodStart: getSubscriptionPeriodStart(subscription),
    periodEnd: getSubscriptionPeriodEnd(subscription),
  };

  await upsertSubscriptionSnapshot(args.supabaseAdmin, snapshot);

  await args.supabaseAdmin.rpc('set_stripe_customer_id', {
    p_user_id: args.userId,
    p_customer_id: stripeCustomerId,
  });

  await applyProfilePlanForSubscription(args.supabaseAdmin, {
    userId: args.userId,
    tier: snapshot.tier,
    isActive: isSubscriptionStatusActive(snapshot.status),
  });

  return snapshot;
}
