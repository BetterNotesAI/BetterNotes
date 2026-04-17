import type { SupabaseClient, User } from '@supabase/supabase-js';

export type BillingIneligibilityReason =
  | 'unauthenticated'
  | 'anonymous'
  | 'missing_email'
  | 'unverified_email';

export interface BillingEligibility {
  eligible: boolean;
  reason: BillingIneligibilityReason | null;
  message: string;
  is_anonymous: boolean;
  has_email: boolean;
  email_verified: boolean;
}

type AnySupabaseClient = SupabaseClient<any, any, any>;

interface ComputeBillingEligibilityInput {
  hasUser: boolean;
  isAnonymous: boolean;
  hasEmail: boolean;
  emailVerified: boolean;
}

function messageForReason(reason: BillingIneligibilityReason): string {
  switch (reason) {
    case 'unauthenticated':
      return 'Log in to activate or manage your subscription.';
    case 'anonymous':
      return 'Create your account to activate or manage your subscription.';
    case 'missing_email':
      return 'Your account needs a valid email before activating subscriptions.';
    case 'unverified_email':
      return 'Verify your email before activating subscriptions.';
    default:
      return 'You are not eligible for billing actions.';
  }
}

export function inferEmailVerified(user: User | null): boolean {
  if (!user) return false;

  const provider =
    typeof user.app_metadata?.provider === 'string'
      ? user.app_metadata.provider.trim().toLowerCase()
      : null;

  if (provider && provider !== 'email') {
    return true;
  }

  const maybeConfirmedAt = (user as unknown as { email_confirmed_at?: string | null }).email_confirmed_at;
  return typeof maybeConfirmedAt === 'string' && maybeConfirmedAt.trim().length > 0;
}

export function computeBillingEligibility(
  input: ComputeBillingEligibilityInput
): BillingEligibility {
  if (!input.hasUser) {
    const reason: BillingIneligibilityReason = 'unauthenticated';
    return {
      eligible: false,
      reason,
      message: messageForReason(reason),
      is_anonymous: false,
      has_email: false,
      email_verified: false,
    };
  }

  if (input.isAnonymous) {
    const reason: BillingIneligibilityReason = 'anonymous';
    return {
      eligible: false,
      reason,
      message: messageForReason(reason),
      is_anonymous: true,
      has_email: input.hasEmail,
      email_verified: input.emailVerified,
    };
  }

  if (!input.hasEmail) {
    const reason: BillingIneligibilityReason = 'missing_email';
    return {
      eligible: false,
      reason,
      message: messageForReason(reason),
      is_anonymous: false,
      has_email: false,
      email_verified: input.emailVerified,
    };
  }

  if (!input.emailVerified) {
    const reason: BillingIneligibilityReason = 'unverified_email';
    return {
      eligible: false,
      reason,
      message: messageForReason(reason),
      is_anonymous: false,
      has_email: true,
      email_verified: false,
    };
  }

  return {
    eligible: true,
    reason: null,
    message: 'Eligible for billing actions.',
    is_anonymous: false,
    has_email: true,
    email_verified: true,
  };
}

export async function resolveBillingEligibilityForUser(args: {
  supabase: AnySupabaseClient;
  user: User | null;
}): Promise<BillingEligibility> {
  const { supabase, user } = args;

  if (!user) {
    return computeBillingEligibility({
      hasUser: false,
      isAnonymous: false,
      hasEmail: false,
      emailVerified: false,
    });
  }

  const hasEmail = typeof user.email === 'string' && user.email.trim().length > 0;
  const emailVerified = inferEmailVerified(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', user.id)
    .maybeSingle();

  const isAnonymous =
    profile && typeof profile.is_anonymous === 'boolean'
      ? profile.is_anonymous
      : false;

  return computeBillingEligibility({
    hasUser: true,
    isAnonymous,
    hasEmail,
    emailVerified,
  });
}
