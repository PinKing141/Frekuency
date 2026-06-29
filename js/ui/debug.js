// Hidden card-inspector. Unlocked by tapping the title 5x and entering a code
// (or via ?debug=<code> in the URL). NOTE: this is obfuscation, not security —
// every built-in card already ships in the JS bundle. It just hides the list
// from casual players. Once unlocked, a 🐞 button opens a panel listing every
// card the game can currently draw: built-in + local custom + current-room custom.

import { cards } from '../data/cards.js';
import { customCards } from '../core/customCards.js';
import { escapeHtml } from '../utils/helpers.js';

const CODE = 'freak42';
const KEY = 'freakquencyDebug';
const SRC_LABEL = { builtin: 'Built-in', local: 'Custom · local', room: 'Custom · room' };
const SRC_ORDER = { builtin: 0, local: 1, room: 2 };

export function setupDebug({ getRoomCustomCards = () => [] } = {}) {
  const btn       = document.querySelector('#debugBtn');
  const modal     = document.querySelector('#debugModal');
  const listEl    = document.querySelector('#debugList');
  const summaryEl = document.querySelector('#debugSummary');
  const searchEl  = document.querySelector('#debugSearch');

  const isUnlocked = () => localStorage.getItem(KEY) === '1';
  function unlock() {
    localStorage.setItem(KEY, '1');
    btn.hidden = false;
  }
  // Leave debug: forget the unlock, hide the 🐞 trigger, close the panel.
  function lock() {
    localStorage.removeItem(KEY);
    btn.hidden = true;
    closeModal();
  }

  // URL unlock: ?debug=<code>
  if (new URLSearchParams(location.search).get('debug') === CODE) unlock();
  if (isUnlocked()) btn.hidden = false;

  // Secret unlock: 5 quick taps on the title.
  const title = document.querySelector('#screen-start h1');
  let taps = 0;
  let resetTimer = null;
  title?.addEventListener('click', () => {
    taps += 1;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { taps = 0; }, 1500);
    if (taps < 5) return;
    taps = 0;
    if (isUnlocked()) { openModal(); return; }
    if (prompt('Enter debug code:') === CODE) { unlock(); openModal(); }
  });

  function collect() {
    return [
      ...cards.map(card => ({ card, source: 'builtin' })),
      ...customCards.map(card => ({ card, source: 'local' })),
      ...(getRoomCustomCards() || []).map(card => ({ card, source: 'room' }))
    ];
  }

  function matches(card, q) {
    if (!q) return true;
    const hay = `${card.text} ${card.id} ${card.type} ${(card.tags || []).join(' ')} l${card.level}`.toLowerCase();
    return hay.includes(q);
  }

  function render() {
    const all = collect();
    const q = (searchEl.value || '').trim().toLowerCase();
    const shown = all
      .filter(x => matches(x.card, q))
      .sort((a, b) => a.card.level - b.card.level || SRC_ORDER[a.source] - SRC_ORDER[b.source]);

    const counts = {};
    all.forEach(x => { counts[x.card.level] = (counts[x.card.level] || 0) + 1; });
    summaryEl.innerHTML =
      `Showing <strong>${shown.length}</strong> of <strong>${all.length}</strong> cards` +
      ` &nbsp;·&nbsp; L1 ${counts[1] || 0} · L2 ${counts[2] || 0} · L3 ${counts[3] || 0} · L4 ${counts[4] || 0} · WILD ${counts[5] || 0}`;

    let html = '';
    let lastLevel = null;
    shown.forEach(({ card, source }) => {
      if (card.level !== lastLevel) {
        lastLevel = card.level;
        html += `<li class="dbg-divider">Level ${card.level}</li>`;
      }
      const tags = card.tags && card.tags.length ? ` · [${escapeHtml(card.tags.join(', '))}]` : '';
      html += `<li class="dbg-row">
        <div class="dbg-meta">
          <span class="dbg-lvl l${card.level}">L${card.level}</span>
          <span class="dbg-type">${escapeHtml(card.type)}${tags}</span>
          <span class="dbg-src ${source}">${SRC_LABEL[source]}</span>
        </div>
        <div class="dbg-text">${escapeHtml(card.text)}</div>
        <div class="dbg-id">${escapeHtml(card.id)}</div>
      </li>`;
    });
    listEl.innerHTML = html || '<li class="dbg-divider">No cards match.</li>';
  }

  function openModal() { render(); modal.classList.add('open'); }
  function closeModal() { modal.classList.remove('open'); }

  btn.onclick = openModal;
  document.querySelector('#closeDebug').onclick = closeModal;
  document.querySelector('#lockDebug')?.addEventListener('click', lock);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  searchEl.addEventListener('input', render);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
}
