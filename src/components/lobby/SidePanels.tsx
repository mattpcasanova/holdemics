import { Avatar } from "@/components/ui/Avatar";
import type { Account } from "@/lib/account";
import type { ModeId } from "@/lib/engine/modes";

const RATED_MODES: { id: ModeId; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "turbo", label: "Turbo" },
  { id: "headsup", label: "Heads-Up" },
];

/** Placement games before a rating settles. Multi-player games carry more information per game. */
const PLACEMENT_GAMES: Record<ModeId, number> = { standard: 10, turbo: 10, headsup: 20 };

export function ProfileCard({ account }: { account: Account | null }) {
  const name = account?.profile.username ?? "Guest";
  const byMode = new Map(account?.ratings.map((r) => [r.mode, r]));
  return (
    <section aria-labelledby="profile-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <div className="flex items-center gap-3">
        <Avatar name={account ? name : "guest"} size={40} />
        <div className="min-w-0">
          <h2 id="profile-heading" className="truncate text-[14px] font-medium">
            {name}
          </h2>
          <div className="text-[12px] text-text-tertiary">{account ? "Ranked play opens soon" : "Unrated"}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {RATED_MODES.map((m) => {
          const r = byMode.get(m.id);
          const needed = PLACEMENT_GAMES[m.id];
          const placed = r ? Math.min(r.games, needed) : 0;
          return (
            <div key={m.id} className="rounded-lg bg-surface-deep px-2 py-2">
              <div className={`font-display text-[17px] font-semibold tabular-nums ${r ? "text-text-primary" : "text-text-tertiary"}`}>
                {r ? r.rating : "—"}
              </div>
              <div className="text-[11px] text-text-tertiary">{m.label}</div>
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
          ? "Everyone starts at 1500. Ratings move faster during placement: 10 games in 8-max modes, 20 in Heads-Up."
          : "Each mode keeps its own rating, and it settles after a few placement games."}
      </p>
    </section>
  );
}

export function FriendsCard() {
  return (
    <section aria-labelledby="friends-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <h2 id="friends-heading" className="font-display text-[15px] font-semibold">
        Friends
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-text-secondary">
        Add friends to invite them to private tables. Private games are unrated, so nobody can farm rating off a friend.
      </p>
      <button disabled className="mt-3 w-full cursor-not-allowed rounded-lg border border-border py-2 text-[13px] text-text-tertiary">
        Add friends after sign-in
      </button>
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
