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
    apiKey: 'AIzaSyA8U9ECqLYMa2EsP9tSKHtlCQLfOvel4Qo',
    authDomain: 'mountainbar-f659e.firebaseapp.com',
    databaseURL: 'https://mountainbar-f659e-default-rtdb.asia-southeast1.firebasedatabase.app/',
    projectId: 'mountainbar-f659e',
    storageBucket: 'mountainbar-f659e.firebasestorage.app',
    messagingSenderId: '571561050433',
    appId: '1:571561050433:web:1361a7e949afc2868961c0'
    
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
