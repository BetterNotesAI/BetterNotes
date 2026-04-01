ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS has_math boolean NOT NULL DEFAULT false;
