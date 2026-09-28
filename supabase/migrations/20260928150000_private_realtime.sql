-- Invites go through the database so the sender can't be forged: RLS proves
-- from_id is the caller and that the two players are friends. Recipients are
-- notified over Realtime Postgres Changes on their own rows.

create table public.table_invites (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  mode text not null,
  created_at timestamptz not null default now(),
  constraint table_invites_code_format check (code ~ '^[A-Z0-9]{5,8}$'),
  constraint table_invites_mode check (mode in ('standard', 'turbo', 'headsup')),
  constraint table_invites_not_self check (from_id <> to_id)
);

create index table_invites_to_idx on public.table_invites (to_id, created_at desc);

alter table public.table_invites enable row level security;

create policy "Recipients see their invites"
  on public.table_invites for select
  to authenticated
  using ((select auth.uid()) = to_id);

create policy "Players invite their friends as themselves"
  on public.table_invites for insert
  to authenticated
  with check (
    (select auth.uid()) = from_id
    and exists (
      select 1 from public.friend_requests f
      where f.status = 'accepted'
        and ((f.from_id = from_id and f.to_id = to_id) or (f.from_id = to_id and f.to_id = from_id))
    )
  );

create policy "Either side clears an invite"
  on public.table_invites for delete
  to authenticated
  using ((select auth.uid()) in (from_id, to_id));

grant select, insert, delete on public.table_invites to authenticated;

-- Stream inserts to recipients (RLS applies to what each client receives).
alter publication supabase_realtime add table public.table_invites;

-- Presence lives on one private channel; any signed-in player may join and
-- track. Presence metadata is client-provided, so it is treated as cosmetic.
create policy "Signed-in players read presence"
  on realtime.messages for select
  to authenticated
  using ((select realtime.topic()) = 'holdemics:presence' and realtime.messages.extension = 'presence');

create policy "Signed-in players publish presence"
  on realtime.messages for insert
  to authenticated
  with check ((select realtime.topic()) = 'holdemics:presence' and realtime.messages.extension = 'presence');

-- Each player listens for invites on their own private topic "invites:<id>".
create policy "Players read their own invite feed"
  on realtime.messages for select
  to authenticated
  using ((select realtime.topic()) = 'invites:' || (select auth.uid())::text);
