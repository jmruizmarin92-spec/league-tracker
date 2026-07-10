-- Phase 2: Auth foundation — profiles, admin allowlist, auto-provisioning, RLS.

-- ---------------------------------------------------------------------------
-- Admin allowlist: emails that become site admins automatically on first login.
-- Seed the owner here; add more emails to pre-authorize future site admins.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_allowlist (
  email text primary key
);

insert into public.admin_allowlist (email)
values ('jmruizmarin92@gmail.com')
on conflict (email) do nothing;

alter table public.admin_allowlist enable row level security;
-- No policies: only SECURITY DEFINER functions / service role may read it.

-- ---------------------------------------------------------------------------
-- Profiles: one row per authenticated account.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone (including logged-out visitors) may read profiles (display names/avatars).
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- A user may create their own profile row (fallback; normally the trigger does it).
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- A user may update their own profile row.
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Prevent privilege escalation: a normal end-user session cannot flip is_admin.
-- Privileged contexts (SQL editor / service role, where auth.uid() is null) and
-- existing admins are allowed to change it.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_is_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null
       and not exists (
         select 1 from public.profiles p
         where p.id = auth.uid() and p.is_admin
       )
    then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_is_admin_change
  before update on public.profiles
  for each row execute function public.prevent_is_admin_change();

-- ---------------------------------------------------------------------------
-- Auto-provision a profile when a new auth user is created.
-- Pulls name/avatar from the Google identity; sets is_admin from the allowlist.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_admin)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    exists (
      select 1 from public.admin_allowlist a
      where lower(a.email) = lower(new.email)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
