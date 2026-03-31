-- ============================================================
-- BetterNotes v2 — Migration: Exams Tables (F4-M2.1)
-- Proyecto: unnaedblaufyganyconl
-- ============================================================
-- Crea las tablas para soportar exámenes de práctica:
-- - exams: registro de exámenes generados por el usuario
-- - exam_questions: preguntas individuales de cada examen
-- ============================================================

-- ---------------------
-- 1. exams
-- ---------------------
CREATE TABLE IF NOT EXISTS public.exams (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  subject         text        NOT NULL,
  level           text        NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  question_count  int4        NOT NULL DEFAULT 0,
  score           int4,
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  CONSTRAINT check_completed_at CHECK (
    (status = 'pending' AND completed_at IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL)
  )
);

-- Índices en exams
CREATE INDEX IF NOT EXISTS idx_exams_user_id
  ON public.exams(user_id);

CREATE INDEX IF NOT EXISTS idx_exams_created_at
  ON public.exams(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exams_status
  ON public.exams(user_id, status)
  WHERE status = 'pending';

-- ---------------------
-- 2. exam_questions
-- ---------------------
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid        NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_number int4        NOT NULL,
  type            text        NOT NULL
    CHECK (type IN ('multiple_choice', 'true_false', 'fill_in')),
  question        text        NOT NULL,
  options         jsonb,
  correct_answer  text        NOT NULL,
  user_answer     text,
  is_correct      boolean,
  explanation     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_number)
);

-- Índices en exam_questions
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id
  ON public.exam_questions(exam_id);

CREATE INDEX IF NOT EXISTS idx_exam_questions_is_correct
  ON public.exam_questions(exam_id, is_correct)
  WHERE is_correct IS NOT NULL;

-- ============================================================
-- Rollback / Revert
-- ============================================================
-- Para revertir esta migración:
-- 1. DROP TABLE IF EXISTS public.exam_questions CASCADE;
-- 2. DROP TABLE IF EXISTS public.exams CASCADE;
-- ============================================================
