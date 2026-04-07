-- F4: Shared exams — allow publishing exams for other users to take
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS share_token     uuid    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_published    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_exam_id  uuid    REFERENCES public.exams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_attempts integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS exams_share_token_idx
  ON public.exams (share_token)
  WHERE share_token IS NOT NULL;
