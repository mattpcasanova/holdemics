-- Owned cosmetics (granted by achievements) and a selectable profile title.

create table public.player_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  item_id text not null,
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (user_id, kind, item_id),
  constraint player_cosmetics_kind check (kind in ('title', 'cardBack', 'table'))
);

alter table public.player_cosmetics enable row level security;

create policy "Players see their own cosmetics"
  on public.player_cosmetics for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.player_cosmetics to authenticated;

-- The title shown under a player's name. Must be one they own.
alter table public.profiles add column title text;
grant update (title) on public.profiles to authenticated;

create or replace function private.check_profile_title()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is not null and not exists (
    select 1 from public.player_cosmetics c where c.user_id = new.id and c.kind = 'title' and c.item_id = new.title
  ) then
    raise exception 'title not owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_check_title
  before insert or update of title on public.profiles
  for each row execute function private.check_profile_title();

-- award_achievements now also grants each award's reward.
-- p_awards: [{user_id, achievement_id, reward_kind, reward_id}]
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
      if a ? 'reward_kind' then
        insert into public.player_cosmetics (user_id, kind, item_id, granted_by)
        values (uid::uuid, a->>'reward_kind', a->>'reward_id', a->>'achievement_id')
        on conflict do nothing;
      end if;
    end if;
  end loop;
  return result;
end;
$$;

-- record_ranked_result totals gain the current win streak.
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
  streak integer;
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
    -- Consecutive wins ending with the most recent game.
    select count(*) into streak from (
      select place, bool_and(place = 1) over (order by played_at desc rows unbounded preceding) as all_wins
      from public.ranked_games g where g.user_id = uid
    ) s where s.all_wins;
    totals := totals || jsonb_build_object(uid::text, jsonb_build_object(
      'games', (select count(*) from public.ranked_games g where g.user_id = uid),
      'wins', (select count(*) from public.ranked_games g where g.user_id = uid and g.place = 1),
      'headsup_wins', (select count(*) from public.ranked_games g where g.user_id = uid and g.place = 1 and g.mode = 'headsup'),
      'streak', streak,
      'rating', (select rating from public.ratings where user_id = uid and mode = p_mode),
      'rank', public.mode_rank(p_mode, uid)
    ));
  end loop;
  return totals;
end;
$$;

-- Test data from the first achievement pass used old ids.
delete from public.player_achievements;
