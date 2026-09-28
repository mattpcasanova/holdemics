-- Friends: a request from one player to another; accepted requests are the
-- friendship, in either direction. Online status and table invites travel
-- over Realtime presence/broadcast and are not stored.

create table public.friend_requests (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (from_id, to_id),
  constraint friend_requests_status check (status in ('pending', 'accepted')),
  constraint friend_requests_not_self check (from_id <> to_id)
);

create index friend_requests_to_idx on public.friend_requests (to_id, status);

alter table public.friend_requests enable row level security;

create policy "Players see requests involving them"
  on public.friend_requests for select
  to authenticated
  using ((select auth.uid()) in (from_id, to_id));

create policy "Players send requests as themselves"
  on public.friend_requests for insert
  to authenticated
  with check ((select auth.uid()) = from_id);

-- Only the recipient accepts, and only the status can change.
create policy "Recipients accept requests"
  on public.friend_requests for update
  to authenticated
  using ((select auth.uid()) = to_id)
  with check ((select auth.uid()) = to_id);

-- Either side can decline, cancel, or unfriend.
create policy "Either side removes a request"
  on public.friend_requests for delete
  to authenticated
  using ((select auth.uid()) in (from_id, to_id));

grant select, insert, delete on public.friend_requests to authenticated;
grant update (status, responded_at) on public.friend_requests to authenticated;

-- A request in either direction between two players counts as one relationship.
create unique index friend_requests_pair_key
  on public.friend_requests (least(from_id, to_id), greatest(from_id, to_id));

-- Case-insensitive username lookup for adding friends.
create or replace function public.find_profile(p_username text)
returns table (id uuid, username text)
language sql
stable
security invoker
set search_path = ''
as $$
  select id, username from public.profiles where lower(username) = lower(p_username);
$$;

grant execute on function public.find_profile(text) to authenticated;
