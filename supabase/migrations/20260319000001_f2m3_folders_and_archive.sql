-- ============================================================
-- BetterNotes v2 — F2-M3: Organización de documentos
-- Tabla folders + columnas archived_at y folder_id en documents
-- ============================================================

-- ============================================================
-- 1. Tabla folders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.folders (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  color       text        DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Columnas nuevas en documents (archived_at y folder_id)
-- ============================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS folder_id    uuid        DEFAULT NULL
    REFERENCES public.folders(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Habilitar RLS en folders
-- ============================================================
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS policies en folders (patrón: owner_all)
-- ============================================================
CREATE POLICY "folders: owner select"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "folders: owner insert"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders: owner update"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders: owner delete"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. Índices para optimizar queries comunes
-- ============================================================
-- Índice para filtrar documentos archivados por usuario
CREATE INDEX IF NOT EXISTS idx_documents_user_archived
  ON public.documents(user_id, archived_at);

-- Índice para filtrar documentos por carpeta
CREATE INDEX IF NOT EXISTS idx_documents_user_folder
  ON public.documents(user_id, folder_id);

-- Índice para filtrar documentos destacados
CREATE INDEX IF NOT EXISTS idx_documents_user_starred
  ON public.documents(user_id, is_starred);

-- Índice para acceso rápido a carpetas del usuario
CREATE INDEX IF NOT EXISTS idx_folders_user_id
  ON public.folders(user_id);
