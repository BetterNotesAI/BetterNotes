-- ============================================================
-- BetterNotes v2 — project-level global input files
-- Files uploaded during project creation (NotebookLM-style corpus).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.folder_inputs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id    uuid        NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  storage_path text        NOT NULL,
  mime_type    text,
  size_bytes   int8,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.folder_inputs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_inputs'
      AND policyname = 'folder_inputs: owner select'
  ) THEN
    CREATE POLICY "folder_inputs: owner select"
      ON public.folder_inputs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_inputs'
      AND policyname = 'folder_inputs: owner insert'
  ) THEN
    CREATE POLICY "folder_inputs: owner insert"
      ON public.folder_inputs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_inputs'
      AND policyname = 'folder_inputs: owner update'
  ) THEN
    CREATE POLICY "folder_inputs: owner update"
      ON public.folder_inputs FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_inputs'
      AND policyname = 'folder_inputs: owner delete'
  ) THEN
    CREATE POLICY "folder_inputs: owner delete"
      ON public.folder_inputs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_folder_inputs_folder_id
  ON public.folder_inputs(folder_id);

CREATE INDEX IF NOT EXISTS idx_folder_inputs_user_id
  ON public.folder_inputs(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_inputs_user_folder_created
  ON public.folder_inputs(user_id, folder_id, created_at DESC);
