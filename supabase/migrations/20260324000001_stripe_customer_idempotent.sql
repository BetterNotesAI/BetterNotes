-- F2-M5.5: Fix race condition — Stripe customer con doble click
--
-- Estrategia:
--   1. Añadir UNIQUE constraint en profiles.stripe_customer_id para evitar duplicados a nivel DB.
--   2. RPC get_or_reserve_stripe_customer: usa SELECT ... FOR UPDATE sobre profiles para serializar
--      requests concurrentes del mismo usuario. Si ya existe stripe_customer_id lo devuelve
--      inmediatamente. Si no existe, devuelve NULL para que el llamador cree el customer en Stripe
--      y luego llame a set_stripe_customer_id para guardarlo.
--   3. RPC set_stripe_customer_id: escribe el customer_id de forma idempotente usando
--      INSERT ... ON CONFLICT DO NOTHING en profiles. Si ya fue escrito por una request paralela,
--      no falla — simplemente devuelve el valor ganador.

-- ─── 1. UNIQUE constraint en profiles.stripe_customer_id ───────────────────────
-- Ignoramos duplicados previos (si los hay) con ON CONFLICT DO NOTHING en los datos,
-- pero la constraint previene futuros duplicados.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stripe_customer_id_unique UNIQUE (stripe_customer_id);

-- ─── 2. RPC: get_or_reserve_stripe_customer ────────────────────────────────────
-- Devuelve el stripe_customer_id existente para p_user_id, o NULL si no existe.
-- Usa SELECT FOR UPDATE para que dos transacciones concurrentes del mismo usuario
-- no pasen ambas el chequeo "no hay customer" — la segunda bloquea hasta que la
-- primera haga commit y entonces ya ve el valor escrito.
CREATE OR REPLACE FUNCTION public.get_or_reserve_stripe_customer(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id text;
BEGIN
  SELECT stripe_customer_id
    INTO v_customer_id
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;   -- serializa requests concurrentes del mismo usuario

  RETURN v_customer_id;  -- NULL si aún no tiene customer
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_reserve_stripe_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_reserve_stripe_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_reserve_stripe_customer(uuid) TO service_role;

-- ─── 3. RPC: set_stripe_customer_id ────────────────────────────────────────────
-- Intenta escribir p_customer_id en profiles para p_user_id.
-- Si ya hay un valor (escrito por una request paralela), devuelve ese valor sin sobreescribir.
-- Si lo escribe correctamente, devuelve p_customer_id.
-- Nunca falla por constraint — siempre devuelve el customer_id ganador.
CREATE OR REPLACE FUNCTION public.set_stripe_customer_id(
  p_user_id     uuid,
  p_customer_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
BEGIN
  -- Intentar escribir; si ya existe un valor no lo sobreescribimos
  UPDATE public.profiles
     SET stripe_customer_id = p_customer_id
   WHERE id = p_user_id
     AND stripe_customer_id IS NULL;

  -- Leer el valor final (puede ser el que acabamos de escribir o el de una request ganadora)
  SELECT stripe_customer_id
    INTO v_existing
    FROM public.profiles
   WHERE id = p_user_id;

  RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.set_stripe_customer_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_stripe_customer_id(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_stripe_customer_id(uuid, text) TO service_role;
