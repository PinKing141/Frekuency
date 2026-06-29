import { escapeHtml } from '../utils/helpers.js';

export function renderPlayers(players, onRemove) {
  const list = document.querySelector('#playerList');
  list.innerHTML = '';
  players.forEach((p, index) => {
    const li  = document.createElement('li');
    const info = document.createElement('span');
    info.innerHTML = `<strong>${escapeHtml(p.name)}</strong> · ${p.gender} · flirt ${p.flirt ? 'yes' : 'no'} · contact ${p.contact ? 'yes' : 'no'}`;

    const btn = document.createElement('button');
    btn.className   = 'remove-player';
    btn.textContent = 'Remove';
    btn.onclick     = () => onRemove(index);

    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

export function renderScores(players) {
  const scoreList = document.querySelector('#scoreList');
  scoreList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(p.name)}</span>` +
      `<span class="score-stat">✓ ${p.score || 0} · 🥃 ${p.drinks || 0}</span>`;
    scoreList.appendChild(li);
  });

  // Collapsed-drawer summary: show who's ahead without opening it.
  const leader = document.querySelector('#scoreLeader');
  if (leader) {
    const top = players.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a), players[0] || null);
    leader.textContent = top && (top.score || 0) > 0 ? `· ${top.name} leads` : '';
  }
}
