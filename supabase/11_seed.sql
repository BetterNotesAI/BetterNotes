-- ============================================================
-- 11_seed.sql
-- Initial seed data for the universities catalogue.
-- Depends on: 06_universities.sql (universities table)
--
-- This block is idempotent: it only inserts if the table is
-- empty, so it is safe to run on an existing database.
-- ============================================================


-- ── Spanish universities ──────────────────────────────────────

INSERT INTO universities (name, short_name, city, country)
SELECT * FROM (VALUES
  ('Universitat Politècnica de Catalunya',    'UPC', 'Barcelona', 'España'),
  ('Universitat de Barcelona',                'UB',  'Barcelona', 'España'),
  ('Universitat Autònoma de Barcelona',       'UAB', 'Barcelona', 'España'),
  ('Universitat Pompeu Fabra',                'UPF', 'Barcelona', 'España'),
  ('Universitat Rovira i Virgili',            'URV', 'Tarragona', 'España'),
  ('Universidad Autónoma de Madrid',          'UAM', 'Madrid',    'España'),
  ('Universidad Complutense de Madrid',       'UCM', 'Madrid',    'España'),
  ('Universidad Politécnica de Madrid',       'UPM', 'Madrid',    'España'),
  ('Universidad de Sevilla',                  'US',  'Sevilla',   'España'),
  ('Universitat de València',                 'UV',  'Valencia',  'España')
) AS v(name, short_name, city, country)
WHERE NOT EXISTS (SELECT 1 FROM universities LIMIT 1);


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after applying all SQL files to confirm the setup:
--
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--   SELECT policyname, tablename FROM pg_policies ORDER BY tablename;
--   SELECT id, name, public FROM storage.buckets;
--   SELECT count(*) FROM universities;
--
-- Expected tables:
--   chats, degree_programs, document_ratings, message_usage,
--   profiles, project_files, project_output_files, project_shares,
--   projects, published_documents, subjects, support_tickets, universities
-- ============================================================
