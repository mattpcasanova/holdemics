"use client";

import Link from "next/link";
import { useState } from "react";
import { HERO, usePracticeGame } from "@/hooks/usePracticeGame";
import { type BotLevel, BOT_LEVELS } from "@/lib/engine/bots";
import { potTotal } from "@/lib/engine/game";
import { type ModeId, MODES, blindsForLevel, describeLevelLength, formatHp } from "@/lib/engine/modes";
import { ActionBar } from "./ActionBar";
import { HandLog } from "./HandLog";
import { PokerTable } from "./PokerTable";
import { ResultOverlay } from "./ResultOverlay";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import { StandingsPanel } from "./StandingsPanel";

interface PracticeTableProps {
  mode: ModeId;
  level: BotLevel;
}

export function PracticeTable(props: PracticeTableProps) {
  // Bumping the key remounts the table for a fresh game.
  const [round, setRound] = useState(0);
  return <PracticeTableInner key={round} {...props} onPlayAgain={() => setRound((r) => r + 1)} />;
}

function PracticeTableInner({ mode, level, onPlayAgain }: PracticeTableProps & { onPlayAgain: () => void }) {
  const { game, history, stats, stage, seated, heroLegal, spectating, showResult, clock, act, watch, skipToResults } =
    usePracticeGame(mode, level);
  const config = MODES[mode];
  const handsLeft = game.handsLeftInLevel;
  const heroClock =
    clock?.turn?.player === HERO ? { startedAt: clock.turn.startedAt, decisionMs: clock.decisionMs, bankMs: clock.bankMs } : null;
  const next = blindsForLevel(game.level + 1);
  const pot = potTotal(game);

  const idleText =
    stage === "seating"
      ? `Seating players ${seated}/${game.players.length}`
      : game.handNumber === 0
        ? "Shuffling up"
        : game.phase === "complete"
          ? "Next hand coming up"
          : game.players[HERO].folded
            ? "You folded. Waiting for the hand to finish"
            : `Waiting on ${game.toAct !== null ? game.players[game.toAct].name : "the table"}`;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-deep px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
          >
            <span aria-hidden>‹</span> Lobby
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <div className="font-display text-[15px] font-semibold leading-tight">
              {config.name} practice
            </div>
            <div className="text-[11px] text-text-tertiary">
              vs {BOT_LEVELS[level].name} {game.players.length === 2 ? "bot" : "bots"}, unrated
            </div>
          </div>
        </div>
        <dl className="flex items-center gap-6 text-[12px]">
          <div className="text-right">
            <dt className="text-text-tertiary">Blinds</dt>
            <dd className="font-display text-[15px] font-semibold tabular-nums">
              {formatHp(game.blinds.sb)}/{formatHp(game.blinds.bb)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-text-tertiary">Next level</dt>
            <dd className="tabular-nums text-text-secondary">
              {formatHp(next.sb)}/{formatHp(next.bb)}{" "}
              {game.handNumber === 0 ? describeLevelLength(config) : handsLeft <= 1 ? "after this hand" : `in ${handsLeft} hands`}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-text-tertiary">Hand</dt>
            <dd className="tabular-nums text-text-secondary">#{Math.max(1, game.handNumber)}</dd>
          </div>
          <SettingsButton className="rounded-md border border-border px-3 py-1.5 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary">
            Settings
          </SettingsButton>
        </dl>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-4 p-4">
          <div className="flex min-h-0 flex-1 items-center">
            <PokerTable
              game={game}
              heroIndex={HERO}
              seatedCount={seated}
              stats={stats}
              clock={clock}
              botLabel={`${BOT_LEVELS[level].name} bot`}
            />
          </div>
          <div className="mx-auto w-full max-w-[860px]">
            <ActionBar
              legal={heroLegal}
              pot={pot}
              currentBet={game.currentBet}
              bigBlind={game.blinds.bb}
              preflop={game.street === "preflop"}
              onAct={act}
              idleText={spectating ? "Spectating" : idleText}
              clock={heroClock}
            />
          </div>
          {showResult && (
            <ResultOverlay
              game={game}
              heroIndex={HERO}
              finished={stage === "finished"}
              onWatch={watch}
              onSkip={skipToResults}
              onPlayAgain={onPlayAgain}
            />
          )}
        </main>
        <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-border bg-surface-deep max-lg:hidden">
          <StandingsPanel game={game} heroIndex={HERO} />
          <HandLog history={history} players={game.players} heroIndex={HERO} />
        </aside>
      </div>
    </div>
  );
}
