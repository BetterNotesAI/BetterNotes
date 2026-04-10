import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isBillingInterval,
  normalizeSubscriptionTier,
  resolveTierAndIntervalByPriceId,
} from '@/lib/billing-plans';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [usageRes, subscriptionRes] = await Promise.all([
    supabase.rpc('get_usage_status', { p_user_id: user.id }),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  if (usageRes.error) {
    return NextResponse.json({ error: usageRes.error.message }, { status: 500 });
  }

  if (subscriptionRes.error) {
    return NextResponse.json({ error: subscriptionRes.error.message }, { status: 500 });
  }

  const rawSubscription =
    subscriptionRes.data && typeof subscriptionRes.data === 'object'
      ? (subscriptionRes.data as Record<string, unknown>)
      : null;

  const priceId =
    asString(rawSubscription?.stripe_price_id) ??
    asString(rawSubscription?.price_id);

  const explicitTier = normalizeSubscriptionTier(rawSubscription?.plan);
  const resolvedTierInterval = resolveTierAndIntervalByPriceId(priceId);

  const rawInterval = isBillingInterval(rawSubscription?.billing_interval)
    ? rawSubscription.billing_interval
    : null;

  return NextResponse.json({
    usage: usageRes.data,
    subscription: {
      status: asString(rawSubscription?.status),
      tier: explicitTier ?? resolvedTierInterval.tier,
      interval: rawInterval ?? resolvedTierInterval.interval,
      price_id: priceId,
      cancel_at_period_end: Boolean(rawSubscription?.cancel_at_period_end),
      current_period_end: asString(rawSubscription?.current_period_end),
    },
  });
}
