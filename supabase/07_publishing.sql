-- ============================================================
-- 07_publishing.sql
-- Community publishing: shared documents and their ratings.
-- Depends on: 03_users.sql (profiles), 05_projects.sql (projects),
--             06_universities.sql (subjects)
-- ============================================================


-- ── published_documents ───────────────────────────────────────
-- Documents that users have made public for the community.
-- Linked to a project as the source of truth for the content.
-- Supports full-text search via the search_published_documents() RPC.

CREATE TABLE IF NOT EXISTS published_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id),
  subject_id    uuid REFERENCES subjects(id) ON DELETE SET NULL,
  category      text CHECK (category IN ('apuntes', 'formularios', 'problemas', 'examenes')),
  title         text NOT NULL,
  description   text,
  tags          text[] DEFAULT '{}',
  pdf_url       text,
  thumbnail_url text,
  avg_rating    numeric(3,2) DEFAULT 0,
  rating_count  int4 DEFAULT 0,
  view_count    int4 DEFAULT 0,
  visibility    text NOT NULL DEFAULT 'public',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_docs_user      ON published_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_pub_docs_subject   ON published_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_pub_docs_category  ON published_documents(category);
CREATE INDEX IF NOT EXISTS idx_pub_docs_tags      ON published_documents USING gin(tags);
-- Trigram index for fast partial-text search on title (requires pg_trgm from 01_extensions.sql)
CREATE INDEX IF NOT EXISTS idx_pub_docs_title_trgm ON published_documents USING gin(title gin_trgm_ops);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pub_docs_updated_at') THEN
    CREATE TRIGGER set_pub_docs_updated_at
      BEFORE UPDATE ON published_documents
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE published_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pd_owner_all' AND tablename = 'published_documents') THEN
    CREATE POLICY pd_owner_all ON published_documents
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pd_public_read' AND tablename = 'published_documents') THEN
    CREATE POLICY pd_public_read ON published_documents
      FOR SELECT USING (visibility = 'public');
  END IF;
END $$;


-- ── document_ratings ──────────────────────────────────────────
-- One rating (1–5 stars) per user per document.
-- The recalc_document_rating trigger keeps avg_rating up to date.

CREATE TABLE IF NOT EXISTS document_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES published_documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      int4 NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_document ON document_ratings(document_id);

ALTER TABLE document_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dr_owner_all' AND tablename = 'document_ratings') THEN
    CREATE POLICY dr_owner_all ON document_ratings
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dr_public_read' AND tablename = 'document_ratings') THEN
    CREATE POLICY dr_public_read ON document_ratings FOR SELECT USING (true);
  END IF;
END $$;


-- ── Rating trigger ────────────────────────────────────────────
-- Recalculates avg_rating and rating_count on published_documents
-- whenever a rating is inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION recalc_document_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE published_documents
  SET avg_rating   = COALESCE((
        SELECT AVG(rating)::numeric(3,2)
        FROM document_ratings
        WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)
      ), 0),
      rating_count = (
        SELECT COUNT(*)
        FROM document_ratings
        WHERE document_id = COALESCE(NEW.document_id, OLD.document_id)
      )
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_rating_insert ON document_ratings;
CREATE TRIGGER trg_recalc_rating_insert
  AFTER INSERT ON document_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_document_rating();

DROP TRIGGER IF EXISTS trg_recalc_rating_update ON document_ratings;
CREATE TRIGGER trg_recalc_rating_update
  AFTER UPDATE ON document_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_document_rating();

DROP TRIGGER IF EXISTS trg_recalc_rating_delete ON document_ratings;
CREATE TRIGGER trg_recalc_rating_delete
  AFTER DELETE ON document_ratings
  FOR EACH ROW EXECUTE FUNCTION recalc_document_rating();


-- ── Publishing RPC functions ──────────────────────────────────

-- Increments the view counter for a document (called from the frontend).
CREATE OR REPLACE FUNCTION increment_view_count(p_doc_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE published_documents SET view_count = view_count + 1 WHERE id = p_doc_id;
END;
$$;


-- Full-text search across public documents.
-- Accent- and case-insensitive (requires unaccent from 01_extensions.sql).
-- Returns document info joined with author, subject, and university.
CREATE OR REPLACE FUNCTION search_published_documents(
  p_query  text,
  p_limit  int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  title            text,
  description      text,
  category         text,
  tags             text[],
  pdf_url          text,
  thumbnail_url    text,
  avg_rating       numeric,
  rating_count     int4,
  view_count       int4,
  created_at       timestamptz,
  user_display_name text,
  user_avatar_url  text,
  university_name  text,
  subject_name     text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  normalized text;
BEGIN
  normalized := '%' || lower(unaccent(p_query)) || '%';
  RETURN QUERY
  SELECT pd.id, pd.title, pd.description, pd.category, pd.tags,
         pd.pdf_url, pd.thumbnail_url, pd.avg_rating, pd.rating_count,
         pd.view_count, pd.created_at,
         p.display_name,  p.avatar_url,
         u.name AS university_name,
         s.name AS subject_name
  FROM   published_documents pd
  LEFT JOIN profiles       p  ON p.id  = pd.user_id
  LEFT JOIN subjects       s  ON s.id  = pd.subject_id
  LEFT JOIN degree_programs dp ON dp.id = s.program_id
  LEFT JOIN universities   u  ON u.id  = dp.university_id
  WHERE  pd.visibility = 'public'
    AND (
      lower(unaccent(pd.title))                     LIKE normalized OR
      lower(unaccent(COALESCE(pd.description, ''))) LIKE normalized OR
      lower(unaccent(COALESCE(s.name, '')))         LIKE normalized OR
      lower(unaccent(COALESCE(u.name, '')))         LIKE normalized OR
      EXISTS (
        SELECT 1 FROM unnest(pd.tags) t
        WHERE lower(unaccent(t)) LIKE normalized
      )
    )
  ORDER BY pd.avg_rating DESC, pd.view_count DESC, pd.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
