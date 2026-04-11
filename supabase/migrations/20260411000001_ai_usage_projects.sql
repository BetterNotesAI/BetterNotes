-- Add project-level attribution for AI usage events and admin analytics views.

ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_usage_events_project_type_check'
      AND conrelid = 'public.ai_usage_events'::regclass
  ) THEN
    ALTER TABLE public.ai_usage_events
      ADD CONSTRAINT ai_usage_events_project_type_check
      CHECK (
        project_type IS NULL
        OR project_type IN ('document', 'cheat_sheet', 'problem_solver', 'exam')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ai_usage_events_project_created_idx
  ON public.ai_usage_events (project_type, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_feature_created_idx
  ON public.ai_usage_events (user_id, feature, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_model_created_idx
  ON public.ai_usage_events (provider, model, created_at DESC);

-- Best-effort backfill for historical rows.
UPDATE public.ai_usage_events
SET
  project_type = COALESCE(
    project_type,
    CASE
      WHEN feature LIKE 'problem_solver%' THEN 'problem_solver'
      WHEN feature LIKE 'exam_%' THEN 'exam'
      WHEN feature LIKE 'cheat_sheet%' THEN 'cheat_sheet'
      WHEN feature LIKE 'document_%' THEN 'document'
      WHEN COALESCE(metadata->>'path', '') LIKE '/problem-solver/%' THEN 'problem_solver'
      WHEN COALESCE(metadata->>'path', '') LIKE '/exams/%' THEN 'exam'
      WHEN COALESCE(metadata->>'path', '') LIKE '/cheat-sheet/%' THEN 'cheat_sheet'
      WHEN COALESCE(metadata->>'path', '') LIKE '/api/cheat-sheets/%' THEN 'cheat_sheet'
      WHEN COALESCE(metadata->>'path', '') LIKE '/latex/%' THEN 'document'
      ELSE NULL
    END
  ),
  project_id = COALESCE(
    project_id,
    CASE
      WHEN COALESCE(metadata->>'document_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (metadata->>'document_id')::uuid
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(metadata->>'session_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (metadata->>'session_id')::uuid
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(metadata->>'exam_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (metadata->>'exam_id')::uuid
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(metadata->>'project_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (metadata->>'project_id')::uuid
      ELSE NULL
    END
  )
WHERE project_type IS NULL
   OR project_id IS NULL;

-- Keep only the new function signature to avoid ambiguity in PostgREST RPC resolution.
DROP FUNCTION IF EXISTS public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_feature text DEFAULT NULL,
  p_input_tokens int4 DEFAULT 0,
  p_cached_input_tokens int4 DEFAULT 0,
  p_output_tokens int4 DEFAULT 0,
  p_input_price_per_1m numeric DEFAULT 0,
  p_cached_input_price_per_1m numeric DEFAULT 0,
  p_output_price_per_1m numeric DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_project_type text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_input_tokens int4 := GREATEST(COALESCE(p_input_tokens, 0), 0);
  v_cached_input_tokens int4 := GREATEST(COALESCE(p_cached_input_tokens, 0), 0);
  v_output_tokens int4 := GREATEST(COALESCE(p_output_tokens, 0), 0);
  v_input_price numeric := GREATEST(COALESCE(p_input_price_per_1m, 0), 0);
  v_cached_input_price numeric := GREATEST(COALESCE(p_cached_input_price_per_1m, 0), 0);
  v_output_price numeric := GREATEST(COALESCE(p_output_price_per_1m, 0), 0);
  v_input_cost numeric(14, 8);
  v_cached_input_cost numeric(14, 8);
  v_output_cost numeric(14, 8);
  v_total_cost numeric(14, 8);
  v_project_type text := NULLIF(TRIM(LOWER(COALESCE(p_project_type, ''))), '');
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_project_type IS NOT NULL
     AND v_project_type NOT IN ('document', 'cheat_sheet', 'problem_solver', 'exam') THEN
    v_project_type := NULL;
  END IF;

  v_input_cost := ROUND((v_input_tokens::numeric / 1000000) * v_input_price, 8);
  v_cached_input_cost := ROUND((v_cached_input_tokens::numeric / 1000000) * v_cached_input_price, 8);
  v_output_cost := ROUND((v_output_tokens::numeric / 1000000) * v_output_price, 8);
  v_total_cost := ROUND(v_input_cost + v_cached_input_cost + v_output_cost, 8);

  INSERT INTO public.ai_usage_events (
    user_id,
    provider,
    model,
    feature,
    project_type,
    project_id,
    input_tokens,
    cached_input_tokens,
    output_tokens,
    input_cost_usd,
    cached_input_cost_usd,
    output_cost_usd,
    total_cost_usd,
    metadata
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(TRIM(p_provider), ''), 'unknown'),
    COALESCE(NULLIF(TRIM(p_model), ''), 'unknown'),
    NULLIF(TRIM(COALESCE(p_feature, '')), ''),
    v_project_type,
    p_project_id,
    v_input_tokens,
    v_cached_input_tokens,
    v_output_tokens,
    v_input_cost,
    v_cached_input_cost,
    v_output_cost,
    v_total_cost,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN json_build_object(
    'ok', true,
    'input_cost_usd', v_input_cost,
    'cached_input_cost_usd', v_cached_input_cost,
    'output_cost_usd', v_output_cost,
    'total_cost_usd', v_total_cost,
    'project_type', v_project_type,
    'project_id', p_project_id
  );
END;
$$;

CREATE OR REPLACE VIEW public.analytics_projects_v AS
  SELECT
    'cheat_sheet'::text AS project_type,
    d.id AS project_id,
    d.user_id,
    d.title,
    d.status,
    d.template_id AS subtype,
    'documents'::text AS source_table,
    d.created_at,
    d.updated_at
  FROM public.documents d
  WHERE d.template_id IN ('landscape_3col_maths', '2cols_portrait', 'lecture_notes', 'study_form')

  UNION ALL

  SELECT
    'cheat_sheet'::text AS project_type,
    cs.id AS project_id,
    cs.user_id,
    cs.title,
    cs.status,
    NULL::text AS subtype,
    'cheat_sheet_sessions'::text AS source_table,
    cs.created_at,
    cs.updated_at
  FROM public.cheat_sheet_sessions cs

  UNION ALL

  SELECT
    'problem_solver'::text AS project_type,
    ps.id AS project_id,
    ps.user_id,
    ps.title,
    ps.status,
    NULL::text AS subtype,
    'problem_solver_sessions'::text AS source_table,
    ps.created_at,
    ps.updated_at
  FROM public.problem_solver_sessions ps

  UNION ALL

  SELECT
    'exam'::text AS project_type,
    e.id AS project_id,
    e.user_id,
    e.title,
    e.status,
    e.level::text AS subtype,
    'exams'::text AS source_table,
    e.created_at,
    COALESCE(e.completed_at, e.created_at) AS updated_at
  FROM public.exams e;

CREATE OR REPLACE VIEW public.analytics_ai_usage_events_v AS
SELECT
  e.id AS usage_event_id,
  e.created_at,
  e.user_id,
  p.email AS user_email,
  p.display_name AS user_display_name,
  e.project_type,
  e.project_id,
  pr.title AS project_title,
  pr.status AS project_status,
  pr.subtype AS project_subtype,
  pr.source_table AS project_source,
  e.provider,
  e.model,
  e.feature,
  e.input_tokens,
  e.cached_input_tokens,
  e.output_tokens,
  (e.input_tokens + e.cached_input_tokens + e.output_tokens) AS total_tokens,
  e.input_cost_usd,
  e.cached_input_cost_usd,
  e.output_cost_usd,
  e.total_cost_usd,
  ROUND(e.total_cost_usd / 0.01, 6) AS total_credits,
  e.metadata
FROM public.ai_usage_events e
LEFT JOIN public.profiles p
  ON p.id = e.user_id
LEFT JOIN public.analytics_projects_v pr
  ON pr.project_type = e.project_type
 AND pr.project_id = e.project_id;

CREATE OR REPLACE VIEW public.analytics_ai_usage_by_project_v AS
SELECT
  e.user_id,
  p.email AS user_email,
  p.display_name AS user_display_name,
  e.project_type,
  e.project_id,
  pr.title AS project_title,
  pr.status AS project_status,
  pr.subtype AS project_subtype,
  pr.source_table AS project_source,
  COUNT(*) AS event_count,
  COUNT(DISTINCT COALESCE(e.feature, '')) AS feature_count,
  COUNT(DISTINCT e.model) AS model_count,
  MIN(e.created_at) AS first_event_at,
  MAX(e.created_at) AS last_event_at,
  SUM(e.input_tokens) AS input_tokens,
  SUM(e.cached_input_tokens) AS cached_input_tokens,
  SUM(e.output_tokens) AS output_tokens,
  SUM(e.input_tokens + e.cached_input_tokens + e.output_tokens) AS total_tokens,
  ROUND(SUM(e.total_cost_usd), 8) AS total_cost_usd,
  ROUND(SUM(e.total_cost_usd) / 0.01, 6) AS total_credits
FROM public.ai_usage_events e
LEFT JOIN public.profiles p
  ON p.id = e.user_id
LEFT JOIN public.analytics_projects_v pr
  ON pr.project_type = e.project_type
 AND pr.project_id = e.project_id
WHERE e.project_type IS NOT NULL
  AND e.project_id IS NOT NULL
GROUP BY
  e.user_id,
  p.email,
  p.display_name,
  e.project_type,
  e.project_id,
  pr.title,
  pr.status,
  pr.subtype,
  pr.source_table;

CREATE OR REPLACE VIEW public.analytics_ai_usage_by_user_feature_model_v AS
SELECT
  e.user_id,
  p.email AS user_email,
  p.display_name AS user_display_name,
  e.project_type,
  e.feature,
  e.provider,
  e.model,
  COUNT(*) AS event_count,
  MIN(e.created_at) AS first_event_at,
  MAX(e.created_at) AS last_event_at,
  SUM(e.input_tokens) AS input_tokens,
  SUM(e.cached_input_tokens) AS cached_input_tokens,
  SUM(e.output_tokens) AS output_tokens,
  SUM(e.input_tokens + e.cached_input_tokens + e.output_tokens) AS total_tokens,
  ROUND(SUM(e.total_cost_usd), 8) AS total_cost_usd,
  ROUND(SUM(e.total_cost_usd) / 0.01, 6) AS total_credits
FROM public.ai_usage_events e
LEFT JOIN public.profiles p
  ON p.id = e.user_id
GROUP BY
  e.user_id,
  p.email,
  p.display_name,
  e.project_type,
  e.feature,
  e.provider,
  e.model;

REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, text, text, int4, int4, int4, numeric, numeric, numeric, jsonb, text, uuid) TO service_role;

REVOKE ALL ON TABLE public.analytics_projects_v FROM PUBLIC;
REVOKE ALL ON TABLE public.analytics_ai_usage_events_v FROM PUBLIC;
REVOKE ALL ON TABLE public.analytics_ai_usage_by_project_v FROM PUBLIC;
REVOKE ALL ON TABLE public.analytics_ai_usage_by_user_feature_model_v FROM PUBLIC;

GRANT SELECT ON TABLE public.analytics_projects_v TO service_role;
GRANT SELECT ON TABLE public.analytics_ai_usage_events_v TO service_role;
GRANT SELECT ON TABLE public.analytics_ai_usage_by_project_v TO service_role;
GRANT SELECT ON TABLE public.analytics_ai_usage_by_user_feature_model_v TO service_role;
