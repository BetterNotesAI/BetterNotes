ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS grading_mode text NOT NULL DEFAULT 'strict'
    CHECK (grading_mode IN ('strict', 'partial'));

-- partial_score: AI-assigned score 0.0–1.0 for fill_in in partial mode (null otherwise)
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS partial_score real;
