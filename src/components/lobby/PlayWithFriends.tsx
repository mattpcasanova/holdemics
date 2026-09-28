"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type BotLevel, BOT_LEVELS } from "@/lib/engine/bots";
import { type ModeId, MODES } from "@/lib/engine/modes";

/** Create a private table and share its code, or join one by code. Private games are unrated. */
export function PlayWithFriends({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<ModeId>("standard");
  const [bots, setBots] = useState<BotLevel>("medium");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, botLevel: bots }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { code?: string; error?: string } | null;
    if (!res?.ok || !data?.code) {
      setError(data?.error ?? "Couldn't create the table.");
      setBusy(false);
      return;
    }
    router.push(`/table/${data.code}`);
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (/^[A-Z0-9]{5,8}$/.test(c)) router.push(`/table/${c}`);
    else setError("Codes are 5–8 letters and numbers.");
  };

  return (
    <section aria-labelledby="friends-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <h2 id="friends-heading" className="font-display text-[15px] font-semibold">
        Play with friends
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-text-secondary">
        Start a private table and send the code. Empty seats are filled with bots. Private games never change your rating.
      </p>

      {!signedIn ? (
        <Link href="/login" className="mt-3 block rounded-lg border border-border py-2 text-center text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary">
          Sign in to host a table
        </Link>
      ) : (
        <>
          <div className="mt-3 flex gap-1">
            {(Object.keys(MODES) as ModeId[]).map((id) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex-1 rounded-md py-1.5 text-[12px] transition ${id === mode ? "bg-white/10 font-medium" : "text-text-secondary hover:text-text-primary"}`}
              >
                {MODES[id].name}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px]">
            <span className="text-text-tertiary">Bots</span>
            {(Object.keys(BOT_LEVELS) as BotLevel[]).map((id) => (
              <button
                key={id}
                onClick={() => setBots(id)}
                className={`rounded-md px-2 py-1 transition ${id === bots ? "bg-white/10 font-medium" : "text-text-secondary hover:text-text-primary"}`}
              >
                {BOT_LEVELS[id].name}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="mt-2.5 w-full rounded-lg bg-gold py-2 font-display text-[13px] font-semibold text-surface-primary transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Creating table" : "Create table"}
          </button>
          <form onSubmit={join} className="mt-3 flex gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Have a code?"
              maxLength={8}
              aria-label="Table code"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-deep px-3 py-2 font-display text-[13px] font-semibold tracking-wider outline-none placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-text-tertiary focus:border-gold/60"
            />
            <button type="submit" className="rounded-lg border border-border px-3 text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary">
              Join
            </button>
          </form>
        </>
      )}
      {error && <p className="mt-2 text-[12px] text-[#EFA3A3]">{error}</p>}
    </section>
  );
}
