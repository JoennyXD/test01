// net.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, onValue, set, update, push, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

let db;
let roomId = null;
let me = null; // BLACK (1) or WHITE (2)
let onMoveCb = () => {};
let onStatusCb = () => {};

export function initNet() {
  const firebaseConfig = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
    projectId: 'YOUR_PROJECT',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID'
  };
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

export async function createRoom() {
  roomId = randomId();
  const roomRef = ref(db, `rooms/${roomId}`);
  await set(roomRef, {
    createdAt: Date.now(),
    players: { black: true },
    turn: 1,
    moves: []
  });
  subscribe(roomId);
  me = 1; // Black
  if (onStatusCb) onStatusCb('Room ready. Waiting for White to join.');
  return { id: roomId, role: me };
}

export async function joinRoom(id) {
  const roomRef = ref(db, `rooms/${id}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) throw new Error('Room not found.');
  const room = snapshot.val();
  roomId = id;

  if (!room.players?.white && room.players?.black) {
    await update(roomRef, { players: { black: true, white: true } });
    me = 2; // White
  } else if (!room.players?.black) {
    await update(roomRef, { players: { black: true } });
    me = 1; // Black
  } else {
    me = 2; // default to White if both exist (spectator would be extra logic)
  }

  subscribe(roomId);
  if (onStatusCb) onStatusCb('Joined room.');
  return { id: roomId, role: me };
}

function subscribe(id) {
  const roomRef = ref(db, `rooms/${id}`);
  onValue(roomRef, (snap) => {
    const room = snap.val();
    if (!room) return;
    // Emit latest move if any
    if (room.moves && room.moves.length) {
      const last = room.moves[room.moves.length - 1];
      onMoveCb(last);
    }
    // Turn sync could be done here if desired
  });
}

export async function sendMove(move) {
  const movesRef = ref(db, `rooms/${roomId}/moves`);
  // Atomic append
  const snapshot = await get(movesRef);
  const moves = snapshot.val() || [];
  moves.push(move);
  await set(movesRef, moves);
  // Optionally update turn on server
  const nextTurn = move.color === 1 ? 2 : 1;
  await update(ref(db, `rooms/${roomId}`), { turn: nextTurn });
}

export function onRemoteMove(cb) { onMoveCb = cb; }
export function onRoomStatus(cb) { onStatusCb = cb; }
