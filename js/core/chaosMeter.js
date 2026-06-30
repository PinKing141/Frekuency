// Chaos meter — a simple 0–100 escalation gauge for a solo session. It nudges
// the draw toward Wildcards as the night gets messier (see cardWeights.js).
// Resets whenever a session starts or ends.

let chaos = 0;

const GAIN = {
  done: 2,       // a card got done
  pass: 5,       // someone dodged with a drink
  l4: 8,         // an OMG card completed
  contact: 6,    // a physical-contact card completed
  wildcard: 10,  // a wildcard came out
};

export function increaseChaos(reason) {
  chaos = Math.min(100, chaos + (GAIN[reason] || 0));
  return chaos;
}

export function getChaosLevel() { return chaos; }
export function shouldBoostWildcards() { return chaos >= 50; }
export function resetChaos() { chaos = 0; }
