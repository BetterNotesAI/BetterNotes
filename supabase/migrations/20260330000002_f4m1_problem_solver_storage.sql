-- ============================================================
-- F4-M1: Problem Solver — Storage bucket + RLS policies
-- ============================================================

-- Bucket for original uploaded PDFs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('problem-solver-pdfs', 'problem-solver-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE:
-- Files are stored as: <user_id>/<session_id>/<random>.pdf
-- We enforce ownership by checking first folder == auth.uid().

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'problem-solver-pdfs: owner select'
  ) THEN
    CREATE POLICY "problem-solver-pdfs: owner select"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'problem-solver-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'problem-solver-pdfs: owner insert'
  ) THEN
    CREATE POLICY "problem-solver-pdfs: owner insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'problem-solver-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'problem-solver-pdfs: owner update'
  ) THEN
    CREATE POLICY "problem-solver-pdfs: owner update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'problem-solver-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'problem-solver-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'problem-solver-pdfs: owner delete'
  ) THEN
    CREATE POLICY "problem-solver-pdfs: owner delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'problem-solver-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;
