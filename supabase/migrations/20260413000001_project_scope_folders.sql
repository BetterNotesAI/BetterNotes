-- ============================================================
-- Project scope support for Problem Solver + Exams
-- Adds optional folder_id links so non-document tools can live
-- inside the same project folder.
-- ============================================================

ALTER TABLE public.problem_solver_sessions
  ADD COLUMN IF NOT EXISTS folder_id uuid
  REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ps_sessions_user_folder_created
  ON public.problem_solver_sessions(user_id, folder_id, created_at DESC);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS folder_id uuid
  REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_user_folder_created
  ON public.exams(user_id, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exams_user_folder_status
  ON public.exams(user_id, folder_id, status);

