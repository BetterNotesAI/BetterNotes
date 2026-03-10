-- ============================================================
-- 08_support.sql
-- Support ticket system for user-submitted help requests.
-- No dependency on other tables (email is stored as plain text,
-- not linked to profiles, so anonymous submissions are allowed).
-- ============================================================


-- ── support_tickets ───────────────────────────────────────────
-- Stores inbound support requests submitted via the app's
-- contact/help form. Anyone can insert; only the submitter
-- can read their own tickets (matched by email).

CREATE TABLE IF NOT EXISTS support_tickets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  subject    text NOT NULL,
  message    text NOT NULL,
  status     text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Anyone (including unauthenticated users) can submit a ticket
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'st_insert' AND tablename = 'support_tickets') THEN
    CREATE POLICY st_insert ON support_tickets FOR INSERT WITH CHECK (true);
  END IF;

  -- Users can read tickets that match their auth email
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'st_own_read' AND tablename = 'support_tickets') THEN
    CREATE POLICY st_own_read ON support_tickets FOR SELECT USING (
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  END IF;
END $$;
