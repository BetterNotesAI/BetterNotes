-- Migration: cheat_sheet_sessions + subchats + messages
-- Run: supabase db push

CREATE TABLE public.cheat_sheet_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Untitled Cheat Sheet',
  source_doc_ids  uuid[] NOT NULL DEFAULT '{}',
  external_content text,
  content_md      text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','generating','done','error')),
  subject         text,
  language        text NOT NULL DEFAULT 'english',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cheat_sheet_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cheat sheets"
  ON public.cheat_sheet_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Subchats (same pattern as problem_solver_sub_chats)
CREATE TABLE public.cheat_sheet_sub_chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.cheat_sheet_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_index int4 NOT NULL,
  block_text  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, block_index)
);
ALTER TABLE public.cheat_sheet_sub_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cheat sheet subchats"
  ON public.cheat_sheet_sub_chats FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.cheat_sheet_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subchat_id  uuid NOT NULL REFERENCES public.cheat_sheet_sub_chats(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cheat_sheet_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cheat sheet messages"
  ON public.cheat_sheet_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cheat_sheet_sub_chats sc
      WHERE sc.id = subchat_id AND sc.user_id = auth.uid()
    )
  );
