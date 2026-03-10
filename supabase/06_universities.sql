-- ============================================================
-- 06_universities.sql
-- University catalogue: institutions, degree programs, subjects.
-- Also adds university/program FK columns to profiles.
-- Depends on: 03_users.sql (profiles)
-- ============================================================


-- ── universities ─────────────────────────────────────────────
-- Reference table of academic institutions. Read-only for users.

CREATE TABLE IF NOT EXISTS universities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  short_name text,
  city       text,
  country    text NOT NULL DEFAULT 'España',
  logo_url   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'uni_public_read' AND tablename = 'universities') THEN
    CREATE POLICY uni_public_read ON universities FOR SELECT USING (true);
  END IF;
END $$;


-- ── degree_programs ───────────────────────────────────────────
-- Degree programs offered by each university.

CREATE TABLE IF NOT EXISTS degree_programs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name          text NOT NULL,
  degree_type   text CHECK (degree_type IN ('grado', 'master', 'doctorado')),
  years         int4 DEFAULT 4,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_university ON degree_programs(university_id);

ALTER TABLE degree_programs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dp_public_read' AND tablename = 'degree_programs') THEN
    CREATE POLICY dp_public_read ON degree_programs FOR SELECT USING (true);
  END IF;
END $$;


-- ── subjects ──────────────────────────────────────────────────
-- Individual subjects within a degree program.

CREATE TABLE IF NOT EXISTS subjects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES degree_programs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  year       int4,
  semester   int4,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_program ON subjects(program_id);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subj_public_read' AND tablename = 'subjects') THEN
    CREATE POLICY subj_public_read ON subjects FOR SELECT USING (true);
  END IF;
END $$;


-- ── profiles: add university FK columns ───────────────────────
-- Deferred until here because universities/degree_programs must
-- exist before we can reference them.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'university_id'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN university_id uuid REFERENCES universities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'degree_program_id'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN degree_program_id uuid REFERENCES degree_programs(id) ON DELETE SET NULL;
  END IF;
END $$;
