-- F4-M3: Add time_spent_seconds and cognitive_distribution to exams
-- Already applied manually in Supabase Dashboard on 2026-04-01

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS cognitive_distribution JSONB;

COMMENT ON COLUMN exams.time_spent_seconds IS 'Seconds elapsed from exam start to submit. NULL if not tracked.';
COMMENT ON COLUMN exams.cognitive_distribution IS 'Cognitive distribution used at generation time. Shape: {memory, logic, application} summing to 100.';
