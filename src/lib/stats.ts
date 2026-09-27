import type { LogEvent } from "./engine/game";

/** Per-player tendencies, accumulated from hand logs. */
export interface PlayerStats {
  hands: number;
  /** Voluntarily put chips in preflop (call/bet/raise, not blinds). */
  vpip: number;
  /** Raised preflop. */
  pfr: number;
  /** Postflop bets + raises vs calls, for aggression factor. */
  aggressive: number;
  passive: number;
  showdowns: number;
  showdownsWon: number;
  handsWon: number;
}

export const EMPTY_STATS: PlayerStats = {
  hands: 0, vpip: 0, pfr: 0, aggressive: 0, passive: 0, showdowns: 0, showdownsWon: 0, handsWon: 0,
};

export type StatsTable = Record<string, PlayerStats>;

/**
 * Fold one completed hand's log into the stats table.
 * `dealt` maps player index to player id for everyone dealt into the hand.
 */
export function accumulateHand(table: StatsTable, events: LogEvent[], dealt: Record<number, string>): StatsTable {
  const next: StatsTable = { ...table };
  const touched = new Map<number, PlayerStats>();
  const get = (i: number) => {
    if (!touched.has(i)) touched.set(i, { ...(next[dealt[i]] ?? EMPTY_STATS) });
    return touched.get(i)!;
  };

  const vpip = new Set<number>();
  const pfr = new Set<number>();
  const showed = new Set<number>();
  const won = new Set<number>();
  let street = "preflop";

  for (const e of events) {
    if (e.kind === "street") street = e.street;
    if (e.kind === "action" && e.player in dealt) {
      const s = get(e.player);
      if (street === "preflop") {
        if (e.action === "call" || e.action === "bet" || e.action === "raise") vpip.add(e.player);
        if (e.action === "raise" || e.action === "bet") pfr.add(e.player);
      } else if (e.action === "bet" || e.action === "raise") s.aggressive++;
      else if (e.action === "call") s.passive++;
    }
    if (e.kind === "show") showed.add(e.player);
    if (e.kind === "win") won.add(e.player);
  }

  for (const i of Object.keys(dealt).map(Number)) {
    const s = get(i);
    s.hands++;
    if (vpip.has(i)) s.vpip++;
    if (pfr.has(i)) s.pfr++;
    if (showed.has(i)) {
      s.showdowns++;
      if (won.has(i)) s.showdownsWon++;
    }
    if (won.has(i)) s.handsWon++;
  }
  for (const [i, s] of touched) next[dealt[i]] = s;
  return next;
}

export function pct(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

export function aggressionFactor(s: PlayerStats): string {
  if (s.aggressive + s.passive === 0) return "—";
  if (s.passive === 0) return "∞";
  return (s.aggressive / s.passive).toFixed(1);
}
