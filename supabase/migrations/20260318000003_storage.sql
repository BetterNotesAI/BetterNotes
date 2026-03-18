-- ============================================================
-- BetterNotes v2 — Migration 3: Storage Buckets
-- ============================================================

-- documents-output (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-output', 'documents-output', false)
ON CONFLICT (id) DO NOTHING;

-- document-attachments (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-attachments', 'document-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- template-previews (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-previews', 'template-previews', true)
ON CONFLICT (id) DO NOTHING;

-- user-avatars (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------
-- Storage RLS: documents-output (solo propietario)
-- ---------------------
CREATE POLICY "documents-output: owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents-output'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents-output: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents-output'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents-output: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents-output'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------
-- Storage RLS: document-attachments (solo propietario)
-- ---------------------
CREATE POLICY "document-attachments: owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'document-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "document-attachments: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'document-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "document-attachments: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'document-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------
-- Storage RLS: template-previews (lectura pública)
-- ---------------------
CREATE POLICY "template-previews: public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-previews');

-- ---------------------
-- Storage RLS: user-avatars (lectura pública, escritura propietario)
-- ---------------------
CREATE POLICY "user-avatars: public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "user-avatars: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user-avatars: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "user-avatars: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
