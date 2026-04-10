-- Ensure storage bucket + policies for profile avatar/banner uploads.
-- We reuse the existing public bucket `user-avatars` for both avatar and banner files.

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = true
WHERE id = 'user-avatars';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user-avatars: public select'
  ) THEN
    CREATE POLICY "user-avatars: public select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'user-avatars');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user-avatars: owner insert'
  ) THEN
    CREATE POLICY "user-avatars: owner insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'user-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user-avatars: owner update'
  ) THEN
    CREATE POLICY "user-avatars: owner update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'user-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'user-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user-avatars: owner delete'
  ) THEN
    CREATE POLICY "user-avatars: owner delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'user-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END
$$;
