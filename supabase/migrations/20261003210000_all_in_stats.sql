-- Career count of all-in showdowns won, for the Shove It / High Roller / Living Dangerously tiers.
alter table public.player_game_stats add column all_in_wins integer not null default 0 check (all_in_wins >= 0);

-- p_stats: [{user_id, bluffs, pots72, all_in_wins}].
-- Returns {"<user_id>": {"bluffs": n, "pots72": n, "allInWins": n}} (keys match CareerTotals).
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
    insert into public.player_game_stats (table_code, game_seed, user_id, bluffs, pots72, all_in_wins)
    values (
      p_code, p_game, uid,
      greatest(0, coalesce((r->>'bluffs')::int, 0)),
      greatest(0, coalesce((r->>'pots72')::int, 0)),
      greatest(0, coalesce((r->>'all_in_wins')::int, 0))
    )
    on conflict do nothing;
    totals := totals || jsonb_build_object(uid::text, (
      select jsonb_build_object(
        'bluffs', coalesce(sum(s.bluffs), 0),
        'pots72', coalesce(sum(s.pots72), 0),
        'allInWins', coalesce(sum(s.all_in_wins), 0)
      )
      from public.player_game_stats s where s.user_id = uid
    ));
  end loop;
  return totals;
end;
$$;
