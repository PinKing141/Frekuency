import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  collection,
  query,
  where,
  limit,
  getDocs,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebaseConfig.js";

// How long a room lives before it's considered stale and eligible for cleanup.
const ROOM_TTL_HOURS = 8;

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(hostName, gender, playerId) {
  const code = makeRoomCode();
  const roomRef = doc(db, "rooms", code);

  await setDoc(roomRef, {
    code,
    hostId: playerId,
    status: "waiting",
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + ROOM_TTL_HOURS * 3600 * 1000),
    currentPlayerIndex: 0,
    currentCard: null,
    usedCardIds: [],
    customCards: [],
    settings: {
      maxLevel: 2,
      allowTargetedCards: true,
      allowPhysicalCards: false,
      timerSeconds: 0
    },
    players: [{
      id: playerId,
      name: hostName,
      gender: gender || "any",
      drinksTaken: 0,
      isHost: true
    }]
  });

  return code;
}

export async function joinRoom(code, playerName, gender, playerId) {
  const clean = code.trim().toUpperCase();
  const roomRef = doc(db, "rooms", clean);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) throw new Error("Room not found. Check the code and try again.");

  const room = snap.data();
  if (room.status === "playing") throw new Error("That game has already started.");

  const alreadyIn = room.players.some(p => p.id === playerId);
  if (!alreadyIn) {
    await updateDoc(roomRef, {
      players: arrayUnion({
        id: playerId,
        name: playerName,
        gender: gender || "any",
        drinksTaken: 0,
        isHost: false
      })
    });
  }

  return clean;
}

export function listenToRoom(code, callback) {
  const roomRef = doc(db, "rooms", code);
  return onSnapshot(roomRef, snap => callback(snap.exists() ? snap.data() : null));
}

export async function startGame(code) {
  await updateDoc(doc(db, "rooms", code), { status: "playing" });
}

export async function updateCurrentCard(code, card) {
  await updateDoc(doc(db, "rooms", code), {
    currentCard: card,
    usedCardIds: arrayUnion(card.id)
  });
}

export async function advanceRoomTurn(code, nextIndex) {
  await updateDoc(doc(db, "rooms", code), { currentPlayerIndex: nextIndex });
}

export async function updateRoomSettings(code, settings) {
  await updateDoc(doc(db, "rooms", code), { settings });
}

export async function markPlayerDrink(code, players) {
  await updateDoc(doc(db, "rooms", code), { players });
}

export async function addRoomCustomCard(code, card) {
  await updateDoc(doc(db, "rooms", code), { customCards: arrayUnion(card) });
}

export async function setRoomCustomCards(code, customCards) {
  await updateDoc(doc(db, "rooms", code), { customCards });
}

// Opportunistic cleanup: delete a handful of rooms whose expireAt has passed.
// Called fire-and-forget whenever someone creates a room, so the collection
// self-trims without any server. Best-effort — failures are swallowed (e.g. if
// Firestore rules forbid client deletes, use a TTL policy on expireAt instead).
export async function cleanupStaleRooms(maxDeletes = 10) {
  try {
    const q = query(
      collection(db, "rooms"),
      where("expireAt", "<", Timestamp.now()),
      limit(maxDeletes)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    return snap.size;
  } catch (err) {
    console.warn("Room cleanup skipped:", err && err.message ? err.message : err);
    return 0;
  }
}
