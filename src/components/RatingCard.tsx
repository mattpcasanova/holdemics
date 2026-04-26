interface RatingCardProps {
  username: string;
  initials: string;
  rank: string;
  percentile: string;
  rating: number;
  ratingChange: number;
  changePeriod: string;
  gamesPlayed: number;
  itmRate: string;
  bestRating: number;
}

export function RatingCard({
  username,
  initials,
  rank,
  percentile,
  rating,
  ratingChange,
  changePeriod,
  gamesPlayed,
  itmRate,
  bestRating,
}: RatingCardProps) {
  return (
    <div className="bg-surface-card border-[0.5px] border-border rounded-lg p-3.5 mb-3">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full bg-felt inline-flex items-center justify-center text-xs text-gold font-medium">
          {initials}
        </div>
        <div>
          <div className="text-[13px] text-text-primary font-medium">
            {username}
          </div>
          <div className="text-[10px] text-text-secondary">
            {rank} &middot; {percentile}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1">
        <div className="font-display text-[28px] font-medium text-gold tracking-tight">
          {rating.toLocaleString()}
        </div>
        <div className="text-[11px] text-felt font-medium">
          +{ratingChange} ({changePeriod})
        </div>
      </div>

      <div className="flex gap-3 mt-3 pt-2.5 border-t-[0.5px] border-border">
        <div>
          <div className="text-[10px] text-text-secondary">Played</div>
          <div className="text-[13px] text-text-primary font-medium">
            {gamesPlayed}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary">ITM rate</div>
          <div className="text-[13px] text-text-primary font-medium">
            {itmRate}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary">Best</div>
          <div className="text-[13px] text-text-primary font-medium">
            {bestRating.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
