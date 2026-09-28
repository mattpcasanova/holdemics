-- Ranked results are written by the table server through this function
-- rather than with the service role, so the server holds no privileged key.
-- It runs as the owner (SECURITY DEFINER) because anon can't write ratings;
-- it is exposed in public for RPC, so it authenticates every call against
-- the table-server secret kept in Vault and does nothing else.
--
-- Per environment, store the secret once (dashboard SQL editor):
--   select vault.create_secret('<TABLE_SERVER_SECRET>', 'table_server_secret');
-- and rotate with vault.update_secret. It must match the Worker's
-- TABLE_SERVER_SECRET.

create or replace function public.record_ranked_result(p_secret text, p_code text, p_mode text, p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  r jsonb;
  written integer := 0;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'table_server_secret';
  if expected is null or p_secret is distinct from expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_mode not in ('standard', 'turbo', 'headsup') then
    raise exception 'bad mode';
  end if;

  for r in select * from jsonb_array_elements(p_results) loop
    -- One row per player per table; a repeated call changes nothing.
    insert into public.ranked_games (table_code, user_id, mode, place, players, hands, rating_before, rating_after)
    values (
      p_code, (r->>'user_id')::uuid, p_mode, (r->>'place')::int, (r->>'players')::int,
      (r->>'hands')::int, (r->>'rating_before')::int, (r->>'rating_after')::int
    )
    on conflict (table_code, user_id) do nothing;
    if found then
      update public.ratings
        set rating = (r->>'rating_after')::int,
            peak = greatest(peak, (r->>'rating_after')::int),
            games = games + 1,
            updated_at = now()
        where user_id = (r->>'user_id')::uuid and mode = p_mode;
      written := written + 1;
    end if;
  end loop;
  return written;
end;
$$;

revoke all on function public.record_ranked_result(text, text, text, jsonb) from public;
grant execute on function public.record_ranked_result(text, text, text, jsonb) to anon, authenticated;
