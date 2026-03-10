-- ============================================================
-- 05_projects.sql
-- Project tables: projects, output files, uploaded files, shares.
-- Depends on: 03_users.sql (profiles), 04_chats.sql (chats)
-- ============================================================


-- ── projects ─────────────────────────────────────────────────
-- Top-level container for a user's LaTeX document or note set.
-- is_playground = true marks a temporary draft session that
-- can later be promoted to a full project.

CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Untitled Project',
  description     text,
  template_id     text,
  visibility      text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
  is_starred      boolean NOT NULL DEFAULT false,
  is_playground   boolean NOT NULL DEFAULT false,
  cover_image_url text,
  tags            text[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id   ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_starred   ON projects(user_id, is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_projects_updated   ON projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_playground ON projects(user_id, is_playground);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_projects_updated_at') THEN
    CREATE TRIGGER set_projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- ── chats.project_id FK ───────────────────────────────────────
-- Added here because chats is created before projects.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE chats ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);


-- ── project_output_files ──────────────────────────────────────
-- Stores the LaTeX source files and compiled output (PDFs, etc.)
-- for a project. Binary files (compiled PDFs) use storage_path;
-- text files (LaTeX source) store their content inline.

CREATE TABLE IF NOT EXISTS project_output_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path    text NOT NULL,    -- e.g. 'main.tex', 'chapters/ch1.tex'
  content      text,             -- LaTeX source (null for binary files)
  is_binary    boolean NOT NULL DEFAULT false,
  storage_path text,             -- Supabase Storage path for binary files
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_output_files_project ON project_output_files(project_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_output_files_updated_at') THEN
    CREATE TRIGGER set_output_files_updated_at
      BEFORE UPDATE ON project_output_files
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- ── project_files ─────────────────────────────────────────────
-- User-uploaded reference files (PDFs, images, data files) attached
-- to a project. Supports folders via self-referencing parent_folder_id.

CREATE TABLE IF NOT EXISTS project_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id),
  parent_folder_id uuid REFERENCES project_files(id) ON DELETE CASCADE,
  is_folder        boolean NOT NULL DEFAULT false,
  name             text NOT NULL,
  storage_path     text,   -- null for folders
  mime_type        text,
  size_bytes       int8,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_parent  ON project_files(parent_folder_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_project_files_updated_at') THEN
    CREATE TRIGGER set_project_files_updated_at
      BEFORE UPDATE ON project_files
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- ── project_shares ────────────────────────────────────────────
-- Collaboration: grant another user view or edit access to a project.

CREATE TABLE IF NOT EXISTS project_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission  text NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_project_shares_shared ON project_shares(shared_with);
