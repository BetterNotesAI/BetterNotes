-- ============================================================
-- F4-M1: Problem Solver — 3 tables + RLS
-- ============================================================

-- ----------------------------------------------------------------
-- 1. problem_solver_sessions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problem_solver_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'Untitled Problem',
  pdf_path     text,
  pdf_text     text,
  solution_md  text,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','extracting','solving','done','error')),
  is_published boolean     NOT NULL DEFAULT false,
  published_at timestamptz,
  university   text,
  degree       text,
  subject      text,
  visibility   text        NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private','public')),
  keywords     text[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE problem_solver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON problem_solver_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own" ON problem_solver_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_own" ON problem_solver_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON problem_solver_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 2. problem_solver_sub_chats
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problem_solver_sub_chats (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES problem_solver_sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'Question',
  is_minimized boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE problem_solver_sub_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_chats_select_own" ON problem_solver_sub_chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sub_chats_insert_own" ON problem_solver_sub_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sub_chats_update_own" ON problem_solver_sub_chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sub_chats_delete_own" ON problem_solver_sub_chats
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 3. problem_solver_messages
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problem_solver_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chat_id uuid        NOT NULL REFERENCES problem_solver_sub_chats(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user','assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE problem_solver_messages ENABLE ROW LEVEL SECURITY;

-- Messages: verify ownership through the sub_chat → session chain
CREATE POLICY "messages_select_own" ON problem_solver_messages
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM problem_solver_sub_chats sc
      JOIN problem_solver_sessions s ON s.id = sc.session_id
      WHERE sc.id = problem_solver_messages.sub_chat_id
        AND sc.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert_own" ON problem_solver_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM problem_solver_sub_chats sc
      JOIN problem_solver_sessions s ON s.id = sc.session_id
      WHERE sc.id = problem_solver_messages.sub_chat_id
        AND sc.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update_own" ON problem_solver_messages
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM problem_solver_sub_chats sc
      JOIN problem_solver_sessions s ON s.id = sc.session_id
      WHERE sc.id = problem_solver_messages.sub_chat_id
        AND sc.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete_own" ON problem_solver_messages
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM problem_solver_sub_chats sc
      JOIN problem_solver_sessions s ON s.id = sc.session_id
      WHERE sc.id = problem_solver_messages.sub_chat_id
        AND sc.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- Indexes for common access patterns
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ps_sessions_user_id
  ON problem_solver_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_ps_sub_chats_session_id
  ON problem_solver_sub_chats(session_id);

CREATE INDEX IF NOT EXISTS idx_ps_sub_chats_user_id
  ON problem_solver_sub_chats(user_id);

CREATE INDEX IF NOT EXISTS idx_ps_messages_sub_chat_id
  ON problem_solver_messages(sub_chat_id);
