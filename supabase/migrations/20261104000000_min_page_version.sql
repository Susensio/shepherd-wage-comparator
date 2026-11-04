-- The oldest page version allowed to write. The page reads it on connect and before each flush; an older page stops
-- syncing and asks for a reload. Raise it in the migration that changes what older pages could write:
--   update public.app_meta set min_page_version = <n>;
-- A one-row table rather than a function: the value is data a later migration updates, not code to redefine.

create table if not exists public.app_meta (
  singleton boolean primary key default true check (singleton),
  min_page_version int not null default 1
);

insert into public.app_meta (singleton) values (true) on conflict (singleton) do nothing;

alter table public.app_meta enable row level security;

-- Readable by everyone (the anon key is public); no write privilege or policy for any API role.
revoke all on public.app_meta from public, anon, authenticated;
grant select on public.app_meta to anon, authenticated;

drop policy if exists app_meta_read on public.app_meta;
create policy app_meta_read on public.app_meta for select to anon, authenticated using (true);
