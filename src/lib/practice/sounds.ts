import { type SoundName, play } from "../audio";
import { type GameState, type LogEvent, alivePlayers } from "../engine/game";
import { runoutSchedule } from "./runout";
import { BOARD_DEAL_STAGGER_MS, DEAL_LAND_MS, DEAL_STAGGER_MS, FLIP_SOUND_OFFSET_MS, boardFlipDelay } from "./timing";

/**
 * Sound cues for newly appended log events. Runout streets are cued by
 * `playRunoutSounds`, and the win sound plays with the pot-push animation.
 */
export function playEventSounds(events: LogEvent[], state: GameState, runout: boolean) {
  for (const e of events) {
    let name: SoundName | null = null;
    switch (e.kind) {
      case "hand": {
        const dealt = alivePlayers(state).length * 2;
        for (let i = 0; i < dealt; i++) play("deal", i * DEAL_STAGGER_MS + DEAL_LAND_MS);
        break;
      }
      case "level":
        name = "levelUp";
        break;
      case "action":
        name = e.allIn ? "allIn" : e.action === "raise" ? "bet" : e.action;
        break;
      case "street":
        if (!runout) {
          e.cards.forEach((_, i) => {
            play("deal", i * BOARD_DEAL_STAGGER_MS);
            play("flip", boardFlipDelay(i) + FLIP_SOUND_OFFSET_MS);
          });
        }
        break;
    }
    if (name) play(name);
  }
}

/** Deal and flip cues for each street of an all-in runout, timed from its start. */
export function playRunoutSounds(from: number, startedAt: number) {
  const { cards } = runoutSchedule(from);
  const elapsed = Date.now() - startedAt;
  for (const c of Object.values(cards)) {
    play("deal", Math.max(0, c.dealAt - elapsed + 120));
    play("flip", Math.max(0, c.flipAt - elapsed + (c.dramatic ? 300 : FLIP_SOUND_OFFSET_MS)));
  }
}

/** The "your turn" chime, delayed past the deal animation at the start of a hand. */
export function playYourTurn(state: GameState, newHand: boolean) {
  play("yourTurn", newHand ? alivePlayers(state).length * 2 * DEAL_STAGGER_MS : 0);
}
