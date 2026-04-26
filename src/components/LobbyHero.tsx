const PAYOUTS = [
  { place: "1st", change: "+30", gold: true },
  { place: "2nd", change: "+15", gold: true },
  { place: "3rd", change: "+5", gold: true },
  { place: "4th", change: "-5", gold: false },
  { place: "5th", change: "-15", gold: false },
  { place: "6th", change: "-30", gold: false },
];

export function LobbyHero() {
  return (
    <div
      className="rounded-[10px] p-[18px_20px] mb-3.5 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, var(--felt) 0%, var(--felt-deep) 100%)",
      }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] text-green-light-text tracking-wide mb-1">
            6-max placement poker
          </div>
          <div className="font-display text-[22px] font-medium text-white mb-0.5 tracking-tight">
            Quick play
          </div>
          <div className="text-xs text-felt-light">Average wait: 12s</div>
        </div>
        <button className="bg-gold text-surface-primary px-4 py-2 rounded-md text-[13px] font-medium hover:brightness-110 transition-all">
          Find table &rarr;
        </button>
      </div>

      <div className="flex gap-1.5 mt-3.5 pt-3 border-t border-white/10">
        {PAYOUTS.map((p, i) => (
          <div key={p.place} className="flex items-center gap-1 text-[10px]">
            {i > 0 && (
              <span className="text-felt-muted mr-1">&middot;</span>
            )}
            <span className={p.gold ? "text-gold font-medium" : "text-red-muted"}>
              {p.place}
            </span>
            <span className={p.gold ? "text-felt-light" : "text-red-muted"}>
              {p.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
