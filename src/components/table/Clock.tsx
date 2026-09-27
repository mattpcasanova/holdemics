"use client";

import { useEffect, useState } from "react";
import { play } from "@/lib/audio";

export interface ClockInfo {
  startedAt: number;
  decisionMs: number;
  /** Time bank available to this player (0 for bots). */
  bankMs: number;
}

function useNow(active: boolean, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return now;
}

function clockState(clock: ClockInfo, now: number) {
  const elapsed = now - clock.startedAt;
  const mainLeft = Math.max(0, clock.decisionMs - elapsed);
  const inBank = mainLeft === 0 && clock.bankMs > 0;
  const bankLeft = inBank ? Math.max(0, clock.bankMs - (elapsed - clock.decisionMs)) : clock.bankMs;
  const fraction = inBank ? bankLeft / clock.bankMs : mainLeft / clock.decisionMs;
  const color = inBank ? "var(--gold)" : fraction > 0.35 ? "var(--felt-light)" : fraction > 0.15 ? "var(--gold)" : "var(--red)";
  return { mainLeft, inBank, bankLeft, fraction, color };
}

/** Thin countdown bar pinned to the bottom edge of a seat. */
export function SeatTimer({ clock }: { clock: ClockInfo }) {
  const now = useNow(true);
  const { fraction, color } = clockState(clock, now);
  return (
    <div className="absolute inset-x-2 -bottom-[1px] h-[3px] overflow-hidden rounded-full bg-black/40" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, background: color, transition: "width 100ms linear" }} />
    </div>
  );
}

/** Seconds readout for the hero's action bar. */
export function ClockReadout({ clock, compact = false }: { clock: ClockInfo; compact?: boolean }) {
  const now = useNow(true, 200);
  const { mainLeft, inBank, bankLeft, fraction, color } = clockState(clock, now);
  const seconds = Math.ceil((inBank ? bankLeft : mainLeft) / 1000);
  const urgent = !inBank && fraction <= 0.15;
  // Tick only in the final countdown: inside the time bank, or when no bank is left.
  const lastSeconds = seconds <= 5 && seconds > 0 && (inBank || clock.bankMs === 0);
  useEffect(() => {
    if (lastSeconds) play("tick");
  }, [seconds, lastSeconds]);
  return (
    <div className="flex flex-col items-center justify-center" role="timer" aria-live={urgent ? "assertive" : "off"}>
      <span
        className={`font-display font-semibold tabular-nums leading-none ${compact ? "text-[15px]" : "text-[20px]"} ${urgent ? "animate-pulse" : ""}`}
        style={{ color }}
      >
        {seconds}s
      </span>
      {!compact && (
        <span className="mt-1 text-[10px] text-text-tertiary">
          {inBank ? "time bank" : `bank ${Math.ceil(clock.bankMs / 1000)}s`}
        </span>
      )}
    </div>
  );
}
