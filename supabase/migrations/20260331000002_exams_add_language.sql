ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'english';
