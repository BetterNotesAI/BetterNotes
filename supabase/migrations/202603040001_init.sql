create extension if not exists "pgcrypto";

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  latex_template text not null,
  preview_image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  created_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  template_id uuid not null references public.templates(id),
  prompt text not null default '',
  input_text text not null default '',
  status text not null check (status in ('queued', 'running', 'done', 'error')) default 'queued',
  error_code text,
  error_message text,
  output_pdf_path text,
  output_tex_path text,
  dispatched_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.job_uploads (
  job_id uuid not null references public.jobs(id) on delete cascade,
  upload_id uuid not null references public.uploads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, upload_id)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  build_count integer not null default 0 check (build_count >= 0),
  primary key (user_id, usage_date)
);

create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_uploads_user_id on public.uploads(user_id);
create index if not exists idx_uploads_project_id on public.uploads(project_id);
create index if not exists idx_jobs_user_id_created_at on public.jobs(user_id, created_at desc);
create index if not exists idx_jobs_status_created_at on public.jobs(status, created_at asc);
create index if not exists idx_job_uploads_upload_id on public.job_uploads(upload_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_usage_daily_user_date on public.usage_daily(user_id, usage_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

create or replace function public.consume_free_build(p_user_id uuid, p_limit integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.usage_daily (user_id, usage_date, build_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set build_count = public.usage_daily.build_count + 1
  returning build_count into v_count;

  if v_count > p_limit then
    update public.usage_daily
    set build_count = build_count - 1
    where user_id = p_user_id
      and usage_date = current_date;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_free_build(uuid, integer) from public;
grant execute on function public.consume_free_build(uuid, integer) to service_role;

alter table public.templates enable row level security;
alter table public.projects enable row level security;
alter table public.uploads enable row level security;
alter table public.jobs enable row level security;
alter table public.job_uploads enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_daily enable row level security;
alter table public.stripe_events enable row level security;

create policy "templates_select_authenticated"
on public.templates
for select
to authenticated
using (is_active = true);

create policy "projects_owner_select"
on public.projects
for select
to authenticated
using (auth.uid() = user_id);

create policy "projects_owner_insert"
on public.projects
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "projects_owner_update"
on public.projects
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "projects_owner_delete"
on public.projects
for delete
to authenticated
using (auth.uid() = user_id);

create policy "uploads_owner_select"
on public.uploads
for select
to authenticated
using (auth.uid() = user_id);

create policy "uploads_owner_insert"
on public.uploads
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "uploads_owner_delete"
on public.uploads
for delete
to authenticated
using (auth.uid() = user_id);

create policy "jobs_owner_select"
on public.jobs
for select
to authenticated
using (auth.uid() = user_id);

create policy "jobs_owner_insert"
on public.jobs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "job_uploads_owner_select"
on public.job_uploads
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_uploads.job_id
      and j.user_id = auth.uid()
  )
);

create policy "job_uploads_owner_insert"
on public.job_uploads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_uploads.job_id
      and j.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.uploads u
    where u.id = job_uploads.upload_id
      and u.user_id = auth.uid()
  )
);

create policy "subscriptions_owner_select"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy "usage_daily_owner_select"
on public.usage_daily
for select
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 104857600)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('outputs', 'outputs', false, 104857600)
on conflict (id) do nothing;

create policy "uploads_storage_select_own"
on storage.objects
for select
to authenticated
using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_storage_delete_own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "outputs_storage_select_own"
on storage.objects
for select
to authenticated
using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
