import { state } from './gameState.js';
import { savePlayers } from './storage.js';

export function getCurrentPlayer() {
  return state.players[state.turn % state.players.length];
}

export function advanceTurn(scored) {
  const current = getCurrentPlayer();
  if (scored) current.score = (current.score || 0) + 1;
  state.turn++;
  savePlayers(state.players);
}

export function resetTurn() {
  state.turn = 0;
  state.usedCards = [];
}
