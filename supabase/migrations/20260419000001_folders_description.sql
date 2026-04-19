-- ============================================================
-- BetterNotes v2 — folders.description
-- Per-project description, used as context for AI-generated documents.
-- ============================================================

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;
