-- ============================================================
-- BetterNotes v2 — Migration: Fix level check constraint (F4-M3)
-- Proyecto: unnaedblaufyganyconl
-- ============================================================
-- The difficulty system was redesigned to a 3x3 matrix:
--   Secondary / High School / University  ×  Basic / Intermediate / Advanced
-- This migration replaces the old 3-value constraint with the 9-value one
-- on both tables: exams and exam_attempts.
-- ============================================================

-- ---------------------
-- 1. exams.level
-- ---------------------
ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_level_check;

ALTER TABLE public.exams
  ALTER COLUMN level SET DEFAULT 'secondary_basic';

ALTER TABLE public.exams
  ADD CONSTRAINT exams_level_check
    CHECK (level IN (
      'secondary_basic',    'secondary_intermediate',    'secondary_advanced',
      'highschool_basic',   'highschool_intermediate',   'highschool_advanced',
      'university_basic',   'university_intermediate',   'university_advanced'
    ));

-- ---------------------
-- 2. exam_attempts.level
-- ---------------------
ALTER TABLE public.exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_level_check;

ALTER TABLE public.exam_attempts
  ADD CONSTRAINT exam_attempts_level_check
    CHECK (level IN (
      'secondary_basic',    'secondary_intermediate',    'secondary_advanced',
      'highschool_basic',   'highschool_intermediate',   'highschool_advanced',
      'university_basic',   'university_intermediate',   'university_advanced'
    ));

-- ============================================================
-- NOTE: Existing rows with legacy values ('beginner',
-- 'intermediate', 'advanced') will be rejected by the new
-- constraint only on UPDATE. To migrate old data run:
--
-- UPDATE public.exams
--   SET level = CASE level
--     WHEN 'beginner'     THEN 'secondary_basic'
--     WHEN 'intermediate' THEN 'secondary_intermediate'
--     WHEN 'advanced'     THEN 'secondary_advanced'
--   END
-- WHERE level IN ('beginner', 'intermediate', 'advanced');
--
-- UPDATE public.exam_attempts
--   SET level = CASE level
--     WHEN 'beginner'     THEN 'secondary_basic'
--     WHEN 'intermediate' THEN 'secondary_intermediate'
--     WHEN 'advanced'     THEN 'secondary_advanced'
--   END
-- WHERE level IN ('beginner', 'intermediate', 'advanced');
-- ============================================================

-- Migrate existing legacy rows in exams
UPDATE public.exams
  SET level = CASE level
    WHEN 'beginner'     THEN 'secondary_basic'
    WHEN 'intermediate' THEN 'secondary_intermediate'
    WHEN 'advanced'     THEN 'secondary_advanced'
    ELSE level
  END
WHERE level IN ('beginner', 'intermediate', 'advanced');

-- Migrate existing legacy rows in exam_attempts
UPDATE public.exam_attempts
  SET level = CASE level
    WHEN 'beginner'     THEN 'secondary_basic'
    WHEN 'intermediate' THEN 'secondary_intermediate'
    WHEN 'advanced'     THEN 'secondary_advanced'
    ELSE level
  END
WHERE level IN ('beginner', 'intermediate', 'advanced');
