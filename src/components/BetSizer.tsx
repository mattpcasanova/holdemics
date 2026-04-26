interface BetSizerProps {
  value: number;
  min: number;
  max: number;
  pot: number;
  onValueChange: (value: number) => void;
}

export function BetSizer({ value, min, max, pot, onValueChange }: BetSizerProps) {
  const quickFills = [
    { label: "\u00bd pot", amount: Math.floor(pot / 2) },
    { label: "\u00be pot", amount: Math.floor((pot * 3) / 4) },
    { label: "pot", amount: pot },
    { label: "all in", amount: max },
  ];

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] text-felt-light tracking-wide min-w-7">
          BET
        </span>
        <div className="flex-1 flex items-center bg-surface-deep/50 border-[0.5px] border-border rounded-md overflow-hidden">
          <button
            onClick={() => onValueChange(Math.max(min, value - 1))}
            className="px-2.5 py-2 text-text-secondary text-sm border-r-[0.5px] border-border hover:text-text-primary transition-colors"
          >
            &minus;
          </button>
          <div className="flex-1 text-center font-display text-base font-medium text-gold py-2 min-w-[60px]">
            {value}
          </div>
          <button
            onClick={() => onValueChange(Math.min(max, value + 1))}
            className="px-2.5 py-2 text-text-secondary text-sm border-l-[0.5px] border-border hover:text-text-primary transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-[10px] text-text-tertiary min-w-9 text-right">
          min {min}
        </span>
      </div>
      <div className="flex gap-1">
        {quickFills.map((qf) => (
          <button
            key={qf.label}
            onClick={() => onValueChange(Math.max(min, Math.min(max, qf.amount)))}
            className={`flex-1 py-1.5 text-[10px] rounded border-[0.5px] transition-colors ${
              qf.label === "all in"
                ? "bg-gold/10 border-gold/30 text-gold hover:bg-gold/20"
                : "bg-surface-deep/40 border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {qf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
