export function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

// Cards no longer force a specific target player. {target} resolves to one of
// these phrases so the current player picks who it applies to. Every phrase is
// always satisfiable in any group, so a card can never get "stuck".
const TARGET_PHRASES = [
  'a player of your choice',
  'anyone in the circle',
  'the player to your left',
  'the player to your right',
  'someone you pick',
  'the player across from you',
  'a player you haven\'t picked yet'
];

export function randomTargetPhrase() {
  return TARGET_PHRASES[Math.floor(Math.random() * TARGET_PHRASES.length)];
}
