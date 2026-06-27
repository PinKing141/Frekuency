import { state } from './gameState.js';
import { cards } from '../data/cards.js';
import { randomTargetPhrase } from '../utils/helpers.js';

// --- Solo mode helpers (read settings from DOM) ---

function selectedLevels() {
  return [...document.querySelectorAll('.levelCheck:checked')].map(c => Number(c.value));
}

function cardAllowed(card, current) {
  if (!selectedLevels().includes(card.level)) return false;
  if (card.tags.includes('contact') && !document.querySelector('#allowContact').checked) return false;
  if (card.tags.includes('contact') && !current.contact) return false;
  if (card.tags.includes('flirt')   && !current.flirt)   return false;
  if (!document.querySelector('#allowNever').checked  && card.text.toLowerCase().includes('never have i ever')) return false;
  if (!document.querySelector('#allowWould').checked  && card.text.toLowerCase().includes('would you rather'))  return false;
  if (card.tags.includes('target')  && !document.querySelector('#allowTarget').checked) return false;
  return true;
}

export function drawCard() {
  const current = state.players[state.turn % state.players.length];
  const allowed = cards.filter(card => cardAllowed(card, current));
  if (!allowed.length) return null;

  let card = allowed[Math.floor(Math.random() * allowed.length)];
  let attempts = 0;
  while (state.usedCards.includes(card.id) && attempts < 30) {
    card = allowed[Math.floor(Math.random() * allowed.length)];
    attempts++;
  }

  state.usedCards.push(card.id);
  if (state.usedCards.length > Math.min(cards.length, 25)) state.usedCards.shift();

  const text = card.text
    .replaceAll('{player}', current.name)
    .replaceAll('{target}', randomTargetPhrase());

  state.currentCard = card;
  return { card, text, current };
}

// --- Multiplayer mode: draws using room data, no DOM reads ---

export function drawCardForRoom(room) {
  const { players, currentPlayerIndex, usedCardIds = [], settings } = room;
  const current = players[currentPlayerIndex];
  if (!current) return null;

  const maxLevel = settings.maxLevel || 4;
  const allowed = cards.filter(card => {
    if (card.level > maxLevel) return false;
    if (!settings.allowPhysicalCards && card.tags.includes('contact')) return false;
    if (!settings.allowTargetedCards && card.tags.includes('target')) return false;
    return true;
  });

  if (!allowed.length) return null;

  let card = allowed[Math.floor(Math.random() * allowed.length)];
  let attempts = 0;
  while (usedCardIds.includes(card.id) && attempts < 30) {
    card = allowed[Math.floor(Math.random() * allowed.length)];
    attempts++;
  }

  const resolvedText = card.text
    .replaceAll('{player}', current.name)
    .replaceAll('{target}', randomTargetPhrase());

  return {
    id: card.id,
    level: card.level,
    type: card.type,
    icon: card.icon,
    resolvedText,
    currentPlayerName: current.name
  };
}
