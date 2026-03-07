import { createClient } from "../../lib/supabase/server";
import { BillingPortalButton } from "../../components/pricing-actions";
import { LogoutButton } from "../../components/logout-button";

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, price_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Billing</h1>
          <p className="mt-1 text-sm text-white/65">Subscription source of truth is synced from Stripe webhooks.</p>
        </div>
        <LogoutButton />
      </header>

      <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Current plan</h2>
        <dl className="mt-4 grid gap-3 text-sm text-white/75">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>{subscription?.status ?? "free"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Renews at</dt>
            <dd>{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleString() : "-"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Cancel at period end</dt>
            <dd>{subscription?.cancel_at_period_end ? "Yes" : "No"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Price ID</dt>
            <dd>{subscription?.price_id ?? "-"}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <BillingPortalButton />
        </div>
      </article>
    </section>
  );
}
