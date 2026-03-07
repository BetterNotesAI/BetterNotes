import Stripe from "npm:stripe@18.3.0";
import { requireEnv } from "./env.ts";

let stripe: Stripe | null = null;

export function getStripeClient() {
  if (!stripe) {
    stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-02-24.acacia"
    });
  }

  return stripe;
}
