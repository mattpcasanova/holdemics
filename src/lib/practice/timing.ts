/**
 * Animation timings shared by the table and the sound cues, so a sound always
 * lands on the frame it belongs to.
 */

/** Gap between hole cards as the dealer pitches them around the table. */
export const DEAL_STAGGER_MS = 75;
/** Flight time of a pitched card. */
export const DEAL_FLY_MS = 480;
/** When the card-landing sound plays within a flight. */
export const DEAL_LAND_MS = 320;

/** Board cards on a normal street: slide in, then turn over. */
export const BOARD_DEAL_STAGGER_MS = 70;
export const BOARD_FLIP_DELAY_MS = 260;
export const BOARD_FLIP_STAGGER_MS = 110;
export const FLIP_MS = 460;
/** The flip sound plays as the card passes edge-on. */
export const FLIP_SOUND_OFFSET_MS = 140;

export function boardFlipDelay(i: number): number {
  return BOARD_FLIP_DELAY_MS + (i < 3 ? i * BOARD_FLIP_STAGGER_MS : 0);
}

/** Pot push: how long the pot sits after a hand ends, then how long the chips take to reach the winner. */
export const POT_HOLD_SHOWDOWN_MS = 900;
export const POT_HOLD_UNCONTESTED_MS = 300;
export const POT_MOVE_MS = 650;
