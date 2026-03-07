# BetterNotes v2 MVP

Monorepo MVP for BetterNotes with three isolated runtime layers:

1. `apps/web` (Next.js App Router): UI, auth flows, workspace, pricing/billing.
2. `supabase` (Postgres + Auth + Storage + Edge Functions): business rules, paywall, Stripe sync.
3. `services/latex-worker` (Cloud Run-ready Node service): AI generation + secure LaTeX compile + output upload.

## Repository Layout

```text
apps/web                     # Frontend (Next.js)
packages/shared             # Shared contracts/types
services/latex-worker       # Worker (OpenAI + Tectonic)
supabase/migrations          # SQL schema + RLS + storage policies
supabase/seed               # Template seed data
supabase/functions          # Edge Functions (Stripe, jobs, dispatch)
```

## Implemented MVP Scope

- Email/password auth with Supabase.
- Protected routes for `/workspace` and `/billing`.
- Landing, templates, pricing, billing and workspace pages.
- Upload flow to private `uploads` bucket + metadata table.
- Job queue creation + polling UI.
- Stripe Checkout + Stripe Billing Portal via Edge Functions.
- Stripe webhook idempotency (`stripe_events`) and subscription sync (`subscriptions`).
- Paywall: free users can run 1 build/day, pro users unlimited.
- Worker endpoint `POST /render` with shared-secret auth.
- Pipeline: notes + uploads -> OpenAI structured output -> template merge -> Tectonic -> PDF/TEX to private `outputs` bucket.

## Required Environment Variables

### `apps/web/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `supabase/.env`

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
WORKER_RENDER_URL=http://localhost:8080/render
WORKER_SHARED_SECRET=
CRON_SECRET=
WORKER_DISPATCH_TIMEOUT_MS=10000
```

### `services/latex-worker/.env`

```bash
PORT=8080
WORKER_SHARED_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
LATEX_TIMEOUT_MS=20000
MAX_INPUT_CHARS=40000
```

## Local Setup

1. Install dependencies.

```bash
pnpm install
```

2. Apply DB schema and seed templates (from repo root).

```bash
supabase db push --linked
supabase db seed --linked
```

3. Deploy Edge Functions.

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
supabase functions deploy create-job
supabase functions deploy dispatch-queued-jobs
```

4. Run services.

```bash
pnpm dev:web
pnpm dev:worker
```

## Stripe Setup

1. Create Stripe product/price with lookup key `pro_monthly`.
2. Configure webhook endpoint to Supabase function URL:

```text
https://<project-ref>.functions.supabase.co/stripe-webhook
```

3. Subscribe to events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Scheduled Dispatch

Set an external cron (or Supabase Scheduled Function) to call:

```text
POST https://<project-ref>.functions.supabase.co/dispatch-queued-jobs
Header: x-cron-secret: <CRON_SECRET>
```

Recommended cadence: every 1 minute.

## Build Verification Performed

- `pnpm typecheck` (all workspaces): passed.
- `pnpm build:worker`: passed.
- `pnpm build:web` with placeholder env vars: passed.

## Security Baseline

- Private buckets (`uploads`, `outputs`) with user-folder policies.
- RLS on all business tables.
- No Stripe/OpenAI/service-role secrets in frontend.
- Worker protected by `WORKER_SHARED_SECRET`.
- Webhook idempotency via `stripe_events` primary key.
- Tectonic compile inside isolated worker runtime.
