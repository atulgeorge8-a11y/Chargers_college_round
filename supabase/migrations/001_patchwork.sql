-- PATCHWORK schema. Paste into Supabase → SQL Editor → Run.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now());

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  website_url text not null,
  description text not null default '',
  environment text not null default 'Development' check (environment in ('Development','Staging','Production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reviewer' check (role in ('owner','editor','reviewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id));

create table public.patches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  target_selector text not null check (char_length(target_selector) between 1 and 500),
  target_metadata jsonb not null default '{}',
  patch_type text not null check (patch_type in ('CSS','JavaScript','Content')),
  patch_code text not null check (char_length(patch_code) <= 20000),
  status text not null default 'Draft' check (status in ('Draft','Testing','Pending Review','Approved','Deployed','Failed','Rolled Back')),
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

create table public.patch_versions (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references public.patches(id) on delete cascade,
  version_number int not null,
  target_selector text not null,
  patch_type text not null,
  patch_code text not null,
  change_description text not null default '',
  author_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (patch_id, version_number));

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_id uuid not null references public.patches(id) on delete cascade,
  patch_version int not null,
  environment text not null default 'demo (simulated)',
  status text not null check (status in ('simulated_deployed','failed','rolled_back')),
  test_results jsonb,
  error_details text,
  created_at timestamptz not null default now());

create table public.patch_reviews (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references public.patches(id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users(id),
  status text not null check (status in ('Pending Review','Approved','Rejected')),
  comments text not null default '',
  created_at timestamptz not null default now());

create table public.patch_conflicts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_id uuid not null references public.patches(id) on delete cascade,
  conflicting_patch_id uuid not null references public.patches(id) on delete cascade,
  conflict_type text not null check (conflict_type in ('same_element','css_property','content_replace','target_modified')),
  description text not null default '',
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (patch_id <> conflicting_patch_id));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now());

create index on public.projects (owner_id);
create index on public.project_members (user_id);
create index on public.patches (project_id, status);
create index on public.patch_versions (patch_id);
create index on public.deployments (project_id, created_at desc);
create index on public.deployments (patch_id);
create index on public.patch_reviews (patch_id);
create index on public.patch_conflicts (project_id, status);
create index on public.audit_logs (project_id, created_at desc);

-- Helpers (security definer so policies don't recurse)
create function public.is_member(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and owner_id = auth.uid())
      or exists (select 1 from project_members where project_id = pid and user_id = auth.uid()) $$;
create function public.can_edit(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and owner_id = auth.uid())
      or exists (select 1 from project_members where project_id = pid and user_id = auth.uid() and role in ('owner','editor')) $$;
create function public.patch_project(pat uuid) returns uuid language sql stable security definer set search_path = public as $$
  select project_id from patches where id = pat $$;

-- Triggers
create function public.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger t_projects before update on public.projects for each row execute function public.touch();
create trigger t_patches before update on public.patches for each row execute function public.touch();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.add_owner_member() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into project_members (project_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing; return new; end $$;
create trigger t_project_owner after insert on public.projects for each row execute function public.add_owner_member();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.patches enable row level security;
alter table public.patch_versions enable row level security;
alter table public.deployments enable row level security;
alter table public.patch_reviews enable row level security;
alter table public.patch_conflicts enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_sel on public.profiles for select using (id = auth.uid());
create policy profiles_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy projects_sel on public.projects for select using (owner_id = auth.uid() or public.is_member(id));
create policy projects_ins on public.projects for insert with check (owner_id = auth.uid());
create policy projects_upd on public.projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_del on public.projects for delete using (owner_id = auth.uid());

create policy members_sel on public.project_members for select using (public.is_member(project_id));
create policy members_ins on public.project_members for insert with check (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy members_del on public.project_members for delete using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy patches_sel on public.patches for select using (public.is_member(project_id));
create policy patches_ins on public.patches for insert with check (public.can_edit(project_id) and author_id = auth.uid());
create policy patches_upd on public.patches for update using (public.can_edit(project_id)) with check (public.can_edit(project_id));
create policy patches_del on public.patches for delete using (public.can_edit(project_id));

-- Versions, deployments and audit logs are append-only (no update/delete policies).
create policy versions_sel on public.patch_versions for select using (public.is_member(public.patch_project(patch_id)));
create policy versions_ins on public.patch_versions for insert with check (public.can_edit(public.patch_project(patch_id)) and author_id = auth.uid());

create policy deploy_sel on public.deployments for select using (public.is_member(project_id));
create policy deploy_ins on public.deployments for insert with check (public.can_edit(project_id));

create policy reviews_sel on public.patch_reviews for select using (public.is_member(public.patch_project(patch_id)));
create policy reviews_ins on public.patch_reviews for insert with check (public.is_member(public.patch_project(patch_id)) and reviewer_id = auth.uid());

create policy conflicts_sel on public.patch_conflicts for select using (public.is_member(project_id));
create policy conflicts_ins on public.patch_conflicts for insert with check (public.can_edit(project_id));
create policy conflicts_upd on public.patch_conflicts for update using (public.can_edit(project_id)) with check (public.can_edit(project_id));

create policy audit_sel on public.audit_logs for select using (project_id is not null and public.is_member(project_id));
create policy audit_ins on public.audit_logs for insert with check (project_id is not null and public.is_member(project_id) and actor_id = auth.uid());
