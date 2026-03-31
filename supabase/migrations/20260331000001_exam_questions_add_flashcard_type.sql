-- Add 'flashcard' to the exam_questions.type check constraint
ALTER TABLE public.exam_questions
  DROP CONSTRAINT IF EXISTS exam_questions_type_check;

ALTER TABLE public.exam_questions
  ADD CONSTRAINT exam_questions_type_check
  CHECK (type IN ('multiple_choice', 'true_false', 'fill_in', 'flashcard'));
