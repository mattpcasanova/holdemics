-- Custom tables choose their own size (2–9).
alter table public.tables add column seats smallint not null default 8;
alter table public.tables add constraint tables_seats check (seats between 2 and 9);
