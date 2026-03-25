-- ============================================================
-- BetterNotes v2 — Migration: F2-M7.1 Templates is_active
-- Adds is_active column to templates and marks 6 of 10 inactive.
-- Active templates (4): 2cols_portrait, landscape_3col_maths,
--   study_form, lecture_notes
-- Inactive templates (6): cornell, problem_solving, zettelkasten,
--   academic_paper, lab_report, data_analysis
-- ============================================================

-- Add is_active column (default true so existing rows stay active)
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Mark 6 templates as inactive
UPDATE public.templates
SET is_active = false
WHERE id IN (
  'cornell',
  'problem_solving',
  'zettelkasten',
  'academic_paper',
  'lab_report',
  'data_analysis'
);
