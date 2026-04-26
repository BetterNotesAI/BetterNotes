-- Internal folders inside a Notebook/project.

CREATE TABLE IF NOT EXISTS public.folder_sections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid        NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  color       text        DEFAULT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS section_id uuid DEFAULT NULL
    REFERENCES public.folder_sections(id) ON DELETE SET NULL;

ALTER TABLE public.folder_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder_sections: owner select"
  ON public.folder_sections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "folder_sections: owner insert"
  ON public.folder_sections FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.folders f
      WHERE f.id = folder_id
        AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "folder_sections: owner update"
  ON public.folder_sections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.folders f
      WHERE f.id = folder_id
        AND f.user_id = auth.uid()
    )
  );

CREATE POLICY "folder_sections: owner delete"
  ON public.folder_sections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_folder_sections_user_folder
  ON public.folder_sections(user_id, folder_id, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_documents_user_folder_section
  ON public.documents(user_id, folder_id, section_id);

CREATE OR REPLACE FUNCTION public.ensure_document_section_matches_folder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.section_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.folder_id IS NULL THEN
    RAISE EXCEPTION 'section_id requires folder_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.folder_sections s
    WHERE s.id = NEW.section_id
      AND s.folder_id = NEW.folder_id
      AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'section_id must belong to the document folder';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_section_matches_folder ON public.documents;
CREATE TRIGGER trg_documents_section_matches_folder
  BEFORE INSERT OR UPDATE OF section_id, folder_id, user_id
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_document_section_matches_folder();
