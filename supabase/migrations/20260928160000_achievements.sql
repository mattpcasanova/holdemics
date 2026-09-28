-- Achievements: definitions live in code (src/lib/achievements.ts); this
-- table records who earned what. Awarded only by the table server through
-- a guarded function, never by clients.

create table public.player_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  table_code text,
  primary key (user_id, achievement_id)
);

alter table public.player_achievements enable row level security;

create policy "Achievements are public"
  on public.player_achievements for select
  to anon, authenticated
  using (true);

grant select on public.player_achievements to anon, authenticated;

-- Awards a batch and returns what was newly earned: {"<user_id>": ["id", ...]}.
create or replace function public.award_achievements(p_secret text, p_code text, p_awards jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  a jsonb;
  result jsonb := '{}'::jsonb;
  uid text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'table_server_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for a in select * from jsonb_array_elements(p_awards) loop
    insert into public.player_achievements (user_id, achievement_id, table_code)
    values ((a->>'user_id')::uuid, a->>'achievement_id', p_code)
    on conflict (user_id, achievement_id) do nothing;
    if found then
      uid := a->>'user_id';
      result := jsonb_set(result, array[uid], coalesce(result->uid, '[]'::jsonb) || to_jsonb(a->>'achievement_id'));
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.award_achievements(text, text, jsonb) from public;
grant execute on function public.award_achievements(text, text, jsonb) to anon, authenticated;

-- record_ranked_result now also returns each player's ranked totals after the
-- game, so the table server can evaluate milestone achievements:
-- {"<user_id>": {"games": n, "wins": n, "headsup_wins": n, "rating": r, "rank": k}}
drop function public.record_ranked_result(text, text, text, jsonb);

create or replace function public.record_ranked_result(p_secret text, p_code text, p_mode text, p_results jsonb)
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
  if p_mode not in ('standard', 'turbo', 'headsup') then
    raise exception 'bad mode';
  end if;

  for r in select * from jsonb_array_elements(p_results) loop
    uid := (r->>'user_id')::uuid;
    insert into public.ranked_games (table_code, user_id, mode, place, players, hands, rating_before, rating_after)
    values (
      p_code, uid, p_mode, (r->>'place')::int, (r->>'players')::int,
      (r->>'hands')::int, (r->>'rating_before')::int, (r->>'rating_after')::int
    )
    on conflict (table_code, user_id) do nothing;
    if found then
      update public.ratings
        set rating = (r->>'rating_after')::int,
            peak = greatest(peak, (r->>'rating_after')::int),
            games = games + 1,
            updated_at = now()
        where user_id = uid and mode = p_mode;
    end if;
    totals := totals || jsonb_build_object(uid::text, jsonb_build_object(
      'games', (select count(*) from public.ranked_games g where g.user_id = uid),
      'wins', (select count(*) from public.ranked_games g where g.user_id = uid and g.place = 1),
      'headsup_wins', (select count(*) from public.ranked_games g where g.user_id = uid and g.place = 1 and g.mode = 'headsup'),
      'rating', (select rating from public.ratings where user_id = uid and mode = p_mode),
      'mode_games', (select games from public.ratings where user_id = uid and mode = p_mode),
      'rank', public.mode_rank(p_mode, uid)
    ));
  end loop;
  return totals;
end;
$$;

revoke all on function public.record_ranked_result(text, text, text, jsonb) from public;
grant execute on function public.record_ranked_result(text, text, text, jsonb) to anon, authenticated;
