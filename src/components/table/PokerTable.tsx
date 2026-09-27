"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEAL_STAGGER_MS, type Runout, type Turn } from "@/hooks/usePracticeGame";
import type { Card } from "@/lib/engine/cards";
import { describeHand, describeStartingHand, evaluate } from "@/lib/engine/evaluator";
import { type GameState, buildPots, positionLabels } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { noteKey, useNotes } from "@/lib/notes";
import { runoutSchedule } from "@/lib/practice/runout";
import type { StatsTable } from "@/lib/stats";
import { ChipStack } from "./ChipStack";
import { FlipCard } from "./FlipCard";
import { PlayerCard } from "./PlayerCard";
import { PotDisplay } from "./PotDisplay";
import { Seat } from "./Seat";

interface PokerTableProps {
  game: GameState;
  heroIndex: number;
  /** Players with an index at or above this haven't sat down yet. */
  seatedCount?: number;
  stats?: StatsTable;
  clock?: { turn: Turn | null; decisionMs: number; bankMs: number } | null;
  runout?: Runout | null;
  /** Label for bot players, e.g. "Regular bot". */
  botLabel?: string;
}

type Point = { x: number; y: number };

/**
 * The table is laid out on a fixed-size stage and scaled to fit, so seats,
 * cards, and chips keep their proportions on every screen. Tall, narrow
 * containers (phones) get a portrait stage with seats in two columns.
 */
const STAGES = {
  landscape: { w: 1000, h: 640, felt: "9% 7% 12%", boardTop: 45, board: "md" as const },
  portrait: { w: 540, h: 880, felt: "8% 11% 9%", boardTop: 44, board: "sm" as const },
};
const DEALER: Point = { x: 50, y: 40 };

function ellipsePoint(offset: number, seats: number, radius = 1): Point {
  const angle = ((90 + (offset * 360) / seats) * Math.PI) / 180;
  return { x: 50 + 44 * radius * Math.cos(angle), y: 51 + 40 * radius * Math.sin(angle) };
}

const PORTRAIT_8: Point[] = [
  { x: 50, y: 88 },
  { x: 15, y: 73 },
  { x: 15, y: 52 },
  { x: 15, y: 29 },
  { x: 50, y: 12 },
  { x: 85, y: 29 },
  { x: 85, y: 52 },
  { x: 85, y: 73 },
];

/** Seat centers by offset from the hero (0 = hero, then clockwise). */
function seatLayout(n: number, portrait: boolean): Point[] {
  if (!portrait) return Array.from({ length: n }, (_, k) => ellipsePoint(k, n));
  if (n === 2) return [PORTRAIT_8[0], PORTRAIT_8[4]];
  if (n === 8) return PORTRAIT_8;
  return Array.from({ length: n }, (_, k) => {
    const a = ((90 + (k * 360) / n) * Math.PI) / 180;
    return { x: 50 + 36 * Math.cos(a), y: 50 + 38 * Math.sin(a) };
  });
}

/**
 * Where a seat's bet sits, relative to the seat box so chips clear both the
 * seat and the board.
 */
function betPoint(seat: Point, isHero: boolean, portrait: boolean): Point {
  if (isHero) return { x: 50, y: portrait ? 71 : 68.5 };
  const toward = Math.sign(50 - seat.x);
  if (portrait) {
    if (Math.abs(seat.x - 50) < 10) return { x: seat.x, y: seat.y + 12 };
    // Middle side seats sit level with the pot, so drop their bets just below it.
    return { x: seat.x + toward * 22, y: seat.y + (Math.abs(seat.y - 52) < 5 ? 8 : 0) };
  }
  const dy = seat.y - 51;
  if (Math.abs(dy) < 12) return { x: seat.x + toward * 14, y: seat.y };
  if (dy < 0) return { x: seat.x + toward * 5, y: seat.y + 14 };
  return { x: seat.x + toward * 13, y: seat.y - 9 };
}

function dealerButtonPoint(seat: Point, offset: number, n: number, portrait: boolean): Point {
  if (!portrait) return ellipsePoint(offset + 0.32, n, 0.7);
  // Just inside the seat box, toward the middle of the table.
  if (Math.abs(seat.x - 50) < 10) return { x: seat.x + 19, y: seat.y + (seat.y < 50 ? 6 : -6) };
  return { x: seat.x + Math.sign(50 - seat.x) * 18, y: seat.y - 6 };
}

/** How many board cards are face up, following the runout schedule while one plays. */
function useVisibleBoard(runout: Runout | null | undefined, boardLength: number): number {
  const [flipped, setFlipped] = useState<{ hand: number; count: number } | null>(null);
  useEffect(() => {
    if (!runout) return;
    const { flipAt } = runoutSchedule(runout.from);
    const timers = Object.entries(flipAt).map(([i, t]) =>
      setTimeout(
        () => setFlipped({ hand: runout.hand, count: Number(i) + 1 }),
        Math.max(0, runout.startedAt + t + 350 - Date.now()),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [runout]);
  if (!runout) return boardLength;
  return flipped?.hand === runout.hand ? Math.max(flipped.count, runout.from) : runout.from;
}

function madeHand(hole: Card[], board: Card[]): string {
  if (hole.length < 2) return "";
  return board.length >= 3 ? describeHand(evaluate([...hole, ...board])) : describeStartingHand(hole);
}

export function PokerTable({
  game,
  heroIndex,
  seatedCount = game.players.length,
  stats = {},
  clock,
  runout,
  botLabel = "Bot",
}: PokerTableProps) {
  const [selected, setSelected] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const notes = useNotes();
  const wrapper = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Use whichever layout renders the table larger in the space available.
  const fit = (st: { w: number; h: number }) => (box.w ? Math.min(box.w / st.w, box.h / st.h) : 0);
  const portrait = fit(STAGES.portrait) > fit(STAGES.landscape);
  const stage = portrait ? STAGES.portrait : STAGES.landscape;
  const scale = fit(stage);

  const n = game.players.length;
  const layout = seatLayout(n, portrait);
  const labels = positionLabels(game);
  const result = game.phase === "complete" || game.phase === "finished" ? game.result : null;
  const visibleBoard = game.board.slice(0, useVisibleBoard(runout, game.board.length));
  const schedule = runout ? runoutSchedule(runout.from) : null;

  // Side pots only exist once someone is all in; otherwise differing bets are just the current street.
  const anyAllIn = game.players.some((p) => p.allIn && !p.folded);
  const collected = game.players.reduce((sum, p) => sum + p.totalBet - p.bet, 0);
  const pots = result
    ? result.pots.map((p) => p.amount)
    : anyAllIn
      ? buildPots(game.players).map((p) => p.amount)
      : [game.players.reduce((sum, p) => sum + p.totalBet, 0)];
  const potShown = pots.reduce((sum, a) => sum + a, 0);
  const chipsInMiddle = result ? potShown : collected;

  // Deal order starts left of the button and goes around twice.
  const dealOrder: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (game.sbIndex + k + n) % n;
    if (game.players[i]?.holeCards.length && !game.players[i].eliminated) dealOrder.push(i);
  }

  return (
    <div ref={wrapper} className="relative h-full w-full select-none">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: stage.w,
          height: stage.h,
          transform: `translate(-50%, -50%) scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {/* Rail + felt */}
        <div
          className="absolute rounded-[50%] p-[14px]"
          style={{
            inset: stage.felt,
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
          </div>
        </div>

        {/* Board + pot */}
        <div
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
          style={{ top: `${stage.boardTop}%` }}
        >
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = game.board[i];
              const size = stage.board;
              const w = size === "md" ? 56 : 42;
              const h = size === "md" ? 78 : 59;
              if (!card) {
                return <div key={`slot-${i}`} className="rounded-md border border-dashed border-white/10" style={{ width: w, height: h }} />;
              }
              const inRunout = runout && schedule && i >= runout.from;
              return (
                <FlipCard
                  key={`${game.handNumber}-${i}`}
                  card={card}
                  size={size}
                  flipAt={inRunout ? runout.startedAt + schedule.flipAt[i] : undefined}
                  flipDelay={i < 3 ? 260 + i * 110 : 260}
                  dealDelay={inRunout ? (i - runout.from) * 90 : i < 3 ? i * 70 : 0}
                  dealFrom={{ dx: (2 - i) * (w + 6), dy: -24 }}
                />
              );
            })}
          </div>
          <PotDisplay total={potShown} pots={pots} chips={chipsInMiddle} />
        </div>

        {/* Seats, bets, dealer button */}
        {game.players.map((player, i) => {
          const offset = (i - heroIndex + n) % n;
          const seat = layout[offset];
          const isHero = i === heroIndex;
          const bet = betPoint(seat, isHero, portrait);
          const dealer = dealerButtonPoint(seat, offset, n, portrait);

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

          const revealedAtShowdown = result?.showdown && result.hands[i] !== undefined;
          const showCards = isHero || revealedAtShowdown ? player.holeCards : null;
          const won = result?.payouts[i] ? { amount: result.payouts[i], hand: result.hands[i]?.name ?? null } : undefined;
          const handLabel =
            showCards && !player.folded
              ? result && !runout && result.hands[i]
                ? result.hands[i].name
                : madeHand(player.holeCards, visibleBoard)
              : null;

          const order = dealOrder.indexOf(i);
          const deal =
            order >= 0
              ? {
                  dx: ((DEALER.x - seat.x) / 100) * stage.w,
                  dy: ((DEALER.y - seat.y) / 100) * stage.h + 40,
                  delays: [order * DEAL_STAGGER_MS, (dealOrder.length + order) * DEAL_STAGGER_MS] as [number, number],
                }
              : undefined;

          return (
            <div key={player.id}>
              {player.bet > 0 && (
                <div
                  className={`absolute z-[45] flex -translate-x-1/2 -translate-y-1/2 items-end gap-1.5 ${
                    seat.x > 55 && !isHero ? "flex-row-reverse" : ""
                  }`}
                  style={{ left: `${bet.x}%`, top: `${bet.y}%`, animation: "chip-in 260ms ease-out both" }}
                >
                  <ChipStack amount={player.bet} scale={1.5} />
                  <span className="mb-0.5 rounded-md border border-white/10 bg-black/60 px-1.5 py-px font-display text-[12px] font-semibold tabular-nums text-text-primary shadow">
                    {formatHp(player.bet)}
                  </span>
                </div>
              )}
              {game.button === i && !player.eliminated && (
                <div
                  className="absolute z-[44] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/30 bg-[#F7F5F0] font-display text-[11px] font-bold text-surface-primary shadow-md transition-[left,top] duration-500"
                  style={{ left: `${dealer.x}%`, top: `${dealer.y}%` }}
                  aria-label="Dealer button"
                >
                  D
                </div>
              )}
              <SeatMover to={seat} className={isHero ? "z-40" : "z-30"}>
                <Seat
                  player={player}
                  isHero={isHero}
                  isActing={game.toAct === i}
                  position={labels[i]}
                  bigBlind={game.blinds.bb}
                  revealed={showCards}
                  handLabel={handLabel}
                  won={won}
                  handNumber={game.handNumber}
                  tag={notes[noteKey(player)]?.tag}
                  selected={selected?.index === i}
                  onSelect={(anchor) => setSelected(selected?.index === i ? null : { index: i, anchor })}
                  deal={deal}
                  clock={
                    clock?.turn && clock.turn.player === i
                      ? { startedAt: clock.turn.startedAt, decisionMs: clock.decisionMs, bankMs: isHero ? clock.bankMs : 0 }
                      : null
                  }
                />
              </SeatMover>
            </div>
          );
        })}
      </div>

      {selected && (
        <Popover anchor={selected.anchor} onClose={() => setSelected(null)}>
          <PlayerCard
            player={game.players[selected.index]}
            isHero={selected.index === heroIndex}
            stats={stats[game.players[selected.index].id]}
            botLabel={game.players[selected.index].isBot ? botLabel : null}
            onClose={() => setSelected(null)}
          />
        </Popover>
      )}
    </div>
  );
}

/** Seats start at the dealer's spot and glide out to their chair when the player sits down. */
function SeatMover({ to, className, children }: { to: Point; className: string; children: React.ReactNode }) {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    // A timer rather than requestAnimationFrame: rAF is paused in background tabs,
    // which would leave players who sat down meanwhile stuck at the dealer.
    const t = setTimeout(() => setArrived(true), 30);
    return () => clearTimeout(t);
  }, []);
  const pos = arrived ? to : DEALER;
  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        opacity: arrived ? 1 : 0,
        scale: arrived ? "1" : "0.55",
        transition:
          "left 650ms cubic-bezier(0.22, 1, 0.36, 1), top 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease-out, scale 650ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Floating panel next to a seat, rendered at the page level and clamped to the
 * viewport so it is never cut off, whatever the seat position or screen size.
 */
function Popover({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = panel.current;
      if (!el) return;
      const margin = 8;
      const a = anchor.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = Math.min(el.scrollHeight, window.innerHeight - margin * 2);
      let left = a.right + 12;
      if (left + w > window.innerWidth - margin) left = a.left - 12 - w;
      if (left < margin) left = a.left + a.width / 2 - w / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
      const top = Math.max(margin, Math.min(a.top + a.height / 2 - h / 2, window.innerHeight - h - margin));
      setPos({ left, top, maxHeight: window.innerHeight - margin * 2 });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        className="fixed z-[91] overflow-y-auto rounded-2xl"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
