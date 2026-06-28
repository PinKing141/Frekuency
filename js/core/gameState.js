import { loadPlayers } from './storage.js';

export const state = {
  players: loadPlayers(),
  turn: 0,
  usedCards: [],   // short rotation buffer that stops immediate repeats
  deadPile: [],    // cards already played — set aside face-down, not redrawn
  currentCard: null
};
