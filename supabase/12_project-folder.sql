-- Tabla de carpetas
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index folders_user_id_idx on public.folders(user_id);

alter table public.folders enable row level security;
create policy "folders: select own" on public.folders for select using (auth.uid() = user_id);
create policy "folders: insert own" on public.folders for insert with check (auth.uid() = user_id);
create policy "folders: update own" on public.folders for update using (auth.uid() = user_id);
create policy "folders: delete own" on public.folders for delete using (auth.uid() = user_id);

-- Columna folder_id en projects
alter table public.projects
  add column folder_id uuid references public.folders(id) on delete set null;

create index projects_folder_id_idx on public.projects(folder_id);