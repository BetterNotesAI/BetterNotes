-- ============================================================
-- 01_extensions.sql
-- PostgreSQL extensions required by BetterNotes
-- Run this first — other files depend on these being available.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram index for fuzzy/partial text search
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- accent-insensitive search (e.g. "fisica" matches "física")
