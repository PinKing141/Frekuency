import { state } from './gameState.js';
import { cards } from '../data/cards.js';
import { customCards } from './customCards.js';
import { settings, isCategoryEnabled } from './settings.js';
import { randomTargetPhrase } from '../utils/helpers.js';

// --- Solo mode helpers (read the persisted settings object) ---

function cardAllowed(card, current) {
  if (!settings.levels[card.level]) return false;
  if (state.players.length < (card.minPlayers || 2)) return false;
  if (card.tags.includes('contact') && !settings.allowContact) return false;
  if (card.tags.includes('contact') && !current.contact) return false;
  if (card.tags.includes('flirt')   && !current.flirt)   return false;
  if (!settings.allowNever && card.text.toLowerCase().includes('never have i ever')) return false;
  if (!settings.allowWould && card.text.toLowerCase().includes('would you rather'))  return false;
  if (card.tags.includes('target')  && !settings.allowTarget) return false;
  if (card.categoryId && !isCategoryEnabled(card.categoryId)) return false;
  return true;
}

// Tags that make a card shine in a 1-on-1 game, and ones that fall flat there.
const DUO_BOOST = ['2p', 'duel', 'target', 'kiss', 'contact', 'freaky', 'omg'];
const DUO_DAMPEN = ['group', 'vote'];

// After Dark intensity (0–5): per-level draw weights [L1, L2, L3, L4, Wildcard].
// Disabled levels are still never shown — this only re-mixes what's enabled, so
// "Soft" can keep L4 on but make it rare, and "Unhinged" buries the icebreakers.
const INTENSITY = [
  [6, 3, 1, 1, 1],  // 0 Plain
  [4, 4, 2, 1, 1],  // 1 Soft
  [2, 4, 3, 2, 1],  // 2 Spicy (default)
  [1, 2, 4, 3, 2],  // 3 Freaky
  [1, 1, 3, 5, 3],  // 4 Nasty
  [1, 1, 2, 6, 4],  // 5 Unhinged
];

function intensityWeight(card, intensity) {
  const row = INTENSITY[Math.max(0, Math.min(5, intensity | 0))] || INTENSITY[2];
  return row[(card.level || 1) - 1] || 1;
}

// Build the sampling pool: repeat each allowed card by its intensity weight, and
// in a 2-player game boost intimate 1-on-1 cards (and dampen group/vote ones).
// Copies are capped so the pool can't blow up. For 3+ players with default
// intensity this is effectively the plain allowed list.
function weightedPool(allowed, playerCount, intensity = 2) {
  const pool = [];
  for (const card of allowed) {
    let copies = intensityWeight(card, intensity);
    if (playerCount === 2) {
      if (card.tags.some(t => DUO_DAMPEN.includes(t))) copies = 1;
      else if (card.tags.some(t => DUO_BOOST.includes(t))) copies *= 3;
    }
    copies = Math.max(1, Math.min(15, copies));
    for (let i = 0; i < copies; i++) pool.push(card);
  }
  return pool;
}

// {target} resolves to the OTHER player's name in a duo, else a chooser phrase.
function targetFor(players, current) {
  if (players.length === 2) {
    const other = players.find(p => p !== current);
    if (other) return other.name;
  }
  return randomTargetPhrase();
}

export function drawCard() {
  const current = state.players[state.turn % state.players.length];
  const deck = [...cards, ...customCards];
  // The dead pile is set aside permanently (until reshuffled), so exclude it.
  const allowed = deck.filter(card => cardAllowed(card, current) && !state.deadPile.includes(card.id));
  if (!allowed.length) return null;

  const pool = weightedPool(allowed, state.players.length, settings.intensity);
  let card = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (state.usedCards.includes(card.id) && attempts < 30) {
    card = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }

  state.usedCards.push(card.id);
  if (state.usedCards.length > Math.min(allowed.length, 25)) state.usedCards.shift();

  const text = card.text
    .replaceAll('{player}', current.name)
    .replaceAll('{target}', targetFor(state.players, current));

  state.currentCard = card;
  return { card, text, current };
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

// --- Multiplayer mode: draws using room data, no DOM reads ---

export function drawCardForRoom(room) {
  const { players, currentPlayerIndex, usedCardIds = [], settings, customCards: roomCustom = [] } = room;
  const current = players[currentPlayerIndex];
  if (!current) return null;

  const maxLevel = settings.maxLevel || 4;
  const deck = [...cards, ...roomCustom];
  const allowed = deck.filter(card => {
    if (card.level > maxLevel) return false;
    if (players.length < (card.minPlayers || 2)) return false;
    if (!settings.allowPhysicalCards && card.tags.includes('contact')) return false;
    if (!settings.allowTargetedCards && card.tags.includes('target')) return false;
    return true;
  });

  if (!allowed.length) return null;

  const pool = weightedPool(allowed, players.length, settings.intensity ?? 2);
  let card = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (usedCardIds.includes(card.id) && attempts < 30) {
    card = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }

  const resolvedText = card.text
    .replaceAll('{player}', current.name)
    .replaceAll('{target}', targetFor(players, current));

  return {
    id: card.id,
    level: card.level,
    type: card.type,
    icon: card.icon,
    timer: card.timer || 0,
    drink: card.drink || '',
    resolvedText,
    currentPlayerName: current.name
  };
}
