-- ============================================================================
-- 20260425000001_public_documents_rls.sql
-- ----------------------------------------------------------------------------
-- Community v1: allow any authenticated or anonymous user to SELECT documents
-- (and their current version + author profile) when the document has been
-- explicitly published as PUBLIC.
--
-- Context: the original RLS policies on `documents`, `document_versions` and
-- `profiles` only allowed the owner to read their own rows. With the My
-- Studies / Explore community pages, other users must be able to view
-- published public notes authored by anyone.
--
-- These new policies are ADDITIVE — RLS combines policies with OR, so the
-- existing "owner select" rules remain intact for private/draft documents.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- documents: anyone can read published public docs (non-archived)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents: public read" ON public.documents;
CREATE POLICY "documents: public read"
  ON public.documents FOR SELECT
  TO authenticated, anon
  USING (
    is_published = true
    AND visibility = 'public'
    AND archived_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- document_versions: anyone can read versions that belong to a published
-- public document. We check the parent document directly to keep the policy
-- self-contained and avoid depending on owns_document() which is owner-only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "document_versions: public read" ON public.document_versions;
CREATE POLICY "document_versions: public read"
  ON public.document_versions FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_versions.document_id
        AND d.is_published = true
        AND d.visibility = 'public'
        AND d.archived_at IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: anyone can read basic profile info (for author attribution on
-- community cards: display_name, username, avatar_url). The profiles table
-- contains no sensitive data in those columns, and PostgREST will only
-- return columns the API explicitly selects.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles: public read" ON public.profiles;
CREATE POLICY "profiles: public read"
  ON public.profiles FOR SELECT
  TO authenticated, anon
  USING (true);

-- ---------------------------------------------------------------------------
-- storage: documents-output public read for published PDFs
-- ---------------------------------------------------------------------------
-- Path layout in this bucket is `${userId}/${documentId}/v_*.pdf`, so the
-- second folder segment is the document id. We allow SELECT (download +
-- createSignedUrl) when that document is published as public. This is
-- required so:
--   1. Forking another user's doc can copy their PDF into the new owner's
--      namespace.
--   2. Anonymous / non-owner viewers can stream the PDF on Explore pages.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents-output: public read" ON storage.objects;
CREATE POLICY "documents-output: public read"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (
    bucket_id = 'documents-output'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id::text = (storage.foldername(name))[2]
        AND d.is_published = true
        AND d.visibility   = 'public'
        AND d.archived_at IS NULL
    )
  );
