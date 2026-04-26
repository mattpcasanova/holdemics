interface HeaderProps {
  variant: "lobby" | "table";
  handNumber?: number;
  orbit?: number;
  blinds?: { sb: number; bb: number };
  nextBlinds?: { sb: number; bb: number };
  handsUntilBlindUp?: number;
  pot?: number;
  onlineCount?: number;
  userInitials?: string;
}

export function Header({
  variant,
  handNumber,
  orbit,
  blinds,
  nextBlinds,
  handsUntilBlindUp,
  pot,
  onlineCount,
  userInitials = "MC",
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-deep border-b-[0.5px] border-border">
      <div className="flex items-center gap-3.5">
        {/* Logo */}
        <div
          className={`font-display font-medium flex items-center gap-1.5 tracking-tight ${
            variant === "lobby" ? "text-xl" : "text-sm"
          }`}
        >
          <div
            className={`rounded bg-felt inline-flex items-center justify-center text-gold font-medium ${
              variant === "lobby"
                ? "w-[22px] h-[22px] text-xs"
                : "w-4 h-4 text-[9px]"
            }`}
          >
            &#9824;
          </div>
          <span>holdemics</span>
        </div>

        {variant === "lobby" ? (
          <nav className="flex gap-4 text-[13px] text-text-secondary">
            <span className="text-text-primary font-medium">Play</span>
            <span>Learn</span>
            <span>Friends</span>
            <span>History</span>
          </nav>
        ) : (
          <span className="text-[11px] text-text-secondary">
            Standard &middot; Hand #{handNumber} &middot; Orbit {orbit}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3.5">
        {variant === "table" ? (
          <div className="flex gap-3.5 text-[11px] text-text-secondary">
            <span>
              Blinds{" "}
              <span className="text-text-primary">
                {blinds?.sb}/{blinds?.bb}
              </span>{" "}
              <span className="text-text-tertiary">
                &rarr; {nextBlinds?.sb}/{nextBlinds?.bb} in{" "}
                {handsUntilBlindUp}
              </span>
            </span>
            <span>
              Pot{" "}
              <span className="text-gold font-medium">{pot}</span>
            </span>
          </div>
        ) : (
          <>
            <span className="text-xs text-text-secondary">
              {onlineCount?.toLocaleString()} online
            </span>
            <div className="w-7 h-7 rounded-full bg-felt inline-flex items-center justify-center text-[11px] text-gold font-medium">
              {userInitials}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
