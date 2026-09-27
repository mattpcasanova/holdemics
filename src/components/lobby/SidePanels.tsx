import { Avatar } from "@/components/ui/Avatar";

export function ProfileCard() {
  return (
    <section aria-labelledby="profile-heading" className="rounded-xl border border-border bg-surface-primary p-4">
      <div className="flex items-center gap-3">
        <Avatar name="guest" size={40} />
        <div>
          <h2 id="profile-heading" className="text-[14px] font-medium">
            Guest
          </h2>
          <div className="text-[12px] text-text-tertiary">Unrated</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Standard", value: "—" },
          { label: "Turbo", value: "—" },
          { label: "Heads-Up", value: "—" },
        ].map((r) => (
          <div key={r.label} className="rounded-lg bg-surface-deep py-2">
            <div className="font-display text-[17px] font-semibold text-text-tertiary">{r.value}</div>
            <div className="text-[11px] text-text-tertiary">{r.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-text-tertiary">
        Each mode keeps its own rating. Your first 20 ranked games move it faster while it settles.
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
