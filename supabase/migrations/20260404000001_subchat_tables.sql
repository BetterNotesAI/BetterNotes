-- Inline subchats for Problem Solver
-- Each subchat is tied to a specific block index in the solution output.

create table if not exists problem_solver_subchats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references problem_solver_sessions(id) on delete cascade,
  block_index integer not null,
  context_text text not null default '',
  created_at timestamptz not null default now()
);

create index idx_ps_subchats_session on problem_solver_subchats(session_id);
alter table problem_solver_subchats
  add constraint uq_ps_subchat_session_block unique (session_id, block_index);

create table if not exists problem_solver_subchat_messages (
  id uuid primary key default gen_random_uuid(),
  subchat_id uuid not null references problem_solver_subchats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index idx_ps_subchat_msgs_subchat on problem_solver_subchat_messages(subchat_id);

-- RLS
alter table problem_solver_subchats enable row level security;
alter table problem_solver_subchat_messages enable row level security;

create policy "Users manage own subchats"
  on problem_solver_subchats for all
  using (session_id in (select id from problem_solver_sessions where user_id = auth.uid()))
  with check (session_id in (select id from problem_solver_sessions where user_id = auth.uid()));

create policy "Users manage own subchat messages"
  on problem_solver_subchat_messages for all
  using (subchat_id in (
    select s.id from problem_solver_subchats s
    join problem_solver_sessions ps on ps.id = s.session_id
    where ps.user_id = auth.uid()
  ))
  with check (subchat_id in (
    select s.id from problem_solver_subchats s
    join problem_solver_sessions ps on ps.id = s.session_id
    where ps.user_id = auth.uid()
  ));
