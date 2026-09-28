import Link from "next/link";
import type { PracticeGame } from "@/lib/account";
import { BOT_LEVELS } from "@/lib/engine/bots";
import { MODES } from "@/lib/engine/modes";
import { ordinal } from "@/lib/rating";

function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function RecentGames({ games, signedIn, now }: { games: PracticeGame[]; signedIn: boolean; now: number }) {
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="mb-3 font-display text-[20px] font-semibold tracking-tight">
        Recent games
      </h2>
      {!signedIn ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-[13px] text-text-secondary">
          <Link href="/signup" className="font-medium text-gold hover:underline">
            Create an account
          </Link>{" "}
          to keep a history of your games.
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-[13px] text-text-secondary">
          Finish a practice game and it will show up here.
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-border bg-surface-primary">
          {games.map((g, i) => {
            const top = g.place <= Math.floor(g.players / 2);
            return (
              <li key={g.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-semibold ${
                    g.place === 1 ? "bg-gold text-surface-primary" : top ? "bg-gold/15 text-gold" : "bg-red/15 text-red-muted"
                  }`}
                >
                  {ordinal(g.place)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {MODES[g.mode].name} vs {BOT_LEVELS[g.bot_level].name} {g.players === 2 ? "bot" : "bots"}
                  </div>
                  <div className="text-[12px] text-text-tertiary">
                    {g.players} players, {g.hands} {g.hands === 1 ? "hand" : "hands"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-text-tertiary">Practice</div>
                  <div className="text-[12px] text-text-tertiary">{timeAgo(g.played_at, now)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
