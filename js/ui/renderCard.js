const cardEl   = document.querySelector('#card');
const levelEl  = document.querySelector('#cardLevel');
const typeEl   = document.querySelector('#cardType');
const iconEl   = document.querySelector('#cardIcon');
const textEl   = document.querySelector('#cardText');
const footerEl = document.querySelector('#cardFooter');
const turnName = document.querySelector('#turnName');

function animateCard(level) {
  cardEl.className = `card level-${level}`;
  cardEl.classList.remove('animate-in');
  void cardEl.offsetWidth;
  cardEl.classList.add('animate-in');
}

// Solo mode — receives { card, text, current }
export function renderCard({ card, text, current }) {
  turnName.textContent = current.name;
  levelEl.textContent  = `L${card.level}`;
  typeEl.textContent   = card.type;
  iconEl.textContent   = card.icon;
  textEl.textContent   = text;
  footerEl.textContent = 'Do it, answer honestly, or drink/pass.';
  animateCard(card.level);
}

// Multiplayer mode — receives the card object stored in Firestore
export function renderRoomCard(roomCard) {
  if (!roomCard) return;
  turnName.textContent = roomCard.currentPlayerName || '?';
  levelEl.textContent  = `L${roomCard.level}`;
  typeEl.textContent   = roomCard.type;
  iconEl.textContent   = roomCard.icon;
  textEl.textContent   = roomCard.resolvedText;
  footerEl.textContent = 'Do it, answer honestly, or drink/pass.';
  animateCard(roomCard.level);
}
