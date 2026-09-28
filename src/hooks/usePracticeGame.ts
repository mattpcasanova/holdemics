"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type BotLevel, decideBotAction } from "@/lib/engine/bots";
import {
  type Action,
  type GameState,
  type LogEvent,
  alivePlayers,
  applyAction,
  createGame,
  legalActions,
  startHand,
} from "@/lib/engine/game";
import { type ModeId, MODES } from "@/lib/engine/modes";
import { botSeats } from "@/lib/practice/bots";
import { maskResult, runoutSchedule } from "@/lib/practice/runout";
import { playEventSounds, playRunoutSounds, playYourTurn } from "@/lib/practice/sounds";
import { DEAL_STAGGER_MS } from "@/lib/practice/timing";
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

/** An all-in runout being revealed street by street. */
export interface Runout {
  hand: number;
  /** Board cards already face up before the runout began. */
  from: number;
  startedAt: number;
}

const PACE = {
  normal: { botMin: 650, botMax: 1500, handEnd: 1600, showdownEnd: 3200 },
  fast: { botMin: 60, botMax: 120, handEnd: 250, showdownEnd: 450 },
};

export { DEAL_STAGGER_MS };

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
  const [runout, setRunout] = useState<Runout | null>(null);
  const [revealedHand, setRevealedHand] = useState(0);
  const [bankMs, setBankMs] = useState(config.timeBankSeconds * 1000);
  const [seated, setSeated] = useState(1);
  const [spectating, setSpectating] = useState(false);
  /** Set when the hero's clock runs out; their turns auto check/fold until they return. */
  const [sittingOut, setSittingOut] = useState(false);
  const sittingOutRef = useRef(false);
  useEffect(() => {
    sittingOutRef.current = sittingOut;
  }, [sittingOut]);
  const processedHand = useRef(0);

  const runoutActive = runout !== null && runout.hand === game.handNumber && revealedHand !== game.handNumber;
  // While a runout plays, everything on screen reflects the hand before it resolved.
  const view = useMemo(() => (runoutActive ? maskResult(game) : game), [runoutActive, game]);

  const seats = game.players.length;
  const hero = view.players[HERO];
  const stage: TableStage =
    seated < seats ? "seating" : view.phase === "finished" ? "finished" : hero.eliminated ? "eliminated" : "playing";
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

  const commit = useCallback((next: GameState, prev: GameState, quiet = false) => {
    const sameHand = prev.handNumber === next.handNumber;
    const fresh = next.log.slice(sameHand ? prev.log.length : 0);
    const isRunout = !!next.result?.showdown && sameHand && next.board.length > prev.board.length;

    setGame(next);
    setTurn(
      next.phase === "betting" && next.toAct !== null
        ? { key: `${next.handNumber}:${next.log.length}`, player: next.toAct, startedAt: Date.now() }
        : null,
    );
    if (isRunout && !quiet) setRunout({ hand: next.handNumber, from: prev.board.length, startedAt: Date.now() });
    if (!quiet) {
      playEventSounds(fresh, next, isRunout);
      if (next.toAct === HERO && (prev.toAct !== HERO || !sameHand) && !sittingOutRef.current) playYourTurn(next, !sameHand);
    }

    // Runout hands enter the history once the reveal finishes (see below).
    if (!isRunout || quiet) {
      setHistory((h) => {
        const rest = h.length && h[h.length - 1].hand === next.handNumber ? h.slice(0, -1) : h;
        return [...rest, { hand: next.handNumber, events: next.log }].slice(-12);
      });
    }
    if (next.result && processedHand.current !== next.handNumber) {
      processedHand.current = next.handNumber;
      const dealt: Record<number, string> = {};
      next.players.forEach((p, i) => {
        if (p.dealt) dealt[i] = p.id;
      });
      setStats((s) => accumulateHand(s, next.log, dealt));
    }
  }, []);

  // Drive the runout: flip sounds on schedule, then reveal the result.
  useEffect(() => {
    if (!runout || runout.hand !== game.handNumber) return;
    const { doneAt } = runoutSchedule(runout.from);
    const elapsed = Date.now() - runout.startedAt;
    playRunoutSounds(runout.from, runout.startedAt);
    const t = setTimeout(() => {
      setRevealedHand(runout.hand);
      setHistory((h) => {
        const rest = h.length && h[h.length - 1].hand === game.handNumber ? h.slice(0, -1) : h;
        return [...rest, { hand: game.handNumber, events: game.log }].slice(-12);
      });
    }, Math.max(0, doneAt - elapsed));
    return () => clearTimeout(t);
    // Only re-run when a new runout starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runout]);

  // Opponents take their seats one by one before the first deal.
  useEffect(() => {
    if (seated >= seats) return;
    const t = setTimeout(() => setSeated((n) => n + 1), seated === 1 ? 500 : 220);
    return () => clearTimeout(t);
  }, [seated, seats]);

  useEffect(() => {
    if (seated < seats) return;
    if (game.phase === "finished") return;
    if (hero.eliminated && !spectating) return;
    if (runoutActive) return;

    if (game.phase === "waiting") {
      const t = setTimeout(() => commit(startHand(game), game), 900);
      return () => clearTimeout(t);
    }
    if (game.phase === "complete") {
      const delay = game.result?.showdown ? pace.showdownEnd : pace.handEnd;
      const t = setTimeout(() => commit(startHand(game), game, spectating), delay);
      return () => clearTimeout(t);
    }
    if (game.toAct !== null && game.toAct !== HERO) {
      // Wait out the deal animation before the first action of a hand.
      const dealing = game.log.length <= 4 ? alivePlayers(game).length * 2 * DEAL_STAGGER_MS : 0;
      const delay = dealing + pace.botMin + Math.random() * (pace.botMax - pace.botMin);
      const t = setTimeout(() => commit(applyAction(game, decideBotAction(game, level)), game, spectating), delay);
      return () => clearTimeout(t);
    }
  }, [game, seated, seats, hero.eliminated, spectating, level, pace, commit, runoutActive]);

  const act = useCallback(
    (action: Action) => {
      if (game.toAct !== HERO || runoutActive) return;
      if (turn && practiceClock) {
        const overtime = Date.now() - turn.startedAt - decisionMs;
        if (overtime > 0) setBankMs((b) => Math.max(0, b - overtime));
      }
      commit(applyAction(game, action), game);
    },
    [game, commit, turn, practiceClock, decisionMs, runoutActive],
  );

  // Hero's clock: after the decision time and then the time bank run out, check or fold.
  useEffect(() => {
    if (!practiceClock || sittingOut || !turn || turn.player !== HERO || game.toAct !== HERO) return;
    const remaining = turn.startedAt + decisionMs + bankMs - Date.now();
    const t = setTimeout(() => {
      const legal = legalActions(game);
      if (!legal) return;
      setBankMs(0);
      setSittingOut(true);
      commit(applyAction(game, { type: legal.canCheck ? "check" : "fold" }), game);
    }, Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [practiceClock, sittingOut, turn, game, decisionMs, bankMs, commit]);

  // Sitting out: check when possible, otherwise fold, without waiting on the clock.
  useEffect(() => {
    if (!sittingOut || game.toAct !== HERO || runoutActive || game.phase !== "betting") return;
    const t = setTimeout(() => {
      const legal = legalActions(game);
      if (legal) commit(applyAction(game, { type: legal.canCheck ? "check" : "fold" }), game);
    }, 500);
    return () => clearTimeout(t);
  }, [sittingOut, game, runoutActive, commit]);

  const skipToResults = useCallback(() => commit(runToEnd(game, level), game, true), [game, level, commit]);

  const heroLegal = useMemo(
    () => (game.toAct === HERO && !runoutActive && !sittingOut ? legalActions(game) : null),
    [game, runoutActive, sittingOut],
  );

  return {
    game: view,
    history,
    stats,
    stage,
    seated,
    heroLegal,
    spectating,
    showResult,
    runout: runoutActive ? runout : null,
    clock: practiceClock ? { turn, decisionMs, bankMs } : null,
    sittingOut,
    comeBack: () => setSittingOut(false),
    act,
    watch: () => setSpectating(true),
    skipToResults,
  };
}
