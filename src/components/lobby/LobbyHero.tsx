"use client";

import Link from "next/link";
import { useState } from "react";
import { type ModeId, MODES, STARTING_HP, describeLevelLength } from "@/lib/engine/modes";
import { evenLobbyPayouts, ordinal } from "@/lib/rating";
import { RankedButton } from "./RankedButton";

const MODE_ORDER: ModeId[] = ["standard", "turbo", "headsup"];

/** Seats placed around the mini table, 1st at the top going clockwise. */
function seatPosition(k: number, n: number) {
  const angle = ((-90 + (k * 360) / n) * Math.PI) / 180;
  // Matches the rail ellipse: the felt is inset 12% vertically and 10% horizontally.
  return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` };
}

function MiniTable({ seats }: { seats: number }) {
  const payouts = evenLobbyPayouts(seats);
  const slots = Array.from({ length: 8 }, (_, k) => k);
  return (
    <div className="relative aspect-[16/11] w-full">
      <div className="absolute inset-[12%_10%] rounded-[50%] bg-[#1a1d21] p-2.5 shadow-[0_24px_50px_-18px_rgba(0,0,0,0.8)]">
        <div
          className="flex h-full w-full flex-col items-center justify-center rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, #247C53 0%, var(--felt) 40%, var(--felt-deep) 80%, var(--felt-deepest) 100%)",
            boxShadow: "inset 0 0 0 1px rgba(229,185,106,0.25)",
          }}
        >
          <div className="font-display text-[34px] font-semibold leading-none tabular-nums text-gold">
            {seats * STARTING_HP}
          </div>
          <div className="mt-1 text-[11px] text-felt-light">HP on the table</div>
        </div>
      </div>
      {slots.map((k) => {
        const visible = k < seats;
        const pos = seatPosition(visible ? k : 0, visible ? seats : 1);
        const delta = payouts[k] ?? 0;
        const gains = delta > 0;
        return (
          <div
            key={k}
            className="absolute transition-all duration-500 ease-out"
            style={{ ...pos, opacity: visible ? 1 : 0, transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.6})` }}
            aria-hidden={!visible}
          >
            <div
              className={`flex w-[62px] flex-col items-center rounded-lg border bg-surface-deep py-1.5 ${
                gains ? "border-gold/40" : "border-red/30"
              }`}
            >
              <span className="text-[10.5px] text-text-tertiary">{ordinal(k + 1)}</span>
              <span className={`font-display text-[15px] font-semibold tabular-nums ${gains ? "text-gold" : "text-red-muted"}`}>
                {gains ? `+${delta}` : delta}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LobbyHero({ signedIn, serverWs, queueMode = null }: { signedIn: boolean; serverWs: string | null; queueMode?: ModeId | null }) {
  const [modeId, setModeId] = useState<ModeId>(queueMode ?? "standard");
  const mode = MODES[modeId];

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-primary"
      style={{ background: "radial-gradient(120% 90% at 85% 50%, rgba(31,111,74,0.28) 0%, transparent 60%), var(--surface-primary)" }}
    >
      <div className="grid grid-cols-[1fr_1.1fr] items-center gap-4 p-5 sm:p-7 max-lg:grid-cols-1">
        <div>
          <div role="tablist" aria-label="Game mode" className="mb-6 inline-flex max-w-full rounded-lg border border-border bg-surface-deep p-1">
            {MODE_ORDER.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={id === modeId}
                onClick={() => setModeId(id)}
                className={`rounded-md px-3.5 py-1.5 text-[13px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                  id === modeId ? "bg-white/10 font-medium text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {MODES[id].name}
              </button>
            ))}
          </div>

          <h1 id="hero-heading" className="min-h-[3.15em] font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
            {mode.seats === 2 ? "Two players. One survives." : "Eight players. One table. Top four climb."}
          </h1>
          <p className="mt-3 min-h-[4.9em] max-w-[46ch] text-[14px] leading-relaxed text-text-secondary">
            Everyone starts with {STARTING_HP} HP, and your HP is your stack. Blinds climb {describeLevelLength(mode)} until one
            player holds it all. Your rating moves on where you finish.
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <div>
              <dt className="text-text-tertiary">Length</dt>
              <dd className="font-medium">{mode.estimatedMinutes}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Decisions</dt>
              <dd className="font-medium">{mode.decisionSeconds}s each</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Blinds up</dt>
              <dd className="font-medium">{describeLevelLength(mode)}</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <RankedButton mode={modeId} signedIn={signedIn} serverWs={serverWs} autoJoin={queueMode === modeId} />
            <Link
              href={`/practice?mode=${modeId}&bots=medium`}
              className="whitespace-nowrap rounded-lg border border-border px-4 py-3 text-[14px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
            >
              Practice vs bots
            </Link>
          </div>
        </div>

        <MiniTable seats={mode.seats} />
      </div>
    </section>
  );
}
