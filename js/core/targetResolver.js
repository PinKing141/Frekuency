// Turns a card's template into the line you read aloud. {player} is the current
// player; {target} is the OTHER player's real name in a duo (so 1-on-1 cards
// feel intentional), or a "player of your choice" phrase with a bigger circle.

import { randomTargetPhrase } from '../utils/helpers.js';

export function targetFor(players, current) {
  if (players.length === 2) {
    const other = players.find(p => p !== current);
    if (other) return other.name;
  }
  return randomTargetPhrase();
}

export function resolveCardText(card, current, players) {
  return card.text
    .replaceAll('{player}', current.name)
    .replaceAll('{target}', targetFor(players, current));
}
