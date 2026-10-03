-- The game each player is currently in (TFT-style: one at a time, rejoinable).
-- The table server sets rows when a game starts and clears them when a player
-- busts, the game ends, or a match is called off. Rows older than four hours
-- are treated as stale (no game runs that long) in case a clear was missed.

create table public.active_games (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  table_code text not null,
  mode text not null check (mode in ('standard', 'turbo', 'headsup')),
  ranked boolean not null,
  started_at timestamptz not null default now()
);

create index active_games_table_idx on public.active_games (table_code);

alter table public.active_games enable row level security;

create policy "Players see their own active game"
  on public.active_games for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.active_games to authenticated;

-- p_op: 'set' (start p_users at p_code), 'clear' (remove p_users at p_code; all
-- players there when p_users is null), or 'get' (read only).
-- Always returns the live active table per requested user: {"<user_id>": "CODE"}.
create or replace function public.sync_active_games(
  p_secret text, p_op text, p_code text, p_mode text, p_ranked boolean, p_users uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  result jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'table_server_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_op = 'set' then
    insert into public.active_games (user_id, table_code, mode, ranked, started_at)
    select u, p_code, p_mode, coalesce(p_ranked, false), now() from unnest(p_users) as u
    on conflict (user_id) do update
      set table_code = excluded.table_code, mode = excluded.mode, ranked = excluded.ranked, started_at = excluded.started_at;
  elsif p_op = 'clear' then
    delete from public.active_games a
    where a.table_code = p_code and (p_users is null or a.user_id = any (p_users));
  elsif p_op <> 'get' then
    raise exception 'bad op';
  end if;

  select coalesce(jsonb_object_agg(a.user_id::text, a.table_code), '{}'::jsonb) into result
  from public.active_games a
  where a.user_id = any (coalesce(p_users, '{}')) and a.started_at > now() - interval '4 hours';
  return result;
end;
$$;

revoke all on function public.sync_active_games(text, text, text, text, boolean, uuid[]) from public;
grant execute on function public.sync_active_games(text, text, text, text, boolean, uuid[]) to anon, authenticated;

-- Stale rows are pruned with the other housekeeping.
create or replace function private.prune_active_games()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.active_games where started_at < now() - interval '4 hours';
$$;

select cron.schedule('prune-active-games', '23 * * * *', 'select private.prune_active_games()');
