import { Avatar } from "@/components/ui/Avatar";
import { TagIcon } from "@/components/ui/TagIcon";
import type { Card } from "@/lib/engine/cards";
import type { PlayerState } from "@/lib/engine/game";
import { STARTING_STACK, formatHp } from "@/lib/engine/modes";
import { HP_TIER_COLORS, getHpTier } from "@/lib/hp";
import type { PlayerTag } from "@/lib/notes";
import { ordinal } from "@/lib/rating";
import { type ClockInfo, SeatTimer } from "./Clock";
import { PlayingCard } from "./PlayingCard";

interface SeatProps {
  player: PlayerState;
  isHero: boolean;
  isActing: boolean;
  sittingOut?: boolean;
  position?: string;
  bigBlind: number;
  /** Cards to show face up (hero always; others at showdown). */
  revealed: Card[] | null;
  /** Current made hand for revealed cards, e.g. "Pair of Sixes". */
  handLabel?: string | null;
  won?: { amount: number; hand: string | null };
  handNumber: number;
  clock?: ClockInfo | null;
  tag?: PlayerTag | null;
  selected?: boolean;
  onSelect?: (el: HTMLElement) => void;
  /** Dealer offset and per-card delays for the deal animation. */
  deal?: { dx: number; dy: number; delays: [number, number] };
}

function statusText(p: PlayerState, isActing: boolean, isHero: boolean, sittingOut: boolean): { text: string; tone: string } | null {
  if (p.eliminated) return { text: p.place ? `Out in ${ordinal(p.place)}` : "Out", tone: "text-text-tertiary" };
  if (sittingOut && !p.lastAction) return { text: "Sitting out", tone: "text-gold" };
  if (isActing) return { text: isHero ? "Your turn" : "Thinking", tone: "text-felt-light" };
  if (p.folded) return { text: "Folded", tone: "text-text-tertiary" };
  const a = p.lastAction;
  if (!a) return p.allIn ? { text: "All in", tone: "text-gold" } : null;
  const amount = formatHp(a.amount);
  if (a.allIn) return { text: `All in ${amount}`, tone: "text-gold" };
  switch (a.kind) {
    case "check":
      return { text: "Check", tone: "text-text-secondary" };
    case "call":
      return { text: `Call ${amount}`, tone: "text-text-primary" };
    case "bet":
      return { text: `Bet ${amount}`, tone: "text-gold" };
    case "raise":
      return { text: `Raise to ${amount}`, tone: "text-gold" };
    default:
      return null;
  }
}

export function Seat({
  player,
  isHero,
  isActing,
  sittingOut = false,
  position,
  bigBlind,
  revealed,
  handLabel,
  won,
  handNumber,
  clock,
  tag,
  selected = false,
  onSelect,
  deal,
}: SeatProps) {
  const bbs = player.stack / bigBlind;
  const tier = getHpTier(bbs);
  const fill = Math.min(1, player.stack / STARTING_STACK);
  const overflow = Math.max(0, player.stack - STARTING_STACK) / (STARTING_STACK * 7);
  const out = player.eliminated;
  const inactive = out || player.folded;
  // Folded opponents muck their cards; the hero keeps seeing theirs, dimmed.
  // Players knocked out this hand keep their revealed cards up so you can see what beat them.
  const dealt = player.holeCards.length > 0 && (isHero || !player.folded) && (!out || !!revealed);
  const status = statusText(player, isActing, isHero, sittingOut);

  const border = won
    ? "border-gold shadow-[0_0_0_1px_var(--gold),0_0_28px_rgba(229,185,106,0.35)]"
    : isActing
      ? "border-felt shadow-[0_0_0_1px_var(--felt),0_0_22px_rgba(31,111,74,0.45)]"
      : isHero
        ? "border-gold/60"
        : "border-border";

  const cardProps = (i: 0 | 1) =>
    deal ? { dealFrom: { dx: deal.dx, dy: deal.dy }, dealDelay: deal.delays[i] } : {};

  return (
    <div className={`relative flex flex-col items-center ${isHero ? "w-[176px]" : "w-[148px]"}`}>
      {/* Hole cards */}
      <div
        className={`relative z-0 flex items-end justify-center ${isHero ? "gap-1.5 -mb-2" : "gap-0.5 -mb-4"}`}
        style={{ height: isHero ? 92 : 62 }}
      >
        {dealt &&
          ([0, 1] as const).map((i) =>
            revealed ? (
              <PlayingCard
                key={`${handNumber}-${i}`}
                card={revealed[i]}
                size={isHero ? "lg" : "sm"}
                dimmed={player.folded}
                {...(isHero ? cardProps(i) : {})}
              />
            ) : (
              // Fan the face-down pair slightly so it reads as a hand, not two tiles.
              <div key={`${handNumber}-${i}`} style={{ rotate: `${i === 0 ? -8 : 8}deg`, translate: `${i === 0 ? 5 : -5}px 3px` }}>
                <PlayingCard faceDown size="sm" dimmed={player.folded} {...cardProps(i)} />
              </div>
            ),
          )}
      </div>

      <button
        type="button"
        onClick={(e) => onSelect?.(e.currentTarget)}
        aria-label={`${isHero ? "Your" : player.name + "'s"} player details`}
        aria-expanded={selected}
        className={`relative z-10 w-full cursor-pointer rounded-xl border bg-surface-deep/95 px-2.5 py-2 text-left backdrop-blur-sm transition-[border-color,box-shadow,opacity] duration-300 hover:bg-surface-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${border} ${
          inactive ? "opacity-55" : ""
        } ${selected ? "ring-1 ring-white/30" : ""}`}
      >
        {handLabel && dealt && (
          <span
            className={`absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-semibold shadow-md ${
              won ? "border-gold bg-gold text-surface-primary" : "border-white/15 bg-[#0B0D10] text-text-primary"
            }`}
          >
            {handLabel}
          </span>
        )}
        {position && !out && !handLabel && (
          <span
            className={`absolute -top-2 right-2 rounded border px-1.5 text-[9.5px] font-semibold leading-[15px] ${
              position === "BTN" ? "border-gold/40 bg-surface-deep text-gold" : "border-border bg-surface-deep text-text-secondary"
            }`}
          >
            {position}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Avatar name={player.name} size={isHero ? 34 : 28} dimmed={out} ring={isActing ? "felt" : "none"} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className={`truncate text-[12px] font-medium leading-tight ${isHero ? "text-gold" : "text-text-primary"}`}>
                {isHero ? "You" : player.name}
              </span>
              {tag && <TagIcon tag={tag} size={13} />}
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-[15px] font-semibold tabular-nums leading-tight"
                style={{ color: out ? "var(--text-tertiary)" : HP_TIER_COLORS[tier] }}
              >
                {formatHp(player.stack)}
              </span>
              {!out && <span className="text-[10px] tabular-nums text-text-tertiary">{Math.round(bbs)}bb</span>}
            </div>
          </div>
        </div>

        {/* HP bar */}
        <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" title={`${formatHp(player.stack)} HP`}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${fill * 100}%`, background: out ? "var(--border)" : HP_TIER_COLORS[tier] }}
          />
          {overflow > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gold/80 transition-[width] duration-500"
              style={{ width: `${Math.min(1, overflow) * 100}%`, height: 2, top: 0 }}
            />
          )}
        </div>

        <div className="mt-1 h-[14px] truncate text-[10.5px] leading-[14px]">
          {won ? (
            <span className="font-medium text-gold">+{formatHp(won.amount)}</span>
          ) : status ? (
            <span className={`${status.tone} ${isActing ? "animate-pulse" : ""}`}>{status.text}</span>
          ) : null}
        </div>
        {isActing && clock && <SeatTimer clock={clock} />}
      </button>
    </div>
  );
}
