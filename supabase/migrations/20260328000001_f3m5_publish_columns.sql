-- F3-M5.1: Add publish/discovery columns to documents table
-- Allows users to publish their documents to "My Studies" with metadata.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_published   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at   timestamptz,
  ADD COLUMN IF NOT EXISTS university     text,
  ADD COLUMN IF NOT EXISTS degree         text,
  ADD COLUMN IF NOT EXISTS subject        text,
  ADD COLUMN IF NOT EXISTS visibility     text        NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS keywords       text[]      NOT NULL DEFAULT '{}';

-- Index for fast lookup of published documents by owner
CREATE INDEX IF NOT EXISTS idx_documents_published
  ON documents (user_id, is_published)
  WHERE is_published = true;

-- Index for public discovery (future use)
CREATE INDEX IF NOT EXISTS idx_documents_public
  ON documents (is_published, published_at DESC)
  WHERE is_published = true AND visibility = 'public';
