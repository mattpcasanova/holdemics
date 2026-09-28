-- Private tables: a short shareable code, its host, and its settings. The
-- live game itself runs in the table server; this row is for links, lists,
-- and history.

create table public.tables (
  code text primary key,
  host_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  bot_level text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint tables_code_format check (code ~ '^[A-Z0-9]{5,8}$'),
  constraint tables_mode check (mode in ('standard', 'turbo', 'headsup')),
  constraint tables_bot_level check (bot_level in ('easy', 'medium', 'hard')),
  constraint tables_status check (status in ('open', 'playing', 'finished'))
);

create index tables_host_created_idx on public.tables (host_id, created_at desc);

alter table public.tables enable row level security;

-- Anyone signed in can look up a table by its code (that's how invites work).
create policy "Players can look up tables"
  on public.tables for select
  to authenticated
  using (true);

create policy "Players create their own tables"
  on public.tables for insert
  to authenticated
  with check ((select auth.uid()) = host_id);

grant select, insert on public.tables to authenticated;
