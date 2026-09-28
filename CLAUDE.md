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

Legacy 6-max mock components still live in `src/components/*.tsx` and `src/lib/types.ts`; nothing imports them anymore and they can be deleted.

## Commands

```bash
npm run dev                          # Dev server
npm run build                        # Production build
npm run lint                         # ESLint
npm test                             # Engine + rating tests
npm run simulate -- standard 100     # Bot sims: hands/game and avg place per difficulty
cd server && npm run dev             # Table server (Cloudflare Worker, local, port 8787)
node scripts/table-client.mjs CODE   # Scripted second player for two-human table tests (uses TEST_FRIEND_* in .env.local)
```

## Game Rules (source of truth: src/lib/engine)

- **Units**: engine amounts are integers where 1 HP = 10 units (`UNITS_PER_HP`), so the opening SB can be 0.5 HP. Always display via `formatHp()`.
- **Modes**: Standard (8 players, 1 orbit/level, 20s clock), Turbo (8, ½ orbit/level, 12s), Heads-Up (2, 2 orbits = 4 hands/level, 15s).
- **Levels are orbit-based**: a level lasts (players alive × orbits) hands, fixed when the level starts, so levels shorten as players bust (`levelHands()` in modes.ts; `handsLeftInLevel` in GameState).
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
- **Email confirm**: `/auth/confirm` accepts both `?code=` (default PKCE link) and `?token_hash=&type=`. The dev project has Site URL `http://localhost:3100` and `http://localhost:3100/**` on the redirect allow list.
- **Dev project**: `flfuvcxbvfviwatnwsnw` ("holdemics", Free org). Test account credentials are in `.env.local` (`TEST_ACCOUNT_*`). The MCP SQL tool is read-only; writes to `auth.*` go through the dashboard SQL editor.

## Table Server (private tables)

- **Where**: `server/` is a separate Cloudflare Worker package (own `package.json`, `tsconfig`, `wrangler.jsonc`). One SQLite-backed Durable Object (`TableRoom`) per table; run locally with `cd server && npm run dev` (port 8787, no Cloudflare login needed). Deploy with `npm run deploy` once a Cloudflare account is linked.
- **Imports the engine directly** via the `@/*` path alias pointing at `../src/*`; keep `src/lib/engine`, `src/lib/practice/{runout,timing,sounds,bots}` and `src/lib/realtime/*` free of browser-only code.
- **Flow**: `POST /api/tables` (Next) inserts a `tables` row and calls the Worker `POST /tables/:code/create` with `TABLE_SERVER_SECRET`. The page `/table/[code]` opens `ws://…/tables/:code/ws?token=<supabase access token>`; the Worker verifies the JWT against the project JWKS and reads the username from `profiles`, so names are never client-claimed.
- **Views**: the room sends each socket a `TableView` with `redactGame()` applied (own hole cards only, all at showdown, no deck). During an all-in runout it sends `maskResult()` output plus `runout` timing, and the result after `runoutSchedule().doneAt`.
- **Clocks and bots** run on a single Durable Object alarm (`state.due`); every transition persists to storage first. Clock expiry auto check/folds and sits the player out until they send `back`.
- **Actions** carry `hand` and `step` (server transition counter) and are dropped if stale.
- **Env**: `NEXT_PUBLIC_TABLE_SERVER_WS`, `TABLE_SERVER_URL`, `TABLE_SERVER_SECRET` (Next); `server/.dev.vars` holds the Worker's copy of the secret locally.

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
2. ~~Supabase auth, profiles, per-mode ratings~~ (done); friends list after private tables
3. ~~Server-authoritative multiplayer — private friend tables, unrated~~ (done; see Table Server)
4. Ranked matchmaking (rating window widens with wait time; launch Heads-Up ranked first since 8-max needs 8 concurrent players)
5. Cosmetics (avatars, card backs, chip sets) and achievements

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
- Below `lg` the table sidebar becomes a drawer (Standings button); below `md` the lobby swaps the nav rail for a top bar.
