"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type BotLevel, decideBotAction } from "@/lib/engine/bots";
import {
  type Action,
  type GameState,
  type LogEvent,
  applyAction,
  createGame,
  legalActions,
  startHand,
} from "@/lib/engine/game";
import { type ModeId, MODES } from "@/lib/engine/modes";
import { botSeats } from "@/lib/practice/bots";
import { useSettings } from "@/lib/settings";
import { type StatsTable, accumulateHand } from "@/lib/stats";

export const HERO = 0;

export interface HandHistory {
  hand: number;
  events: LogEvent[];
}

export type TableStage = "seating" | "playing" | "eliminated" | "finished";

/** The decision currently on the clock. */
export interface Turn {
  key: string;
  player: number;
  startedAt: number;
}

const PACE = {
  normal: { botMin: 650, botMax: 1500, handEnd: 1600, showdownEnd: 3200 },
  fast: { botMin: 60, botMax: 120, handEnd: 250, showdownEnd: 450 },
};

function initialGame(mode: ModeId, level: BotLevel, heroName: string): GameState {
  const bots = botSeats(MODES[mode].seats - 1, level);
  return createGame({
    mode,
    seed: Math.floor(Math.random() * 2 ** 31),
    seats: [{ id: "hero", name: heroName, isBot: false }, ...bots],
  });
}

function runToEnd(state: GameState, level: BotLevel): GameState {
  let s = state;
  while (s.phase !== "finished") {
    s = s.phase === "betting" ? applyAction(s, decideBotAction(s, level)) : startHand(s);
  }
  return s;
}

export function usePracticeGame(mode: ModeId, level: BotLevel, heroName = "you") {
  const config = MODES[mode];
  const { practiceClock } = useSettings();
  const [game, setGame] = useState(() => initialGame(mode, level, heroName));
  const [history, setHistory] = useState<HandHistory[]>([]);
  const [stats, setStats] = useState<StatsTable>({});
  const [turn, setTurn] = useState<Turn | null>(null);
  const [bankMs, setBankMs] = useState(config.timeBankSeconds * 1000);
  const [seated, setSeated] = useState(1);
  const [spectating, setSpectating] = useState(false);
  const processedHand = useRef(0);

  const seats = game.players.length;
  const hero = game.players[HERO];
  const stage: TableStage =
    seated < seats ? "seating" : game.phase === "finished" ? "finished" : hero.eliminated ? "eliminated" : "playing";
  const pace = spectating ? PACE.fast : PACE.normal;
  const decisionMs = config.decisionSeconds * 1000;

  // Let the final showdown play out before the result dialog covers the table.
  const [resultFor, setResultFor] = useState<TableStage | null>(null);
  const endStage = stage === "eliminated" || stage === "finished" ? stage : null;
  useEffect(() => {
    if (!endStage) return;
    const t = setTimeout(() => setResultFor(endStage), 2600);
    return () => clearTimeout(t);
  }, [endStage]);
  const showResult = endStage !== null && resultFor === endStage && (endStage === "finished" || !spectating);

  const commit = useCallback((next: GameState) => {
    setGame(next);
    setHistory((h) => {
      const rest = h.length && h[h.length - 1].hand === next.handNumber ? h.slice(0, -1) : h;
      return [...rest, { hand: next.handNumber, events: next.log }].slice(-12);
    });
    setTurn(
      next.phase === "betting" && next.toAct !== null
        ? { key: `${next.handNumber}:${next.log.length}`, player: next.toAct, startedAt: Date.now() }
        : null,
    );
    if (next.result && processedHand.current !== next.handNumber) {
      processedHand.current = next.handNumber;
      const dealt: Record<number, string> = {};
      next.players.forEach((p, i) => {
        if (p.holeCards.length) dealt[i] = p.id;
      });
      setStats((s) => accumulateHand(s, next.log, dealt));
    }
  }, []);

  // Opponents take their seats one by one before the first deal.
  useEffect(() => {
    if (seated >= seats) return;
    const t = setTimeout(() => setSeated((n) => n + 1), seated === 1 ? 500 : 180);
    return () => clearTimeout(t);
  }, [seated, seats]);

  useEffect(() => {
    if (seated < seats) return;
    if (game.phase === "finished") return;
    if (hero.eliminated && !spectating) return;

    if (game.phase === "waiting") {
      const t = setTimeout(() => commit(startHand(game)), 700);
      return () => clearTimeout(t);
    }
    if (game.phase === "complete") {
      const delay = game.result?.showdown ? pace.showdownEnd : pace.handEnd;
      const t = setTimeout(() => commit(startHand(game)), delay);
      return () => clearTimeout(t);
    }
    if (game.toAct !== null && game.toAct !== HERO) {
      const delay = pace.botMin + Math.random() * (pace.botMax - pace.botMin);
      const t = setTimeout(() => commit(applyAction(game, decideBotAction(game, level))), delay);
      return () => clearTimeout(t);
    }
  }, [game, seated, seats, hero.eliminated, spectating, level, pace, commit]);

  const act = useCallback(
    (action: Action) => {
      if (game.toAct !== HERO) return;
      if (turn && practiceClock) {
        const overtime = Date.now() - turn.startedAt - decisionMs;
        if (overtime > 0) setBankMs((b) => Math.max(0, b - overtime));
      }
      commit(applyAction(game, action));
    },
    [game, commit, turn, practiceClock, decisionMs],
  );

  // Hero's clock: after the decision time and then the time bank run out, check or fold.
  useEffect(() => {
    if (!practiceClock || !turn || turn.player !== HERO || game.toAct !== HERO) return;
    const remaining = turn.startedAt + decisionMs + bankMs - Date.now();
    const t = setTimeout(() => {
      const legal = legalActions(game);
      if (!legal) return;
      setBankMs(0);
      commit(applyAction(game, { type: legal.canCheck ? "check" : "fold" }));
    }, Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [practiceClock, turn, game, decisionMs, bankMs, commit]);

  const skipToResults = useCallback(() => commit(runToEnd(game, level)), [game, level, commit]);

  const heroLegal = useMemo(() => (game.toAct === HERO ? legalActions(game) : null), [game]);

  return {
    game,
    history,
    stats,
    stage,
    seated,
    heroLegal,
    spectating,
    showResult,
    clock: practiceClock ? { turn, decisionMs, bankMs } : null,
    act,
    watch: () => setSpectating(true),
    skipToResults,
  };
}
