import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCC6tvytUGZSqEkXXkSzAympvLzvoL1aMM",
  authDomain: "freakquency-db802.firebaseapp.com",
  projectId: "freakquency-db802",
  storageBucket: "freakquency-db802.firebasestorage.app",
  messagingSenderId: "943044186550",
  appId: "1:943044186550:web:6f7ef799bc336f3fd1b117",
  measurementId: "G-JY4CM7X5LR"
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export function loginGuest() {
  return signInAnonymously(auth);
}

export function waitForUser() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, user => { if (user) resolve(user); });
  });
}
