import { state } from './gameState.js';
import { savePlayers } from './storage.js';

export function getCurrentPlayer() {
  return state.players[state.turn % state.players.length];
}

// Just advances the rotation + persists. Scoring lives in core/scoring.js now,
// recorded by the caller before the turn advances.
export function advanceTurn() {
  state.turn++;
  savePlayers(state.players);
}

export function resetTurn() {
  state.turn = 0;
  state.usedCards = [];
  state.deadPile = [];
}
