-- Public player profiles (/u/<username>).
--
-- Ranked results are public, as on chess.com: anyone can read placements,
-- rating changes, and dates. (Ratings and achievements were already public.)
create policy "Ranked games are public"
  on public.ranked_games for select
  to anon, authenticated
  using (true);

grant select on public.ranked_games to anon;

-- Superseded by the public policy above.
drop policy if exists "Players read their own ranked games" on public.ranked_games;

-- A player's accepted friends. Pending requests stay private to the two
-- players involved (friend_requests RLS); this returns only friendships.
-- SECURITY DEFINER so it can read other players' accepted rows; it returns
-- only public profile fields. (The advisor flags anon execution: intentional.)
create or replace function public.profile_friends(p_user uuid)
returns table (id uuid, username text, avatar text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar, p.title
  from public.friend_requests f
  join public.profiles p
    on p.id = case when f.from_id = p_user then f.to_id else f.from_id end
  where f.status = 'accepted'
    and (f.from_id = p_user or f.to_id = p_user)
  order by lower(p.username);
$$;

revoke all on function public.profile_friends(uuid) from public;
grant execute on function public.profile_friends(uuid) to anon, authenticated;
