-- BetterNotes v2 — folders: add archived_at column
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Index for fast filtering of archived/non-archived folders per user
CREATE INDEX IF NOT EXISTS idx_folders_user_archived
  ON public.folders(user_id, archived_at);
