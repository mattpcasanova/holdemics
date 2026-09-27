"use client";

import { useEffect, useRef } from "react";
import { type Card, isRedSuit, rankLabel } from "@/lib/engine/cards";
import type { LogEvent, PlayerState } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { ordinal } from "@/lib/rating";
import type { HandHistory } from "@/hooks/usePracticeGame";

const GLYPH = { s: "♠", h: "♥", d: "♦", c: "♣" } as const;

function CardText({ cards }: { cards: Card[] }) {
  return (
    <span className="font-medium">
      {cards.map((c, i) => (
        <span key={i} className={isRedSuit(c.suit) ? "text-[#E07A7A]" : "text-text-primary"}>
          {rankLabel(c.rank)}
          {GLYPH[c.suit]}
          {i < cards.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

function Line({ event, name }: { event: LogEvent; name: (i: number) => React.ReactNode }) {
  switch (event.kind) {
    case "hand":
      return (
        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-text-tertiary first:mt-0">
          <span>Hand {event.hand}</span>
          <div className="h-px flex-1 bg-border" />
          <span>
            {formatHp(event.blinds.sb)}/{formatHp(event.blinds.bb)}
          </span>
        </div>
      );
    case "level":
      return (
        <div className="text-gold">
          Blinds up to {formatHp(event.blinds.sb)}/{formatHp(event.blinds.bb)}
        </div>
      );
    case "post":
      return (
        <div>
          {name(event.player)} posts {event.blind} {formatHp(event.amount)}
        </div>
      );
    case "action": {
      const verb = {
        fold: "folds",
        check: "checks",
        call: `calls ${formatHp(event.amount)}`,
        bet: `bets ${formatHp(event.amount)}`,
        raise: `raises to ${formatHp(event.amount)}`,
      }[event.action];
      return (
        <div>
          {name(event.player)} {verb}
          {event.allIn && <span className="text-gold"> · all in</span>}
        </div>
      );
    }
    case "street":
      return (
        <div className="text-text-tertiary">
          {event.street[0].toUpperCase() + event.street.slice(1)} <CardText cards={event.cards} />
        </div>
      );
    case "return":
      return (
        <div className="text-text-tertiary">
          {formatHp(event.amount)} returned to {name(event.player)}
        </div>
      );
    case "show":
      return (
        <div>
          {name(event.player)} shows {event.hand}
        </div>
      );
    case "win":
      return (
        <div className="text-felt-light">
          {name(event.player)} wins <span className="text-gold">{formatHp(event.amount)}</span>
          {event.hand ? ` with ${event.hand}` : ""}
        </div>
      );
    case "bust":
      return (
        <div className="text-red-muted">
          {name(event.player)} is out in {ordinal(event.place)}
        </div>
      );
  }
}

export function HandLog({ history, players, heroIndex }: { history: HandHistory[]; players: PlayerState[]; heroIndex: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [history]);

  const name = (i: number) =>
    i === heroIndex ? <span className="font-medium text-gold">You</span> : <span className="text-text-primary">{players[i]?.name}</span>;

  return (
    <section aria-labelledby="log-heading" className="flex min-h-0 flex-1 flex-col border-t border-border">
      <h2 id="log-heading" className="px-4 pb-2 pt-3 font-display text-[14px] font-semibold">
        Hand history
      </h2>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-[12px] leading-relaxed text-text-secondary">
        {history.length === 0 && <p className="text-text-tertiary">Hands will appear here once the deal starts.</p>}
        {history.map((h) => h.events.map((e, i) => <Line key={`${h.hand}-${i}`} event={e} name={name} />))}
      </div>
    </section>
  );
}
