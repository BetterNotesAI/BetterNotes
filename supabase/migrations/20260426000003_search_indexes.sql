-- ============================================================
-- BetterNotes — Full-text search indexes (F5-M4 Search)
-- Uses 'simple' dictionary so it works for any language
-- without stemming — avoids false negatives on Spanish/English
-- mixed content.
-- ============================================================

-- ── documents ───────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(degree, '') || ' ' ||
      coalesce(university, '') || ' ' ||
      coalesce(array_to_string(keywords, ' '), '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN(search_vector);

-- ── degree_programs ─────────────────────────────────────────
ALTER TABLE degree_programs
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS degree_programs_search_idx ON degree_programs USING GIN(search_vector);

-- ── courses ─────────────────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS courses_search_idx ON courses USING GIN(search_vector);
