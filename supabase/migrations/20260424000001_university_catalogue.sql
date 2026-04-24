-- ============================================================
-- BetterNotes — University Catalogue (F5-M3)
-- Three-table hierarchy: universities → degree_programs → courses
-- Documents FK into this catalogue; existing free-text columns
-- are kept as denormalised display strings.
-- ============================================================

-- ── 1. Universities ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.universities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,   -- e.g. "uc3m"
  country     text NOT NULL DEFAULT 'ES',
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Degree programmes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.degree_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  tipo            text NOT NULL,   -- Grado | Máster | PCEO (Doble Grado) | PCEO (Doble Máster)
  title           text NOT NULL,
  slug            text NOT NULL,   -- URL-safe version of title
  url             text,            -- official programme page
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_degree_programs_university
  ON public.degree_programs (university_id);

-- ── 3. Courses ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  degree_program_id uuid NOT NULL REFERENCES public.degree_programs(id) ON DELETE CASCADE,
  year              smallint NOT NULL,       -- 1–6
  semester          smallint,               -- 1–4 for standard; NULL for module-based programmes
  semester_label    text,                   -- raw label for non-standard groupings (Módulo I, Materia 1…)
  name              text NOT NULL,
  ects              numeric(4,1),
  tipo              text,                    -- Básica | Obligatoria | Optativa
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_degree_program
  ON public.courses (degree_program_id);

CREATE INDEX IF NOT EXISTS idx_courses_name
  ON public.courses USING gin (to_tsvector('spanish', name));

-- ── 4. Link documents to catalogue ──────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS university_id   uuid REFERENCES public.universities(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id      uuid REFERENCES public.degree_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id       uuid REFERENCES public.courses(id)         ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_university_id
  ON public.documents (university_id) WHERE university_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_program_id
  ON public.documents (program_id) WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_course_id
  ON public.documents (course_id) WHERE course_id IS NOT NULL;

-- ── 5. RLS — catalogue is public-read, service-role writes ──
ALTER TABLE public.universities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degree_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read universities"    ON public.universities;
DROP POLICY IF EXISTS "Public read degree_programs" ON public.degree_programs;
DROP POLICY IF EXISTS "Public read courses"         ON public.courses;

CREATE POLICY "Public read universities"
  ON public.universities FOR SELECT USING (true);

CREATE POLICY "Public read degree_programs"
  ON public.degree_programs FOR SELECT USING (true);

CREATE POLICY "Public read courses"
  ON public.courses FOR SELECT USING (true);
