import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { getAccount } from "@/lib/account";
import { type ModeId, MODES } from "@/lib/engine/modes";
import { placementGames } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";
import { TOP_TIER_CUT, tierFor } from "@/lib/tiers";

export const metadata: Metadata = { title: "Leaderboard · Holdemics" };

const MODE_ORDER: ModeId[] = ["headsup", "standard", "turbo"];

interface Row {
  user_id: string;
  rating: number;
  peak: number;
  games: number;
  profiles: { username: string; title: string | null; avatar: string } | null;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const mode = (MODE_ORDER.includes(params.mode as ModeId) ? params.mode : "headsup") as ModeId;
  const [account, supabase] = await Promise.all([getAccount(), createClient()]);
  const { data } = await supabase
    .from("ratings")
    .select("user_id, rating, peak, games, profiles(username, title, avatar)")
    .eq("mode", mode)
    .gte("games", placementGames(mode))
    .order("rating", { ascending: false })
    .limit(TOP_TIER_CUT);
  const rows = (data ?? []) as unknown as Row[];
  const mine = account?.ratings.find((r) => r.mode === mode);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Leaderboard" profile={account?.profile ?? null} />
      <MobileTopBar profile={account?.profile ?? null} />
      <div className="mx-auto w-full max-w-[880px] p-4 sm:p-6">
        <h1 className="mb-1 font-display text-[28px] font-semibold tracking-tight">Leaderboard</h1>
        <p className="mb-5 text-[14px] text-text-secondary">
          The top {TOP_TIER_CUT} in each mode hold The Nuts. Players appear once their placement games are done.
        </p>

        <div role="tablist" aria-label="Mode" className="mb-4 inline-flex rounded-lg border border-border bg-surface-deep p-1">
          {MODE_ORDER.map((id) => (
            <Link
              key={id}
              role="tab"
              aria-selected={id === mode}
              href={`/leaderboard?mode=${id}`}
              className={`rounded-md px-3.5 py-1.5 text-[13px] transition ${id === mode ? "bg-white/10 font-medium text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
            >
              {MODES[id].name}
            </Link>
          ))}
        </div>

        {mine && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/[0.05] px-4 py-3 text-[13px]">
            <span>
              You: <span className="font-display text-[15px] font-semibold tabular-nums">{mine.rating}</span>
              {mine.rank !== null && mine.games >= placementGames(mode) ? ` · #${mine.rank}` : ""}
            </span>
            <span className="text-text-secondary">
              {mine.games >= placementGames(mode)
                ? tierFor(mode, mine.rating, mine.games, mine.rank).name
                : `${placementGames(mode) - mine.games} placement games to go`}
            </span>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-text-secondary">
            Nobody has finished placement in {MODES[mode].name} yet. Play {placementGames(mode)} ranked games to be first.
          </div>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-border bg-surface-primary">
            {rows.map((r, i) => {
              const tier = tierFor(mode, r.rating, r.games, i + 1);
              const isMe = r.user_id === account?.profile.id;
              return (
                <li key={r.user_id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""} ${isMe ? "bg-gold/[0.06]" : ""}`}>
                  <span className={`w-7 text-center font-display text-[14px] font-semibold tabular-nums ${i < 3 ? "text-gold" : "text-text-tertiary"}`}>{i + 1}</span>
                  <Avatar name={r.profiles?.username ?? "?"} avatar={r.profiles?.avatar} size={28} />
                  <span className="min-w-0 flex-1">
                    {r.profiles ? (
                      <Link href={`/u/${r.profiles.username}`} className={`block truncate text-[13.5px] hover:underline ${isMe ? "font-medium text-gold" : ""}`}>
                        {r.profiles.username}
                      </Link>
                    ) : (
                      <span className="block truncate text-[13.5px]">unknown</span>
                    )}
                    <PlayerTitle id={r.profiles?.title} size={9} />
                  </span>
                  <span className="text-[11.5px] font-semibold" style={{ color: tier.color }}>
                    {tier.name}
                  </span>
                  <span className="w-16 text-right text-[11.5px] text-text-tertiary">{r.games} games</span>
                  <span className="w-14 text-right font-display text-[15px] font-semibold tabular-nums">{r.rating}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
