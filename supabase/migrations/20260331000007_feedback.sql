-- ============================================================
-- Feedback / Suggestions
-- ============================================================

-- ----------------------------------------------------------------
-- 1. user_feedback table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     text        NOT NULL,
  page_path   text,
  source      text        NOT NULL DEFAULT 'web',
  status      text        NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'reviewed', 'planned', 'done', 'dismissed')),
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_feedback_message_len
    CHECK (char_length(trim(message)) >= 5 AND char_length(message) <= 2000)
);

-- Keep updated_at fresh on edits (e.g., status updates from admin panel)
CREATE OR REPLACE FUNCTION public.set_user_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_feedback_updated_at ON public.user_feedback;
CREATE TRIGGER trg_user_feedback_updated_at
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_feedback_updated_at();

-- ----------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_feedback_select_own" ON public.user_feedback;
CREATE POLICY "user_feedback_select_own"
  ON public.user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_feedback_insert_own" ON public.user_feedback;
CREATE POLICY "user_feedback_insert_own"
  ON public.user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policy for authenticated users.
-- Admin dashboard should use service_role from server-side code.

-- ----------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id_created_at
  ON public.user_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status_created_at
  ON public.user_feedback(status, created_at DESC);

