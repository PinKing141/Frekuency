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

// In a 2-player game, bias the draw towards intimate 1-on-1 cards and away from
// group/vote prompts by repeating boosted cards in the sampling pool. For 3+
// players the pool is unchanged.
function weightedPool(allowed, playerCount) {
  if (playerCount !== 2) return allowed;
  const pool = [];
  for (const card of allowed) {
    if (card.tags.some(t => DUO_DAMPEN.includes(t))) { pool.push(card); continue; }
    const copies = card.tags.some(t => DUO_BOOST.includes(t)) ? 4 : 1;
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

  const pool = weightedPool(allowed, state.players.length);
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

  const pool = weightedPool(allowed, players.length);
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
