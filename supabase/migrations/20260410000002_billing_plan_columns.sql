-- Add Stripe billing metadata columns for Better/Best plan handling.
-- Keeps compatibility with existing free/pro entitlement logic in profiles.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text;

UPDATE public.subscriptions
SET stripe_price_id = COALESCE(stripe_price_id, price_id)
WHERE stripe_price_id IS NULL;

UPDATE public.subscriptions
SET plan = COALESCE(plan, 'better')
WHERE plan IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN plan SET DEFAULT 'better';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_plan_tier_check_20260410'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_plan_tier_check_20260410
      CHECK (plan IN ('free', 'pro', 'better', 'best'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_billing_interval_check_20260410'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_billing_interval_check_20260410
      CHECK (billing_interval IS NULL OR billing_interval IN ('monthly', 'quarterly'));
  END IF;
END
$$;
