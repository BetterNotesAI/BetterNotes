-- ============================================================
-- 02_functions.sql
-- Shared utility functions used across multiple tables/triggers.
-- ============================================================

-- Automatically updates the updated_at column before any row update.
-- Attached as a BEFORE UPDATE trigger on every table with updated_at.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Creates a profile row automatically when a new user signs up via Supabase Auth.
-- Triggered by auth.users INSERT — keeps profiles in sync with auth.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
