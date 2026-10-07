"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEAL_STAGGER_MS, type Runout, type Turn } from "@/hooks/usePracticeGame";
import type { Card } from "@/lib/engine/cards";
import { describeHand, describeStartingHand, evaluate } from "@/lib/engine/evaluator";
import { type GameState, buildPots, positionLabels } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { TABLE_SKINS } from "@/lib/cosmetics";
import { noteKey, useNotes } from "@/lib/notes";
import { useSettings } from "@/lib/settings";
import { runoutSchedule } from "@/lib/practice/runout";
import { type Point, DEALER, STAGES, betPoints, dealerButtonPoint, seatLayout } from "./layout";
import { equities } from "@/lib/handFacts";
import { play } from "@/lib/audio";
import {
  BOARD_DEAL_STAGGER_MS,
  POT_HOLD_SHOWDOWN_MS,
  POT_HOLD_UNCONTESTED_MS,
  POT_MOVE_MS,
  boardFlipDelay,
} from "@/lib/practice/timing";
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
  heroSittingOut?: boolean;
  /** Skip the pot-push animation (spectating at speed). */
  fast?: boolean;
  /** Label for bot players, e.g. "Regular bot". */
  botLabel?: string;
  /** Selected title id per seat, shown under names. */
  titles?: (string | null)[];
  /** Per-seat bot labels, when bots differ in difficulty. */
  botLabels?: (string | null)[];
  /** Per-seat avatar ids. */
  avatars?: (string | null)[];
}

/**
 * Runout progress: how many board cards have been dealt (face down) and how
 * many have turned face up, following the schedule. Outside a runout, all of
 * the board is both.
 */
function useRunoutProgress(runout: Runout | null | undefined, boardLength: number) {
  const [progress, setProgress] = useState<{ hand: number; dealt: number; faceUp: number } | null>(null);
  useEffect(() => {
    if (!runout) return;
    const { cards } = runoutSchedule(runout.from);
    const at = (ms: number) => Math.max(0, runout.startedAt + ms - Date.now());
    const timers = Object.entries(cards).flatMap(([key, c]) => {
      const i = Number(key);
      const bump = (field: "dealt" | "faceUp") => () =>
        setProgress((p) => {
          const base = p?.hand === runout.hand ? p : { hand: runout.hand, dealt: runout.from, faceUp: runout.from };
          return { ...base, [field]: Math.max(base[field], i + 1) };
        });
      // Labels update once the card is mostly turned.
      return [setTimeout(bump("dealt"), at(c.dealAt)), setTimeout(bump("faceUp"), at(c.flipAt + (c.dramatic ? 500 : 250)))];
    });
    return () => timers.forEach(clearTimeout);
  }, [runout]);
  if (!runout) return { dealt: boardLength, faceUp: boardLength };
  const p = progress?.hand === runout.hand ? progress : null;
  return { dealt: p?.dealt ?? runout.from, faceUp: p?.faceUp ?? runout.from };
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
  heroSittingOut = false,
  fast = false,
  botLabel = "Bot",
  titles,
  botLabels,
  avatars,
}: PokerTableProps) {
  const [selected, setSelected] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const notes = useNotes();
  const settings = useSettings();
  const skin = TABLE_SKINS[settings.tableSkin] ?? TABLE_SKINS.classic;
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
  const bets = betPoints(n, portrait);
  const labels = positionLabels(game);
  const result = game.phase === "complete" || game.phase === "finished" ? game.result : null;
  const progress = useRunoutProgress(runout, game.board.length);
  const visibleBoard = game.board.slice(0, progress.faceUp);
  const schedule = runout ? runoutSchedule(runout.from) : null;

  // During an all-in runout every live hand is face up, so show each one's chance of winning
  // with the cards turned so far. Recomputed as each street lands; gone once the river is out.
  const faceUp = progress.faceUp;
  const allInOdds = useMemo(() => {
    if (!runout || !result?.showdown || faceUp >= 5) return null;
    const live = Object.keys(result.hands).map(Number);
    if (live.length < 2) return null;
    const eq = equities(live.map((i) => game.players[i].holeCards), game.board.slice(0, faceUp), game.handNumber);
    return Object.fromEntries(live.map((i, k) => [i, eq[k]])) as Record<number, number>;
  }, [runout, result, faceUp, game.players, game.board, game.handNumber]);
  const oddsLeader = allInOdds ? Math.max(...Object.values(allInOdds)) : null;

  // Side pots only exist once someone is all in; otherwise differing bets are just the current street.
  const anyAllIn = game.players.some((p) => p.allIn && !p.folded);
  const collected = game.players.reduce((sum, p) => sum + p.totalBet - p.bet, 0);
  const pots = result
    ? result.pots.map((p) => p.amount)
    : anyAllIn
      ? buildPots(game.players).map((p) => p.amount)
      : [game.players.reduce((sum, p) => sum + p.totalBet, 0)];
  const potShown = pots.reduce((sum, a) => sum + a, 0);

  // Pot push: once the result is showing, the pot slides to each winner.
  const winners = result && !runout ? Object.entries(result.payouts).map(([i, amount]) => ({ index: Number(i), amount })) : [];
  const push = usePotPush(
    winners.length ? `${game.handNumber}` : null,
    result?.showdown ? POT_HOLD_SHOWDOWN_MS : POT_HOLD_UNCONTESTED_MS,
    fast,
  );
  const potGone = winners.length > 0 && push !== "holding";
  const chipsInMiddle = potGone ? 0 : result ? potShown : collected;
  const potPoint: Point = { x: 50, y: stage.boardTop + (portrait ? 2.1 : 4.4) };

  // Deal order starts left of the button and goes around twice.
  const dealOrder: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (game.sbIndex + k + n) % n;
    if (game.players[i]?.dealt && !game.players[i].eliminated) dealOrder.push(i);
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
            background: `linear-gradient(180deg, ${skin.rail[0]} 0%, ${skin.rail[1]} 100%)`,
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="relative h-full w-full rounded-[50%]"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${skin.felt[0]} 0%, ${skin.felt[1]} 35%, ${skin.felt[2]} 72%, ${skin.felt[3]} 100%)`,
              boxShadow: `inset 0 0 0 1px ${skin.inlay}, inset 0 12px 40px rgba(0,0,0,0.35)`,
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
              const size = stage.board;
              const w = size === "md" ? 56 : 42;
              const h = size === "md" ? 78 : 59;
              // During a runout a street only appears once the dealer reaches it.
              const card = i < progress.dealt ? game.board[i] : undefined;
              if (!card) {
                return <div key={`slot-${i}`} className="rounded-md border border-dashed border-white/10" style={{ width: w, height: h }} />;
              }
              const timing = runout && schedule && i >= runout.from ? schedule.cards[i] : null;
              return (
                <FlipCard
                  key={`${game.handNumber}-${i}`}
                  card={card}
                  size={size}
                  flipAt={timing ? runout!.startedAt + timing.flipAt : undefined}
                  flipDelay={boardFlipDelay(i)}
                  dramatic={timing?.dramatic}
                  dealDelay={timing ? 0 : i < 3 ? i * BOARD_DEAL_STAGGER_MS : 0}
                  dealFrom={{ dx: (2 - i) * (w + 6), dy: -24 }}
                />
              );
            })}
          </div>
          <div className="transition-opacity duration-300" style={{ opacity: push === "done" ? 0 : 1 }}>
            <PotDisplay total={potShown} pots={pots} chips={chipsInMiddle} />
          </div>
        </div>

        {/* Pot chips on their way to the winner(s) */}
        {winners.map((w) => {
          const target = layout[(w.index - heroIndex + n) % n];
          const moving = push !== "holding";
          const pos = moving ? target : potPoint;
          return (
            <div
              key={`push-${game.handNumber}-${w.index}`}
              aria-hidden
              className="pointer-events-none absolute z-[46] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                opacity: push === "done" ? 0 : 1,
                scale: push === "done" ? "0.7" : "1",
                transition: `left ${POT_MOVE_MS}ms cubic-bezier(0.5, 0, 0.2, 1), top ${POT_MOVE_MS}ms cubic-bezier(0.5, 0, 0.2, 1), opacity 250ms ease-in, scale 250ms ease-in`,
                visibility: push === "holding" ? "hidden" : "visible",
              }}
            >
              <ChipStack amount={w.amount} scale={1.5} layout="pile" maxStacks={4} />
            </div>
          );
        })}

        {/* Seats, bets, dealer button */}
        {game.players.map((player, i) => {
          const offset = (i - heroIndex + n) % n;
          const seat = layout[offset];
          const isHero = i === heroIndex;
          const bet = bets[offset];
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
                // Chips over the amount keeps each bet compact, so it clears neighbouring seats and cards.
                <div
                  data-bet
                  className="absolute z-[45] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
                  style={{ left: `${bet.x}%`, top: `${bet.y}%`, animation: "chip-in 260ms ease-out both" }}
                >
                  <ChipStack amount={player.bet} scale={1.4} maxStacks={2} />
                  <span className="rounded-md border border-gold/70 bg-black/85 px-2 font-display text-[19px] font-bold leading-[26px] tabular-nums text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
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
                  // Winners' stacks count up when the chips land, not before.
                  player={pushedPlayer(player, winners.find((w) => w.index === i)?.amount ?? 0, push === "done")}
                  isHero={isHero}
                  sittingOut={isHero && heroSittingOut}
                  isActing={game.toAct === i}
                  position={labels[i]}
                  bigBlind={game.blinds.bb}
                  revealed={showCards}
                  handLabel={handLabel}
                  odds={allInOdds?.[i] !== undefined ? { value: allInOdds[i], leading: allInOdds[i] === oddsLeader } : null}
                  won={won}
                  handNumber={game.handNumber}
                  tag={notes[noteKey(player)]?.tag}
                  title={titles?.[i]}
                  avatar={avatars?.[i]}
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
            botLabel={game.players[selected.index].isBot ? (botLabels?.[selected.index] ?? botLabel) : null}
            title={titles?.[selected.index]}
            avatar={avatars?.[selected.index]}
            mode={game.mode}
            onClose={() => setSelected(null)}
          />
        </Popover>
      )}
    </div>
  );
}

type PushPhase = "holding" | "moving" | "done";

/** Drives the pot push for one hand: hold on the pot, slide to the winner, then land. */
function usePotPush(key: string | null, holdMs: number, fast: boolean): PushPhase {
  const [state, setState] = useState<{ key: string; phase: PushPhase } | null>(null);
  useEffect(() => {
    if (!key) return;
    const hold = fast ? 0 : holdMs;
    const move = fast ? 0 : POT_MOVE_MS;
    const timers = [
      setTimeout(() => {
        setState({ key, phase: "moving" });
        if (!fast) play("win");
      }, hold),
      setTimeout(() => setState({ key, phase: "done" }), hold + move),
    ];
    return () => timers.forEach(clearTimeout);
    // A new hand (key) starts a new push; timing props don't restart one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.phase : "holding";
}

function pushedPlayer(player: GameState["players"][number], won: number, landed: boolean) {
  return won && !landed ? { ...player, stack: player.stack - won } : player;
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
