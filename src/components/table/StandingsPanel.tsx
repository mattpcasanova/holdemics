import { Avatar } from "@/components/ui/Avatar";
import { type GameState, standings } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { evenLobbyPayouts } from "@/lib/rating";

interface StandingsPanelProps {
  game: GameState;
  heroIndex: number;
}

export function StandingsPanel({ game, heroIndex }: StandingsPanelProps) {
  const order = standings(game);
  const n = game.players.length;
  const payouts = evenLobbyPayouts(n);
  const cutoff = Math.floor(n / 2);

  return (
    <section aria-labelledby="standings-heading" className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="standings-heading" className="font-display text-[14px] font-semibold">
          Standings
        </h2>
        <span className="text-[11px] text-text-tertiary">Rating if ranked</span>
      </div>
      <ol className="flex flex-col">
        {order.map((idx, k) => {
          const p = game.players[idx];
          const place = k + 1;
          const isHero = idx === heroIndex;
          const delta = payouts[k];
          return (
            <li key={p.id}>
              {k === cutoff && (
                <div className="my-1.5 flex items-center gap-2 text-[10px] text-text-tertiary">
                  <div className="h-px flex-1 bg-border" />
                  <span>gain above · lose below</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${isHero ? "bg-gold/[0.07]" : ""} ${
                  p.eliminated ? "opacity-50" : ""
                }`}
              >
                <span
                  className={`w-4 text-center font-display text-[12px] font-semibold tabular-nums ${
                    k < cutoff ? "text-gold" : "text-red-muted"
                  }`}
                >
                  {place}
                </span>
                <Avatar name={p.name} size={20} dimmed={p.eliminated} />
                <span className={`min-w-0 flex-1 truncate text-[12px] ${isHero ? "font-medium text-gold" : "text-text-primary"}`}>
                  {isHero ? "You" : p.name}
                </span>
                <span className="font-display text-[12px] font-semibold tabular-nums text-text-primary">
                  {p.eliminated ? "out" : formatHp(p.stack + p.totalBet)}
                </span>
                <span
                  className={`w-7 text-right text-[10px] tabular-nums ${delta > 0 ? "text-felt-light" : "text-red-muted"}`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
