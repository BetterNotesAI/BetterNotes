ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS profile_university_id uuid REFERENCES universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_program_id uuid REFERENCES degree_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_year smallint,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
