import type Stripe from "npm:stripe@18.3.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getStripeClient } from "../_shared/stripe.ts";

const acceptedEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed"
]);

async function resolveUserId(admin: ReturnType<typeof createServiceClient>, customerId: string, metadataUserId?: string | null) {
  if (metadataUserId) {
    return metadataUserId;
  }

  const { data: byCustomer } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return byCustomer?.user_id ?? null;
}

async function upsertSubscriptionFromStripe(
  admin: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await resolveUserId(admin, customerId, subscription.metadata?.user_id);

  if (!userId) {
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return error("Method not allowed", 405);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return error("Missing stripe-signature header", 400);
  }

  const body = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (webhookError) {
    return error(webhookError instanceof Error ? webhookError.message : "Invalid Stripe signature", 400);
  }

  const admin = createServiceClient();

  const { error: eventInsertError } = await admin
    .from("stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (eventInsertError && eventInsertError.code === "23505") {
    return json({ ok: true, duplicate: true });
  }

  if (eventInsertError) {
    return error(eventInsertError.message, 500);
  }

  if (!acceptedEvents.has(event.type)) {
    return json({ ok: true, ignored: event.type });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) {
          break;
        }

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscriptionFromStripe(admin, subscription);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(admin, subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) {
          break;
        }

        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscriptionFromStripe(admin, subscription);
        break;
      }
      default:
        break;
    }
  } catch (handlerError) {
    return error(handlerError instanceof Error ? handlerError.message : "Failed to process webhook", 500);
  }

  return json({ ok: true });
});
