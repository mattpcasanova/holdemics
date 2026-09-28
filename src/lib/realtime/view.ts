import type { GameState } from "../engine/game";

/**
 * A copy of the game state safe to send to one player: only their own hole
 * cards, plus everyone's at showdown, and never the deck.
 */
export function redactGame(state: GameState, viewer: number | null): GameState {
  const showdown = state.result?.showdown ? state.result.hands : null;
  return {
    ...state,
    deck: [],
    players: state.players.map((p, i) => {
      const visible = i === viewer || (showdown !== null && showdown[i] !== undefined);
      return visible ? p : { ...p, holeCards: [] };
    }),
  };
}
