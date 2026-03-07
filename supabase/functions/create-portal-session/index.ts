import { z } from "https://esm.sh/zod@3.24.2";
import { corsHeaders } from "../_shared/cors.ts";
import { error, json } from "../_shared/http.ts";
import { createServiceClient, createUserClient } from "../_shared/supabase.ts";
import { getStripeClient } from "../_shared/stripe.ts";

const bodySchema = z.object({
  return_url: z.string().url()
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

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return error("No Stripe customer found for this user", 400);
  }

  const stripe = getStripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: parsedBody.data.return_url
  });

  return json({ url: portalSession.url });
});
