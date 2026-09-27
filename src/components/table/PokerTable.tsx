"use client";

import { useState } from "react";
import type { Turn } from "@/hooks/usePracticeGame";
import type { GameState } from "@/lib/engine/game";
import { positionLabels, potTotal } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { noteKey, useNotes } from "@/lib/notes";
import type { StatsTable } from "@/lib/stats";
import { ChipStack } from "./ChipStack";
import { PlayerCard } from "./PlayerCard";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";

interface PokerTableProps {
  game: GameState;
  heroIndex: number;
  /** Players with an index at or above this haven't sat down yet. */
  seatedCount?: number;
  stats?: StatsTable;
  clock?: { turn: Turn | null; decisionMs: number; bankMs: number } | null;
  /** Label for bot players, e.g. "Regular bot". */
  botLabel?: string;
}

/** Point on the table ellipse for a seat, in % of the container. Hero sits at the bottom. */
function seatPoint(offset: number, seats: number, radius = 1) {
  const angle = ((90 + (offset * 360) / seats) * Math.PI) / 180;
  return { x: 50 + 44 * radius * Math.cos(angle), y: 50 + 41 * radius * Math.sin(angle) };
}

export function PokerTable({
  game,
  heroIndex,
  seatedCount = game.players.length,
  stats = {},
  clock,
  botLabel = "Bot",
}: PokerTableProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const notes = useNotes();
  const n = game.players.length;
  const labels = positionLabels(game);
  const result = game.phase === "complete" || game.phase === "finished" ? game.result : null;
  const collected = game.players.reduce((sum, p) => sum + p.totalBet - p.bet, 0);
  const potShown = result ? result.pots.reduce((sum, p) => sum + p.amount, 0) : potTotal(game);
  const chipsInMiddle = result ? potShown : collected;

  return (
    <div
      className="relative mx-auto aspect-[16/10] w-full max-w-[980px] select-none"
      // Size by the viewport height too, so the action bar stays on screen.
      style={{ width: "min(100%, calc((100vh - 250px) * 1.6))" }}
    >
      {/* Rail + felt */}
      <div
        className="absolute inset-[9%_7%_12%] rounded-[50%] p-[14px]"
        style={{
          background: "linear-gradient(180deg, #2A2F36 0%, #15181C 100%)",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="relative h-full w-full rounded-[50%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #247C53 0%, var(--felt) 35%, var(--felt-deep) 72%, var(--felt-deepest) 100%)",
            boxShadow: "inset 0 0 0 1px rgba(229,185,106,0.22), inset 0 12px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div className="pointer-events-none absolute inset-[7%] rounded-[50%] border border-white/[0.05]" />
          <div className="absolute left-1/2 top-[27%] -translate-x-1/2 font-display text-[13px] font-semibold tracking-tight text-white/[0.08]">
            holdemics
          </div>
        </div>
      </div>

      {/* Board + pot */}
      <div className="absolute left-1/2 top-[45%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5">
        <div className="flex min-h-[76px] gap-1.5">
          {game.board.map((card, i) => (
            <PlayingCard key={`${game.handNumber}-${i}`} card={card} size="md" dealDelay={i < 3 ? i * 80 : 0} />
          ))}
          {Array.from({ length: 5 - game.board.length }).map((_, i) => (
            <div key={`slot-${i}`} className="h-[76px] w-[54px] rounded-md border border-dashed border-white/10" />
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1">
          {chipsInMiddle > 0 && <ChipStack amount={chipsInMiddle} scale={0.8} />}
          <span className="text-[12px] text-felt-light">Pot</span>
          <span className="font-display text-[16px] font-semibold tabular-nums text-gold">{formatHp(potShown)}</span>
        </div>
      </div>

      {/* Seats, bets, dealer button */}
      {game.players.map((player, i) => {
        const offset = (i - heroIndex + n) % n;
        const seat = seatPoint(offset, n);
        const bet = seatPoint(offset, n, offset === 0 ? 0.36 : 0.66);
        const dealer = seatPoint(offset + 0.32, n, 0.7);
        const isHero = i === heroIndex;
        const showCards =
          isHero || (result?.showdown && result.hands[i] !== undefined) ? player.holeCards : null;
        const won = result?.payouts[i] ? { amount: result.payouts[i], hand: result.hands[i]?.name ?? null } : undefined;

        if (i >= seatedCount) {
          return (
            <div
              key={player.id}
              className="absolute z-30 flex h-[62px] w-[140px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-dashed border-white/15 text-[11px] text-text-tertiary"
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
            >
              Open seat
            </div>
          );
        }

        return (
          <div key={player.id} style={{ animation: game.handNumber === 0 ? "seat-in 320ms ease-out both" : undefined }}>
            {player.bet > 0 && (
              <div
                className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
                style={{ left: `${bet.x}%`, top: `${bet.y}%` }}
              >
                <ChipStack amount={player.bet} scale={0.75} />
                <span className="rounded bg-black/35 px-1.5 text-[11px] font-medium tabular-nums text-text-primary">
                  {formatHp(player.bet)}
                </span>
              </div>
            )}
            {game.button === i && !player.eliminated && (
              <div
                className="absolute z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#F7F5F0] text-[10px] font-bold text-surface-primary shadow"
                style={{ left: `${dealer.x}%`, top: `${dealer.y}%` }}
                aria-label="Dealer button"
              >
                D
              </div>
            )}
            <div
              className={`absolute ${isHero ? "z-40" : "z-30"} -translate-x-1/2 -translate-y-1/2`}
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
            >
              <Seat
                player={player}
                isHero={isHero}
                isActing={game.toAct === i}
                position={labels[i]}
                bigBlind={game.blinds.bb}
                revealed={showCards}
                won={won}
                handNumber={game.handNumber}
                tag={notes[noteKey(player)]?.tag}
                selected={selected === i}
                onSelect={() => setSelected(selected === i ? null : i)}
                clock={
                  clock?.turn && clock.turn.player === i
                    ? { startedAt: clock.turn.startedAt, decisionMs: clock.decisionMs, bankMs: isHero ? clock.bankMs : 0 }
                    : null
                }
              />
            </div>
          </div>
        );
      })}

      {selected !== null && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setSelected(null)} aria-hidden />
          <div className="absolute z-[60]" style={popoverPosition(seatPoint((selected - heroIndex + n) % n, n))}>
            <PlayerCard
              player={game.players[selected]}
              isHero={selected === heroIndex}
              stats={stats[game.players[selected].id]}
              botLabel={game.players[selected].isBot ? botLabel : null}
              onClose={() => setSelected(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Place the details card beside its seat, keeping it inside the table area. */
function popoverPosition(seat: { x: number; y: number }): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (seat.x <= 50) style.left = `${seat.x + 9}%`;
  else style.right = `${100 - seat.x + 9}%`;
  if (seat.y > 70) style.bottom = "4%";
  else style.top = `${Math.max(0, Math.min(seat.y - 18, 30))}%`;
  return style;
}
