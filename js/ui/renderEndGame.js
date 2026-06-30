// End-game UI layer. core/endGame.js does the maths (who won what); this just
// paints it: a final scoreboard (everyone, ranked) plus the "Most Wanted"
// award cards. Pure DOM — hand it the players and the pre-computed awards.

import { escapeHtml } from '../utils/helpers.js';

const dids   = p => p.dids || p.score || 0;
const drinks = p => p.drinks || p.drinksTaken || 0;

// Final ranked scoreboard: most cards done first, drinks as the tie-break.
function renderFinalScores(players) {
  const list = document.querySelector('#finalScoreList');
  if (!list) return;
  list.innerHTML = '';

  const ranked = [...(players || [])]
    .filter(p => p && p.name)
    .sort((a, b) => dids(b) - dids(a) || drinks(b) - drinks(a));

  if (!ranked.length) return;

  const medals = ['🥇', '🥈', '🥉'];
  ranked.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'final-score';
    li.innerHTML =
      `<span class="final-rank">${medals[i] || (i + 1)}</span>` +
      `<span class="final-name">${escapeHtml(p.name)}</span>` +
      `<span class="final-tally">${dids(p)} done · ${drinks(p)} 🥃</span>`;
    list.appendChild(li);
  });
}

// Award cards from core/endGame.js → [{ icon, title, who, sub }].
function renderAwardsList(awards) {
  const list = document.querySelector('#awardsList');
  if (!list) return;
  list.innerHTML = '';

  if (!awards || !awards.length) {
    list.innerHTML = '<li class="awards-empty">Play a few cards first, then end the game to crown the winners.</li>';
    return;
  }
  awards.forEach(a => {
    const li = document.createElement('li');
    li.className = 'award';
    li.innerHTML =
      `<span class="award-icon">${a.icon}</span>` +
      `<span class="award-text"><strong>${escapeHtml(a.who)}</strong>` +
      `<span class="award-title">${escapeHtml(a.title)}</span>` +
      `<span class="award-sub">${escapeHtml(a.sub)}</span></span>`;
    list.appendChild(li);
  });
}

// Fill the end-game modal with the final scoreboard + the awards.
export function renderEndGame(players, awards) {
  renderFinalScores(players);
  renderAwardsList(awards);
}
