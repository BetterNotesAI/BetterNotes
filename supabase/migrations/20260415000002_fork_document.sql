-- ============================================================
-- BetterNotes — Fork & Remix (F5-M5)
-- Adds forked_from_id to documents so forked copies can trace
-- their origin. ON DELETE SET NULL so deleting the original
-- doesn't cascade-delete all forks.
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS forked_from_id uuid
    REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_forked_from
  ON public.documents (forked_from_id)
  WHERE forked_from_id IS NOT NULL;
