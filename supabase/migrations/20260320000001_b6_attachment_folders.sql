-- ============================================================
-- BetterNotes v2 — B6: Carpetas en Attachments
-- Tabla attachment_folders + columna folder_id en document_attachments
-- ============================================================

-- ============================================================
-- 1. Tabla attachment_folders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachment_folders (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Columna folder_id en document_attachments
-- ============================================================
ALTER TABLE public.document_attachments
  ADD COLUMN IF NOT EXISTS folder_id uuid DEFAULT NULL
    REFERENCES public.attachment_folders(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Habilitar RLS en attachment_folders
-- ============================================================
ALTER TABLE public.attachment_folders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS policies en attachment_folders (patrón: owner_all)
-- ============================================================
CREATE POLICY "attachment_folders: owner select"
  ON public.attachment_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "attachment_folders: owner insert"
  ON public.attachment_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attachment_folders: owner update"
  ON public.attachment_folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attachment_folders: owner delete"
  ON public.attachment_folders FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. Índices para optimizar queries comunes
-- ============================================================
-- Índice para filtrar carpetas de attachments por documento
CREATE INDEX IF NOT EXISTS idx_attachment_folders_document_id
  ON public.attachment_folders(document_id);

-- Índice para acceso rápido a carpetas del usuario
CREATE INDEX IF NOT EXISTS idx_attachment_folders_user_id
  ON public.attachment_folders(user_id);

-- Índice para filtrar attachments por carpeta
CREATE INDEX IF NOT EXISTS idx_document_attachments_folder_id
  ON public.document_attachments(folder_id);
