-- F4-M3: RPC get_exam_stats — aggregate exam stats in SQL to avoid full table scan in Node

CREATE OR REPLACE FUNCTION get_exam_stats(p_user_id UUID)
RETURNS TABLE (
  total_exams      INTEGER,
  avg_score        NUMERIC(5,2),
  avg_time_seconds NUMERIC(10,2),
  subjects         JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subjects JSONB;
BEGIN
  -- Per-subject aggregation
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'subject',      COALESCE(s.subject, 'Unknown'),
          'attempts',     s.attempts,
          'avg_score',    ROUND(s.avg_score::NUMERIC, 2),
          'best_score',   s.best_score,
          'last_attempt', s.last_attempt
        )
        ORDER BY s.avg_score DESC
      ),
      '[]'::JSONB
    )
  INTO v_subjects
  FROM (
    SELECT
      subject,
      COUNT(*)                AS attempts,
      AVG(score)              AS avg_score,
      MAX(score)              AS best_score,
      MAX(completed_at)::TEXT AS last_attempt
    FROM exams
    WHERE
      user_id      = p_user_id
      AND status   = 'completed'
      AND score    IS NOT NULL
      AND completed_at IS NOT NULL
    GROUP BY subject
  ) s;

  -- Global totals
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER                          AS total_exams,
    ROUND(AVG(score)::NUMERIC, 2)             AS avg_score,
    ROUND(AVG(time_spent_seconds)::NUMERIC, 2) AS avg_time_seconds,
    v_subjects                                 AS subjects
  FROM exams
  WHERE
    user_id      = p_user_id
    AND status   = 'completed'
    AND score    IS NOT NULL
    AND completed_at IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_exam_stats(UUID) TO authenticated;
