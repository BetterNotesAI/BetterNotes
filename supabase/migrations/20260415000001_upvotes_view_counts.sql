-- ============================================================
-- BetterNotes — Upvotes + View Counts (F5-M4)
-- Adds view_count and like_count to documents,
-- creates document_likes table, and two RPCs.
-- ============================================================

-- 1. New columns on documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS view_count int4 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count int4 NOT NULL DEFAULT 0;

-- 2. document_likes table (tracks who liked what — one row per user per doc)
CREATE TABLE IF NOT EXISTS public.document_likes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_likes_document_id
  ON public.document_likes (document_id);

CREATE INDEX IF NOT EXISTS idx_document_likes_user_id
  ON public.document_likes (user_id);

ALTER TABLE public.document_likes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read likes (needed to compute user_liked status)
DROP POLICY IF EXISTS "Authenticated users can view likes" ON public.document_likes;
CREATE POLICY "Authenticated users can view likes"
  ON public.document_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can only insert their own likes
DROP POLICY IF EXISTS "Users can like documents" ON public.document_likes;
CREATE POLICY "Users can like documents"
  ON public.document_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
DROP POLICY IF EXISTS "Users can unlike documents" ON public.document_likes;
CREATE POLICY "Users can unlike documents"
  ON public.document_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 3. RPC: increment_document_view
--    Called when any user opens a published document.
--    SECURITY DEFINER so it works even without direct table access.
CREATE OR REPLACE FUNCTION public.increment_document_view(doc_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE documents
  SET view_count = view_count + 1
  WHERE id = doc_id
    AND is_published = true;
$$;

-- 4. RPC: toggle_document_like
--    Uses the natural key (document_id, user_id) — avoids referencing the id
--    column of document_likes which may not exist if the table was partially created.
CREATE OR REPLACE FUNCTION public.toggle_document_like(doc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_exists     boolean;
  v_like_count int4;
  v_liked      boolean;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if like already exists using the natural key
  SELECT EXISTS (
    SELECT 1 FROM document_likes
    WHERE document_id = doc_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Unlike: delete by natural key, decrement cache
    DELETE FROM document_likes
    WHERE document_id = doc_id AND user_id = v_user_id;
    UPDATE documents
      SET like_count = GREATEST(like_count - 1, 0)
      WHERE documents.id = doc_id;
    v_liked := false;
  ELSE
    -- Like: insert row, increment cache
    INSERT INTO document_likes (document_id, user_id)
      VALUES (doc_id, v_user_id);
    UPDATE documents
      SET like_count = like_count + 1
      WHERE documents.id = doc_id;
    v_liked := true;
  END IF;

  SELECT like_count INTO v_like_count
  FROM documents WHERE documents.id = doc_id;

  RETURN jsonb_build_object(
    'liked',      v_liked,
    'like_count', v_like_count
  );
END;
$$;
