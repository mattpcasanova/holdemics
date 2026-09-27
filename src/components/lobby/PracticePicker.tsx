"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { type BotLevel, BOT_LEVELS } from "@/lib/engine/bots";
import { type ModeId, MODES } from "@/lib/engine/modes";

const LEVELS: { id: BotLevel; face: string; pips: number }[] = [
  { id: "easy", face: "pocket_rox", pips: 1 },
  { id: "medium", face: "the_grinder", pips: 2 },
  { id: "hard", face: "felt_ghost", pips: 3 },
];

export function PracticePicker() {
  const [level, setLevel] = useState<BotLevel>("medium");
  const [mode, setMode] = useState<ModeId>("standard");

  return (
    <section id="practice" aria-labelledby="practice-heading" className="scroll-mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 id="practice-heading" className="font-display text-[20px] font-semibold tracking-tight">
            Practice vs bots
          </h2>
          <p className="text-[13px] text-text-secondary">Pick your opponents. Practice games never change your rating.</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Bot difficulty" className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {LEVELS.map((l) => {
          const selected = l.id === level;
          return (
            <button
              key={l.id}
              role="radio"
              aria-checked={selected}
              onClick={() => setLevel(l.id)}
              className={`flex flex-col justify-start rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                selected ? "border-gold/70 bg-gold/[0.06]" : "border-border bg-surface-primary hover:border-text-tertiary"
              }`}
            >
              <div className="flex items-center justify-between">
                <Avatar name={l.face} size={36} ring={selected ? "gold" : "none"} />
                <div className="flex gap-1" aria-label={`Difficulty ${l.pips} of 3`}>
                  {[1, 2, 3].map((p) => (
                    <span key={p} className={`h-1.5 w-4 rounded-full ${p <= l.pips ? "bg-gold" : "bg-border"}`} />
                  ))}
                </div>
              </div>
              <div className="mt-3 font-display text-[16px] font-semibold">{BOT_LEVELS[l.id].name}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-text-secondary">{BOT_LEVELS[l.id].blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-primary p-3">
        <div role="radiogroup" aria-label="Practice mode" className="flex gap-1">
          {(Object.keys(MODES) as ModeId[]).map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={id === mode}
              onClick={() => setMode(id)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                id === mode ? "bg-white/10 font-medium" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {MODES[id].name}
            </button>
          ))}
        </div>
        <Link
          href={`/practice?mode=${mode}&bots=${level}`}
          className="rounded-lg bg-felt px-4 py-2 font-display text-[14px] font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Sit down with {MODES[mode].seats - 1} {BOT_LEVELS[level].name}
          {MODES[mode].seats - 1 === 1 ? "" : "s"}
        </Link>
      </div>
    </section>
  );
}
