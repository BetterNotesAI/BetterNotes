-- Usage accounting based on real token cost (USD) mapped to credits.
-- 1 credit = $0.01
-- Plan credit limits per month:
--   free   -> 10 credits ($0.10)
--   better -> 200 credits ($2.00)
--   best   -> 500 credits ($5.00)

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider                   text NOT NULL,
  model                      text NOT NULL,
  feature                    text,
  input_tokens               int4 NOT NULL DEFAULT 0,
  cached_input_tokens        int4 NOT NULL DEFAULT 0,
  output_tokens              int4 NOT NULL DEFAULT 0,
  input_cost_usd             numeric(14, 8) NOT NULL DEFAULT 0,
  cached_input_cost_usd      numeric(14, 8) NOT NULL DEFAULT 0,
  output_cost_usd            numeric(14, 8) NOT NULL DEFAULT 0,
  total_cost_usd             numeric(14, 8) NOT NULL DEFAULT 0,
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CHECK (input_tokens >= 0),
  CHECK (cached_input_tokens >= 0),
  CHECK (output_tokens >= 0),
  CHECK (input_cost_usd >= 0),
  CHECK (cached_input_cost_usd >= 0),
  CHECK (output_cost_usd >= 0),
  CHECK (total_cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events (user_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'ai_usage_events: owner select'
  ) THEN
    CREATE POLICY "ai_usage_events: owner select"
      ON public.ai_usage_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.resolve_effective_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_plan text;
  v_profile_plan text;
BEGIN
  SELECT
    CASE
      WHEN s.plan IN ('best', 'better') THEN s.plan
      WHEN s.plan = 'pro' THEN 'better'
      WHEN s.plan = 'free' THEN 'free'
      ELSE NULL
    END
  INTO v_subscription_plan
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND COALESCE(s.status, '') IN ('active', 'trialing', 'past_due')
  ORDER BY COALESCE(s.current_period_end, s.updated_at, s.created_at) DESC
  LIMIT 1;

  IF v_subscription_plan IS NOT NULL THEN
    RETURN v_subscription_plan;
  END IF;

  SELECT COALESCE(plan, 'free')
  INTO v_profile_plan
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile_plan = 'best' THEN
    RETURN 'best';
  END IF;

  IF v_profile_plan IN ('better', 'pro') THEN
    RETURN 'better';
  END IF;

  RETURN 'free';
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_credit_limit(p_plan text)
RETURNS int4
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_plan = 'best' THEN 500
    WHEN p_plan IN ('better', 'pro') THEN 200
    ELSE 10
  END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_feature text DEFAULT NULL,
  p_input_tokens int4 DEFAULT 0,
  p_cached_input_tokens int4 DEFAULT 0,
  p_output_tokens int4 DEFAULT 0,
  p_input_price_per_1m numeric DEFAULT 0,
  p_cached_input_price_per_1m numeric DEFAULT 0,
  p_output_price_per_1m numeric DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_input_tokens int4 := GREATEST(COALESCE(p_input_tokens, 0), 0);
  v_cached_input_tokens int4 := GREATEST(COALESCE(p_cached_input_tokens, 0), 0);
  v_output_tokens int4 := GREATEST(COALESCE(p_output_tokens, 0), 0);
  v_input_price numeric := GREATEST(COALESCE(p_input_price_per_1m, 0), 0);
  v_cached_input_price numeric := GREATEST(COALESCE(p_cached_input_price_per_1m, 0), 0);
  v_output_price numeric := GREATEST(COALESCE(p_output_price_per_1m, 0), 0);
  v_input_cost numeric(14, 8);
  v_cached_input_cost numeric(14, 8);
  v_output_cost numeric(14, 8);
  v_total_cost numeric(14, 8);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_input_cost := ROUND((v_input_tokens::numeric / 1000000) * v_input_price, 8);
  v_cached_input_cost := ROUND((v_cached_input_tokens::numeric / 1000000) * v_cached_input_price, 8);
  v_output_cost := ROUND((v_output_tokens::numeric / 1000000) * v_output_price, 8);
  v_total_cost := ROUND(v_input_cost + v_cached_input_cost + v_output_cost, 8);

  INSERT INTO public.ai_usage_events (
    user_id,
    provider,
    model,
    feature,
    input_tokens,
    cached_input_tokens,
    output_tokens,
    input_cost_usd,
    cached_input_cost_usd,
    output_cost_usd,
    total_cost_usd,
    metadata
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(TRIM(p_provider), ''), 'unknown'),
    COALESCE(NULLIF(TRIM(p_model), ''), 'unknown'),
    NULLIF(TRIM(COALESCE(p_feature, '')), ''),
    v_input_tokens,
    v_cached_input_tokens,
    v_output_tokens,
    v_input_cost,
    v_cached_input_cost,
    v_output_cost,
    v_total_cost,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN json_build_object(
    'ok', true,
    'input_cost_usd', v_input_cost,
    'cached_input_cost_usd', v_cached_input_cost,
    'output_cost_usd', v_output_cost,
    'total_cost_usd', v_total_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_status(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_period timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_credit_limit int4;
  v_usd_limit numeric(14, 8);
  v_cost_used_usd numeric(14, 8);
  v_credits_used numeric(14, 4);
  v_credits_remaining numeric(14, 4);
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_plan := public.resolve_effective_plan(p_user_id);
  v_credit_limit := public.plan_credit_limit(v_plan);
  v_usd_limit := ROUND(v_credit_limit::numeric * 0.01, 8);

  SELECT COALESCE(SUM(total_cost_usd), 0)
  INTO v_cost_used_usd
  FROM public.ai_usage_events
  WHERE user_id = p_user_id
    AND created_at >= v_period
    AND created_at < v_period_end;

  v_credits_used := ROUND(v_cost_used_usd / 0.01, 4);
  v_credits_remaining := ROUND(GREATEST((v_usd_limit - v_cost_used_usd) / 0.01, 0), 4);

  RETURN json_build_object(
    'plan', v_plan,
    -- Backward-compatible keys for existing UI/routes.
    'message_count', CEIL(v_credits_used)::int4,
    'limit', v_credit_limit,
    'remaining', FLOOR(v_credits_remaining)::int4,
    -- New keys for credit/cost-aware UI.
    'credits_used', v_credits_used,
    'credits_limit', v_credit_limit,
    'credits_remaining', ROUND(v_credits_remaining, 2),
    'usd_used', ROUND(v_cost_used_usd, 6),
    'usd_limit', ROUND(v_usd_limit, 6),
    'usd_remaining', ROUND(GREATEST(v_usd_limit - v_cost_used_usd, 0), 6),
    'period_start', v_period
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_credit_quota(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_usage json;
  v_allowed boolean;
  v_usd_used numeric;
  v_usd_limit numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_usage := public.get_usage_status(p_user_id);
  v_usd_used := COALESCE((v_usage->>'usd_used')::numeric, 0);
  v_usd_limit := COALESCE((v_usage->>'usd_limit')::numeric, 0);
  v_allowed := v_usd_used < v_usd_limit;

  RETURN json_build_object(
    'allowed', v_allowed,
    'plan', COALESCE(v_usage->>'plan', 'free'),
    'remaining', COALESCE((v_usage->>'remaining')::int4, 0),
    'credits_remaining', COALESCE((v_usage->>'credits_remaining')::numeric, 0),
    'credits_limit', COALESCE((v_usage->>'credits_limit')::int4, 0),
    'credits_used', COALESCE((v_usage->>'credits_used')::numeric, 0),
    'usd_used', v_usd_used,
    'usd_limit', v_usd_limit,
    'usd_remaining', COALESCE((v_usage->>'usd_remaining')::numeric, 0),
    'period_start', v_usage->'period_start'
  );
END;
$$;

-- Backward compatibility: keep the old RPC name but route to credit quota check.
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota json;
BEGIN
  v_quota := public.check_credit_quota(p_user_id);

  RETURN json_build_object(
    'allowed', COALESCE((v_quota->>'allowed')::boolean, false),
    'remaining', COALESCE((v_quota->>'remaining')::int4, 0),
    'plan', COALESCE(v_quota->>'plan', 'free')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.get_usage_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_usage_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_status(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.check_credit_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_credit_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credit_quota(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.check_and_increment_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid) TO service_role;
