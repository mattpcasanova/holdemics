"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueue } from "@/hooks/useQueue";
import { type ModeId, MODES } from "@/lib/engine/modes";

interface RankedButtonProps {
  mode: ModeId;
  signedIn: boolean;
  serverWs: string | null;
}

function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

/** "Find a ranked match" with the live queue state, or a sign-in prompt for guests. */
export function RankedButton({ mode, signedIn, serverWs }: RankedButtonProps) {
  const { state, join, leave } = useQueue(serverWs);
  const elapsed = useElapsed(state.status === "searching" ? state.since : null);
  const seats = MODES[mode].seats;

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-gold/50 px-4 py-3 text-[14px] font-medium text-gold transition hover:bg-gold/10"
      >
        Sign in to play ranked
      </Link>
    );
  }

  if (state.status === "searching" || state.status === "connecting" || state.status === "matched") {
    const searching = state.status === "searching";
    return (
      <div className="flex items-center gap-3 rounded-lg border border-felt/60 bg-felt/10 px-4 py-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-felt-light opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-felt-light" />
        </span>
        <div className="min-w-[150px]">
          <div className="text-[13px] font-medium text-white">
            {state.status === "matched" ? "Match found" : searching ? `Searching ${elapsed}s` : "Joining queue"}
          </div>
          <div className="text-[11px] text-felt-light">
            {searching
              ? `${state.waiting} in queue · needs ${seats} · ±${state.window} rating`
              : state.status === "matched"
                ? "Taking you to the table"
                : ""}
          </div>
        </div>
        {state.status !== "matched" && (
          <button onClick={leave} className="rounded-md px-2.5 py-1 text-[12px] text-text-secondary hover:bg-white/10 hover:text-white">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => join(mode)}
        className="rounded-lg bg-gold px-5 py-3 font-display text-[15px] font-semibold text-surface-primary transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Find a ranked match
      </button>
      {state.status === "error" && <span className="text-[12px] text-[#EFA3A3]">{state.message}</span>}
    </div>
  );
}
