// ── Solo mode imports ──
import { state } from './core/gameState.js';
import { addPlayer, removePlayer, resetPlayers } from './core/playerManager.js';
import { drawCard, drawCardForRoom } from './core/cardDrawer.js';
import { advanceTurn, resetTurn } from './core/turnManager.js';
import { clearPlayers } from './core/storage.js';
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
  updateRoomSettings
} from './firebase/roomService.js';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let mpMode      = false;
let roomCode    = null;
let roomData    = null;
let currentUser = null;
let unsubRoom   = null;

// Start anonymous sign-in immediately (non-blocking)
const userReady = loginGuest()
  .then(() => waitForUser())
  .then(u => { currentUser = u; })
  .catch(() => {}); // Firebase unavailable — solo still works

// ─────────────────────────────────────────────
// Solo helpers
// ─────────────────────────────────────────────

function refreshPlayers() {
  renderPlayers(state.players, index => {
    removePlayer(index);
    refreshPlayers();
    renderScores(state.players);
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

// ─────────────────────────────────────────────
// Multiplayer helpers
// ─────────────────────────────────────────────

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

  const isHost = currentUser && room.hostId === currentUser.uid;
  document.querySelector('#startMultiGame').style.display  = isHost ? 'block' : 'none';
  document.querySelector('#waitingForHost').style.display  = isHost ? 'none'  : 'block';
  document.querySelector('#hostSettings').style.display    = isHost ? 'block' : 'none';
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
    // bump drinksTaken for current player locally then push
    const players = roomData.players.map((p, i) =>
      i === roomData.currentPlayerIndex ? { ...p, drinksTaken: (p.drinksTaken || 0) + 1 } : p
    );
    await import('./firebase/roomService.js').then(({ markPlayerDrink }) => {
      if (markPlayerDrink) return markPlayerDrink(roomCode, players);
    }).catch(() => {});
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
  roomCode = null;
  roomData = null;
  mpMode   = false;
  document.querySelector('#room-bar').hidden = true;
  document.querySelector('#backSetup').textContent = 'Setup';
}

// ─────────────────────────────────────────────
// Event bindings — solo
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Event bindings — multiplayer
// ─────────────────────────────────────────────

document.querySelector('#startMultiplayer').onclick = () => showScreen('lobby');
document.querySelector('#lobbyBack').onclick        = () => showScreen('start');

document.querySelector('#createRoomBtn').onclick = async () => {
  const name = document.querySelector('#hostName').value.trim();
  if (!name) return alert('Enter your name first.');
  try {
    await userReady;
    const code = await createRoom(name, document.querySelector('#hostGender').value);
    roomCode = code;
    unsubRoom = listenToRoom(code, onRoomUpdate);
    document.querySelector('#waitingRoomCode').textContent = code;
    document.querySelector('#roomCodeDisplay').textContent = code;
    showScreen('waiting');
  } catch (err) {
    alert(err.message || 'Could not create room. Check your connection.');
  }
};

document.querySelector('#joinRoomBtn').onclick = async () => {
  const name   = document.querySelector('#joinName').value.trim();
  const code   = document.querySelector('#joinCode').value.trim().toUpperCase();
  const gender = document.querySelector('#joinGender').value;
  if (!name || !code) return alert('Enter your name and the room code.');
  try {
    await userReady;
    roomCode = await joinRoom(code, name, gender);
    unsubRoom = listenToRoom(roomCode, onRoomUpdate);
    showScreen('waiting');
  } catch (err) {
    alert(err.message || 'Could not join room. Check the code and try again.');
  }
};

document.querySelector('#startMultiGame').onclick = async () => {
  if (!roomData || !currentUser || roomData.hostId !== currentUser.uid) return;
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

document.querySelector('#leaveRoom').onclick = () => {
  cleanupRoom();
  showScreen('start');
};

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

refreshPlayers();
renderScores(state.players);
