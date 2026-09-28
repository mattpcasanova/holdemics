-- Ranked games: one row per player per game with the rating before and
-- after, written by the table server (service role). Players read their own
-- history; ratings themselves stay in public.ratings.

create table public.ranked_games (
  id bigint generated always as identity primary key,
  table_code text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  place smallint not null,
  players smallint not null,
  hands integer not null,
  rating_before integer not null,
  rating_after integer not null,
  played_at timestamptz not null default now(),
  constraint ranked_games_mode check (mode in ('standard', 'turbo', 'headsup')),
  constraint ranked_games_players check (players between 2 and 8),
  constraint ranked_games_place check (place between 1 and players),
  constraint ranked_games_hands check (hands >= 0),
  constraint ranked_games_one_row_per_player unique (table_code, user_id)
);

create index ranked_games_user_played_idx on public.ranked_games (user_id, played_at desc);

alter table public.ranked_games enable row level security;

create policy "Players read their own ranked games"
  on public.ranked_games for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.ranked_games to authenticated;

-- Leaderboard position within a mode (1 = highest rating). Used for the top
-- tier, which is a cut of the leaderboard rather than a rating threshold.
create or replace function public.mode_rank(p_mode text, p_user uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer + 1
  from public.ratings r
  where r.mode = p_mode
    and r.games > 0
    and r.rating > (select rating from public.ratings where mode = p_mode and user_id = p_user);
$$;

grant execute on function public.mode_rank(text, uuid) to anon, authenticated;

-- Ranked tables are created by the matchmaker, never by a player.
alter table public.tables add column ranked boolean not null default false;
