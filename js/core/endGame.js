// End game — turns the session's tallies into the "Most Wanted" awards.
// Pure: hand it the players, get back a list of { icon, title, who, sub }.

const dids   = p => p.dids || p.score || 0;
const drinks = p => p.drinks || p.drinksTaken || 0;

function topBy(players, fn) {
  return players.reduce((best, p) => (fn(p) > fn(best) ? p : best), players[0]);
}
function bottomBy(players, fn) {
  return players.reduce((best, p) => (fn(p) < fn(best) ? p : best), players[0]);
}

export function calculateAwards(players) {
  const named = (players || []).filter(p => p && p.name);
  if (!named.length) return [];
  if (named.reduce((s, p) => s + dids(p) + drinks(p), 0) === 0) return [];

  const awards = [];
  const add = (icon, title, who, sub, when = true) => {
    if (who && when) awards.push({ icon, title, who: who.name, sub });
  };

  add('💋', 'Freakquency MVP', topBy(named, dids), 'did the most cards');
  add('🥃', 'Most Drunk', topBy(named, drinks), 'took the most drinks');

  const demon = topBy(named, p => p.l4Done || 0);
  add('😈', 'L4 Demon', demon, 'cleared the most OMG cards', (demon.l4Done || 0) > 0);

  const victim = topBy(named, p => p.wildcardsDone || 0);
  add('🃏', 'Wildcard Victim', victim, 'survived the most chaos', (victim.wildcardsDone || 0) > 0);

  const handsy = topBy(named, p => p.contactDone || 0);
  add('🫦', 'Most Handsy', handsy, 'said yes to the most contact', (handsy.contactDone || 0) > 0);

  if (named.length > 1) {
    add('😇', 'Most Innocent-Looking Menace', bottomBy(named, dids), 'kept the lowest body count… allegedly');
  }

  // A little chaos: a random "Most Wanted" sash.
  add('🔥', 'Most Wanted', named[Math.floor(Math.random() * named.length)], 'the room has decided');
  return awards;
}
