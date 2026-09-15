import { showScreen, initGameplay } from './gameplay.js';

const socket = io();
const $ = (sel) => document.querySelector(sel);

const SESSION_KEY = 'wikihunt_host_session';
function saveSession(data) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

let roomCode = null;
let selectedDifficulty = null;
let selectedLang = 'pt';

const ctx = { myToken: null, myName: null, roomLang: 'pt', onRoomClosed: clearSession };
const { setRoomLang, resumeIntoRound } = initGameplay(socket, ctx);

function showError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

function enterLobby(room) {
  roomCode = room.code;
  renderFlap($('#lobbyCode'), roomCode);
  $('#topbarInfo').textContent = `Sala ${roomCode} — ${ctx.myName}`;
  renderPlayers(room.players);
  showScreen('lobbyScreen');
}

// ---- Flap Display for the room-code readout (timer/room-code cells inside
// the shared gameplay module handle themselves; this one is lobby-only). ----
function renderFlap(el, text) {
  const value = String(text);
  if (el.dataset.flapValue === value) return;
  const chars = value.split('');
  const existing = el.querySelectorAll('.flap-cell');
  if (!el.dataset.flapValue || existing.length !== chars.length) {
    el.innerHTML = chars.map((c) => `<span class="flap-cell">${c}</span>`).join('');
  } else {
    chars.forEach((c, i) => {
      const cell = existing[i];
      if (cell.textContent === c) return;
      cell.classList.add('flipping');
      setTimeout(() => { cell.textContent = c; }, 90);
      setTimeout(() => { cell.classList.remove('flipping'); }, 190);
    });
  }
  el.dataset.flapValue = value;
}

// ---- Setup ----
$('#diffSelect').addEventListener('click', (e) => {
  const btn = e.target.closest('.diff-opt');
  if (!btn) return;
  document.querySelectorAll('#diffSelect .diff-opt').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDifficulty = btn.dataset.diff;
});

$('#langSelect').addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-opt');
  if (!btn) return;
  document.querySelectorAll('#langSelect .lang-opt').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  selectedLang = btn.dataset.lang;
});

$('#createRoomBtn').addEventListener('click', () => {
  const code = $('#roomCode').value.trim().toUpperCase();
  const hostName = $('#hostName').value.trim() || 'Host';
  const rounds = parseInt($('#rounds').value, 10);
  const roundMinutes = parseFloat($('#roundMinutes').value);
  const roundSeconds = Math.round((roundMinutes || 0) * 60);

  if (!code) return showError('#setupError', 'Informe o código da sala.');
  if (!selectedDifficulty) return showError('#setupError', 'Escolha uma dificuldade.');

  socket.emit('host:createRoom', { code, hostName, difficulty: selectedDifficulty, rounds, roundSeconds, lang: selectedLang }, (res) => {
    if (!res.ok) return showError('#setupError', res.error);
    ctx.myName = hostName;
    ctx.myToken = res.hostPlayerToken;
    setRoomLang(res.room);
    saveSession({ code: res.room.code, hostToken: res.hostToken, hostPlayerToken: res.hostPlayerToken, name: hostName });
    enterLobby(res.room);
  });
});

// ---- Lobby ----
function renderPlayers(players) {
  $('#playerCount').textContent = players.length ? `(${players.length})` : '';
  const list = $('#playerList');
  list.innerHTML = players
    .map((p) => `<div class="player-chip ${p.connected ? '' : 'offline'}"><span class="led"></span>${p.name}${p.isHost ? ' <span class="faint">(host)</span>' : ''}</div>`)
    .join('');
}

socket.on('room:update', (room) => {
  if (room.code !== roomCode) return;
  if (room.status === 'lobby') renderPlayers(room.players);
});

$('#startGameBtn').addEventListener('click', () => {
  socket.emit('host:startGame', (res) => {
    if (!res.ok) return showError('#lobbyError', res.error);
    // The shared gameplay module's own round:start listener switches the
    // screen once the round is actually ready — no manual transition here.
  });
});

// ---- Host-only controls ----
$('#skipRoundBtn').addEventListener('click', () => {
  socket.emit('host:nextRound', () => {});
});

$('#playAgainBtn').addEventListener('click', () => {
  socket.emit('host:playAgain', (res) => {
    if (!res.ok) return showError('#playAgainError', res.error);
  });
});

socket.on('room:closed', (data) => {
  clearSession();
  alert(data.reason || 'A sala foi encerrada.');
  window.location.href = '/';
});

// ---- Resume after refresh (F5) ----
const savedSession = loadSession();
if (savedSession?.code && savedSession?.hostToken) {
  socket.emit('host:resumeRoom', savedSession, (res) => {
    if (!res.ok) return clearSession();

    ctx.myName = savedSession.name;
    ctx.myToken = res.hostPlayerToken;
    setRoomLang(res.room);

    if (res.room.status === 'lobby') {
      enterLobby(res.room);
    } else if (res.room.status === 'playing' && res.currentRound) {
      roomCode = res.room.code;
      $('#topbarInfo').textContent = `Sala ${roomCode} — ${ctx.myName}`;
      resumeIntoRound(res.currentRound, res.resume);
    } else {
      clearSession();
    }
  });
}
