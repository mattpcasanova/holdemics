# Holdemics

6-max placement poker webapp — chess.com structure with TFT-style scoring. Six players, top 3 gain rating, bottom 3 lose rating. HP = BBs (100 HP = 100bb starting stack).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 + CSS custom properties
- **Fonts**: Inter (body), Bricolage Grotesque (display)
- **Database**: Supabase (scaffolded, not wired)
- **Hosting**: Vercel

## Key Directories

```
src/
├── app/                  # Pages (lobby, table)
│   ├── page.tsx          # Lobby/hub page
│   └── table/[id]/       # Live game table page
├── components/           # Presentational components
├── lib/
│   ├── hp.ts             # HP tier logic (green/gold/red)
│   ├── types.ts          # All TypeScript types
│   └── supabase/         # Client + server helpers
design-reference/         # HTML mockups (visual source of truth)
```

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Design System

Three-color accent rule:
- **Felt green** (#1F6F4A): active/playable states
- **Gold** (#E5B96A): achievement/value/hero highlights
- **Red** (#C84B4B): loss/critical HP

Hero seat gets gold border; active opponents get felt-green border; folded = gray + reduced opacity.

HP tiers: >=25bb = green, >=15bb = gold, <15bb = red.

## Game Mechanics

- HP = BBs (100 HP = 100bb)
- 6 fixed positions: SB, BB, UTG, MP, CO, D
- Blind schedule: standard = 12 hands/level, turbo = 8, slow = 18
- Placement by HP at hand-end; 0 HP = eliminated
- Rating: 1st +30, 2nd +15, 3rd +5, 4th -5, 5th -15, 6th -30

## Environment Variables

See `.env.local.example` for required variables.

## Known Issues / Gotchas

- All data is currently static mock data — no game state machine yet
- Supabase is scaffolded but not connected (no .env.local)
- ActionLog uses dangerouslySetInnerHTML for rich text — will need sanitization before real data
