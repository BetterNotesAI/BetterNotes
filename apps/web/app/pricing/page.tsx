import { createClient } from "../../lib/supabase/server";
import { CheckoutButton } from "../../components/pricing-actions";

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Pricing</h1>
        <p className="mt-2 text-sm text-white/65">Free gets one build/day. Pro unlocks unlimited builds and billing portal access.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-1 text-sm text-white/60">Perfect for trying the platform.</p>
          <p className="mt-5 text-3xl font-bold">€0</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>1 build/day</li>
            <li>All core templates</li>
            <li>PDF + TEX download</li>
          </ul>
        </article>
        <article className="rounded-3xl border border-neon/40 bg-neon/10 p-6">
          <h2 className="text-xl font-semibold">Pro</h2>
          <p className="mt-1 text-sm text-white/65">For daily students and power users.</p>
          <p className="mt-5 text-3xl font-bold">€12/mo</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>Unlimited builds</li>
            <li>Priority render queue</li>
            <li>Stripe billing management</li>
          </ul>
          <div className="mt-6">{user ? <CheckoutButton /> : <p className="text-sm text-white/70">Login to subscribe.</p>}</div>
        </article>
      </div>
    </section>
  );
}
