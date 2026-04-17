-- Reset paid credits on activation within the current month.
-- When a user activates a paid plan (better/best), webhook stores credits_reset_at.
-- Usage in the same calendar month is counted from that anchor, not from month start.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_reset_at timestamptz;

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
  v_paid_reset_anchor timestamptz;
  v_subscription_created_at timestamptz;
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

  IF v_plan IN ('better', 'best') THEN
    BEGIN
      SELECT s.credits_reset_at, s.created_at
      INTO v_paid_reset_anchor, v_subscription_created_at
      FROM public.subscriptions s
      WHERE s.user_id = p_user_id
        AND COALESCE(s.status, '') IN ('active', 'trialing', 'past_due')
      ORDER BY COALESCE(s.current_period_end, s.updated_at, s.created_at) DESC
      LIMIT 1;
    EXCEPTION
      WHEN undefined_column THEN
        -- Backward compatibility while rolling migration.
        v_paid_reset_anchor := NULL;
        v_subscription_created_at := NULL;
    END;

    -- Backfill behavior for paid subscriptions created earlier this month
    -- before credits_reset_at existed.
    IF v_paid_reset_anchor IS NULL
      AND v_subscription_created_at IS NOT NULL
      AND v_subscription_created_at >= v_period
      AND v_subscription_created_at < v_period_end THEN
      v_paid_reset_anchor := v_subscription_created_at;
    END IF;

    IF v_paid_reset_anchor IS NOT NULL
      AND v_paid_reset_anchor >= v_period
      AND v_paid_reset_anchor < v_period_end THEN
      v_period := v_paid_reset_anchor;
    END IF;
  END IF;

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
