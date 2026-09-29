# Holdemics

Placement poker with a chess.com-style rating ladder and TFT-style scoring. Everyone starts with 100 HP (HP = chips). Last player standing holds all the HP; placement decides rating change.

## Tech Stack

- **Framework**: Next.js 16 (App Router) — read `node_modules/next/dist/docs/` before using unfamiliar APIs
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 + CSS custom properties (`src/app/globals.css`)
- **Fonts**: Inter (body), Bricolage Grotesque (display)
- **Tests**: Vitest (`*.test.ts` next to the code)
- **Database/Auth**: Supabase (email/password auth via `@supabase/ssr`; schema in `supabase/migrations/`). Project lives in a Free-plan org during development; move to the Pro org at launch.
- **Hosting**: Vercel

## Key Directories

```
src/
├── app/
│   ├── page.tsx              # Lobby (mode hero, practice picker, side panels)
│   └── practice/page.tsx     # Practice table vs bots (?mode=standard|turbo|headsup&bots=easy|medium|hard)
├── components/
│   ├── lobby/                # NavRail, LobbyHero (mini table), PracticePicker, SidePanels
│   ├── table/                # PokerTable, Seat, PlayingCard, ChipStack, ActionBar, StandingsPanel, HandLog, ResultOverlay
│   └── ui/                   # Avatar, TagIcon, SettingsDialog
├── hooks/usePracticeGame.ts  # Client-side game loop: bot turns, hand pacing, spectate/skip
├── lib/
│   ├── engine/               # Pure, framework-free poker engine (shared by client + future server)
│   │   ├── cards.ts          # Card types, seeded RNG, shuffle
│   │   ├── evaluator.ts      # 5–7 card hand evaluator
│   │   ├── game.ts           # State machine: blinds, betting, side pots, showdown, eliminations
│   │   ├── modes.ts          # Mode configs + blind schedule
│   │   └── bots.ts           # Bot AI (Monte Carlo equity, per-difficulty personalities)
│   ├── rating.ts             # Pairwise Elo placement rating
│   ├── cosmetics.ts          # Card back / chip skin registries, avatar colors (future unlockables)
│   ├── settings.ts           # User settings (deck colors, card back, chips, practice clock) in localStorage
│   ├── notes.ts              # Player tags (fish/whale/nit/reg/shark/maniac) + notes in localStorage
│   ├── stats.ts              # VPIP/PFR/aggression/showdown stats accumulated from hand logs
│   ├── localStore.ts         # useSyncExternalStore wrapper over localStorage
│   └── practice/bots.ts      # Bot names/seats
scripts/simulate.ts           # Bot-vs-bot sims for tuning blind speed and bot strength
design-reference/             # Original HTML mockups (6-max era; superseded)
```

## Commands

```bash
npm run dev                          # Dev server
npm run build                        # Production build
npm run lint                         # ESLint
npm test                             # Engine + rating tests
npm run simulate -- standard 100     # Bot sims: hands/game and avg place per difficulty
cd server && npm run dev             # Table server (Cloudflare Worker, local, port 8787)
node scripts/table-client.mjs CODE   # Scripted second player for two-human table tests (uses TEST_FRIEND_* in .env.local)
TABLE_WS=wss://holdemics-tables.holdemics-table-server.workers.dev node scripts/table-client.mjs …  # same, against production
cd server && npm run deploy          # Deploy the table server (wrangler, logged in to Cloudflare)
vercel deploy --prod                 # Deploy the app manually (pushes to main also auto-deploy)
```

## Game Rules (source of truth: src/lib/engine)

- **Units**: engine amounts are integers where 1 HP = 10 units (`UNITS_PER_HP`), so the opening SB can be 0.5 HP. Always display via `formatHp()`.
- **Modes**: Standard (8 players, 1 orbit/level, 20s clock), Turbo (8, ½ orbit/level, 12s), Heads-Up (2, 5 hands/level since an orbit is only two hands, 15s).
- **Levels are orbit-based** (8-max) or hand-based (Heads-Up): a level lasts (players alive × orbits) hands, fixed when the level starts, so levels shorten as players bust (`levelHands()` in modes.ts; `handsLeftInLevel` in GameState).
- **Blinds** (BB in HP, SB = half): 1, 2, 3, 5, 8, 12, 18, 25, 35, 50, 70, 100, …
- Sim results (mixed bots): Standard ~33 hands, Turbo ~25, Heads-Up ~21. Orbit levels beat fixed 5-hand levels (38 hands) — slower early, faster late, tighter spread.
- **Clock**: per-decision seconds + per-game time bank (`timeBankSeconds`). Bank drains only after the main clock expires; on full expiry the hero auto-checks or folds and is put in **sit-out** mode (every turn auto check/fold) until they click "I'm back". Practice clock can be disabled in Settings; ranked must always enforce it server-side.
- Heads-up: button posts SB, acts first preflop and last postflop.
- Players busting on the same hand: bigger starting stack gets the better place.
- Incomplete all-in raises do not reopen raising for players who already acted.

## Accounts & Data

- **Env**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.local.example`). Without them the app runs guest-only (`supabaseConfigured` in `src/lib/supabase/config.ts`).
- **Session**: `src/proxy.ts` (Next 16's renamed middleware) refreshes the auth cookie via `getClaims()`. Server code uses `getViewer()` from `src/lib/supabase/server.ts`; never trust `getSession()` user data for authorization.
- **Tables**: `profiles` (public read, own update of username/avatar), `ratings` (per mode, public read, server-only writes), `user_settings` (jsonb), `player_notes` (private), `practice_games` (own history). All RLS-enabled with `(select auth.uid())` ownership checks.
- **Signup**: `private.handle_new_user()` trigger creates profile + 3 rating rows + settings. The requested username comes from signup metadata (user-editable), so it is sanitized and de-duplicated in the trigger and only used as a display name.
- **Sync**: `AccountSync` (mounted in the root layout) loads settings/notes on sign-in (account wins, guest-only data is uploaded) and saves changes back with a debounce. Local stores stay the source of truth for the UI.
- **Email confirm**: `/auth/confirm` accepts both `?code=` (default PKCE link) and `?token_hash=&type=`. The project has Site URL `http://localhost:3100` and both `http://localhost:3100/**` and `https://holdemics.vercel.app/**` on the redirect allow list (signup passes its own origin as the redirect).
- **Dev project**: `flfuvcxbvfviwatnwsnw` ("holdemics", Free org). Test account credentials are in `.env.local` (`TEST_ACCOUNT_*`). The MCP SQL tool is read-only; writes to `auth.*` go through the dashboard SQL editor.

## Table Server (private tables)

- **Where**: `server/` is a separate Cloudflare Worker package (own `package.json`, `tsconfig`, `wrangler.jsonc`). One SQLite-backed Durable Object (`TableRoom`) per table; run locally with `cd server && npm run dev` (port 8787, no Cloudflare login needed). Deploy with `npm run deploy`.
- **Imports the engine directly** via the `@/*` path alias pointing at `../src/*`; keep `src/lib/engine`, `src/lib/practice/{runout,timing,sounds,bots}` and `src/lib/realtime/*` free of browser-only code.
- **Lobby**: the host (`config.hostId`, shown as "You're hosting" / "Hosted by …" via `TableView.hostName`) manages the table without needing a seat; `TableView.viewerId` identifies the viewer even when unseated. Bots are real lobby seats added one at a time with their own difficulty (`addBot`, `Seat.botLevel`; the bot alarm uses the seat's level). Host and **co-hosts** (`Seat.mod`, granted with `setMod`, shown with a felt "Co-host" badge vs the gold "Host" badge) can `kick` any seat except the host (only the host can kick a co-host; the host can `kick` with `block: true`, which stops that player sitting again until `unblock`, sent by the lobby's "Invite back" button alongside a friend invite) and see the invite list; only the host resizes with `setSeats` (2–9, empty seats trimmed from the end) and starts. The `tables.seats` DB column keeps the size at creation only.
- **Flow**: `POST /api/tables` (Next) inserts a `tables` row and calls the Worker `POST /tables/:code/create` with `TABLE_SERVER_SECRET`. The page `/table/[code]` opens `ws://…/tables/:code/ws?token=<supabase access token>`; the Worker verifies the JWT against the project JWKS and reads the username from `profiles`, so names are never client-claimed.
- **Views**: the room sends each socket a `TableView` with `redactGame()` applied (own hole cards only, all at showdown, no deck). During an all-in runout it sends `maskResult()` output plus `runout` timing, and the result after `runoutSchedule().doneAt`.
- **Clocks and bots** run on a single Durable Object alarm (`state.due`); every transition persists to storage first. Clock expiry auto check/folds and sits the player out until they send `back`.
- **Actions** carry `hand` and `step` (server transition counter) and are dropped if stale.
- **Production**: app at https://holdemics.vercel.app (Vercel project `holdemics` under Matt Casanova's projects; linked to GitHub, so pushes to `main` deploy). Worker `holdemics-tables` at https://holdemics-tables.holdemics-table-server.workers.dev (`wss://` for sockets). `ALLOWED_ORIGIN` in `server/wrangler.jsonc` lists localhost and the production origin; add any custom domain there and to Supabase's redirect allow list.
- **Secret rotation**: `TABLE_SERVER_SECRET` must match in four places: Worker secret (`npx wrangler secret put TABLE_SERVER_SECRET`), Vercel env (Production), Vault `table_server_secret` (`vault.update_secret` in the dashboard SQL editor), and local `.env.local` + `server/.dev.vars`.
- **Env**: `NEXT_PUBLIC_TABLE_SERVER_WS`, `TABLE_SERVER_URL`, `TABLE_SERVER_SECRET` (Next); `server/.dev.vars` holds the Worker's copy of the secret locally.
- **Housekeeping**: a pg_cron job (`prune-stale-rows`, 04:17 UTC) deletes `tables` and `table_invites` rows older than a day via `private.prune_stale_rows()`; Durable Object state simply goes idle.
- **Requeue**: the ranked result dialog's "Find another match" sends the player to `/?queue=<mode>`; the lobby selects that mode and `RankedButton` auto-joins once.

## Ranked Play

- **Queue**: `Queue` Durable Object per mode (`/queue/:mode/ws`). The pool is the open sockets; a sweep every 3s (and on join) groups `seats` players whose ratings fall inside each other's windows (±100, +50 every 10s waiting, max ±600), creates a locked ranked table for them, and sends the code. No bots, no party queue.
- **Ranked tables**: `TableConfig.ranked` with fixed `players`; only those users can connect, lobby controls are ignored, the game auto-starts when everyone is connected, and a 30s `startTimeout` alarm cancels the match (no rating change) if someone never shows.
- **Results**: at game end `recordRanked()` computes pairwise Elo (`src/lib/rating.ts`, provisional K doubled during placement: 10 games 8-max, 20 heads-up) and calls the RPC `record_ranked_result(secret, code, mode, results)`. That SECURITY DEFINER function checks the secret against Vault (`table_server_secret`, must equal the Worker's `TABLE_SERVER_SECRET`), inserts `ranked_games` rows (idempotent per table+player) and updates `ratings`. The Worker holds no service-role key. The advisor warns that anon can execute this SECURITY DEFINER function: intentional, it's the secret check that guards it.
- **Tiers** (`src/lib/tiers.ts`): Unranked during placement, then Fish → Calling Station → Nit → Reg → Grinder → Pro → Crusher → Shark by rating, and The Nuts for the top 50 in a mode (`mode_rank` RPC).
- **Test**: `node scripts/table-client.mjs --as friend --queue headsup` and `--as matt --queue headsup --strategy shove` in two shells; `--noshow` tests cancellation.

## Friends, Presence, Leaderboard

- **Friends**: `friend_requests` rows (from, to, status pending/accepted); an accepted row in either direction is the friendship, one row per pair (unique on least/greatest). `POST /api/friends` handles request/accept/remove; `find_profile(username)` RPC does the case-insensitive lookup.
- **Presence** (`src/lib/presence.ts`): one *private* Realtime channel `holdemics:presence` (policies on `realtime.messages` for that topic; "Allow public access" is off in Realtime settings). `PresenceTracker` in the root layout tracks `{userId, username, where}`; presence metadata is client-provided, so treat it as cosmetic.
- **Invites** go through `table_invites`: RLS proves `from_id` is the caller and that the two are friends, so a sender can't be forged. Recipients subscribe to Postgres Changes on their own rows over the private topic `invites:<userId>` (needs `supabase.realtime.setAuth()` first) and resolve the sender's name from `profiles`. Dismissing deletes the row.
- **Leaderboard**: `/leaderboard?mode=` lists the top 50 with ≥ placement games, tier via `tierFor` with rank = list position.
- **Test**: `node scripts/friend-presence.mjs` signs in as the friend account, accepts pending requests, joins presence, and logs invites.

## Achievements & Cosmetics

- Definitions in `src/lib/achievements.ts` (tested in `achievements.test.ts`): tiered families (Comeback ×3, Domination ×3, Bounty ×3), table one-offs (Clean Sweep, Cooler/Bad Beat, Houdini), milestones (Ship It, Heater/Unstoppable streaks, games played, HU wins), tiers. Each has a **rarity** (common→legendary) and exactly one **reward** — a title, card back, or table skin of the same rarity (the test enforces both directions).
- Cosmetic registries in `src/lib/cosmetics.ts`: `CARD_BACKS`, `TABLE_SKINS` (4 defaults + unlockables), `TITLES` (all unlockable), `AVATARS` (12 free SVG glyph designs; `initials` is the default and `Avatar` falls back to it), `RARITY` colors, `ownedCosmetics()`.
- Storage: `player_achievements` (earned) + `player_cosmetics` (kind/item_id, granted by `award_achievements` alongside the achievement) + `profiles.title` (selected title; a trigger rejects titles the player doesn't own). `record_ranked_result` totals include the current win `streak`.
- Server gathers `SeatFacts` per seat (min held stack incl. posted blinds; sole chip-leader from final four / half the field / first bust; knockouts to the hand's biggest winner; worst showdown loss; all-in won while covered) and evaluates at game end. **Eligibility**: ranked games and private tables with no bots.
- Client: `unlocksStore` (`src/lib/unlocks.ts`) is filled by `AccountSync` (owned cosmetics, title, userId); Settings shows locked items with the unlocking achievement, and the title picker updates `profiles.title` directly. `settings.tableSkin` drives `PokerTable` felt/rail. The chosen avatar lives in `profiles.avatar` (picked in Settings, mirrored in `unlocksStore.avatar`) and travels the same road as titles. Titles reach seats via `identify()` → `X-Title` header → `Seat.title` → `SeatView.title`, rendered by `PlayerTitle` (small caps, rarity color) under names at the table, in the lobby seat list, the profile card, and the leaderboard.
- New ids ride along in `TableView.achievements` and show in the result dialog; `/achievements` lists the catalogue with rarity and reward.

## Rating

Pairwise Elo (`src/lib/rating.ts`): each finish = win vs everyone below, loss vs everyone above. Pairwise K = 70/(n-1) for 8-max, 32 for heads-up; doubled for the first 20 games (provisional). Even 8-player lobby → +35/+25/+15/+5/−5/−15/−25/−35, varying with lobby strength. Separate rating per mode.

**Bots and friends games are always unrated** (anti-boosting). Ranked must also block party-queueing into the same 8-max lobby.

## Design System

Three-color accent rule:
- **Felt green** (#1F6F4A): active/playable states, acting seat
- **Gold** (#E5B96A): hero, value, winners, primary CTAs
- **Red** (#C84B4B): loss/critical HP

HP tiers by effective BBs: >=25bb green, >=15bb gold, <15bb red. Sentence-case headings (no tracked all-caps labels).

## Roadmap

1. ~~Engine + bots + practice mode~~ (done)
1b. ~~Ranked matchmaking (all modes; Heads-Up is the one that fills), rating history, tier ladder~~ (done)
2. ~~Supabase auth, profiles, per-mode ratings~~ (done); friends list after private tables
3. ~~Server-authoritative multiplayer — private friend tables, unrated~~ (done; see Table Server)
4. ~~Ranked matchmaking~~ (done; 8-max queues exist but need 8 concurrent players)
5. ~~Achievements, titles, unlockable card backs, table skins, avatars~~ (done)
6. ~~Deploy the table server and link Vercel~~ (done 2026-09-28; see Table Server → Production)

## Known Issues / Gotchas

- Practice games run entirely client-side (deck is in browser state) — fine for unrated bots, never for real-money/ranked play.
- `/practice` is rendered with `ssr: false` because the deck seed is random per game.
- Background browser tabs throttle CSS animations; dealt cards can look invisible in screenshots of an unfocused tab.
- **Table stage**: PokerTable lays everything out on a fixed stage (landscape 1000×640, portrait 540×880) and scales it to fit, picking whichever orientation renders larger. All seat/bet/board positions are % of the stage; don't size table elements from the viewport.
- **All-in runouts**: the engine deals every remaining street in one action. `usePracticeGame` detects this, exposes `runout`, and serves a masked view (`maskResult` in lib/practice/runout.ts) until the schedule finishes, so stacks, standings, and the log don't spoil the result. Each street is dealt face down only when reached, then turned; the river holds longer and flips slowly. Timing lives in `runoutSchedule()`; normal-street and deal timings live in `src/lib/practice/timing.ts` and are shared by animations and sound cues — change them there, not inline.
- **Audio** is synthesized with Web Audio (`src/lib/audio.ts`), no asset files. The AudioContext unlocks on the first pointer/key event.
- Don't use requestAnimationFrame for state that must advance while the tab is hidden (rAF pauses in background tabs); use a timer.
- Root `tsconfig.json` excludes `server/` and ESLint ignores it; the Worker type-checks with its own `npm run typecheck`.
- Don't set `turbopack.root` in `next.config.ts` from `__dirname`: it resolved to the parent folder and broke Tailwind resolution. The extra-lockfile warning from `server/package-lock.json` is harmless.
- Practice results are saved through the route handler `POST /api/practice-games`, not a server action. A server action called from the practice table got a 503 from the dev server before reaching any app code (the same action replayed by hand returned 200); the route handler is plain HTTP and testable with curl.
- Anything rendered inside the sticky NavRail (or other stacking contexts) must portal modals to `document.body` — see SettingsDialog.
- Tailwind v4 `translate-*` utilities use the CSS `translate` property, which stacks with an inline `transform: translate(...)`. Don't mix them on one element.
- Player notes for bots are keyed by bot name (bots are regenerated each game); real players will key by user id.
- **Auth email**: Supabase sends through custom SMTP (Resend, `smtp.resend.com:465`, user `resend`), which is required for custom templates. The sender is still `onboarding@resend.dev`, and Resend only delivers from it to the Resend account owner (mattpcasanova@gmail.com, no `+` aliases), so **real users can't get confirmation emails until a domain is verified in Resend** and the sender is switched to it. Template source: `supabase/templates/confirmation.html` (paste into Auth → Emails → Confirm sign up).
- Below `lg` the table sidebar becomes a drawer (Standings button); below `md` the lobby swaps the nav rail for a top bar.
