import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders } from "../_shared/cors.ts";
import { error, json } from "../_shared/http.ts";
import { createServiceClient, createUserClient } from "../_shared/supabase.ts";
import { getStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  price_lookup_key: z.string().min(1),
  success_url: z.string().url(),
  cancel_url: z.string().url()
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return error("Method not allowed", 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return error("Missing authorization header", 401);
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return error("Invalid payload", 422);
  }

  const supabase = createUserClient(authHeader);
  const admin = createServiceClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return error("Invalid auth token", 401);
  }

  const stripe = getStripeClient();

  const { data: existingSubscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existingSubscription?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        user_id: user.id
      }
    });
    customerId = customer.id;

    await admin.from("subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId
    });
  }

  const prices = await stripe.prices.list({
    lookup_keys: [parsedBody.data.price_lookup_key],
    active: true,
    limit: 1
  });

  const price = prices.data[0];
  if (!price) {
    return error("No Stripe price found for this lookup key", 400);
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: price.id,
        quantity: 1
      }
    ],
    metadata: {
      user_id: user.id
    },
    subscription_data: {
      metadata: {
        user_id: user.id
      }
    },
    success_url: parsedBody.data.success_url,
    cancel_url: parsedBody.data.cancel_url,
    allow_promotion_codes: true
  });

  if (!checkoutSession.url) {
    return error("Stripe did not return a checkout URL", 500);
  }

  return json({ url: checkoutSession.url });
});
