-- ============================================================
-- BetterNotes v2 — Migration: Exams RLS Policies (F4-M2.1)
-- Proyecto: unnaedblaufyganyconl
-- ============================================================
-- Habilita RLS y define políticas para las tablas de exámenes:
-- - exams: cada usuario solo puede ver/editar sus propios exámenes
-- - exam_questions: accesible solo a través del examen del propietario
-- ============================================================

-- ---------------------
-- Habilitar RLS
-- ---------------------
ALTER TABLE public.exams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions     ENABLE ROW LEVEL SECURITY;

-- ---------------------
-- RLS: exams — owner_all (SELECT, INSERT, UPDATE, DELETE)
-- ---------------------
CREATE POLICY "exams: owner select"
  ON public.exams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exams: owner insert"
  ON public.exams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exams: owner update"
  ON public.exams FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exams: owner delete"
  ON public.exams FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------
-- RLS: exam_questions — owner_all via exams.user_id
-- Usa function owns_exam() para evitar recursión
-- ---------------------

-- HELPER: owns_exam()
-- SECURITY DEFINER para evitar recursión en RLS de exam_questions
CREATE OR REPLACE FUNCTION public.owns_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = p_exam_id
      AND user_id = auth.uid()
  );
$$;

CREATE POLICY "exam_questions: owner select"
  ON public.exam_questions FOR SELECT
  USING (public.owns_exam(exam_id));

CREATE POLICY "exam_questions: owner insert"
  ON public.exam_questions FOR INSERT
  WITH CHECK (public.owns_exam(exam_id));

CREATE POLICY "exam_questions: owner update"
  ON public.exam_questions FOR UPDATE
  USING (public.owns_exam(exam_id))
  WITH CHECK (public.owns_exam(exam_id));

CREATE POLICY "exam_questions: owner delete"
  ON public.exam_questions FOR DELETE
  USING (public.owns_exam(exam_id));

-- ============================================================
-- Rollback / Revert
-- ============================================================
-- Para revertir esta migración:
-- 1. DROP POLICY IF EXISTS "exam_questions: owner delete" ON public.exam_questions;
-- 2. DROP POLICY IF EXISTS "exam_questions: owner update" ON public.exam_questions;
-- 3. DROP POLICY IF EXISTS "exam_questions: owner insert" ON public.exam_questions;
-- 4. DROP POLICY IF EXISTS "exam_questions: owner select" ON public.exam_questions;
-- 5. DROP POLICY IF EXISTS "exams: owner delete" ON public.exams;
-- 6. DROP POLICY IF EXISTS "exams: owner update" ON public.exams;
-- 7. DROP POLICY IF EXISTS "exams: owner insert" ON public.exams;
-- 8. DROP POLICY IF EXISTS "exams: owner select" ON public.exams;
-- 9. DROP FUNCTION IF EXISTS public.owns_exam(uuid);
-- 10. ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
-- 11. ALTER TABLE public.exam_questions DISABLE ROW LEVEL SECURITY;
-- ============================================================
