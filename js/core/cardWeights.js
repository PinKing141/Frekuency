// Card weighting — decides *how likely* an allowed card is to be drawn, by
// repeating it in the sampling pool. This is where the game's escalation lives:
// intensity, 2-player bias, and the chaos meter all feed in here.

// After Dark intensity (0–5): per-level weights [L1, L2, L3, L4, Wildcard].
// Disabled levels are already filtered out — this only re-mixes what's left.
const INTENSITY = [
  [6, 3, 1, 1, 1],  // 0 Plain
  [4, 4, 2, 1, 1],  // 1 Soft
  [2, 4, 3, 2, 1],  // 2 Spicy (default)
  [1, 2, 4, 3, 2],  // 3 Freaky
  [1, 1, 3, 5, 3],  // 4 Nasty
  [1, 1, 2, 6, 4],  // 5 Unhinged
];

// Tags that shine in a 1-on-1 game, and ones that fall flat there.
const DUO_BOOST = ['2p', 'duel', 'target', 'kiss', 'contact', 'freaky', 'omg'];
const DUO_DAMPEN = ['group', 'vote'];

function intensityWeight(card, intensity) {
  const row = INTENSITY[Math.max(0, Math.min(5, intensity | 0))] || INTENSITY[2];
  return row[(card.level || 1) - 1] || 1;
}

// Build the pool to sample from. Each allowed card is repeated by its weight,
// capped so the pool can't blow up. `chaos` (0–100) tilts the late game toward
// Wildcards once the meter is high.
export function weightedPool(allowed, { playerCount = 2, intensity = 2, chaos = 0 } = {}) {
  const pool = [];
  for (const card of allowed) {
    let copies = intensityWeight(card, intensity);

    if (playerCount === 2) {
      if (card.tags.some(t => DUO_DAMPEN.includes(t))) copies = 1;
      else if (card.tags.some(t => DUO_BOOST.includes(t))) copies *= 3;
    }

    // Chaos escalation: as the meter climbs, Wildcards (level 5) crash the party.
    if (card.level === 5 && chaos >= 50) copies *= 2;
    if (card.level === 5 && chaos >= 80) copies *= 2;

    copies = Math.max(1, Math.min(24, copies));
    for (let i = 0; i < copies; i++) pool.push(card);
  }
  return pool;
}
