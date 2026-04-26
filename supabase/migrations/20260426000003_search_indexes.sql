-- ============================================================
-- BetterNotes — Full-text search indexes (F5-M4 Search)
-- Uses 'simple' dictionary so it works for any language
-- without stemming — avoids false negatives on Spanish/English
-- mixed content.
--
-- Uses trigger-maintained tsvector columns instead of
-- GENERATED ALWAYS AS, which fails with the immutability
-- constraint on Supabase's PostgreSQL (error 42P17).
-- ============================================================

-- ── documents ───────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE documents
SET search_vector = to_tsvector('simple',
  coalesce(title, '') || ' ' ||
  coalesce(subject, '') || ' ' ||
  coalesce(degree, '') || ' ' ||
  coalesce(university, '') || ' ' ||
  coalesce(array_to_string(keywords, ' '), '')
);

CREATE OR REPLACE FUNCTION documents_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.degree, '') || ' ' ||
    coalesce(NEW.university, '') || ' ' ||
    coalesce(array_to_string(NEW.keywords, ' '), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_search_vector_trig ON documents;
CREATE TRIGGER documents_search_vector_trig
  BEFORE INSERT OR UPDATE OF title, subject, degree, university, keywords
  ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();

CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN(search_vector);

-- ── degree_programs ─────────────────────────────────────────
ALTER TABLE degree_programs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE degree_programs
SET search_vector = to_tsvector('simple', coalesce(title, ''));

CREATE OR REPLACE FUNCTION degree_programs_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS degree_programs_search_vector_trig ON degree_programs;
CREATE TRIGGER degree_programs_search_vector_trig
  BEFORE INSERT OR UPDATE OF title
  ON degree_programs
  FOR EACH ROW EXECUTE FUNCTION degree_programs_search_vector_update();

CREATE INDEX IF NOT EXISTS degree_programs_search_idx ON degree_programs USING GIN(search_vector);

-- ── courses ─────────────────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE courses
SET search_vector = to_tsvector('simple', coalesce(name, ''));

CREATE OR REPLACE FUNCTION courses_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_search_vector_trig ON courses;
CREATE TRIGGER courses_search_vector_trig
  BEFORE INSERT OR UPDATE OF name
  ON courses
  FOR EACH ROW EXECUTE FUNCTION courses_search_vector_update();

CREATE INDEX IF NOT EXISTS courses_search_idx ON courses USING GIN(search_vector);
