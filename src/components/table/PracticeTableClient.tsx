"use client";

import dynamic from "next/dynamic";
import type { BotLevel } from "@/lib/engine/bots";
import type { ModeId } from "@/lib/engine/modes";
import type { PracticeResult } from "@/lib/practice/record";

// The deck is shuffled client-side with a random seed, so skip SSR to avoid hydration mismatches.
const PracticeTable = dynamic(() => import("./PracticeTable").then((m) => m.PracticeTable), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-[13px] text-text-secondary">Opening table</div>
  ),
});

/** Saves a finished game to the player's history; guests get a quiet no-op from the server. */
async function recordResult(result: PracticeResult) {
  await fetch("/api/practice-games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
}

export function PracticeTableClient({ mode, level }: { mode: ModeId; level: BotLevel }) {
  return <PracticeTable mode={mode} level={level} onResult={recordResult} />;
}
