import { Avatar } from "@/components/ui/Avatar";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import { Sparkline } from "@/components/ui/Sparkline";
import type { Account } from "@/lib/account";
import type { ModeId } from "@/lib/engine/modes";
import { placementGames } from "@/lib/rating";
import { UNRANKED, nextTier, tierFor } from "@/lib/tiers";

const RATED_MODES: { id: ModeId; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "turbo", label: "Turbo" },
  { id: "headsup", label: "Heads-Up" },
];


export function ProfileCard({ account }: { account: Account | null }) {
  const name = account?.profile.username ?? "Guest";
  const byMode = new Map(account?.ratings.map((r) => [r.mode, r]));
  return (
    <section aria-labelledby="profile-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <div className="flex items-center gap-3">
        <Avatar name={account ? name : "guest"} avatar={account?.profile.avatar} size={40} />
        <div className="min-w-0">
          <h2 id="profile-heading" className="truncate text-[14px] font-medium">
            {name}
          </h2>
          <PlayerTitle id={account?.profile.title} />
          <div className="text-[12px] text-text-tertiary">
            {account ? `${account.ratings.reduce((n, r) => n + r.games, 0)} ranked games` : "Unrated"}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {RATED_MODES.map((m) => {
          const r = byMode.get(m.id);
          const needed = placementGames(m.id);
          const placed = r ? Math.min(r.games, needed) : 0;
          const tier = r ? tierFor(m.id, r.rating, r.games, r.rank) : UNRANKED;
          const next = r ? nextTier(tier, r.rating) : null;
          return (
            <div key={m.id} className="rounded-lg bg-surface-deep px-2 py-2">
              <div className={`font-display text-[17px] font-semibold tabular-nums ${r ? "text-text-primary" : "text-text-tertiary"}`}>
                {r ? r.rating : "—"}
              </div>
              <div className="text-[11px] text-text-tertiary">{m.label}</div>
              {account?.trend[m.id] && account.trend[m.id]!.length >= 2 && (
                <div className="mt-1 flex justify-center">
                  <Sparkline values={account.trend[m.id]!} width={64} height={18} label={`${m.label} rating over recent games`} />
                </div>
              )}
              {r && tier !== UNRANKED && (
                <div
                  className="mt-1 truncate text-[11px] font-semibold"
                  style={{ color: tier.color }}
                  title={next ? `${next.pointsAway} to ${next.tier.name}` : tier.blurb}
                >
                  {tier.name}
                  {r.rank !== null && r.rank <= 50 ? ` · #${r.rank}` : ""}
                </div>
              )}
              {r && placed < needed && (
                <div
                  className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-label={`${m.label} placement games`}
                  aria-valuenow={placed}
                  aria-valuemax={needed}
                >
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(placed / needed) * 100}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-text-tertiary">
        {account
          ? "Everyone starts at 1500 and is Unranked through placement: 10 games in 8-max modes, 20 in Heads-Up. Then you earn a tier, from Fish up to The Nuts."
          : "Each mode keeps its own rating, and it settles after a few placement games."}
      </p>
    </section>
  );
}

export function RulesCard() {
  const rules = [
    { title: "HP is your stack", body: "Start with 100 HP. Win pots to take HP from others; hit zero and you're out." },
    { title: "Beat the clock", body: "Each decision is timed, with a small time bank for tough spots." },
    { title: "Blinds climb every orbit", body: "A level lasts one trip of the button around the table, so it speeds up as players bust." },
    { title: "Placement sets rating", body: "Top half gains, bottom half loses. Beating a stronger table is worth more." },
  ];
  return (
    <section aria-labelledby="rules-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <h2 id="rules-heading" className="font-display text-[15px] font-semibold">
        How it works
      </h2>
      <dl className="mt-2 flex flex-col gap-2.5">
        {rules.map((r) => (
          <div key={r.title}>
            <dt className="text-[13px] font-medium">{r.title}</dt>
            <dd className="text-[12.5px] leading-snug text-text-secondary">{r.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
