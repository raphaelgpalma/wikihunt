import { showScreen, initGameplay } from './gameplay.js';

const socket = io();
const $ = (sel) => document.querySelector(sel);

const SESSION_KEY = 'wikihunt_player_session';
function saveSession(data) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

let roomCode = null;
const ctx = { myToken: null, myName: null, roomLang: 'pt', onRoomClosed: clearSession };
const { setRoomLang, resumeIntoRound } = initGameplay(socket, ctx);

function showError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

// ---- Join ----
const prefilledCode = new URLSearchParams(window.location.search).get('code');
if (prefilledCode) {
  $('#joinCode').value = prefilledCode.toUpperCase();
  $('#joinName').focus();
}

function enterLobby(room) {
  roomCode = room.code;
  $('#topbarInfo').textContent = `Sala ${roomCode} — ${ctx.myName}`;
  $('#lobbyCode').textContent = roomCode;
  renderPlayerList(room.players);
  showScreen('lobbyScreen');
}

$('#joinBtn').addEventListener('click', () => {
  const code = $('#joinCode').value.trim().toUpperCase();
  const name = $('#joinName').value.trim();
  if (!code || !name) return showError('#joinError', 'Preencha o código e seu apelido.');

  socket.emit('player:joinRoom', { code, name }, (res) => {
    if (!res.ok) return showError('#joinError', res.error);
    ctx.myName = name;
    ctx.myToken = res.playerToken;
    setRoomLang(res.room);
    saveSession({ code: res.room.code, name: ctx.myName, token: ctx.myToken });
    enterLobby(res.room);
  });
});

function renderPlayerList(players) {
  const list = $('#playerList');
  list.innerHTML = players
    .map((p) => `<div class="player-chip ${p.connected ? '' : 'offline'}"><span class="led"></span>${p.name}${p.isHost ? ' <span class="faint">(host)</span>' : ''}</div>`)
    .join('') || '<div class="empty-note">Aguardando participantes...</div>';
}

socket.on('room:update', (room) => {
  if (room.code !== roomCode) return;
  if (room.status === 'lobby') renderPlayerList(room.players);
});

// ---- Resume after refresh (F5) ----
const savedSession = loadSession();
if (savedSession?.code && savedSession?.token) {
  socket.emit('player:joinRoom', { code: savedSession.code, name: savedSession.name, playerToken: savedSession.token }, (res) => {
    if (!res.ok) return clearSession();

    ctx.myName = savedSession.name;
    ctx.myToken = res.playerToken;
    setRoomLang(res.room);
    saveSession({ code: res.room.code, name: ctx.myName, token: ctx.myToken });

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
