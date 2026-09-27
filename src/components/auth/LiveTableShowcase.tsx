"use client";

import { useEffect, useState } from "react";
import { avatarTone, initialsFor } from "@/lib/cosmetics";
import { createRng } from "@/lib/engine/cards";
import { decideBotAction } from "@/lib/engine/bots";
import { type GameState, applyAction, createGame, startHand } from "@/lib/engine/game";
import { STARTING_STACK, formatHp } from "@/lib/engine/modes";
import { type HpTier, getHpTier } from "@/lib/hp";
import { botSeats } from "@/lib/practice/bots";
import { evenLobbyPayouts, ordinal } from "@/lib/rating";

/**
 * A miniature bot table that plays a full Standard game on loop, one hand at a
 * time, so the sign-in page shows the format instead of describing it: HP
 * draining and pooling, players busting out, the placement ladder filling in.
 */

const SEATS = 8;
const HAND_MS = 1300;
const FINISH_HOLD_MS = 4200;
const PAYOUTS = evenLobbyPayouts(SEATS);
/** HP tier colors tuned to read on green felt. */
const ON_FELT: Record<HpTier, string> = { green: "#B9E3CC", gold: "#F0C877", red: "#F08A8A" };

function newTable(seed: number): GameState {
  const rng = createRng(seed);
  return createGame({ mode: "standard", seed, seats: botSeats(SEATS, "medium", rng) });
}

/** Plays one complete hand with bots. */
function playHand(state: GameState): GameState {
  let s = startHand(state);
  let rng = s.seed ^ s.handNumber;
  const random = () => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) / 4294967296);
  while (s.phase === "betting") s = applyAction(s, decideBotAction(s, "medium", random));
  return s;
}

function summarize(state: GameState): string {
  const r = state.result;
  if (!r) return "Shuffling up";
  const [winner, amount] = Object.entries(r.payouts).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (winner === undefined) return `Hand ${state.handNumber}`;
  const name = state.players[Number(winner)].name;
  const hand = r.hands[Number(winner)]?.name;
  return `Hand ${state.handNumber}: ${name} takes ${formatHp(amount)} HP${hand ? ` with ${hand.split(",")[0]}` : ""}`;
}

function seatPoint(i: number): { x: number; y: number } {
  const a = ((90 + (i * 360) / SEATS) * Math.PI) / 180;
  return { x: 50 + 43 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
}

export function LiveTableShowcase() {
  const [round, setRound] = useState(1);
  const [game, setGame] = useState(() => newTable(20260927));
  const [flash, setFlash] = useState<number[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = game.phase === "finished" ? FINISH_HOLD_MS : reduced ? HAND_MS * 3 : HAND_MS;
    const t = setTimeout(() => {
      // Don't simulate hands nobody can see; re-render to check again later.
      if (document.hidden) {
        setGame((g) => ({ ...g }));
        return;
      }
      if (game.phase === "finished") {
        setRound((r) => r + 1);
        setGame(newTable(20260927 + round * 7919));
        setFlash([]);
        return;
      }
      const next = playHand(game);
      setGame(next);
      setFlash(Object.keys(next.result?.payouts ?? {}).map(Number));
    }, delay);
    return () => clearTimeout(t);
  }, [game, round]);

  const winner = game.phase === "finished" ? game.players.find((p) => p.place === 1) : undefined;
  const pot = game.result ? game.result.pots.reduce((s, p) => s + p.amount, 0) : 0;
  const ladder = Array.from({ length: SEATS }, (_, k) => game.players.find((p) => p.place === k + 1));

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-6" aria-hidden>
      {/* Table */}
      <div className="relative aspect-[16/11] w-full">
        <div className="absolute inset-[13%_11%] rounded-[50%] bg-black/35 p-2.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
          <div
            className="flex h-full w-full flex-col items-center justify-center rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at 50% 38%, #2A8A5C 0%, #1F6F4A 45%, #155637 80%, #0F4029 100%)",
              boxShadow: "inset 0 0 0 1px rgba(229,185,106,0.28), inset 0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            {winner ? (
              <div className="text-center" style={{ animation: "pop-in 400ms ease-out both" }}>
                <div className="text-[11px] font-medium text-green-light-text">Last one standing</div>
                <div className="font-display text-[22px] font-semibold text-white">{winner.name}</div>
                <div className="font-display text-[28px] font-bold leading-none tabular-nums text-gold">
                  {formatHp(winner.stack)} HP
                </div>
                <div className="mt-1 text-[12px] font-semibold text-gold">+{PAYOUTS[0]} rating</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-[11px] text-green-light-text">
                  Blinds {formatHp(game.blinds.sb)}/{formatHp(game.blinds.bb)}
                </div>
                <div
                  key={game.handNumber}
                  className="font-display text-[26px] font-semibold leading-tight tabular-nums text-gold"
                  style={{ animation: pot ? "pot-pulse 900ms ease-out both" : undefined }}
                >
                  {pot ? formatHp(pot) : "800"}
                </div>
                <div className="text-[11px] text-green-light-text">{pot ? "HP pot" : "HP on the table"}</div>
              </div>
            )}
          </div>
        </div>

        {game.players.map((p, i) => {
          const pos = seatPoint(i);
          const out = p.eliminated;
          const won = flash.includes(i) && !out;
          const hp = p.stack / (STARTING_STACK / 100);
          const fill = Math.min(100, hp);
          const tier = getHpTier(p.stack / game.blinds.bb);
          const tone = avatarTone(p.name);
          const ring = out ? "rgba(255,255,255,0.12)" : ON_FELT[tier];
          return (
            <div
              key={p.id}
              className="absolute flex w-[92px] flex-col items-center gap-1 transition-opacity duration-700"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, translate: "-50% -50%", opacity: out ? 0.38 : 1 }}
            >
              <div
                className="relative rounded-full p-[3px] transition-[background] duration-700"
                style={{
                  background: `conic-gradient(${ring} ${fill}%, rgba(0,0,0,0.35) 0)`,
                  boxShadow: won ? "0 0 0 2px var(--gold), 0 0 24px rgba(229,185,106,0.6)" : hp > 100 && !out ? "0 0 14px rgba(229,185,106,0.35)" : "none",
                  transition: "box-shadow 400ms ease-out",
                }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full font-display text-[14px] font-semibold"
                  style={{ background: out ? "#1A1D21" : tone.bg, color: out ? "#6B7178" : tone.fg }}
                >
                  {out && p.place ? ordinal(p.place) : initialsFor(p.name)}
                </div>
              </div>
              <div className="flex flex-col items-center rounded-md bg-black/45 px-1.5 py-0.5">
                <span className="max-w-[84px] truncate text-[10.5px] font-medium text-white/90">{p.name}</span>
                <span className="font-display text-[12px] font-semibold leading-tight tabular-nums" style={{ color: out ? "#8A9098" : ring }}>
                  {out ? "out" : `${formatHp(p.stack)} HP`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placement ladder */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-[14px] font-semibold text-white">Placement</span>
          <span key={game.handNumber} className="truncate pl-4 text-[12px] text-green-light-text" style={{ animation: "fade-in 400ms ease-out both" }}>
            {summarize(game)}
          </span>
        </div>
        <ol className="grid grid-cols-8 gap-1.5">
          {ladder.map((p, k) => {
            const gains = k < SEATS / 2;
            return (
              <li
                key={k}
                className={`flex flex-col items-center rounded-lg border px-1 py-1.5 transition-colors duration-500 ${
                  p ? (gains ? "border-gold bg-[#6A5320]" : "border-[#D06A6A] bg-[#5E2A2A]") : "border-white/10 bg-black/30"
                }`}
              >
                <span className="text-[10px] text-white/55">{ordinal(k + 1)}</span>
                <span className={`font-display text-[13px] font-semibold tabular-nums ${gains ? "text-gold" : "text-[#E3A0A0]"}`}>
                  {PAYOUTS[k] > 0 ? `+${PAYOUTS[k]}` : PAYOUTS[k]}
                </span>
                <span className="h-[14px] max-w-full truncate text-[9.5px] text-white/80">{p?.name ?? ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
