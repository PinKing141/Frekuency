import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, auth } from "./firebaseConfig.js";

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(hostName, gender) {
  const code = makeRoomCode();
  const roomRef = doc(db, "rooms", code);

  await setDoc(roomRef, {
    code,
    hostId: auth.currentUser.uid,
    status: "waiting",
    createdAt: serverTimestamp(),
    currentPlayerIndex: 0,
    currentCard: null,
    usedCardIds: [],
    settings: {
      maxLevel: 2,
      allowTargetedCards: true,
      allowPhysicalCards: false
    },
    players: [{
      id: auth.currentUser.uid,
      name: hostName,
      gender: gender || "any",
      drinksTaken: 0,
      isHost: true
    }]
  });

  return code;
}

export async function joinRoom(code, playerName, gender) {
  const clean = code.trim().toUpperCase();
  const roomRef = doc(db, "rooms", clean);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) throw new Error("Room not found. Check the code and try again.");

  const room = snap.data();
  if (room.status === "playing") throw new Error("That game has already started.");

  const alreadyIn = room.players.some(p => p.id === auth.currentUser.uid);
  if (!alreadyIn) {
    await updateDoc(roomRef, {
      players: arrayUnion({
        id: auth.currentUser.uid,
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
