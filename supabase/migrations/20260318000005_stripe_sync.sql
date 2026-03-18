-- M5: Stripe sync helpers
-- RPC atómica: verifica límite e incrementa en una sola transacción (evita race condition)
-- Devuelve: { allowed: bool, remaining: int, plan: text }
-- Si allowed=false, NO incrementa el contador.

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan      text;
  v_limit     int4;
  v_period    timestamptz := date_trunc('month', now());
  v_count     int4;
  v_new_count int4;
BEGIN
  -- Obtener el plan del usuario desde profiles
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  v_plan  := COALESCE(v_plan, 'free');
  v_limit := CASE v_plan WHEN 'pro' THEN 999999 ELSE 20 END;

  -- Leer uso actual del período
  SELECT message_count INTO v_count
  FROM public.message_usage
  WHERE user_id = p_user_id AND period_start = v_period;
  v_count := COALESCE(v_count, 0);

  -- Si ya alcanzó el límite, devolver denied sin modificar nada
  IF v_count >= v_limit THEN
    RETURN json_build_object('allowed', false, 'remaining', 0, 'plan', v_plan);
  END IF;

  -- Incrementar (upsert atómico)
  INSERT INTO public.message_usage (user_id, message_count, period_start)
  VALUES (p_user_id, 1, v_period)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET message_count = public.message_usage.message_count + 1
  RETURNING message_count INTO v_new_count;

  RETURN json_build_object(
    'allowed',    true,
    'remaining',  v_limit - v_new_count,
    'plan',       v_plan
  );
END;
$$;

-- Permisos: solo roles autenticados pueden llamar a esta función
REVOKE ALL ON FUNCTION public.check_and_increment_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid) TO service_role;
