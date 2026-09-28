import type { BotLevel } from "../engine/bots";
import type { SeatInfo } from "../engine/game";

const NAMES = [
  "river_rat", "nutsy", "checkraise_carl", "felt_ghost", "pocket_rox",
  "lady_luck", "the_grinder", "bluffalo", "ace_ventura", "tilt_tanya",
  "donk_hunter", "sixseven", "cold_deck", "gutshot_gus", "blind_bob",
  "slowroll_sal", "overbet_olly", "nit_nancy", "suited_sam", "whale_watch",
];

export function botSeats(count: number, level: BotLevel, rng: () => number = Math.random, avoid: Set<string> = new Set()): SeatInfo[] {
  const pool = NAMES.filter((n) => !avoid.has(n));
  const seats: SeatInfo[] = [];
  for (let i = 0; i < count; i++) {
    const [name] = pool.splice(Math.floor(rng() * pool.length), 1);
    seats.push({ id: `bot-${level}-${i}`, name, isBot: true });
  }
  return seats;
}
