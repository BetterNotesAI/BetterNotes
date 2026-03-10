-- ============================================================
-- 09_rls.sql
-- Row Level Security policies for projects and related tables.
-- Depends on: 05_projects.sql (projects, project_output_files,
--             project_files, project_shares)
--
-- WHY SECURITY DEFINER helpers?
-- RLS policies on `projects` and `project_shares` can cause
-- infinite recursion if they reference each other directly.
-- The three helper functions below break the cycle by reading
-- the tables with elevated privileges (bypassing RLS).
-- ============================================================


-- ── RLS helper functions ──────────────────────────────────────

-- Returns true if the current user owns the given project.
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND user_id = auth.uid()
  );
$$;

-- Returns true if the current user has been granted access to the project.
CREATE OR REPLACE FUNCTION is_shared_with_me(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = p_project_id AND shared_with = auth.uid()
  );
$$;

-- Returns true if the project's visibility is set to 'public'.
CREATE OR REPLACE FUNCTION is_project_public(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND visibility = 'public'
  );
$$;


-- ── projects RLS ──────────────────────────────────────────────

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Owner can do anything with their own projects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_owner_all' AND tablename = 'projects') THEN
    CREATE POLICY projects_owner_all ON projects
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Anyone can read public projects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_public_read' AND tablename = 'projects') THEN
    CREATE POLICY projects_public_read ON projects
      FOR SELECT USING (visibility = 'public');
  END IF;
  -- Collaborators can read projects shared with them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_shared_read' AND tablename = 'projects') THEN
    CREATE POLICY projects_shared_read ON projects
      FOR SELECT USING (is_shared_with_me(id));
  END IF;
END $$;


-- ── project_output_files RLS ──────────────────────────────────

ALTER TABLE project_output_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pof_owner_all' AND tablename = 'project_output_files') THEN
    CREATE POLICY pof_owner_all ON project_output_files
      FOR ALL
      USING     (is_project_owner(project_id))
      WITH CHECK (is_project_owner(project_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pof_public_read' AND tablename = 'project_output_files') THEN
    CREATE POLICY pof_public_read ON project_output_files
      FOR SELECT USING (is_project_public(project_id));
  END IF;
END $$;


-- ── project_files RLS ─────────────────────────────────────────

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pf_owner_all' AND tablename = 'project_files') THEN
    CREATE POLICY pf_owner_all ON project_files
      FOR ALL
      USING     (is_project_owner(project_id))
      WITH CHECK (is_project_owner(project_id));
  END IF;
END $$;


-- ── project_shares RLS ────────────────────────────────────────

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Project owner controls who the project is shared with
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_owner_all' AND tablename = 'project_shares') THEN
    CREATE POLICY ps_owner_all ON project_shares
      FOR ALL
      USING     (is_project_owner(project_id))
      WITH CHECK (is_project_owner(project_id));
  END IF;
  -- Collaborators can see their own share entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_shared_read' AND tablename = 'project_shares') THEN
    CREATE POLICY ps_shared_read ON project_shares
      FOR SELECT USING (shared_with = auth.uid());
  END IF;
END $$;
