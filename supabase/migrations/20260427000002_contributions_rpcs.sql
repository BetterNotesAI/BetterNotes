-- ── contributions_documents ───────────────────────────────────────────────────
-- Returns one row per calendar day (UTC) in the last 30 days on which the given
-- user created at least one document.  Only days with count > 0 are returned.

CREATE OR REPLACE FUNCTION public.contributions_documents(
  p_user_id uuid,
  p_cutoff  date
)
RETURNS TABLE (day text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
    COUNT(*)::bigint                                      AS cnt
  FROM documents
  WHERE user_id   = p_user_id
    AND created_at >= p_cutoff::timestamptz
  GROUP BY day;
$$;

-- ── contributions_chat ────────────────────────────────────────────────────────
-- Returns one row per calendar day (UTC) on which the given user sent at least
-- one chat message (role = 'user').  Only days with count > 0 are returned.

CREATE OR REPLACE FUNCTION public.contributions_chat(
  p_user_id uuid,
  p_cutoff  date
)
RETURNS TABLE (day text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
    COUNT(*)::bigint                                      AS cnt
  FROM chat_messages
  WHERE user_id   = p_user_id
    AND role      = 'user'
    AND created_at >= p_cutoff::timestamptz
  GROUP BY day;
$$;

-- Grant execute to both authenticated and anonymous roles so the public profile
-- endpoint (which uses the service role / anon key on the server) can call them.
GRANT EXECUTE ON FUNCTION public.contributions_documents(uuid, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contributions_chat(uuid, date)      TO anon, authenticated, service_role;
