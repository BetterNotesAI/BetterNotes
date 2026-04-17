-- Billing hardening: checkout session binding + incident log.
-- Enforces stronger anti-orphan reconciliation around Stripe checkout.

CREATE TABLE IF NOT EXISTS public.stripe_checkout_sessions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  stripe_customer_id         text,
  stripe_subscription_id     text,
  requested_tier             text,
  requested_interval         text,
  status                     text NOT NULL DEFAULT 'created',
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz,
  verified_return_at         timestamptz,
  orphaned_at                timestamptz
);

CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_user_idx
  ON public.stripe_checkout_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_status_idx
  ON public.stripe_checkout_sessions(status, created_at DESC);

ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_checkout_sessions'
      AND policyname = 'stripe_checkout_sessions: owner select'
  ) THEN
    CREATE POLICY "stripe_checkout_sessions: owner select"
      ON public.stripe_checkout_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_checkout_sessions'
      AND policyname = 'stripe_checkout_sessions: owner insert'
  ) THEN
    CREATE POLICY "stripe_checkout_sessions: owner insert"
      ON public.stripe_checkout_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_checkout_sessions'
      AND policyname = 'stripe_checkout_sessions: owner update'
  ) THEN
    CREATE POLICY "stripe_checkout_sessions: owner update"
      ON public.stripe_checkout_sessions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.billing_incidents (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type              text NOT NULL,
  severity                   text NOT NULL DEFAULT 'warning',
  user_id                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_event_id            text,
  stripe_checkout_session_id text,
  stripe_customer_id         text,
  stripe_subscription_id     text,
  details                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  resolved_at                timestamptz
);

CREATE INDEX IF NOT EXISTS billing_incidents_created_idx
  ON public.billing_incidents(created_at DESC);

CREATE INDEX IF NOT EXISTS billing_incidents_type_idx
  ON public.billing_incidents(incident_type, created_at DESC);

ALTER TABLE public.billing_incidents ENABLE ROW LEVEL SECURITY;
