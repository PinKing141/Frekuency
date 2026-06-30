// Card filtering — decides *whether* a card may appear. Pure functions, no DOM:
// give them a card + the current context and they return true/false. Kept apart
// from drawing and weighting so each concern can grow on its own.

import { isCategoryEnabled } from './settings.js';

// Solo / pass-the-phone. `settings` is the persisted solo settings object,
// `current` is the player whose turn it is (for per-player comfort opt-ins).
export function soloAllowed(card, settings, players, current) {
  if (!settings.levels[card.level]) return false;
  if (players.length < (card.minPlayers || 2)) return false;
  if (card.tags.includes('contact') && !settings.allowContact) return false;
  if (card.tags.includes('contact') && !current.contact) return false;
  if (card.tags.includes('flirt')   && !current.flirt)   return false;
  if (!settings.allowNever && card.text.toLowerCase().includes('never have i ever')) return false;
  if (!settings.allowWould && card.text.toLowerCase().includes('would you rather'))  return false;
  if (card.tags.includes('target')  && !settings.allowTarget) return false;
  if (card.categoryId && !isCategoryEnabled(card.categoryId)) return false;
  return true;
}

// Multiplayer. `settings` is the room's settings document.
export function roomAllowed(card, settings, players) {
  const maxLevel = settings.maxLevel || 4;
  if (card.level > maxLevel) return false;
  if (players.length < (card.minPlayers || 2)) return false;
  if (!settings.allowPhysicalCards && card.tags.includes('contact')) return false;
  if (!settings.allowTargetedCards && card.tags.includes('target')) return false;
  return true;
}
