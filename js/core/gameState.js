import { loadPlayers } from './storage.js';

export const state = {
  players: loadPlayers(),
  turn: 0,
  usedCards: [],
  currentCard: null
};
