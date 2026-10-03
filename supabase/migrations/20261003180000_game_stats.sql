-- Per-game counts for career achievements (bluffs so far). One row per player
-- per game, keyed by table code + game seed so a retried write can't double
-- count and a private table can host several games. Written only by the table
-- server through record_game_stats, which checks the Vault secret.

create table public.player_game_stats (
  table_code text not null,
  game_seed bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bluffs integer not null default 0 check (bluffs >= 0),
  created_at timestamptz not null default now(),
  primary key (table_code, game_seed, user_id)
);

create index player_game_stats_user_idx on public.player_game_stats (user_id);

alter table public.player_game_stats enable row level security;

create policy "Players see their own game stats"
  on public.player_game_stats for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.player_game_stats to authenticated;

-- p_stats: [{user_id, bluffs}]. Returns career totals: {"<user_id>": {"bluffs": n}}.
create or replace function public.record_game_stats(p_secret text, p_code text, p_game bigint, p_stats jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  r jsonb;
  uid uuid;
  totals jsonb := '{}'::jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'table_server_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(p_stats) loop
    uid := (r->>'user_id')::uuid;
    insert into public.player_game_stats (table_code, game_seed, user_id, bluffs)
    values (p_code, p_game, uid, greatest(0, coalesce((r->>'bluffs')::int, 0)))
    on conflict do nothing;
    totals := totals || jsonb_build_object(uid::text, jsonb_build_object(
      'bluffs', (select coalesce(sum(s.bluffs), 0) from public.player_game_stats s where s.user_id = uid)
    ));
  end loop;
  return totals;
end;
$$;

revoke all on function public.record_game_stats(text, text, bigint, jsonb) from public;
grant execute on function public.record_game_stats(text, text, bigint, jsonb) to anon, authenticated;
