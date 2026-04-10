-- ============================================================
-- Settings / Profile fields
-- ============================================================

-- Expand theme options to include system
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check
  CHECK (theme IN ('light', 'dark', 'system'));

-- New profile/account preference fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS short_bio text,
  ADD COLUMN IF NOT EXISTS university text,
  ADD COLUMN IF NOT EXISTS degree text,
  ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_visibility_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_visibility_check
  CHECK (profile_visibility IN ('public', 'private'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_check
  CHECK (language IN ('en', 'es', 'fr', 'de', 'it', 'pt'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,32}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_short_bio_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_short_bio_len
  CHECK (short_bio IS NULL OR char_length(short_bio) <= 280);

-- Case-insensitive unique username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
