-- ============================================================
-- BetterNotes v2 — Migration: Exam Attempts Tracking (F4-M3)
-- Proyecto: unnaedblaufyganyconl
-- ============================================================
-- Crea la tabla exam_attempts para:
-- - Tracking de intentos de exámenes completados
-- - Estadísticas de rendimiento por materia, nivel, tiempo
-- - Racha de estudio y evolución temporal
-- Incluye trigger automático que captura exámenes completados
-- ============================================================

-- ---------------------
-- 1. exam_attempts
-- ---------------------
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_id         uuid        REFERENCES public.exams(id) ON DELETE SET NULL,
  subject         text        NOT NULL,
  level           text        NOT NULL
    CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  score           int4        NOT NULL
    CHECK (score >= 0 AND score <= 100),
  question_count  int4        NOT NULL CHECK (question_count > 0),
  correct_count   int4        NOT NULL
    CHECK (correct_count >= 0 AND correct_count <= question_count),
  completed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices en exam_attempts
-- Índice principal: listar intentos del usuario
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id
  ON public.exam_attempts(user_id);

-- Índice: estadísticas por materia (usuario + subject)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_subject
  ON public.exam_attempts(user_id, subject);

-- Índice: evolución temporal (usuario + completed_at para timeline)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_completed_asc
  ON public.exam_attempts(user_id, completed_at);

-- Índice: racha y recientes (user_id + completed_at descendente)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_completed_desc
  ON public.exam_attempts(user_id, completed_at DESC);

-- Índice compuesto: filtrado por materia y nivel
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_subject_level
  ON public.exam_attempts(user_id, subject, level);

-- ============================================================
-- 2. TRIGGER: Captura automática de exámenes completados
-- ============================================================
-- Cuando un examen en la tabla exams pase a status = 'completed'
-- (es decir, cuando se asigne score y completed_at),
-- se inserta automáticamente un registro en exam_attempts

CREATE OR REPLACE FUNCTION public.fn_insert_exam_attempt_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo activa cuando:
  -- 1. El status cambia de 'pending' a 'completed'
  -- 2. score y completed_at ahora tienen valor (no eran NULL antes)
  IF NEW.status = 'completed'
    AND OLD.status = 'pending'
    AND NEW.score IS NOT NULL
    AND NEW.completed_at IS NOT NULL
  THEN
    INSERT INTO public.exam_attempts (
      user_id,
      exam_id,
      subject,
      level,
      score,
      question_count,
      correct_count,
      completed_at
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      NEW.subject,
      NEW.level,
      NEW.score,
      NEW.question_count,
      ROUND(NEW.score * NEW.question_count / 100.0),
      NEW.completed_at
    )
    ON CONFLICT DO NOTHING; -- Prevenir duplicados si el trigger se ejecuta varias veces
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger en la tabla exams
CREATE TRIGGER trg_exams_on_complete_insert_attempt
  AFTER UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_insert_exam_attempt_on_complete();

-- ============================================================
-- 3. RLS: exam_attempts — owner_all (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_attempts: owner select"
  ON public.exam_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exam_attempts: owner insert"
  ON public.exam_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exam_attempts: owner update"
  ON public.exam_attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exam_attempts: owner delete"
  ON public.exam_attempts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. Ejemplo de queries para casos de uso principales
-- ============================================================
-- NOTA: Descomentar para probar

-- -- Últimos 5 intentos del usuario
-- SELECT id, subject, level, score, question_count, correct_count, completed_at
-- FROM public.exam_attempts
-- WHERE user_id = auth.uid()
-- ORDER BY completed_at DESC
-- LIMIT 5;

-- -- Estadísticas por materia
-- SELECT
--   subject,
--   COUNT(*) as attempt_count,
--   ROUND(AVG(score)::numeric, 1) as avg_score,
--   MAX(score) as max_score,
--   MIN(score) as min_score
-- FROM public.exam_attempts
-- WHERE user_id = auth.uid()
-- GROUP BY subject
-- ORDER BY attempt_count DESC;

-- -- Racha: intentos últimos 7 días
-- SELECT COUNT(*) as attempts_last_7_days
-- FROM public.exam_attempts
-- WHERE user_id = auth.uid()
--   AND completed_at > NOW() - INTERVAL '7 days';

-- -- Evolución temporal por materia
-- SELECT
--   DATE(completed_at) as exam_date,
--   subject,
--   ROUND(AVG(score)::numeric, 1) as daily_avg_score,
--   COUNT(*) as daily_count
-- FROM public.exam_attempts
-- WHERE user_id = auth.uid()
-- GROUP BY DATE(completed_at), subject
-- ORDER BY exam_date DESC;

-- ============================================================
-- Rollback / Revert
-- ============================================================
-- Para revertir esta migración:
-- 1. DROP TRIGGER IF EXISTS trg_exams_on_complete_insert_attempt ON public.exams;
-- 2. DROP FUNCTION IF EXISTS public.fn_insert_exam_attempt_on_complete();
-- 3. DROP POLICY IF EXISTS "exam_attempts: owner delete" ON public.exam_attempts;
-- 4. DROP POLICY IF EXISTS "exam_attempts: owner update" ON public.exam_attempts;
-- 5. DROP POLICY IF EXISTS "exam_attempts: owner insert" ON public.exam_attempts;
-- 6. DROP POLICY IF EXISTS "exam_attempts: owner select" ON public.exam_attempts;
-- 7. ALTER TABLE public.exam_attempts DISABLE ROW LEVEL SECURITY;
-- 8. DROP TABLE IF EXISTS public.exam_attempts CASCADE;
-- ============================================================
