"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PracticeResult } from "@/lib/practice/record";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { HERO, usePracticeGame } from "@/hooks/usePracticeGame";
import { type BotLevel, BOT_LEVELS } from "@/lib/engine/bots";
import { potTotal } from "@/lib/engine/game";
import { type ModeId, MODES, blindsForLevel, describeLevelLength, formatHp } from "@/lib/engine/modes";
import { ActionBar } from "./ActionBar";
import { HandLog } from "./HandLog";
import { PokerTable } from "./PokerTable";
import { ResultOverlay } from "./ResultOverlay";
import { StandingsPanel } from "./StandingsPanel";

interface PracticeTableProps {
  mode: ModeId;
  level: BotLevel;
  /** Called once with the hero's finishing place, to save it to their history. */
  onResult?: (result: PracticeResult) => Promise<unknown>;
}

export function PracticeTable(props: PracticeTableProps) {
  // Bumping the key remounts the table for a fresh game.
  const [round, setRound] = useState(0);
  return <PracticeTableInner key={round} {...props} onPlayAgain={() => setRound((r) => r + 1)} />;
}

function PracticeTableInner({ mode, level, onResult, onPlayAgain }: PracticeTableProps & { onPlayAgain: () => void }) {
  const {
    game,
    history,
    stats,
    stage,
    seated,
    heroLegal,
    spectating,
    showResult,
    runout,
    clock,
    sittingOut,
    comeBack,
    act,
    watch,
    skipToResults,
  } = usePracticeGame(mode, level);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Save the result once the hero's finishing place is known (knocked out, or the game ends).
  const heroPlace = game.players[HERO].place;
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || heroPlace === null || !showResult) return;
    recorded.current = true;
    void onResult?.({ mode, botLevel: level, place: heroPlace, players: game.players.length, hands: game.handNumber });
  }, [heroPlace, showResult, mode, level, game.players.length, game.handNumber, onResult]);
  const config = MODES[mode];
  const handsLeft = game.handsLeftInLevel;
  const heroClock =
    clock?.turn?.player === HERO ? { startedAt: clock.turn.startedAt, decisionMs: clock.decisionMs, bankMs: clock.bankMs } : null;
  const next = blindsForLevel(game.level + 1);
  const pot = potTotal(game);
  const nextLevelText =
    game.handNumber === 0 ? describeLevelLength(config) : handsLeft <= 1 ? "after this hand" : `in ${handsLeft} hands`;

  const idleText =
    stage === "seating"
      ? `Seating players ${seated}/${game.players.length}`
      : game.handNumber === 0
        ? "Shuffling up"
        : runout
          ? "All in. Running it out"
          : game.phase === "complete"
            ? "Next hand coming up"
            : game.players[HERO].folded
              ? "You folded. Waiting for the hand to finish"
              : `Waiting on ${game.toAct !== null ? game.players[game.toAct].name : "the table"}`;

  const sidebar = (
    <>
      <StandingsPanel game={game} heroIndex={HERO} />
      <HandLog history={history} players={game.players} heroIndex={HERO} />
    </>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-deep px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
          >
            <span aria-hidden>‹</span> <span className="max-sm:hidden">Lobby</span>
          </Link>
          <div className="h-5 w-px shrink-0 bg-border max-sm:hidden" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold leading-tight">{config.name} practice</div>
            <div className="truncate text-[11px] text-text-tertiary">
              vs {BOT_LEVELS[level].name} {game.players.length === 2 ? "bot" : "bots"}, unrated
            </div>
          </div>
        </div>
        <dl className="flex shrink-0 items-center gap-4 text-[12px] sm:gap-6">
          <div className="text-right">
            <dt className="text-text-tertiary">Blinds</dt>
            <dd className="font-display text-[15px] font-semibold tabular-nums">
              {formatHp(game.blinds.sb)}/{formatHp(game.blinds.bb)}
            </dd>
          </div>
          <div className="text-right max-md:hidden">
            <dt className="text-text-tertiary">Next level</dt>
            <dd className="tabular-nums text-text-secondary">
              {formatHp(next.sb)}/{formatHp(next.bb)} {nextLevelText}
            </dd>
          </div>
          <div className="text-right max-md:hidden">
            <dt className="text-text-tertiary">Hand</dt>
            <dd className="tabular-nums text-text-secondary">#{Math.max(1, game.handNumber)}</dd>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary lg:hidden"
          >
            Standings
          </button>
          <SoundToggle className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-border text-text-secondary transition hover:bg-white/5 hover:text-text-primary" />
          <SettingsButton className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary">
            <span className="max-sm:hidden">Settings</span>
            <span className="sm:hidden" aria-label="Settings">
              ⚙
            </span>
          </SettingsButton>
        </dl>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-2 sm:p-4">
          <div className="min-h-0 flex-1">
            <PokerTable
              game={game}
              heroIndex={HERO}
              seatedCount={seated}
              stats={stats}
              clock={clock}
              runout={runout}
              heroSittingOut={sittingOut}
              fast={spectating}
              botLabel={`${BOT_LEVELS[level].name} bot`}
            />
          </div>
          <div className="mx-auto w-full max-w-[880px] shrink-0">
            {sittingOut && stage === "playing" ? (
              <div className="flex h-[64px] items-center justify-between gap-3 rounded-xl border border-gold/50 bg-gold/[0.07] px-4 sm:h-[112px]">
                <div>
                  <div className="font-display text-[15px] font-semibold text-gold">You&apos;re sitting out</div>
                  <div className="text-[12px] text-text-secondary">
                    Your clock ran out. Until you return, you check when you can and fold to bets.
                  </div>
                </div>
                <button
                  onClick={comeBack}
                  autoFocus
                  className="shrink-0 rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  I&apos;m back
                </button>
              </div>
            ) : (
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
            )}
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
        <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-border bg-surface-deep max-lg:hidden">{sidebar}</aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Standings and hand history">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col border-l border-border bg-surface-deep"
            style={{ animation: "drawer-in 220ms ease-out both" }}
          >
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="rounded-md px-2 text-[20px] leading-none text-text-secondary hover:bg-white/5 hover:text-text-primary"
              >
                ×
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
