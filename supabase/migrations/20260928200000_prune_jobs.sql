-- Nightly housekeeping: table codes and invites are only useful for a day.
-- The Durable Object state expires on its own once nobody connects; these rows
-- are just the lookup/invite records.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

create or replace function private.prune_stale_rows()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.table_invites where created_at < now() - interval '1 day';
  delete from public.tables where created_at < now() - interval '1 day';
$$;

revoke all on function private.prune_stale_rows() from public;

select cron.schedule(
  'prune-stale-rows',
  '17 4 * * *',
  $$select private.prune_stale_rows()$$
);
