import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

type AnySupabaseClient = SupabaseClient<any, any, any>;

interface CheckoutSessionBindingRow {
  user_id: string;
  stripe_checkout_session_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  requested_tier: string | null;
  requested_interval: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  verified_return_at: string | null;
  orphaned_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface BillingIncidentArgs {
  incidentType: string;
  severity?: 'info' | 'warning' | 'critical';
  userId?: string | null;
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  details?: Record<string, unknown>;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code ?? '') : '';
  if (code === '42P01' || code === 'PGRST205') return true;
  const message = 'message' in error ? String(error.message ?? '').toLowerCase() : '';
  return message.includes('relation') && message.includes('does not exist');
}

function asStripeId(
  value:
    | string
    | { id?: string | null }
    | null
    | undefined
): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
    return value.id;
  }
  return null;
}

async function maybeRefundByPaymentIntent(args: {
  stripe: Stripe;
  paymentIntentId: string | null;
  sessionId: string;
}): Promise<{ refunded: boolean; refundId: string | null; error: string | null }> {
  if (!args.paymentIntentId) {
    return { refunded: false, refundId: null, error: null };
  }

  try {
    const refund = await args.stripe.refunds.create(
      {
        payment_intent: args.paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          remediation: 'orphan_checkout_session',
          checkout_session_id: args.sessionId,
        },
      },
      { idempotencyKey: `orphan-refund-${args.sessionId}-${args.paymentIntentId}` }
    );

    return { refunded: true, refundId: refund.id, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown refund error';
    return { refunded: false, refundId: null, error: message };
  }
}

async function resolvePaymentIntentId(args: {
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  stripeSubscriptionId: string | null;
}): Promise<string | null> {
  const fromSession = asStripeId(args.session.payment_intent as unknown as string | { id?: string });
  if (fromSession) return fromSession;

  const invoiceId = asStripeId(args.session.invoice as unknown as string | { id?: string });
  if (invoiceId) {
    const invoice = await args.stripe.invoices.retrieve(invoiceId, {
      expand: ['payment_intent'],
    });
    const invoiceWithPaymentIntent = invoice as unknown as {
      payment_intent?: string | { id?: string | null } | null;
    };
    const invoicePaymentIntent = asStripeId(
      invoiceWithPaymentIntent.payment_intent as unknown as string | { id?: string }
    );
    if (invoicePaymentIntent) return invoicePaymentIntent;
  }

  if (args.stripeSubscriptionId) {
    const subscription = await args.stripe.subscriptions.retrieve(args.stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as
      | Stripe.Invoice
      | string
      | null
      | undefined;

    if (latestInvoice && typeof latestInvoice === 'object') {
      const latestInvoiceWithPaymentIntent = latestInvoice as unknown as {
        payment_intent?: string | { id?: string | null } | null;
      };
      const paymentIntent = asStripeId(
        latestInvoiceWithPaymentIntent.payment_intent as unknown as string | { id?: string }
      );
      if (paymentIntent) return paymentIntent;
    }
  }

  return null;
}

async function maybeCancelSubscription(args: {
  stripe: Stripe;
  stripeSubscriptionId: string | null;
  sessionId: string;
}): Promise<{ canceled: boolean; error: string | null }> {
  if (!args.stripeSubscriptionId) {
    return { canceled: false, error: null };
  }

  try {
    await args.stripe.subscriptions.cancel(args.stripeSubscriptionId, {}, {
      idempotencyKey: `orphan-cancel-${args.sessionId}-${args.stripeSubscriptionId}`,
    });
    return { canceled: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown subscription cancellation error';
    return { canceled: false, error: message };
  }
}

export async function saveCheckoutSessionBinding(args: {
  supabaseAdmin: AnySupabaseClient;
  userId: string;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string | null;
  requestedTier: string | null;
  requestedInterval: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await args.supabaseAdmin
    .from('stripe_checkout_sessions')
    .upsert(
      {
        user_id: args.userId,
        stripe_checkout_session_id: args.stripeCheckoutSessionId,
        stripe_customer_id: args.stripeCustomerId,
        requested_tier: args.requestedTier,
        requested_interval: args.requestedInterval,
        status: 'created',
        updated_at: now,
      },
      { onConflict: 'stripe_checkout_session_id' }
    );

  if (error) {
    throw error;
  }
}

export async function getCheckoutSessionBinding(args: {
  supabaseAdmin: AnySupabaseClient;
  stripeCheckoutSessionId: string;
  failOnMissingTable?: boolean;
}): Promise<CheckoutSessionBindingRow | null> {
  const { data, error } = await args.supabaseAdmin
    .from('stripe_checkout_sessions')
    .select('*')
    .eq('stripe_checkout_session_id', args.stripeCheckoutSessionId)
    .maybeSingle();

  if (error) {
    if (!args.failOnMissingTable && isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return (data ?? null) as CheckoutSessionBindingRow | null;
}

export async function markCheckoutSessionCompleted(args: {
  supabaseAdmin: AnySupabaseClient;
  stripeCheckoutSessionId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await args.supabaseAdmin
    .from('stripe_checkout_sessions')
    .update({
      status: 'completed',
      stripe_subscription_id: args.stripeSubscriptionId,
      stripe_customer_id: args.stripeCustomerId,
      completed_at: now,
      updated_at: now,
    })
    .eq('stripe_checkout_session_id', args.stripeCheckoutSessionId);

  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

export async function markCheckoutSessionVerified(args: {
  supabaseAdmin: AnySupabaseClient;
  stripeCheckoutSessionId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await args.supabaseAdmin
    .from('stripe_checkout_sessions')
    .update({
      verified_return_at: now,
      updated_at: now,
    })
    .eq('stripe_checkout_session_id', args.stripeCheckoutSessionId);

  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

export async function markCheckoutSessionOrphaned(args: {
  supabaseAdmin: AnySupabaseClient;
  stripeCheckoutSessionId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await args.supabaseAdmin
    .from('stripe_checkout_sessions')
    .update({
      status: 'orphaned',
      orphaned_at: now,
      updated_at: now,
      metadata: args.details ?? {},
    })
    .eq('stripe_checkout_session_id', args.stripeCheckoutSessionId);

  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

export async function recordBillingIncident(args: {
  supabaseAdmin: AnySupabaseClient;
} & BillingIncidentArgs): Promise<void> {
  const payload = {
    incident_type: args.incidentType,
    severity: args.severity ?? 'warning',
    user_id: args.userId ?? null,
    stripe_event_id: args.stripeEventId ?? null,
    stripe_checkout_session_id: args.stripeCheckoutSessionId ?? null,
    stripe_customer_id: args.stripeCustomerId ?? null,
    stripe_subscription_id: args.stripeSubscriptionId ?? null,
    details: args.details ?? {},
  };

  const { error } = await args.supabaseAdmin
    .from('billing_incidents')
    .insert(payload);

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[billing] Could not persist billing incident: table missing.');
      return;
    }

    console.warn('[billing] Could not persist billing incident:', error.message);
  }
}

export async function remediateOrphanCheckoutSession(args: {
  stripe: Stripe;
  supabaseAdmin: AnySupabaseClient;
  eventId: string | null;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  session: Stripe.Checkout.Session;
  details?: Record<string, unknown>;
}): Promise<void> {
  const cancellation = await maybeCancelSubscription({
    stripe: args.stripe,
    stripeSubscriptionId: args.stripeSubscriptionId,
    sessionId: args.stripeCheckoutSessionId,
  });

  let paymentIntentId: string | null = null;
  let refund = { refunded: false, refundId: null as string | null, error: null as string | null };

  try {
    paymentIntentId = await resolvePaymentIntentId({
      stripe: args.stripe,
      session: args.session,
      stripeSubscriptionId: args.stripeSubscriptionId,
    });

    refund = await maybeRefundByPaymentIntent({
      stripe: args.stripe,
      paymentIntentId,
      sessionId: args.stripeCheckoutSessionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown payment intent resolution error';
    refund = { refunded: false, refundId: null, error: message };
  }

  await markCheckoutSessionOrphaned({
    supabaseAdmin: args.supabaseAdmin,
    stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    details: {
      remediation: {
        subscription_canceled: cancellation.canceled,
        cancellation_error: cancellation.error,
        refunded: refund.refunded,
        refund_id: refund.refundId,
        refund_error: refund.error,
        payment_intent_id: paymentIntentId,
      },
      ...(args.details ?? {}),
    },
  });

  await recordBillingIncident({
    supabaseAdmin: args.supabaseAdmin,
    incidentType: 'orphan_checkout_session',
    severity: 'critical',
    stripeEventId: args.eventId,
    stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    stripeCustomerId: args.stripeCustomerId,
    stripeSubscriptionId: args.stripeSubscriptionId,
    details: {
      remediation: {
        subscription_canceled: cancellation.canceled,
        cancellation_error: cancellation.error,
        refunded: refund.refunded,
        refund_id: refund.refundId,
        refund_error: refund.error,
        payment_intent_id: paymentIntentId,
      },
      ...(args.details ?? {}),
    },
  });
}
