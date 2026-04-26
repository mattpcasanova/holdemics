interface DailyChallengeProps {
  title: string;
  reward: string;
  progress: number;
  total: number;
}

export function DailyChallenge({
  title,
  reward,
  progress,
  total,
}: DailyChallengeProps) {
  return (
    <div className="bg-surface-card border-[0.5px] border-border rounded-lg p-3.5">
      <div className="text-[11px] text-text-secondary tracking-widest font-medium mb-2.5">
        DAILY CHALLENGE
      </div>
      <div className="font-display text-sm text-text-primary font-medium mb-1">
        {title}
      </div>
      <div className="text-[11px] text-text-secondary leading-snug mb-2.5">
        Reward: {reward}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-sm ${
              i < progress ? "bg-felt" : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="text-[10px] text-text-tertiary mt-1.5">
        {progress} of {total}
      </div>
    </div>
  );
}
