// Scoring — records what happened each turn on the player object, so the
// scoreboard and the end-game awards have real numbers to work with. Mutates
// the player; the caller persists (turnManager.savePlayers).

// action: 'done' (did the card) or 'drink' (took the drink / passed).
export function recordOutcome(player, card, action) {
  if (!player) return;
  if (action === 'done') {
    player.score = (player.score || 0) + 1;   // headline number used by the leader chip
    player.dids  = (player.dids  || 0) + 1;
    if (card) {
      if (card.level === 4) player.l4Done = (player.l4Done || 0) + 1;
      if (card.level === 5) player.wildcardsDone = (player.wildcardsDone || 0) + 1;
      if (card.tags && card.tags.includes('contact')) player.contactDone = (player.contactDone || 0) + 1;
    }
  } else {
    player.drinks = (player.drinks || 0) + 1;
  }
}

// Zero every tally — used when a session starts or ends.
export function resetStats(players) {
  players.forEach(p => {
    p.score = 0; p.dids = 0; p.drinks = 0;
    p.l4Done = 0; p.wildcardsDone = 0; p.contactDone = 0;
  });
}
