import Link from "next/link";
import type { GameState } from "@/lib/engine/game";
import { MODES } from "@/lib/engine/modes";
import { evenLobbyPayouts, ordinal } from "@/lib/rating";

interface ResultOverlayProps {
  game: GameState;
  heroIndex: number;
  finished: boolean;
  onWatch: () => void;
  onSkip: () => void;
  onPlayAgain: () => void;
  /** Live table: no skipping ahead, and "play again" isn't offered. */
  online?: boolean;
  /** Ranked: the real change once the server has written it; undefined while pending. */
  ranked?: { change?: { before: number; after: number } };
}

export function ResultOverlay({ game, heroIndex, finished, onWatch, onSkip, onPlayAgain, online = false, ranked }: ResultOverlayProps) {
  const hero = game.players[heroIndex];
  const place = hero.place ?? 1;
  const n = game.players.length;
  const delta = evenLobbyPayouts(n)[place - 1];
  const won = place === 1;
  const top = place <= Math.floor(n / 2);
  const winner = game.players.find((p) => p.place === 1);

  const headline = won ? "You won the table" : top ? "Finished above the line" : "Knocked out";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface-page/70 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-labelledby="result-title"
        className="w-[360px] rounded-2xl border border-border bg-surface-primary p-6 text-center shadow-2xl"
        style={{ animation: "pop-in 280ms ease-out both" }}
      >
        <div
          className={`mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full font-display text-[30px] font-bold ${
            won ? "bg-gold text-surface-primary" : top ? "bg-gold/15 text-gold" : "bg-red/15 text-red-muted"
          }`}
        >
          {ordinal(place)}
        </div>
        <h2 id="result-title" className="font-display text-[22px] font-semibold tracking-tight">
          {headline}
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">
          {MODES[game.mode].name} {online ? "table" : "practice"}, {n} players, {game.handNumber} {game.handNumber === 1 ? "hand" : "hands"}.
          {finished && !won && winner ? ` ${winner.name} took it down.` : ""}
        </p>

        <div className="mt-4 rounded-lg border border-border bg-surface-deep px-4 py-3 text-left">
          {ranked ? (
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-text-secondary">Rating</span>
              {ranked.change ? (
                <span className="font-display text-[15px] font-semibold tabular-nums">
                  <span className="text-text-tertiary">{ranked.change.before} → </span>
                  {ranked.change.after}{" "}
                  <span className={ranked.change.after >= ranked.change.before ? "text-felt-light" : "text-red-muted"}>
                    ({ranked.change.after >= ranked.change.before ? "+" : ""}
                    {ranked.change.after - ranked.change.before})
                  </span>
                </span>
              ) : (
                <span className="text-[13px] text-text-tertiary">{finished ? "Updating…" : "Set when the game ends"}</span>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-text-secondary">Rating change</span>
                <span className="font-display text-[15px] font-semibold text-text-tertiary">Unrated</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-text-tertiary">
                In an even ranked lobby, {ordinal(place)} would be{" "}
                <span className={delta > 0 ? "text-felt-light" : "text-red-muted"}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                .
              </p>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {finished && online ? null : finished ? (
            <button
              onClick={onPlayAgain}
              className="rounded-lg bg-gold py-2.5 font-display text-[14px] font-semibold text-surface-primary transition hover:brightness-110"
            >
              Play again
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onWatch}
                className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-text-primary transition hover:bg-white/5"
              >
                Watch the rest
              </button>
              {!online && (
                <button
                  onClick={onSkip}
                  className="flex-1 rounded-lg bg-gold py-2.5 font-display text-[14px] font-semibold text-surface-primary transition hover:brightness-110"
                >
                  Skip to results
                </button>
              )}
            </div>
          )}
          <Link href="/" className="py-1.5 text-[13px] text-text-secondary transition hover:text-text-primary">
            Back to lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
