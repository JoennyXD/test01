// app.js
import { initNet, createRoom, joinRoom, onRemoteMove, sendMove, onRoomStatus } from './net.js';

const N = 15;            // Board size
const CELL = 40;         // Pixel size per cell (auto scaled by canvas size)
const LINE_COLOR = '#333';
const BLACK = 1, WHITE = 2;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const roomLabel = document.getElementById('roomLabel');
const turnLabel = document.getElementById('turnLabel');
const youLabel = document.getElementById('youLabel');

let board = createEmptyBoard(N);
let turn = BLACK;        // Current player
let me = null;           // My color (BLACK or WHITE)
let roomId = null;       // Current room

// UI wiring
document.getElementById('createRoomBtn').onclick = async () => {
  const { id, role } = await createRoom();
  roomId = id; me = role;
  roomLabel.textContent = roomId;
  youLabel.textContent = me === BLACK ? 'Black' : 'White';
  status('Room created. Share: ?room=' + roomId);
  draw();
};

document.getElementById('joinRoomBtn').onclick = async () => {
  const inputId = document.getElementById('roomIdInput').value.trim();
  if (!inputId) return status('Enter a room ID.');
  const { id, role } = await joinRoom(inputId);
  roomId = id; me = role;
  roomLabel.textContent = roomId;
  youLabel.textContent = me === BLACK ? 'Black' : 'White';
  status('Joined room.');
  draw();
};

// Auto-join via URL
const params = new URLSearchParams(window.location.search);
if (params.has('room')) {
  joinRoom(params.get('room')).then(({ id, role }) => {
    roomId = id; me = role;
    roomLabel.textContent = roomId;
    youLabel.textContent = me === BLACK ? 'Black' : 'White';
    status('Joined room via link.');
    draw();
  }).catch(e => status(e.message));
}

onRemoteMove(({ x, y, color }) => {
  if (board[y][x] !== 0) return;
  board[y][x] = color;
  turn = nextTurn(turn);
  const winner = checkWin(board, x, y, color);
  updateLabels();
  draw();
  if (winner) status((winner === BLACK ? 'Black' : 'White') + ' wins!');
});

onRoomStatus(s => status(s));

canvas.addEventListener('click', async (e) => {
  if (!roomId) return status('Create or join a room first.');
  if (turn !== me) return status('Wait for your turn.');
  const { x, y } = eventToCell(e);

  // Renju nuance: implement forbidden-move checks later. For now, use exact-five rule (no overlines).
  if (board[y][x] !== 0) return;
  const tentative = me;
  // Enforce exact five (reject overline > 5)
  const winLen = maxLineLength(board, x, y, tentative);
  // Place only if it doesn't immediately create >5
  if (winLen > 5) return status('Overline is forbidden in Renju.');

  board[y][x] = tentative;
  const winner = checkWin(board, x, y, tentative);
  turn = nextTurn(turn);
  updateLabels();
  draw();
  await sendMove({ x, y, color: tentative });

  if (winner) status((winner === BLACK ? 'Black' : 'White') + ' wins!');
});

function createEmptyBoard(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function eventToCell(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const x = Math.round(px / CELL);
  const y = Math.round(py / CELL);
  // Clamp to valid intersections (0..N-1)
  return { x: Math.max(0, Math.min(N - 1, x)), y: Math.max(0, Math.min(N - 1, y)) };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawStones();
}

function drawGrid() {
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    // horizontal
    ctx.beginPath();
    ctx.moveTo(CELL, CELL + i * CELL);
    ctx.lineTo(CELL * N, CELL + i * CELL);
    ctx.stroke();
    // vertical
    ctx.beginPath();
    ctx.moveTo(CELL + i * CELL, CELL);
    ctx.lineTo(CELL + i * CELL, CELL * N);
    ctx.stroke();
  }
}

function drawStone(x, y, color) {
  const cx = CELL + x * CELL;
  const cy = CELL + y * CELL;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = color === BLACK ? '#111' : '#fafafa';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function drawStones() {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (board[y][x] !== 0) drawStone(x, y, board[y][x]);
    }
  }
}

function nextTurn(t) { return t === BLACK ? WHITE : BLACK; }

function countDir(b, x, y, dx, dy, color) {
  let c = 0;
  let i = 1;
  while (true) {
    const nx = x + dx * i, ny = y + dy * i;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
    if (b[ny][nx] === color) { c++; i++; } else break;
  }
  return c;
}

function maxLineLength(b, x, y, color) {
  // Count including the placed stone (assume place)
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  let maxLen = 1;
  for (const [dx,dy] of dirs) {
    const c = 1 + countDir(b, x, y, dx, dy, color) + countDir(b, x, y, -dx, -dy, color);
    maxLen = Math.max(maxLen, c);
  }
  return maxLen;
}

function checkWin(b, x, y, color) {
  // Renju: win is exactly 5. Here we detect 5, and we reject >5 earlier.
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dx,dy] of dirs) {
    const c = 1 + countDir(b, x, y, dx, dy, color) + countDir(b, x, y, -dx, -dy, color);
    if (c === 5) return color;
  }
  return null;
}

function updateLabels() {
  turnLabel.textContent = turn === BLACK ? 'Black' : 'White';
}

function status(text) { statusEl.textContent = text; }
initNet();
