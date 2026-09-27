"use client";

import { useEffect, useRef } from "react";
import { type Card, rankLabel } from "@/lib/engine/cards";
import type { LogEvent, PlayerState, Street } from "@/lib/engine/game";
import { formatHp } from "@/lib/engine/modes";
import { ordinal } from "@/lib/rating";
import type { HandHistory } from "@/hooks/usePracticeGame";

const GLYPH = { s: "♠", h: "♥", d: "♦", c: "♣" } as const;
const SUIT_INK = { s: "#E8EAED", h: "#E0797B", d: "#6FA2E6", c: "#6CC08F" } as const;

type SectionId = Street | "result";

const SECTION_STYLE: Record<SectionId, { label: string; color: string }> = {
  preflop: { label: "Preflop", color: "#8A9098" },
  flop: { label: "Flop", color: "#4FA877" },
  turn: { label: "Turn", color: "#5B9BD9" },
  river: { label: "River", color: "#E5B96A" },
  result: { label: "Result", color: "#9FCFB6" },
};

interface Section {
  id: SectionId;
  cards: Card[];
  events: LogEvent[];
}

/** Split one hand's events into preflop / flop / turn / river / result sections. */
function sections(events: LogEvent[]): { header: LogEvent | undefined; levelUp: boolean; sections: Section[] } {
  const out: Section[] = [{ id: "preflop", cards: [], events: [] }];
  let header: LogEvent | undefined;
  let levelUp = false;
  for (const e of events) {
    if (e.kind === "hand") header = e;
    else if (e.kind === "level") levelUp = true;
    else if (e.kind === "street") out.push({ id: e.street, cards: e.cards, events: [] });
    else if (e.kind === "show" || e.kind === "win" || e.kind === "bust") {
      if (out[out.length - 1].id !== "result") out.push({ id: "result", cards: [], events: [] });
      out[out.length - 1].events.push(e);
    } else out[out.length - 1].events.push(e);
  }
  return { header, levelUp, sections: out.filter((s) => s.events.length || s.cards.length) };
}

function CardText({ cards }: { cards: Card[] }) {
  return (
    <span className="inline-flex gap-1 font-display text-[12px] font-semibold">
      {cards.map((c, i) => (
        <span key={i} className="rounded bg-white/[0.06] px-1" style={{ color: SUIT_INK[c.suit] }}>
          {rankLabel(c.rank)}
          {GLYPH[c.suit]}
        </span>
      ))}
    </span>
  );
}

/** "You raise" vs "sam raises". */
function conj(hero: boolean, verb: string): string {
  if (!hero) return verb;
  if (verb === "is") return "are";
  return verb.endsWith("es") && /(sh|ch|ss|x)es$/.test(verb) ? verb.slice(0, -2) : verb.slice(0, -1);
}

function Line({ event, name, heroIndex }: { event: LogEvent; name: (i: number) => React.ReactNode; heroIndex: number }) {
  const v = (player: number, verb: string) => conj(player === heroIndex, verb);
  switch (event.kind) {
    case "post":
      return (
        <div className="text-text-tertiary">
          {name(event.player)} {v(event.player, "posts")} {event.blind} {formatHp(event.amount)}
        </div>
      );
    case "action": {
      const p = event.player;
      const verb = {
        fold: v(p, "folds"),
        check: v(p, "checks"),
        call: `${v(p, "calls")} ${formatHp(event.amount)}`,
        bet: `${v(p, "bets")} ${formatHp(event.amount)}`,
        raise: `${v(p, "raises")} to ${formatHp(event.amount)}`,
      }[event.action];
      const aggressive = event.action === "bet" || event.action === "raise";
      return (
        <div className={event.action === "fold" ? "text-text-tertiary" : ""}>
          {name(event.player)} <span className={aggressive ? "text-gold" : ""}>{verb}</span>
          {event.allIn && <span className="font-medium text-gold"> · all in</span>}
        </div>
      );
    }
    case "return":
      return (
        <div className="text-text-tertiary">
          {formatHp(event.amount)} returned to {name(event.player)}
        </div>
      );
    case "show":
      return (
        <div>
          {name(event.player)} {v(event.player, "shows")} {event.hand}
        </div>
      );
    case "win":
      return (
        <div className="text-felt-light">
          {name(event.player)} {v(event.player, "wins")} <span className="font-semibold text-gold">{formatHp(event.amount)}</span>
          {event.hand ? ` with ${event.hand}` : ""}
        </div>
      );
    case "bust":
      return (
        <div className="text-red-muted">
          {name(event.player)} {v(event.player, "is")} out in {ordinal(event.place)}
        </div>
      );
    default:
      return null;
  }
}

export function HandLog({ history, players, heroIndex }: { history: HandHistory[]; players: PlayerState[]; heroIndex: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  const name = (i: number) =>
    i === heroIndex ? <span className="font-medium text-gold">You</span> : <span className="text-text-primary">{players[i]?.name}</span>;

  return (
    <section aria-labelledby="log-heading" className="flex min-h-0 flex-1 flex-col border-t border-border">
      <h2 id="log-heading" className="px-4 pb-2 pt-3 font-display text-[14px] font-semibold">
        Hand history
      </h2>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 text-[12px] leading-relaxed text-text-secondary">
        {history.length === 0 && <p className="px-1 text-text-tertiary">Hands will appear here once the deal starts.</p>}
        {history.map((h) => {
          const { header, levelUp, sections: parts } = sections(h.events);
          return (
            <article key={h.hand} className="mb-2.5 rounded-lg border border-border bg-surface-primary/60 px-2.5 py-2">
              <header className="mb-1.5 flex items-baseline justify-between">
                <span className="font-display text-[12.5px] font-semibold text-text-primary">Hand {h.hand}</span>
                {header?.kind === "hand" && (
                  <span className={`text-[11px] tabular-nums ${levelUp ? "text-gold" : "text-text-tertiary"}`}>
                    {levelUp ? "Blinds up · " : ""}
                    {formatHp(header.blinds.sb)}/{formatHp(header.blinds.bb)}
                  </span>
                )}
              </header>
              {parts.map((sec, k) => {
                const style = SECTION_STYLE[sec.id];
                return (
                  <div key={k} className="mt-1.5 first:mt-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span
                        className="rounded px-1.5 text-[10px] font-semibold leading-[16px]"
                        style={{ color: style.color, background: `${style.color}1f` }}
                      >
                        {style.label}
                      </span>
                      {sec.cards.length > 0 && <CardText cards={sec.cards} />}
                    </div>
                    {sec.events.length > 0 && (
                      <div className="ml-1 border-l-2 pl-2.5" style={{ borderColor: `${style.color}55` }}>
                        {sec.events.map((e, i) => (
                          <Line key={i} event={e} name={name} heroIndex={heroIndex} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
    </section>
  );
}
