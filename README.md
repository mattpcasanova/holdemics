# Holdemics

6-max placement poker — chess.com meets Teamfight Tactics. Six players sit at a table, the top 3 gain rating and the bottom 3 lose it. Your health points are your big blinds.

## Quick Start

```bash
npm install
cp .env.local.example .env.local  # Fill in Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the lobby, or [http://localhost:3000/table/demo](http://localhost:3000/table/demo) for the game table.

## Design System

### Fonts

| Font | Usage |
|------|-------|
| Inter | Body text, UI elements |
| Bricolage Grotesque | Headers, display text, numbers |

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-page` | `#0E1013` | Page background |
| `--surface-deep` | `#14171A` | Deep panels, header |
| `--surface-primary` | `#1A1D21` | Primary container |
| `--surface-card` | `#252A30` | Card backgrounds |
| `--border` | `#2D333B` | All borders |
| `--felt` | `#1F6F4A` | Active/playable states |
| `--felt-deep` | `#155637` | Felt gradient dark |
| `--felt-deepest` | `#0F4029` | Felt gradient darkest |
| `--gold` | `#E5B96A` | Hero, achievements, values |
| `--red` | `#C84B4B` | Losses, critical HP |
| `--text-primary` | `#E8EAED` | Primary text |
| `--text-secondary` | `#9AA0A6` | Secondary text |
| `--text-tertiary` | `#6B7178` | Tertiary text |

### Three-Color Rule

- **Felt green**: active/playable states
- **Gold**: achievement, value, hero highlights
- **Red**: loss, critical HP

No other accent colors.

### HP Tier Colors

| Condition | Color | Meaning |
|-----------|-------|---------|
| >= 25 BBs | Green | Healthy |
| >= 15 BBs | Gold | Caution |
| < 15 BBs | Red | Critical |

## Component Architecture

### Table Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Felt` | players, pot, communityCards, street | Oval table with 6 seats |
| `Seat` | player | Player position card with avatar, HP, cards |
| `HPBar` | hp, maxHp, bbs | Color-coded health bar |
| `CardBack` | variant, state | Layered card back (felt-green crosshatch + gold spade) |
| `CardFace` | card | Face-up card (white bg, black/red suits) |
| `ChipStack` | pot | Procedural SVG chip stacks by denomination |
| `BetSizer` | value, min, max, pot, onValueChange | Bet input with quick-fill buttons |
| `ActionButtons` | canCheck, callAmount, betAmount, callbacks | Fold/Check/Bet action row |
| `PlacementPanel` | entries, averageHp | Live rankings with top-3/bottom-3 divider |
| `ActionLog` | entries | Hand history |
| `Header` | variant + game info | Top bar (lobby or table mode) |

### Lobby Components

| Component | Props | Description |
|-----------|-------|-------------|
| `LobbyHero` | (none) | Quick play CTA with payout ribbon |
| `GameModeCard` | mode | Game mode selection card |
| `RecentGameRow` | game | Recent game result row |
| `RatingCard` | user stats | Player rating/stats card |
| `FriendsList` | friends | Online friends list |
| `DailyChallenge` | title, reward, progress, total | Daily challenge progress |

## Game Mechanics

- **HP = BBs**: 100 HP starting stack = 100bb
- **6 positions**: SB, BB, UTG, MP, CO, D (button)
- **Blind schedule**: Standard 12 hands/level, Turbo 8, Slow 18
- **Elimination**: 0 HP = out, placement locked
- **Rating**: 1st +30, 2nd +15, 3rd +5, 4th -5, 5th -15, 6th -30

## Tech Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS v4
- Supabase (scaffolded)
