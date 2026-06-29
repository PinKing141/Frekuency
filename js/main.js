// ── Solo mode imports ──
import { state } from './core/gameState.js';
import { addPlayer, removePlayer, resetPlayers } from './core/playerManager.js';
import { drawCard, drawCardForRoom, killCard, reshuffleCurrent } from './core/cardDrawer.js';
import { advanceTurn, resetTurn } from './core/turnManager.js';
import { clearPlayers } from './core/storage.js';
import { customCards, addCustomCard, removeCustomCard, buildCustomCard } from './core/customCards.js';
import { settings, saveSettings } from './core/settings.js';
import { categories, addCategory, removeCategory, categoryName } from './core/categories.js';
import { click as soundClick, drink as soundDrink, buzz as soundBuzz, flip as soundFlip, isMuted, toggleMute } from './core/sound.js';
import { showScreen } from './ui/screens.js';
import { setupDebug } from './ui/debug.js';
import { startTimer, stopTimer } from './ui/timer.js';
import { renderCard, renderRoomCard } from './ui/renderCard.js';
import { renderPlayers, renderScores } from './ui/renderPlayers.js';
import { escapeHtml } from './utils/helpers.js';

// ── Multiplayer (Firebase) — loaded lazily ──
// Firebase comes from a CDN, so a static import would make a network failure
// (or being offline) break the whole app, including solo. Instead we import it
// on demand the first time multiplayer is used; solo never touches the network.

// ──────────────────────
// State
// ──────────────────────

let mpMode      = false;
let roomCode    = null;
let roomData    = null;
let myPlayerId  = null;   // unique per participant, independent of the shared anon auth uid
let unsubRoom   = null;
let lastRoomCardId = null; // so the multiplayer timer only restarts on a new card

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// Lazily import Firebase + room service and sign in anonymously. Anonymous
// sign-in only satisfies Firestore security rules (request.auth != null);
// player identity uses myPlayerId, NOT the auth uid (two people in the same
// browser share an anon uid, which would otherwise collide on join).
let fb = null;
let fbLoading = null;
function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  if (fbLoading) return fbLoading;
  fbLoading = Promise.all([
    import('./firebase/firebaseConfig.js'),
    import('./firebase/roomService.js')
  ]).then(async ([cfg, svc]) => {
    fb = { ...cfg, ...svc };
    try { await cfg.loginGuest(); await cfg.waitForUser(); }
    catch (err) { console.error('Firebase auth failed:', err); }
    return fb;
  });
  return fbLoading;
}

// ──────────────────────
// Solo helpers
// ──────────────────────

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
  const count = document.querySelector('#customCount');
  if (count) count.textContent = customCards.length;
  renderCardList(document.querySelector('#customList'), customCards, c => {
    removeCustomCard(c.id);
    refreshCustomCards();
  });
}

function soloTimerSeconds() {
  return Number(settings.timerSeconds) || 0;
}

// --- Categories (custom card groups) ---

// Fill the "Category" dropdown on the Custom Cards screen.
function renderCategoryOptions() {
  const sel = document.querySelector('#customCategory');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">None (Custom)</option>' +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

// List of categories with a remove button (on the Custom Cards screen).
function renderCategoryList() {
  const ul = document.querySelector('#categoryList');
  if (!ul) return;
  ul.innerHTML = '';
  categories.forEach(cat => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = cat.name;
    const btn = document.createElement('button');
    btn.className = 'remove-player';
    btn.textContent = 'Remove';
    btn.onclick = () => {
      removeCategory(cat.id);
      refreshCategories();
    };
    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function refreshCategories() {
  renderCategoryOptions();
  renderCategoryList();
  renderSettingsCategories();
}

// --- Game settings modal ---

const settingsModal = document.querySelector('#settingsModal');

// Render the per-custom-category on/off toggles inside Game settings.
function renderSettingsCategories() {
  const wrap = document.querySelector('#settingsCategories');
  const note = document.querySelector('#noCategoriesNote');
  if (!wrap) return;
  wrap.innerHTML = '';
  categories.forEach(cat => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.categories[cat.id] !== false;
    cb.onchange = () => { settings.categories[cat.id] = cb.checked; saveSettings(); };
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + cat.name));
    wrap.appendChild(label);
  });
  if (note) note.hidden = categories.length > 0;
}

// Mirror the persisted settings into the modal's checkboxes + selects, and wire
// each control to write straight back to settings (single source of truth).
function initSettingsUI() {
  document.querySelectorAll('#settingsModal .levelCheck').forEach(cb => {
    const lvl = Number(cb.value);
    cb.checked = settings.levels[lvl] !== false;
    cb.onchange = () => { settings.levels[lvl] = cb.checked; saveSettings(); };
  });
  const toggle = (id, key) => {
    const el = document.querySelector('#' + id);
    if (!el) return;
    el.checked = settings[key] !== false;
    el.onchange = () => { settings[key] = el.checked; saveSettings(); };
  };
  toggle('allowContact', 'allowContact');
  toggle('allowTarget',  'allowTarget');
  toggle('allowNever',   'allowNever');
  toggle('allowWould',   'allowWould');

  const intensity = document.querySelector('#intensity');
  const intensityName = document.querySelector('#intensityName');
  if (intensity) {
    const setName = () => {
      if (intensityName) intensityName.textContent = INTENSITY_NAMES[Number(intensity.value)] || 'Spicy';
    };
    intensity.value = String(settings.intensity ?? 2);
    setName();
    intensity.oninput = () => {
      settings.intensity = Number(intensity.value);
      setName();
      saveSettings();
    };
  }

  const timer = document.querySelector('#timerSeconds');
  if (timer) {
    timer.value = String(settings.timerSeconds || 0);
    timer.onchange = () => { settings.timerSeconds = Number(timer.value) || 0; saveSettings(); };
  }
  renderSettingsCategories();
}

const INTENSITY_NAMES = ['Plain', 'Soft', 'Spicy', 'Freaky', 'Nasty', 'Unhinged'];

function openSettings()  { settingsModal.classList.add('open'); }
function closeSettings() { settingsModal.classList.remove('open'); }

// Reflect the face-down dead pile (count + visibility) on the game screen.
function refreshDeadPile() {
  const pile  = document.querySelector('#deadPile');
  const count = document.querySelector('#deadCount');
  const n = state.deadPile.length;
  if (count) count.textContent = n;
  if (pile)  pile.hidden = mpMode || n === 0;
}

// Shared "time's up" handler: buzz and nudge the player to drink/pass.
function onTimerExpire() {
  soundBuzz();
  const footer = document.querySelector('#cardFooter');
  if (footer) footer.textContent = '⏰ Time\'s up — drink or pass!';
}

function handleDrawCard() {
  if (state.players.length < 2) return alert('Add at least 2 players.');
  const result = drawCard();
  if (!result) return alert('No cards match these settings. Turn on more levels or update players.');
  renderCard(result);
  // A card's own timer (timed dares) wins over the turn-timer setting.
  startTimer(result.card.timer || soloTimerSeconds(), onTimerExpire);
}

function handleNextTurn(scored) {
  if (!state.players.length) return;
  // Tally for the end-of-game awards: a "Done" is a completed card, a "Drink"
  // is a dodge. advanceTurn handles the score; we just track the drink count.
  const cur = state.players[state.turn % state.players.length];
  if (cur) {
    if (scored) cur.dids = (cur.dids || 0) + 1;
    else cur.drinks = (cur.drinks || 0) + 1;
  }
  // The card that was on screen is done — set it aside in the dead pile.
  if (state.currentCard) { killCard(state.currentCard.id); refreshDeadPile(); }
  advanceTurn(scored);
  renderScores(state.players);
  handleDrawCard();
}

// ──────────────────────
// Multiplayer helpers
// ──────────────────────

function onRoomUpdate(room) {
  // Room document vanished (expired/cleaned up) while we were in it.
  if (!room) {
    if (mpMode) {
      cleanupRoom();
      showScreen('start');
      alert('This room has closed.');
    }
    return;
  }
  roomData = room;

  // Transition to game when host starts
  if (room.status === 'playing') {
    const gameScreen = document.querySelector('#screen-game');
    if (!gameScreen.classList.contains('active')) {
      showScreen('game');
      setupMultiplayerGameUI();
    }
    if (room.currentCard) {
      renderRoomCard(room.currentCard);
      if (room.currentCard.id !== lastRoomCardId) {
        lastRoomCardId = room.currentCard.id;
        startTimer(room.currentCard.timer || (room.settings && room.settings.timerSeconds) || 0, onTimerExpire);
      }
    }
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
    try { const f = await loadFirebase(); await f.setRoomCustomCards(roomCode, next); }
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
  refreshDeadPile();   // dead pile / reshuffle are solo-only — hide them online
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
  const f = await loadFirebase();
  await f.updateCurrentCard(roomCode, card);
}

async function handleMpNextTurn(tookDrink) {
  if (!roomData) return;
  const f = await loadFirebase();
  if (tookDrink) {
    const players = roomData.players.map((p, i) =>
      i === roomData.currentPlayerIndex ? { ...p, drinksTaken: (p.drinksTaken || 0) + 1 } : p
    );
    await f.markPlayerDrink(roomCode, players);
  }
  const nextIndex = (roomData.currentPlayerIndex + 1) % roomData.players.length;
  await f.advanceRoomTurn(roomCode, nextIndex);
  // onSnapshot fires → roomData updates → draw next card
  const updatedRoom = { ...roomData, currentPlayerIndex: nextIndex };
  const card = drawCardForRoom(updatedRoom);
  if (card) await f.updateCurrentCard(roomCode, card);
}

function cleanupRoom() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  stopTimer();
  lastRoomCardId = null;
  roomCode   = null;
  roomData   = null;
  myPlayerId = null;
  mpMode     = false;
  document.querySelector('#room-bar').hidden = true;
  document.querySelector('#backSetup').textContent = 'Setup';
}

// ──────────────────────
// Event bindings — solo
// ──────────────────────

document.querySelector('#startSetup').onclick = () => showScreen('setup');
document.querySelector('#setupBack').onclick  = () => { stopTimer(); showScreen('start'); };

document.querySelector('#backSetup').onclick = () => {
  if (mpMode) {
    if (confirm('Leave the room?')) { cleanupRoom(); showScreen('start'); }
  } else {
    stopTimer();
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
  const catId = document.querySelector('#customCategory').value || null;
  addCustomCard({
    text,
    level: document.querySelector('#customLevel').value,
    categoryId: catId,
    categoryName: catId ? categoryName(catId) : null
  });
  input.value = '';
  refreshCustomCards();
};

document.querySelector('#customText').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.querySelector('#addCustomCard').click();
});

document.querySelector('#addCategory').onclick = () => {
  const input = document.querySelector('#newCategoryName');
  const name = input.value.trim();
  if (!name) return alert('Name your category first.');
  const cat = addCategory(name);
  input.value = '';
  refreshCategories();
  if (cat) document.querySelector('#customCategory').value = cat.id;
};

document.querySelector('#newCategoryName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.querySelector('#addCategory').click();
});

document.querySelector('#customBack').onclick = () => showScreen('start');

// Settings + Custom-cards openers (multiple entry points share a class)
document.querySelectorAll('.js-open-settings').forEach(b => b.addEventListener('click', openSettings));
document.querySelectorAll('.js-open-custom').forEach(b => b.addEventListener('click', () => showScreen('custom')));
document.querySelectorAll('.js-open-rules').forEach(b => b.addEventListener('click', () => document.querySelector('#rulesModal').classList.add('open')));

document.querySelector('#closeSettings').onclick = closeSettings;
document.querySelector('#settingsDone').onclick  = closeSettings;
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

document.querySelector('#beginGame').onclick = () => {
  if (state.players.length < 2) return alert('Add at least 2 players.');
  resetTurn();           // fresh session: clear dead pile + rotation
  refreshDeadPile();
  showScreen('game');
  renderScores(state.players);
  handleDrawCard();
};

document.querySelector('#reshuffleCards').onclick = () => {
  reshuffleCurrent();    // re-randomise the live deck; dead pile is untouched
  soundFlip();
  handleDrawCard();      // deal a fresh card from the reshuffled deck
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
  soundDrink();
  if (mpMode) handleMpNextTurn(true);
  else handleNextTurn(false);
};

document.querySelector('#resetAll').onclick = () => {
  if (!confirm('Reset all players and scores?')) return;
  resetPlayers();
  clearPlayers();
  resetTurn();
  refreshDeadPile();
  refreshPlayers();
  renderScores(state.players);
};

// ──────────────────────
// Scoreboard drawer + end-of-game awards
// ──────────────────────

const scoreToggle = document.querySelector('#scoreToggle');
const scoreDrawer = document.querySelector('#scoreDrawer');
if (scoreToggle && scoreDrawer) {
  scoreToggle.onclick = () => {
    const open = scoreDrawer.classList.toggle('open');
    scoreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
}

// Pick the player with the highest value of fn(p); ties break to the first.
function topBy(players, fn) {
  return players.reduce((best, p) => (fn(p) > fn(best) ? p : best), players[0]);
}
function bottomBy(players, fn) {
  return players.reduce((best, p) => (fn(p) < fn(best) ? p : best), players[0]);
}

// Build the "Most Wanted" awards from the tallies gathered this game.
function computeAwards(players) {
  const named = players.filter(p => p && p.name);
  if (named.length < 1) return [];
  const dids   = p => p.score || p.dids || 0;
  const drinks = p => p.drinks || p.drinksTaken || 0;
  const total  = named.reduce((s, p) => s + dids(p) + drinks(p), 0);
  if (total === 0) return [];

  const awards = [];
  const push = (icon, title, who, sub) => { if (who) awards.push({ icon, title, who: who.name, sub }); };

  push('😈', 'Most Shameless', topBy(named, dids), 'did the most cards');
  push('🥃', 'Biggest Drink Dodger', topBy(named, drinks), 'took the most drinks');
  if (named.length > 1) {
    push('😇', 'Most Innocent-Looking Menace', bottomBy(named, dids), 'kept the lowest body count… allegedly');
  }
  // A bit of chaos: random "Most Wanted" sash.
  const wanted = named[Math.floor(Math.random() * named.length)];
  push('🔥', 'Most Wanted', wanted, 'the room has decided');
  return awards;
}

function renderAwards(players) {
  const list = document.querySelector('#awardsList');
  if (!list) return false;
  const awards = computeAwards(players);
  list.innerHTML = '';
  if (!awards.length) {
    list.innerHTML = '<li class="awards-empty">Play a few cards first, then end the game to crown the winners.</li>';
    return true;
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
  return true;
}

const awardsModal = document.querySelector('#awardsModal');
function openAwards() {
  const players = mpMode && roomData ? roomData.players : state.players;
  renderAwards(players || []);
  awardsModal.classList.add('open');
}
function closeAwards() { awardsModal.classList.remove('open'); }

document.querySelector('#endGame').onclick = openAwards;
document.querySelector('#closeAwards').onclick = closeAwards;
document.querySelector('#awardsClose2').onclick = closeAwards;
document.querySelector('#awardsPlayAgain').onclick = () => {
  closeAwards();
  if (mpMode) return;   // scores live in the room for multiplayer
  state.players.forEach(p => { p.score = 0; p.dids = 0; p.drinks = 0; });
  resetTurn();
  refreshDeadPile();
  renderScores(state.players);
};

// ──────────────────────
// Event bindings — multiplayer
// ──────────────────────

document.querySelector('#startMultiplayer').onclick = () => { showScreen('lobby'); loadFirebase(); };
document.querySelector('#lobbyBack').onclick        = () => showScreen('start');

document.querySelector('#createRoomBtn').onclick = async () => {
  const name = document.querySelector('#hostName').value.trim();
  if (!name) return alert('Enter your name first.');
  try {
    const f = await loadFirebase();
    myPlayerId = newId();
    f.cleanupStaleRooms();   // fire-and-forget: trim expired rooms
    const code = await f.createRoom(name, document.querySelector('#hostGender').value, myPlayerId);
    roomCode = code;
    unsubRoom = f.listenToRoom(code, onRoomUpdate);
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
    const f = await loadFirebase();
    myPlayerId = newId();
    roomCode = await f.joinRoom(code, name, gender, myPlayerId);
    unsubRoom = f.listenToRoom(roomCode, onRoomUpdate);
    showScreen('waiting');
  } catch (err) {
    console.error('Join room failed:', err);
    alert(err.message || 'Could not join room. Check the code and try again.');
  }
};

document.querySelector('#startMultiGame').onclick = async () => {
  if (!roomData || roomData.hostId !== myPlayerId) return;
  if (roomData.players.length < 2) return alert('Need at least 2 players to start.');

  const f = await loadFirebase();
  // Push host's chosen settings before starting
  const settings = {
    maxLevel:            Number(document.querySelector('#mpMaxLevel').value),
    allowTargetedCards:  document.querySelector('#mpAllowTarget').checked,
    allowPhysicalCards:  document.querySelector('#mpAllowContact').checked,
    timerSeconds:        Number(document.querySelector('#mpTimerSeconds').value) || 0
  };
  await f.updateRoomSettings(roomCode, settings);

  // Draw first card with the new settings applied
  const updatedRoom = { ...roomData, settings };
  const firstCard = drawCardForRoom(updatedRoom);
  if (firstCard) await f.updateCurrentCard(roomCode, firstCard);

  await f.startGame(roomCode);
};

document.querySelector('#mpAddCustomCard').onclick = async () => {
  if (!roomData || roomData.hostId !== myPlayerId) return;
  const input = document.querySelector('#mpCustomText');
  const text = input.value.trim();
  if (!text) return alert('Type a prompt first.');
  const card = buildCustomCard({ text, level: document.querySelector('#mpCustomLevel').value });
  input.value = '';
  try {
    const f = await loadFirebase();
    await f.addRoomCustomCard(roomCode, card);
  } catch (err) {
    console.error('Add custom card failed:', err);
    alert('Could not add the card. Check your connection.');
  }
};

document.querySelector('#leaveRoom').onclick = () => {
  cleanupRoom();
  showScreen('start');
};

document.querySelector('#waitingBack').onclick = () => {
  if (confirm('Leave the room?')) { cleanupRoom(); showScreen('lobby'); }
};

// ──────────────────────
// Sound + rules
// ──────────────────────

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
  if (btn && btn.id !== 'muteToggle' && btn.id !== 'drink') soundClick();
});

const rules = document.querySelector('#rulesModal');
const closeRules = () => rules.classList.remove('open');
document.querySelector('#closeRules').onclick  = closeRules;
document.querySelector('#closeRules2').onclick = closeRules;
rules.addEventListener('click', e => { if (e.target === rules) closeRules(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeRules();
  closeSettings();
});

// ──────────────────────
// 18+ gate — shown once, remembered in localStorage
// ──────────────────────

const AGE_KEY = 'freakquencyAgeOk';
const ageModal = document.querySelector('#ageModal');
if (localStorage.getItem(AGE_KEY) !== '1') {
  ageModal.hidden = false;
  ageModal.classList.add('open');
}
document.querySelector('#ageConfirm').onclick = () => {
  localStorage.setItem(AGE_KEY, '1');
  ageModal.classList.remove('open');
  ageModal.hidden = true;
};
document.querySelector('#ageLeave').onclick = () => {
  document.body.innerHTML =
    '<div style="min-height:100dvh;display:grid;place-items:center;padding:32px;text-align:center;color:#c5a8d8;font-family:Inter,sans-serif">' +
    'Come back when everyone playing is 18+. 👋</div>';
};

// ──────────────────────
// Init
// ──────────────────────

refreshPlayers();
renderScores(state.players);
refreshCustomCards();
refreshCategories();
initSettingsUI();
refreshDeadPile();
setupDebug({ getRoomCustomCards: () => (roomData && roomData.customCards) || [] });

// Register the service worker so the app installs and works offline for solo.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
