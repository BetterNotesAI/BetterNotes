-- ============================================================
-- 04_chats.sql
-- Chat sessions: AI conversation history and generated LaTeX.
-- Depends on: 03_users.sql (profiles)
-- Note: project_id FK is added later in 05_projects.sql once
--       the projects table exists.
-- ============================================================


-- ── chats ─────────────────────────────────────────────────────
-- One row per AI conversation. Stores the full message history
-- as JSONB and the last generated LaTeX output.
-- Optionally linked to a project (project_id added in 05_projects.sql).

CREATE TABLE IF NOT EXISTS chats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    uuid,   -- FK to projects(id) added in 05_projects.sql
  title         text NOT NULL DEFAULT 'Untitled',
  template_id   text,
  latex_content text,
  messages      jsonb DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chats_owner_all' AND tablename = 'chats') THEN
    CREATE POLICY chats_owner_all ON chats
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
