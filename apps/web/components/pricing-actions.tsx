"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: invokeError } = await supabase.functions.invoke("create-checkout-session", {
      body: {
        price_lookup_key: "pro_monthly",
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/pricing?checkout=cancel`
      }
    });

    if (invokeError) {
      setError(invokeError.message);
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setError("Missing checkout URL");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
      >
        {loading ? "Redirecting..." : "Start Pro subscription"}
      </button>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenPortal() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: invokeError } = await supabase.functions.invoke("create-portal-session", {
      body: { return_url: `${window.location.origin}/billing` }
    });

    if (invokeError) {
      setError(invokeError.message);
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setError("Missing portal URL");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleOpenPortal}
        disabled={loading}
        className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/50 disabled:opacity-50"
      >
        {loading ? "Opening..." : "Open Stripe portal"}
      </button>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
