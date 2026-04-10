export type BillingTier = 'free' | 'better' | 'best';
export type PaidBillingTier = Exclude<BillingTier, 'free'>;
export type BillingInterval = 'monthly' | 'quarterly';

function readEnvValue(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function readEnvValues(...names: string[]): string[] {
  return names
    .map((name) => process.env[name]?.trim() ?? '')
    .filter(Boolean);
}

export function isPaidBillingTier(value: unknown): value is PaidBillingTier {
  return value === 'better' || value === 'best';
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'quarterly';
}

export function normalizeSubscriptionTier(value: unknown): PaidBillingTier | null {
  if (value === 'better' || value === 'best') return value;
  if (value === 'pro') return 'better';
  return null;
}

export function getStripePriceId(
  tier: PaidBillingTier,
  interval: BillingInterval
): string | null {
  if (tier === 'better' && interval === 'monthly') {
    return readEnvValue(
      'STRIPE_BETTER_MONTHLY_PRICE_ID',
      'NEXT_PUBLIC_STRIPE_BETTER_MONTHLY_PRICE_ID',
      'STRIPE_PRICE_PRO_MONTHLY'
    );
  }

  if (tier === 'better' && interval === 'quarterly') {
    return readEnvValue(
      'STRIPE_BETTER_QUARTERLY_PRICE_ID',
      'NEXT_PUBLIC_STRIPE_BETTER_QUARTERLY_PRICE_ID'
    );
  }

  if (tier === 'best' && interval === 'monthly') {
    return readEnvValue(
      'STRIPE_BEST_MONTHLY_PRICE_ID',
      'NEXT_PUBLIC_STRIPE_BEST_MONTHLY_PRICE_ID'
    );
  }

  return readEnvValue(
    'STRIPE_BEST_QUARTERLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_BEST_QUARTERLY_PRICE_ID'
  );
}

export function resolveTierAndIntervalByPriceId(priceId: string | null | undefined): {
  tier: PaidBillingTier | null;
  interval: BillingInterval | null;
} {
  if (!priceId) {
    return { tier: null, interval: null };
  }

  const betterMonthlyIds = readEnvValues(
    'STRIPE_BETTER_MONTHLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_BETTER_MONTHLY_PRICE_ID',
    'STRIPE_PRICE_PRO_MONTHLY'
  );

  if (betterMonthlyIds.includes(priceId)) {
    return { tier: 'better', interval: 'monthly' };
  }

  const betterQuarterlyIds = readEnvValues(
    'STRIPE_BETTER_QUARTERLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_BETTER_QUARTERLY_PRICE_ID'
  );

  if (betterQuarterlyIds.includes(priceId)) {
    return { tier: 'better', interval: 'quarterly' };
  }

  const bestMonthlyIds = readEnvValues(
    'STRIPE_BEST_MONTHLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_BEST_MONTHLY_PRICE_ID'
  );

  if (bestMonthlyIds.includes(priceId)) {
    return { tier: 'best', interval: 'monthly' };
  }

  const bestQuarterlyIds = readEnvValues(
    'STRIPE_BEST_QUARTERLY_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_BEST_QUARTERLY_PRICE_ID'
  );

  if (bestQuarterlyIds.includes(priceId)) {
    return { tier: 'best', interval: 'quarterly' };
  }

  return { tier: null, interval: null };
}
