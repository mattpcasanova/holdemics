-- Accounts: profiles, per-mode ratings, synced settings and player notes,
-- and practice game history.

create schema if not exists private;

-- ─── Helpers ─────────────────────────────────────────────

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Profiles ────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  -- Cosmetic avatar id; "initials" until avatars ship.
  avatar text not null default 'initials',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Usernames are unique regardless of case, but keep the case the player chose.
create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Players update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.profiles to anon, authenticated;
grant update (username, avatar) on public.profiles to authenticated;

-- ─── Ratings (one row per game mode) ─────────────────────

create table public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  rating integer not null default 1500,
  peak integer not null default 1500,
  games integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode),
  constraint ratings_mode check (mode in ('standard', 'turbo', 'headsup')),
  constraint ratings_games_nonnegative check (games >= 0)
);

alter table public.ratings enable row level security;

-- Ratings are public; only the game server (service role) writes them.
create policy "Ratings are public"
  on public.ratings for select
  to anon, authenticated
  using (true);

grant select on public.ratings to anon, authenticated;

-- ─── Settings (deck colors, skins, sound, clock) ─────────

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function private.touch_updated_at();

alter table public.user_settings enable row level security;

create policy "Players read their own settings"
  on public.user_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players create their own settings"
  on public.user_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players update their own settings"
  on public.user_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_settings to authenticated;

-- ─── Player notes (private reads on other players) ───────

create table public.player_notes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- "user:<uuid>" for players, "bot:<name>" for bots.
  subject text not null,
  tag text,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_id, subject),
  constraint player_notes_subject_length check (char_length(subject) <= 100),
  constraint player_notes_note_length check (char_length(note) <= 2000),
  constraint player_notes_tag check (tag in ('fish', 'whale', 'nit', 'reg', 'shark', 'maniac'))
);

create trigger player_notes_touch_updated_at
  before update on public.player_notes
  for each row execute function private.touch_updated_at();

alter table public.player_notes enable row level security;

create policy "Players read their own notes"
  on public.player_notes for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Players create their own notes"
  on public.player_notes for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Players update their own notes"
  on public.player_notes for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Players delete their own notes"
  on public.player_notes for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.player_notes to authenticated;

-- ─── Practice games (unrated history vs bots) ────────────

create table public.practice_games (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  bot_level text not null,
  place smallint not null,
  players smallint not null,
  hands integer not null,
  played_at timestamptz not null default now(),
  constraint practice_games_mode check (mode in ('standard', 'turbo', 'headsup')),
  constraint practice_games_bot_level check (bot_level in ('easy', 'medium', 'hard')),
  constraint practice_games_players check (players between 2 and 8),
  constraint practice_games_place check (place between 1 and players),
  constraint practice_games_hands check (hands >= 0)
);

create index practice_games_user_played_idx on public.practice_games (user_id, played_at desc);

alter table public.practice_games enable row level security;

create policy "Players read their own practice games"
  on public.practice_games for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players record their own practice games"
  on public.practice_games for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.practice_games to authenticated;

-- ─── Username availability (signup form) ─────────────────

create or replace function public.username_available(name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ─── New user bootstrap ──────────────────────────────────
-- Runs as the table owner so it can write rows the new user can't yet write
-- themselves. Lives in the private schema and is only invoked by the trigger.
-- The requested username comes from signup metadata, which is user-supplied,
-- so it is sanitized here and only ever used as a display name.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix integer := 0;
begin
  base := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), ''),
    '[^A-Za-z0-9_]', '', 'g'
  );
  if char_length(base) < 3 then
    base := 'player' || base;
  end if;
  base := left(base, 16);
  candidate := base;

  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate);
  insert into public.ratings (user_id, mode)
    values (new.id, 'standard'), (new.id, 'turbo'), (new.id, 'headsup');
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
