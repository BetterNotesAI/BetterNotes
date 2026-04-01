-- F4-M1 — Inline chat messages (replaces sub-chat architecture)
-- Direct FK to session, no intermediate sub_chats table needed.

CREATE TABLE problem_solver_chat_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES problem_solver_sessions(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE problem_solver_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session chat messages"
  ON problem_solver_chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM problem_solver_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session chat messages"
  ON problem_solver_chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM problem_solver_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session chat messages"
  ON problem_solver_chat_messages FOR DELETE
  USING (
    session_id IN (
      SELECT id FROM problem_solver_sessions WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_ps_chat_messages_session
  ON problem_solver_chat_messages (session_id, created_at);
