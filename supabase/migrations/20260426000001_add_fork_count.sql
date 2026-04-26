-- Add fork_count to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0;

-- Backfill existing data
-- NOTE: This runs as the migration user (postgres/service role) so it bypasses RLS
-- and can count forked documents across all users.
UPDATE documents d
SET fork_count = (
  SELECT COUNT(*) FROM documents f WHERE f.forked_from_id = d.id
);

-- Atomic increment function, SECURITY DEFINER so any authenticated user can
-- increment the fork_count on a public document they don't own.
CREATE OR REPLACE FUNCTION increment_document_fork_count(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE documents
  SET fork_count = fork_count + 1
  WHERE id = p_document_id
    AND is_published = true
    AND visibility = 'public';
END;
$$;

GRANT EXECUTE ON FUNCTION increment_document_fork_count(uuid) TO authenticated;
