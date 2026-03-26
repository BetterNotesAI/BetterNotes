-- ============================================================
-- BetterNotes v2 — Share token para documentos de solo lectura
-- Añade columna share_token (uuid, nullable, unique) a documents
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT NULL;

-- Índice único para lookups rápidos por token
CREATE UNIQUE INDEX IF NOT EXISTS documents_share_token_idx
  ON public.documents (share_token)
  WHERE share_token IS NOT NULL;
