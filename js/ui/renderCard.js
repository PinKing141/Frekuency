import { flip as soundFlip, omg as soundOmg } from '../core/sound.js';

const sceneEl  = document.querySelector('.card-scene');
const cardEl   = document.querySelector('#card');
const levelEl  = document.querySelector('#cardLevel');
const typeEl   = document.querySelector('#cardType');
const iconEl   = document.querySelector('#cardIcon');
const textEl   = document.querySelector('#cardText');
const footerEl = document.querySelector('#cardFooter');
const turnName = document.querySelector('#turnName');

const LEVELS = ['level-1', 'level-2', 'level-3', 'level-4', 'level-5'];

// Wildcard cards live at level 5 but read as "WILD" on the card face.
const levelLabel = level => (Number(level) === 5 ? 'WILD' : `L${level}`);

// Set the level skin and flip back -> front. Re-flips only when the card id
// changes, so repeated multiplayer snapshots of the same card don't re-animate.
function present(level, id) {
  const idStr = String(id);
  const isNew = cardEl.dataset.cardId !== idStr;

  LEVELS.forEach(c => cardEl.classList.remove(c));
  cardEl.classList.add('card', `level-${level}`);

  if (isNew) {
    cardEl.dataset.cardId = idStr;
    cardEl.classList.remove('revealed');
    // Deal motion: the card pops off the deck stack while it flips.
    if (sceneEl) {
      sceneEl.classList.remove('dealing');
      void sceneEl.offsetWidth;
      sceneEl.classList.add('dealing');
    }
    void cardEl.offsetWidth;            // restart the flip
    soundFlip();
    if (Number(level) === 4) soundOmg();
  }
  cardEl.classList.add('revealed');
}

// Solo mode — receives { card, text, current }
export function renderCard({ card, text, current }) {
  turnName.textContent = current.name;
  levelEl.textContent  = levelLabel(card.level);
  typeEl.textContent   = card.type;
  iconEl.textContent   = card.icon;
  textEl.textContent   = text;
  footerEl.textContent = 'Do it, answer honestly, or drink/pass.';
  present(card.level, card.id);
}

// Multiplayer mode — receives the card object stored in Firestore
export function renderRoomCard(roomCard) {
  if (!roomCard) return;
  turnName.textContent = roomCard.currentPlayerName || '?';
  levelEl.textContent  = levelLabel(roomCard.level);
  typeEl.textContent   = roomCard.type;
  iconEl.textContent   = roomCard.icon;
  textEl.textContent   = roomCard.resolvedText;
  footerEl.textContent = 'Do it, answer honestly, or drink/pass.';
  present(roomCard.level, roomCard.id);
}
