-- Paste into the Supabase SQL editor; safe to run again.
-- Security rests on these policies: the anon key in the page is public.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  phone text,
  sharing boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cfg jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  terms jsonb not null,
  schema_version int not null,
  updated_at timestamptz not null default now()
);
create index if not exists offers_user_id_idx on public.offers (user_id);

create table if not exists public.offer_mine (
  offer_id uuid primary key references public.offers (id) on delete cascade,
  mine jsonb not null default '{}'
);

-- Helpers read around RLS (security definer) so the policies below do not recurse.

create or replace function public.can_read()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.sharing)
    and exists (select 1 from public.offers o where o.user_id = auth.uid());
$$;

create or replace function public.is_sharing(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = owner and p.sharing);
$$;

-- Profile row on signup, from the OAuth metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileges: nothing for anon, tables for signed-in users, RLS narrows them.

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.offers enable row level security;
alter table public.offer_mine enable row level security;

revoke all on public.profiles, public.settings, public.offers, public.offer_mine from public, anon;
grant select, insert, update, delete on public.profiles, public.settings, public.offers, public.offer_mine to authenticated;

revoke all on function public.can_read(), public.is_sharing(uuid), public.handle_new_user() from public, anon, authenticated;
grant execute on function public.can_read(), public.is_sharing(uuid) to authenticated;

-- Policies

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profiles_shared on public.profiles;
create policy profiles_shared on public.profiles for select to authenticated
  using (sharing and public.can_read());

drop policy if exists settings_owner on public.settings;
create policy settings_owner on public.settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists offers_owner on public.offers;
create policy offers_owner on public.offers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists offers_shared on public.offers;
create policy offers_shared on public.offers for select to authenticated
  using (public.is_sharing(user_id) and public.can_read());

drop policy if exists offer_mine_owner on public.offer_mine;
create policy offer_mine_owner on public.offer_mine for all to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and o.user_id = auth.uid()))
  with check (exists (select 1 from public.offers o where o.id = offer_id and o.user_id = auth.uid()));
