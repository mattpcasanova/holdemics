-- Career ranked record per player and mode, lolchess-style: games, wins,
-- top-half finishes (top 4 of 8; in heads-up that's just the win), and
-- average place. Ranked results are public, so this runs as the caller.
create or replace function public.ranked_summary(p_users uuid[], p_mode text default null)
returns table (user_id uuid, mode text, games integer, wins integer, top_half integer, avg_place numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.user_id,
    g.mode,
    count(*)::integer,
    (count(*) filter (where g.place = 1))::integer,
    (count(*) filter (where g.place <= g.players / 2))::integer,
    round(avg(g.place), 2)
  from public.ranked_games g
  where g.user_id = any (p_users) and (p_mode is null or g.mode = p_mode)
  group by g.user_id, g.mode;
$$;

grant execute on function public.ranked_summary(uuid[], text) to anon, authenticated;
