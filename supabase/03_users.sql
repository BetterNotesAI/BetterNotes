-- ============================================================
-- 03_users.sql
-- Core user tables: profiles and message usage tracking.
-- Depends on: 02_functions.sql (set_updated_at, handle_new_user)
-- ============================================================


-- ── profiles ─────────────────────────────────────────────────
-- One row per auth.users entry. Created automatically on signup
-- via the handle_new_user trigger (defined in 02_functions.sql).
-- Stores plan tier, display info, and optional university link.

CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              text,
  plan               text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text,
  display_name       text,
  avatar_url         text,
  university_id      uuid,   -- FK added later in 06_universities.sql
  degree_program_id  uuid,   -- FK added later in 06_universities.sql
  theme              text DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_owner_all' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_owner_all ON profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- ── message_usage ─────────────────────────────────────────────
-- Tracks how many AI messages each user has sent per calendar month.
-- Used to enforce the freemium quota (50 messages/month for free plan).
-- One row per (user, month). Upserted by the increment_message_count() RPC.

CREATE TABLE IF NOT EXISTS message_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_count int4 NOT NULL DEFAULT 0,
  period_start  timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

ALTER TABLE message_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mu_owner_all' AND tablename = 'message_usage') THEN
    CREATE POLICY mu_owner_all ON message_usage
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ── Usage RPC functions ────────────────────────────────────────
-- These run as SECURITY DEFINER so they can read profiles and
-- message_usage regardless of the caller's RLS context.

-- Returns the current month's usage status for the given user.
CREATE OR REPLACE FUNCTION get_usage_status(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count     int4 := 0;
  v_is_paid   boolean := false;
  v_limit     int4 := 50;
  v_period    timestamptz := date_trunc('month', now());
  v_resets_at timestamptz;
BEGIN
  SELECT plan = 'pro' INTO v_is_paid FROM profiles WHERE id = p_user_id;
  SELECT message_count INTO v_count
  FROM message_usage
  WHERE user_id = p_user_id AND period_start = v_period;

  v_count     := COALESCE(v_count, 0);
  v_resets_at := v_period + interval '1 month';

  RETURN json_build_object(
    'message_count', v_count,
    'free_limit',    v_limit,
    'remaining',     GREATEST(0, v_limit - v_count),
    'is_paid',       COALESCE(v_is_paid, false),
    'can_send',      COALESCE(v_is_paid, false) OR v_count < v_limit,
    'resets_at',     v_resets_at
  );
END;
$$;

-- Increments the message count for the current month and returns new status.
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period    timestamptz := date_trunc('month', now());
  v_count     int4;
  v_limit     int4 := 50;
  v_is_paid   boolean := false;
BEGIN
  SELECT plan = 'pro' INTO v_is_paid FROM profiles WHERE id = p_user_id;

  INSERT INTO message_usage (user_id, period_start, message_count)
  VALUES (p_user_id, v_period, 1)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET message_count = message_usage.message_count + 1,
                updated_at    = now()
  RETURNING message_count INTO v_count;

  RETURN json_build_object(
    'new_count',     v_count,
    'remaining',     GREATEST(0, v_limit - v_count),
    'limit_reached', NOT COALESCE(v_is_paid, false) AND v_count >= v_limit,
    'is_paid',       COALESCE(v_is_paid, false)
  );
END;
$$;
