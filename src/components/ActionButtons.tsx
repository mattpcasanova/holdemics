interface ActionButtonsProps {
  canCheck: boolean;
  callAmount?: number;
  betAmount?: number;
  onFold: () => void;
  onCheckCall: () => void;
  onBetRaise: () => void;
}

export function ActionButtons({
  canCheck,
  callAmount,
  betAmount,
  onFold,
  onCheckCall,
  onBetRaise,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onFold}
        className="flex-1 py-2.5 bg-red/15 border-[0.5px] border-red/40 rounded-md text-[#E89898] text-xs font-medium hover:bg-red/25 transition-colors"
      >
        Fold
      </button>
      <button
        onClick={onCheckCall}
        className="flex-1 py-2.5 bg-text-secondary/15 border-[0.5px] border-text-secondary/30 rounded-md text-text-primary text-xs font-medium hover:bg-text-secondary/25 transition-colors"
      >
        {canCheck ? "Check" : `Call ${callAmount}`}
      </button>
      <button
        onClick={onBetRaise}
        className="flex-[1.6] py-2.5 bg-gold border-[0.5px] border-gold rounded-md text-surface-primary text-xs font-medium hover:brightness-110 transition-all"
      >
        {betAmount ? `Bet ${betAmount}` : "Bet"}
      </button>
    </div>
  );
}
