-- Document Q&A chat + inline subchats (for template-generated documents workspace)

create table if not exists document_qa_subchats (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  block_index integer not null,
  context_text text not null default '',
  created_at timestamptz not null default now(),
  unique (document_id, block_index)
);

create index if not exists idx_document_qa_subchats_document
  on document_qa_subchats(document_id);

create table if not exists document_qa_messages (
  id uuid primary key default gen_random_uuid(),
  subchat_id uuid not null references document_qa_subchats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_document_qa_messages_subchat
  on document_qa_messages(subchat_id);

alter table document_qa_subchats enable row level security;
alter table document_qa_messages enable row level security;

create policy "Users manage own document qa subchats"
  on document_qa_subchats for all
  using (document_id in (select id from documents where user_id = auth.uid()))
  with check (document_id in (select id from documents where user_id = auth.uid()));

create policy "Users manage own document qa messages"
  on document_qa_messages for all
  using (
    subchat_id in (
      select s.id
      from document_qa_subchats s
      join documents d on d.id = s.document_id
      where d.user_id = auth.uid()
    )
  )
  with check (
    subchat_id in (
      select s.id
      from document_qa_subchats s
      join documents d on d.id = s.document_id
      where d.user_id = auth.uid()
    )
  );
