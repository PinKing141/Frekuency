// Card drawer — the orchestrator. It no longer knows the *rules*: it asks
// cardFilters which cards are allowed, cardWeights how to bias them, and
// targetResolver how to word them. Just deck plumbing + the dead pile here.

import { state } from './gameState.js';
import { cards } from '../data/cards.js';
import { customCards } from './customCards.js';
import { settings } from './settings.js';
import { soloAllowed, roomAllowed } from './cardFilters.js';
import { weightedPool } from './cardWeights.js';
import { resolveCardText } from './targetResolver.js';
import { getChaosLevel } from './chaosMeter.js';

// Sample a card id from the pool, avoiding the short anti-repeat buffer.
function pick(pool, used) {
  let card = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (used.includes(card.id) && attempts < 30) {
    card = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }
  return card;
}

// --- Solo / pass-the-phone ---

export function drawCard() {
  const current = state.players[state.turn % state.players.length];
  const deck = [...cards, ...customCards];
  // The dead pile is set aside permanently (until reshuffled), so exclude it.
  const allowed = deck.filter(card =>
    soloAllowed(card, settings, state.players, current) && !state.deadPile.includes(card.id));
  if (!allowed.length) return null;

  const pool = weightedPool(allowed, {
    playerCount: state.players.length,
    intensity: settings.intensity,
    chaos: getChaosLevel()
  });
  const card = pick(pool, state.usedCards);

  state.usedCards.push(card.id);
  if (state.usedCards.length > Math.min(allowed.length, 25)) state.usedCards.shift();

  state.currentCard = card;
  return { card, text: resolveCardText(card, current, state.players), current };
}

// Move the just-played card out of rotation into the face-down dead pile.
export function killCard(id) {
  if (id && !state.deadPile.includes(id)) state.deadPile.push(id);
}

// Reshuffle the live deck: clear the short anti-repeat buffer so the remaining
// (non-dead) cards get a fresh random order. The dead pile is left untouched.
export function reshuffleCurrent() {
  state.usedCards = [];
}

// --- Multiplayer: draws using room data, no DOM reads ---

export function drawCardForRoom(room) {
  const { players, currentPlayerIndex, usedCardIds = [], settings: roomSettings, customCards: roomCustom = [] } = room;
  const current = players[currentPlayerIndex];
  if (!current) return null;

  const deck = [...cards, ...roomCustom];
  const allowed = deck.filter(card => roomAllowed(card, roomSettings, players));
  if (!allowed.length) return null;

  const pool = weightedPool(allowed, {
    playerCount: players.length,
    intensity: roomSettings.intensity ?? 2,
    chaos: 0
  });
  const card = pick(pool, usedCardIds);

  return {
    id: card.id,
    level: card.level,
    type: card.type,
    icon: card.icon,
    timer: card.timer || 0,
    drink: card.drink || '',
    resolvedText: resolveCardText(card, current, players),
    currentPlayerName: current.name
  };
}
