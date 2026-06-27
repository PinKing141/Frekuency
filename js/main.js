// ── Solo mode imports ──
import { state } from './core/gameState.js';
import { addPlayer, removePlayer, resetPlayers } from './core/playerManager.js';
import { drawCard, drawCardForRoom } from './core/cardDrawer.js';
import { advanceTurn, resetTurn } from './core/turnManager.js';
import { clearPlayers } from './core/storage.js';
import { customCards, addCustomCard, removeCustomCard, buildCustomCard } from './core/customCards.js';
import { click as soundClick, isMuted, toggleMute } from './core/sound.js';
import { showScreen } from './ui/screens.js';
import { renderCard, renderRoomCard } from './ui/renderCard.js';
import { renderPlayers, renderScores } from './ui/renderPlayers.js';
import { escapeHtml } from './utils/helpers.js';

// ── Multiplayer imports ──
import { loginGuest, waitForUser } from './firebase/firebaseConfig.js';
import {
  createRoom,
  joinRoom,
  listenToRoom,
  startGame,
  updateCurrentCard,
  advanceRoomTurn,
  updateRoomSettings,
  markPlayerDrink,
  addRoomCustomCard,
  setRoomCustomCards
} from './firebase/roomService.js';

// ──────────────────────────────────────
// State
// ──────────────────────────────────────

let mpMode      = false;
let roomCode    = null;
let roomData    = null;
let myPlayerId  = null;   // unique per participant, independent of the shared anon auth uid
let unsubRoom   = null;

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// Anonymous sign-in only satisfies Firestore security rules (request.auth != null).
// Player identity uses myPlayerId, NOT the auth uid — two people in the same browser
// share an anon uid, which previously made the second join collide with the first.
const userReady = loginGuest()
  .then(() => waitForUser())
  .catch(err => { console.error('Firebase auth failed:', err); }); // solo still works

// ──────────────────────────────────────
// Solo helpers
// ──────────────────────────────────────

function refreshPlayers() {
  renderPlayers(state.players, index => {
    removePlayer(index);
    refreshPlayers();
    renderScores(state.players);
  });
}

// Render a list of custom cards into a <ul>, with a remove handler per item.
function renderCardList(ul, list, onRemove) {
  ul.innerHTML = '';
  list.forEach(c => {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.innerHTML = `<span class="tag">L${c.level}</span> ${escapeHtml(c.text)}`;
    const btn = document.createElement('button');
    btn.className = 'remove-player';
    btn.textContent = 'Remove';
    btn.onclick = () => onRemove(c);
    li.appendChild(info);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function refreshCustomCards() {
  renderCardList(document.querySelector('#customList'), customCards, c => {
    removeCustomCard(c.id);
    refreshCustomCards();
  });
}

function handleDrawCard() {
  if (state.players.length < 2) return alert('Add at least 2 players.');
  const result = drawCard();
  if (!result) return alert('No cards match these settings. Turn on more levels or update players.');
  renderCard(result);
}

function handleNextTurn(scored) {
  if (!state.players.length) return;
  advanceTurn(scored);
  renderScores(state.players);
  handleDrawCard();
}

// ──────────────────────────────────────
// Multiplayer helpers
// ──────────────────────────────────────

function onRoomUpdate(room) {
  if (!room) return;
  roomData = room;

  // Transition to game when host starts
  if (room.status === 'playing') {
    const gameScreen = document.querySelector('#screen-game');
    if (!gameScreen.classList.contains('active')) {
      showScreen('game');
      setupMultiplayerGameUI();
    }
    if (room.currentCard) renderRoomCard(room.currentCard);
    renderMultiplayerScores(room.players);
    return;
  }

  // Still in waiting room — update player list
  updateWaitingScreen(room);
}

function updateWaitingScreen(room) {
  document.querySelector('#waitingRoomCode').textContent = room.code;
  document.querySelector('#playerCount').textContent = room.players.length;

  const list = document.querySelector('#waitingPlayerList');
  list.innerHTML = '';
  room.players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span><strong>${escapeHtml(p.name)}</strong> · ${p.gender}</span>
      <span class="tag-row">${p.isHost ? '<span class="tag host">Host</span>' : ''}</span>`;
    list.appendChild(li);
  });

  const isHost = room.hostId === myPlayerId;
  document.querySelector('#startMultiGame').style.display  = isHost ? 'block' : 'none';
  document.querySelector('#waitingForHost').style.display  = isHost ? 'none'  : 'block';
  document.querySelector('#hostSettings').style.display    = isHost ? 'block' : 'none';

  renderCardList(document.querySelector('#mpCustomList'), room.customCards || [], async c => {
    if (!roomData || roomData.hostId !== myPlayerId) return;
    const next = (roomData.customCards || []).filter(x => x.id !== c.id);
    try { await setRoomCustomCards(roomCode, next); }
    catch (err) { console.error('Remove custom card failed:', err); }
  });
}

function setupMultiplayerGameUI() {
  mpMode = true;
  const bar = document.querySelector('#room-bar');
  bar.hidden = false;
  document.querySelector('#roomCodeDisplay').textContent = roomCode;
  document.querySelector('#onlineCount').textContent =
    roomData ? `${roomData.players.length} players` : '';
  document.querySelector('#backSetup').textContent = 'Leave';
}

function renderMultiplayerScores(players) {
  const list = document.querySelector('#scoreList');
  list.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(p.name)}</span><strong>${p.drinksTaken || 0} 🥃</strong>`;
    list.appendChild(li);
  });
}

async function handleMpDraw() {
  if (!roomData) return;
  const card = drawCardForRoom(roomData);
  if (!card) return alert('No cards match the current room settings.');
  await updateCurrentCard(roomCode, card);
}

async function handleMpNextTurn(tookDrink) {
  if (!roomData) return;
  if (tookDrink) {
    const players = roomData.players.map((p, i) =>
      i === roomData.currentPlayerIndex ? { ...p, drinksTaken: (p.drinksTaken || 0) + 1 } : p
    );
    await markPlayerDrink(roomCode, players);
  }
  const nextIndex = (roomData.currentPlayerIndex + 1) % roomData.players.length;
  await advanceRoomTurn(roomCode, nextIndex);
  // onSnapshot fires → roomData updates → draw next card
  const updatedRoom = { ...roomData, currentPlayerIndex: nextIndex };
  const card = drawCardForRoom(updatedRoom);
  if (card) await updateCurrentCard(roomCode, card);
}

function cleanupRoom() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  roomCode   = null;
  roomData   = null;
  myPlayerId = null;
  mpMode     = false;
  document.querySelector('#room-bar').hidden = true;
  document.querySelector('#backSetup').textContent = 'Setup';
}

// ──────────────────────────────────────
// Event bindings — solo
// ──────────────────────────────────────

document.querySelector('#startSetup').onclick = () => showScreen('setup');

document.querySelector('#backSetup').onclick = () => {
  if (mpMode) {
    if (confirm('Leave the room?')) { cleanupRoom(); showScreen('start'); }
  } else {
    showScreen('setup');
  }
};

document.querySelector('#addPlayer').onclick = () => {
  const nameInput = document.querySelector('#playerName');
  const name = nameInput.value.trim();
  if (!name) return alert('Add a player name first.');
  addPlayer({
    name,
    gender:  document.querySelector('#playerGender').value,
    flirt:   document.querySelector('#playerFlirt').value === 'yes',
    contact: document.querySelector('#playerContact').value === 'yes'
  });
  nameInput.value = '';
  refreshPlayers();
};

document.querySelector('#playerName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.querySelector('#addPlayer').click();
});

document.querySelector('#addCustomCard').onclick = () => {
  const input = document.querySelector('#customText');
  const text = input.value.trim();
  if (!text) return alert('Type a prompt first.');
  addCustomCard({ text, level: document.querySelector('#customLevel').value });
  input.value = '';
  refreshCustomCards();
};

document.querySelector('#customText').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.querySelector('#addCustomCard').click();
});

document.querySelector('#beginGame').onclick = () => {
  if (state.players.length < 2) return alert('Add at least 2 players.');
  showScreen('game');
  renderScores(state.players);
  handleDrawCard();
};

document.querySelector('#newCard').onclick = () => {
  if (mpMode) handleMpDraw();
  else handleDrawCard();
};

document.querySelector('#didIt').onclick = () => {
  if (mpMode) handleMpNextTurn(false);
  else handleNextTurn(true);
};

document.querySelector('#drink').onclick = () => {
  if (mpMode) handleMpNextTurn(true);
  else handleNextTurn(false);
};

document.querySelector('#resetAll').onclick = () => {
  if (!confirm('Reset all players and scores?')) return;
  resetPlayers();
  clearPlayers();
  resetTurn();
  refreshPlayers();
  renderScores(state.players);
};

// ──────────────────────────────────────
// Event bindings — multiplayer
// ──────────────────────────────────────

document.querySelector('#startMultiplayer').onclick = () => showScreen('lobby');
document.querySelector('#lobbyBack').onclick        = () => showScreen('start');

document.querySelector('#createRoomBtn').onclick = async () => {
  const name = document.querySelector('#hostName').value.trim();
  if (!name) return alert('Enter your name first.');
  try {
    await userReady;
    myPlayerId = newId();
    const code = await createRoom(name, document.querySelector('#hostGender').value, myPlayerId);
    roomCode = code;
    unsubRoom = listenToRoom(code, onRoomUpdate);
    document.querySelector('#waitingRoomCode').textContent = code;
    document.querySelector('#roomCodeDisplay').textContent = code;
    showScreen('waiting');
  } catch (err) {
    console.error('Create room failed:', err);
    alert(err.message || 'Could not create room. Check your connection and Firestore rules.');
  }
};

document.querySelector('#joinRoomBtn').onclick = async () => {
  const name   = document.querySelector('#joinName').value.trim();
  const code   = document.querySelector('#joinCode').value.trim().toUpperCase();
  const gender = document.querySelector('#joinGender').value;
  if (!name || !code) return alert('Enter your name and the room code.');
  try {
    await userReady;
    myPlayerId = newId();
    roomCode = await joinRoom(code, name, gender, myPlayerId);
    unsubRoom = listenToRoom(roomCode, onRoomUpdate);
    showScreen('waiting');
  } catch (err) {
    console.error('Join room failed:', err);
    alert(err.message || 'Could not join room. Check the code and try again.');
  }
};

document.querySelector('#startMultiGame').onclick = async () => {
  if (!roomData || roomData.hostId !== myPlayerId) return;
  if (roomData.players.length < 2) return alert('Need at least 2 players to start.');

  // Push host's chosen settings before starting
  const settings = {
    maxLevel:            Number(document.querySelector('#mpMaxLevel').value),
    allowTargetedCards:  document.querySelector('#mpAllowTarget').checked,
    allowPhysicalCards:  document.querySelector('#mpAllowContact').checked
  };
  await updateRoomSettings(roomCode, settings);

  // Draw first card with the new settings applied
  const updatedRoom = { ...roomData, settings };
  const firstCard = drawCardForRoom(updatedRoom);
  if (firstCard) await updateCurrentCard(roomCode, firstCard);

  await startGame(roomCode);
};

document.querySelector('#mpAddCustomCard').onclick = async () => {
  if (!roomData || roomData.hostId !== myPlayerId) return;
  const input = document.querySelector('#mpCustomText');
  const text = input.value.trim();
  if (!text) return alert('Type a prompt first.');
  const card = buildCustomCard({ text, level: document.querySelector('#mpCustomLevel').value });
  input.value = '';
  try {
    await addRoomCustomCard(roomCode, card);
  } catch (err) {
    console.error('Add custom card failed:', err);
    alert('Could not add the card. Check your connection.');
  }
};

document.querySelector('#leaveRoom').onclick = () => {
  cleanupRoom();
  showScreen('start');
};

// ──────────────────────────────────────
// Sound + rules
// ──────────────────────────────────────

const muteToggle = document.querySelector('#muteToggle');
function syncMuteUI() {
  const m = isMuted();
  muteToggle.textContent = m ? '🔇' : '🔊';
  muteToggle.classList.toggle('muted', m);
}
muteToggle.onclick = () => { toggleMute(); syncMuteUI(); };
syncMuteUI();

// Subtle click on every button press (respects mute).
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn && btn.id !== 'muteToggle') soundClick();
});

const rules = document.querySelector('#rulesModal');
const openRules  = () => rules.classList.add('open');
const closeRules = () => rules.classList.remove('open');
document.querySelector('#openRules').onclick   = openRules;
document.querySelector('#closeRules').onclick  = closeRules;
document.querySelector('#closeRules2').onclick = closeRules;
rules.addEventListener('click', e => { if (e.target === rules) closeRules(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRules(); });

// ──────────────────────────────────────
// Init
// ──────────────────────────────────────

refreshPlayers();
renderScores(state.players);
refreshCustomCards();
