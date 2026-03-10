-- ============================================================
-- 10_storage.sql
-- Supabase Storage buckets and their RLS policies.
-- Depends on: 05_projects.sql (projects table referenced in RLS)
--
-- Buckets:
--   user-files    — chat attachments, private, 50 MB limit
--   project-files — project uploads, private, 50 MB limit
--   user-avatars  — profile pictures, public, 2 MB limit
--
-- Path conventions:
--   user-files:    <user_id>/<filename>
--   project-files: <project_id>/<filename>
--   user-avatars:  <user_id>/avatar.<ext>
-- ============================================================


-- ── Buckets ───────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('user-files',    'user-files',    false, 52428800),  -- 50 MB, private
  ('project-files', 'project-files', false, 52428800),  -- 50 MB, private
  ('user-avatars',  'user-avatars',  true,  2097152)    --  2 MB, public
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;


-- ── user-files policies ───────────────────────────────────────
-- Users can only access files under their own <user_id>/ folder.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own user-files' AND tablename = 'objects') THEN
    CREATE POLICY "Users insert own user-files" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'user-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users select own user-files' AND tablename = 'objects') THEN
    CREATE POLICY "Users select own user-files" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'user-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own user-files' AND tablename = 'objects') THEN
    CREATE POLICY "Users update own user-files" ON storage.objects
      FOR UPDATE
      USING     (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users delete own user-files' AND tablename = 'objects') THEN
    CREATE POLICY "Users delete own user-files" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'user-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;


-- ── project-files policies ────────────────────────────────────
-- Users can manage files in projects they own.
-- Path must start with a project_id that belongs to the current user.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage project-files' AND tablename = 'objects') THEN
    CREATE POLICY "Users can manage project-files" ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'project-files' AND
        EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id::text = (storage.foldername(name))[1]
            AND projects.user_id = auth.uid()
        )
      )
      WITH CHECK (
        bucket_id = 'project-files' AND
        EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id::text = (storage.foldername(name))[1]
            AND projects.user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- ── user-avatars policies ─────────────────────────────────────
-- Public read, own write (bucket is already public).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public avatars view' AND tablename = 'objects') THEN
    CREATE POLICY "Public avatars view" ON storage.objects
      FOR SELECT USING (bucket_id = 'user-avatars');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users manage own avatar" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'user-avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users update own avatar" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'user-avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users delete own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users delete own avatar" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'user-avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
