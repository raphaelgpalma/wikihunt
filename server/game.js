import { nanoid } from 'nanoid';
import { roomCodes, wordPairs, pickRandom } from './db.js';
import { createRoom, getRoom, removeRoom, publicRoomState } from './rooms.js';
import { getRedirectAliases, getLangLink, getRandomArticle, findShortestPath, DEFAULT_LANG, SUPPORTED_LANGS } from './wiki.js';

const CUTOFF_MS = 30_000;
const RESULTS_DELAY_MS = 10_000;
const HOST_GRACE_MS = 45_000;
const NAME_MAX = 20;

function scoreForRank(rank) {
  return Math.max(100 - (rank - 1) * 15, 20);
}

function sortedLeaderboard(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ place: i + 1, id: p.token, name: p.name, score: p.score, connected: p.connected, isHost: p.token === room.hostPlayerToken }));
}

// Word pairs are curated once in DEFAULT_LANG. A room running in another
// language needs the equivalent article via Wikipedia's own interlanguage
// links; pairs with no equivalent in that language are skipped rather than
// blocking room creation, since coverage varies pair by pair.
async function resolvePairsForLang(matchingPairs, rounds, lang) {
  if (lang === DEFAULT_LANG) return { resolved: pickRandom(matchingPairs, rounds), attempted: rounds };

  const shuffled = pickRandom(matchingPairs, matchingPairs.length);
  const resolved = [];
  let attempted = 0;
  for (const pair of shuffled) {
    if (resolved.length >= rounds) break;
    attempted += 1;
    const [start_title, target_title] = await Promise.all([
      getLangLink(pair.start_title, DEFAULT_LANG, lang),
      getLangLink(pair.target_title, DEFAULT_LANG, lang),
    ]);
    if (start_title && target_title) {
      resolved.push({ ...pair, start_title, target_title });
    }
  }
  return { resolved, attempted };
}

// Chaos mode draws two live random articles instead of an admin-curated
// pair. Retries a handful of times if the API hiccups or, vanishingly
// rarely, draws the same article twice.
async function generateChaosPair(lang) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [start_title, target_title] = await Promise.all([
        getRandomArticle(lang),
        getRandomArticle(lang),
      ]);
      if (start_title.trim().toLowerCase() !== target_title.trim().toLowerCase()) {
        return { start_title, target_title };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Não foi possível sortear um par de artigos.');
}

function closeCodeInDb(code) {
  roomCodes.updateOne((c) => c.code === code, { status: 'closed', closed_at: new Date().toISOString() });
}

function currentRoundInfo(room) {
  if (room.status !== 'playing' || !room.currentRound) return null;
  return {
    roundIndex: room.roundIndex,
    totalRounds: room.config.rounds,
    startTitle: room.currentRound.pair.start_title,
    targetTitle: room.currentRound.pair.target_title,
    targetAliases: room.currentRound.targetAliases || [],
    endsAt: room.currentRound.endsAt,
    difficulty: room.config.difficulty,
  };
}

// Normalizes the trailing ack callback (falls back to a no-op if the client didn't
// send a real function) and catches thrown errors, so a malformed or malicious
// client emit can never take down the whole process for every active room.
function safeOn(socket, event, handler) {
  socket.on(event, (...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
    try {
      handler(...args, ack);
    } catch (err) {
      console.error(`[socket:${event}]`, err);
      try { ack({ ok: false, error: 'Erro interno.' }); } catch { /* ack itself is broken, nothing to do */ }
    }
  });
}

export function registerGameHandlers(io) {
  io.on('connection', (socket) => {
    safeOn(socket, 'host:createRoom', async (payload, ack) => {
        const code = String(payload?.code || '').trim().toUpperCase();
        const hostName = String(payload?.hostName || 'Host').trim().slice(0, NAME_MAX) || 'Host';
        const difficulty = ['easy', 'medium', 'hard', 'chaos'].includes(payload?.difficulty) ? payload.difficulty : null;
        const rounds = Math.min(Math.max(parseInt(payload?.rounds, 10) || 0, 1), 15);
        const roundSeconds = Math.min(Math.max(parseInt(payload?.roundSeconds, 10) || 0, 15), 1800);
        const lang = SUPPORTED_LANGS.includes(payload?.lang) ? payload.lang : DEFAULT_LANG;

        if (!code) return ack({ ok: false, error: 'Informe o código da sala.' });
        if (!difficulty) return ack({ ok: false, error: 'Escolha uma dificuldade válida.' });

        const codeRow = roomCodes.findOne((c) => c.code === code);
        if (!codeRow) return ack({ ok: false, error: 'Código inválido.' });
        if (codeRow.status !== 'available') return ack({ ok: false, error: 'Esse código já foi utilizado.' });
        if (getRoom(code)) return ack({ ok: false, error: 'Já existe uma sala ativa com esse código.' });

        let pairsQueue = [];
        if (difficulty !== 'chaos') {
          const matchingPairs = wordPairs.find((p) => p.difficulty === difficulty);
          if (matchingPairs.length < rounds) {
            return ack({
              ok: false,
              error: `Pares insuficientes para "${difficulty}" (necessário ${rounds}, disponível ${matchingPairs.length}). Peça ao admin para cadastrar mais.`,
            });
          }

          try {
            const { resolved, attempted } = await resolvePairsForLang(matchingPairs, rounds, lang);
            if (resolved.length < rounds) {
              return ack({
                ok: false,
                error: `Só ${resolved.length} de ${rounds} pares têm equivalente em inglês na Wikipedia (de ${attempted} pares "${difficulty}" testados). Tente menos rodadas ou a dificuldade em português.`,
              });
            }
            pairsQueue = resolved;
          } catch (err) {
            console.error('[resolvePairsForLang]', err);
            return ack({ ok: false, error: 'Erro ao consultar a Wikipedia para o idioma escolhido.' });
          }
        }

        roomCodes.updateOne((c) => c.code === code, { status: 'claimed', claimed_at: new Date().toISOString() });

        const hostToken = nanoid();
        const room = createRoom(code, { hostSocketId: socket.id, hostToken, hostName, difficulty, rounds, roundSeconds, lang });
        room.pairsQueue = pairsQueue;

        // The host is always a real player too — never a spectator-only role.
        // This also means "solo" just falls out naturally: a lone host already
        // satisfies host:startGame's "at least one player" requirement.
        const hostPlayerToken = nanoid();
        room.hostPlayerToken = hostPlayerToken;
        room.players.set(hostPlayerToken, {
          token: hostPlayerToken, socketId: socket.id, name: hostName, score: 0, connected: true,
          status: 'far', currentTitle: null, clicks: 0,
        });

        socket.join(code);
        socket.data.role = 'host';
        socket.data.roomCode = code;
        socket.data.hostToken = hostToken;
        socket.data.playerToken = hostPlayerToken;

        ack({ ok: true, hostToken, hostPlayerToken, room: publicRoomState(room) });
    });

    safeOn(socket, 'host:resumeRoom', (payload, ack) => {
      const code = String(payload?.code || '').trim().toUpperCase();
      const hostToken = String(payload?.hostToken || '').trim();
      const room = getRoom(code);
      if (!room || !hostToken || room.hostToken !== hostToken) {
        return ack({ ok: false, error: 'Sessão de host inválida ou sala encerrada.' });
      }

      if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = null;
      }

      room.hostSocketId = socket.id;
      socket.join(code);
      socket.data.role = 'host';
      socket.data.roomCode = code;
      socket.data.hostToken = hostToken;

      const hostPlayer = room.players.get(room.hostPlayerToken);
      let resume = null;
      if (hostPlayer) {
        hostPlayer.socketId = socket.id;
        hostPlayer.connected = true;
        socket.data.playerToken = room.hostPlayerToken;
        if (room.status === 'playing') {
          resume = { title: hostPlayer.currentTitle, clicks: hostPlayer.clicks || 0, status: hostPlayer.status };
        }
      }

      io.to(code).emit('host:reconnected');
      io.to(code).emit('room:update', publicRoomState(room));
      ack({
        ok: true,
        hostPlayerToken: room.hostPlayerToken,
        room: publicRoomState(room),
        currentRound: currentRoundInfo(room),
        resume,
      });
    });

    safeOn(socket, 'player:joinRoom', (payload, ack) => {
      const code = String(payload?.code || '').trim().toUpperCase();
      const name = String(payload?.name || '').trim().slice(0, NAME_MAX);
      const token = String(payload?.playerToken || '').trim();
      const room = getRoom(code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada.' });

      // Reconnect path: a known token always wins, regardless of room status.
      if (token && room.players.has(token)) {
        const player = room.players.get(token);
        player.connected = true;
        player.socketId = socket.id;
        socket.join(code);
        socket.data.role = 'player';
        socket.data.roomCode = code;
        socket.data.playerToken = token;
        socket.data.name = player.name;

        io.to(code).emit('room:update', publicRoomState(room));
        return ack({
          ok: true,
          reconnected: true,
          playerToken: token,
          room: publicRoomState(room),
          currentRound: currentRoundInfo(room),
          resume: room.status === 'playing' ? {
            title: player.currentTitle,
            clicks: player.clicks || 0,
            status: player.status,
          } : null,
        });
      }

      // New join: only allowed before the game starts.
      if (room.status !== 'lobby') return ack({ ok: false, error: 'Essa sala já iniciou o jogo.' });
      if (!name) return ack({ ok: false, error: 'Informe um nome.' });
      const nameTaken = [...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
      if (nameTaken) return ack({ ok: false, error: 'Esse nome já está em uso nessa sala.' });

      const newToken = nanoid();
      room.players.set(newToken, {
        token: newToken, socketId: socket.id, name, score: 0, connected: true,
        status: 'far', currentTitle: null, clicks: 0,
      });
      socket.join(code);
      socket.data.role = 'player';
      socket.data.roomCode = code;
      socket.data.playerToken = newToken;
      socket.data.name = name;

      io.to(code).emit('room:update', publicRoomState(room));
      ack({ ok: true, playerToken: newToken, room: publicRoomState(room) });
    });

    safeOn(socket, 'host:startGame', (ack) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack({ ok: false, error: 'Ação não permitida.' });
      if (room.status !== 'lobby') return ack({ ok: false, error: 'Jogo já iniciado.' });
      if (room.players.size < 1) return ack({ ok: false, error: 'Aguarde pelo menos um participante entrar.' });

      room.status = 'playing';
      startNextRound(room, io);
      ack({ ok: true });
    });

    safeOn(socket, 'host:nextRound', (ack) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack({ ok: false, error: 'Ação não permitida.' });
      if (!room.nextRoundTimer) return ack({ ok: false, error: 'Nada para avançar agora.' });
      clearTimeout(room.nextRoundTimer);
      room.nextRoundTimer = null;
      if (room.roundIndex + 1 >= room.config.rounds) endGame(room, io);
      else startNextRound(room, io);
      ack({ ok: true });
    });

    safeOn(socket, 'host:playAgain', async (ack) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack({ ok: false, error: 'Ação não permitida.' });
      if (room.status !== 'finished') return ack({ ok: false, error: 'A partida ainda não terminou.' });

      let pairsQueue = [];
      if (room.config.difficulty !== 'chaos') {
        const matchingPairs = wordPairs.find((p) => p.difficulty === room.config.difficulty);
        if (matchingPairs.length < room.config.rounds) {
          return ack({ ok: false, error: `Pares insuficientes para jogar de novo em "${room.config.difficulty}".` });
        }
        try {
          const { resolved, attempted } = await resolvePairsForLang(matchingPairs, room.config.rounds, room.config.lang);
          if (resolved.length < room.config.rounds) {
            return ack({
              ok: false,
              error: `Só ${resolved.length} de ${room.config.rounds} pares disponíveis (de ${attempted} testados).`,
            });
          }
          pairsQueue = resolved;
        } catch (err) {
          console.error('[host:playAgain resolvePairsForLang]', err);
          return ack({ ok: false, error: 'Erro ao consultar a Wikipedia.' });
        }
      }

      for (const p of room.players.values()) {
        p.score = 0;
        p.status = 'far';
        p.clicks = 0;
        p.currentTitle = null;
      }
      room.roundIndex = -1;
      room.pairsQueue = pairsQueue;
      room.status = 'playing';
      io.to(room.code).emit('room:update', publicRoomState(room));
      startNextRound(room, io);
      ack({ ok: true });
    });

    safeOn(socket, 'player:reachedTarget', (payload, ack) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || room.status !== 'playing' || !room.currentRound) return ack({ ok: false });
      const token = socket.data.playerToken;
      const player = room.players.get(token);
      if (!player) return ack({ ok: false });
      if (room.currentRound.finishers.some((f) => f.token === token)) return ack({ ok: false });

      const clicks = Math.max(parseInt(payload?.clicks, 10) || 0, 0);
      const timeMs = Date.now() - room.currentRound.startedAt;
      const rank = room.currentRound.finishers.length + 1;
      const points = scoreForRank(rank);

      room.currentRound.finishers.push({ token, name: player.name, timeMs, clicks });
      player.score += points;
      player.status = 'done';
      player.clicks = clicks;

      io.to(room.code).emit('round:playerFinished', { name: player.name, rank, timeMs });
      io.to(room.code).emit('player:statusUpdate', { playerId: token, status: 'done' });

      if (rank === 1) {
        const newEndsAt = Math.min(room.currentRound.endsAt, Date.now() + CUTOFF_MS);
        if (newEndsAt < room.currentRound.endsAt) {
          room.currentRound.endsAt = newEndsAt;
          clearTimeout(room.currentRound.timer);
          room.currentRound.timer = setTimeout(() => endRound(room, io), newEndsAt - Date.now());
          io.to(room.code).emit('round:timeAdjusted', { endsAt: newEndsAt });
        }
      }

      const connectedPlayers = [...room.players.values()].filter((p) => p.connected);
      const allFinished = connectedPlayers.every((p) =>
        room.currentRound.finishers.some((f) => f.token === p.token)
      );
      if (allFinished) endRound(room, io);

      ack({ ok: true, rank, points });
    });

    safeOn(socket, 'player:status', (payload, ack) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || room.status !== 'playing') return ack({ ok: false });
      const player = room.players.get(socket.data.playerToken);
      if (!player) return ack({ ok: false });

      if (typeof payload?.title === 'string') player.currentTitle = payload.title;
      if (Number.isFinite(payload?.clicks)) player.clicks = Math.max(payload.clicks, 0);

      if (player.status === 'done') return ack({ ok: false });

      const status = ['far', 'near'].includes(payload?.status) ? payload.status : null;
      if (!status || status === player.status) return ack({ ok: true });

      player.status = status;
      io.to(room.code).emit('player:statusUpdate', { playerId: player.token, status });
      ack({ ok: true });
    });

    socket.on('disconnect', () => {
      try {
        const code = socket.data.roomCode;
        const room = getRoom(code);
        if (!room) return;

        if (socket.data.role === 'host' && room.hostSocketId === socket.id) {
          const hostPlayer = room.players.get(room.hostPlayerToken);
          if (hostPlayer && hostPlayer.socketId === socket.id) hostPlayer.connected = false;
          io.to(code).emit('room:update', publicRoomState(room));
          io.to(code).emit('host:disconnected');
          room.hostDisconnectTimer = setTimeout(() => {
            io.to(code).emit('room:closed', { reason: 'O host ficou desconectado por tempo demais.' });
            closeCodeInDb(code);
            removeRoom(code);
          }, HOST_GRACE_MS);
          return;
        }

        if (socket.data.role === 'player') {
          const token = socket.data.playerToken;
          const player = room.players.get(token);
          if (!player || player.socketId !== socket.id) return;
          if (room.status === 'lobby') {
            room.players.delete(token);
          } else {
            player.connected = false;
          }
          io.to(code).emit('room:update', publicRoomState(room));

          if (room.status === 'playing' && room.currentRound) {
            const connectedPlayers = [...room.players.values()].filter((p) => p.connected);
            const allFinished =
              connectedPlayers.length > 0 &&
              connectedPlayers.every((p) => room.currentRound.finishers.some((f) => f.token === p.token));
            if (allFinished) endRound(room, io);
          }
        }
      } catch (err) {
        console.error('[socket:disconnect]', err);
      }
    });
  });
}

async function startNextRound(room, io) {
  if (room.currentRound?.timer) clearTimeout(room.currentRound.timer);
  room.roundIndex += 1;

  if (room.roundIndex >= room.config.rounds) {
    endGame(room, io);
    return;
  }

  const roundToken = Symbol('round');
  room.pendingRoundToken = roundToken;

  let pair;
  if (room.config.difficulty === 'chaos') {
    try {
      pair = await generateChaosPair(room.config.lang);
    } catch (err) {
      console.error('[generateChaosPair]', err);
      io.to(room.code).emit('room:closed', { reason: 'Erro ao sortear artigos aleatórios. Crie a sala de novo.' });
      closeCodeInDb(room.code);
      removeRoom(room.code);
      return;
    }
    if (getRoom(room.code) !== room || room.pendingRoundToken !== roundToken) return;
  } else {
    pair = room.pairsQueue[room.roundIndex];
  }

  // Links on the page before the target often point at a redirect/alias
  // rather than the target's canonical title. Resolve those aliases up
  // front so the client can recognize "one click away" and "arrived"
  // correctly instead of relying on an exact title-string match.
  let targetAliases = [];
  try {
    targetAliases = await getRedirectAliases(pair.target_title, room.config.lang);
  } catch (err) {
    console.error('[getRedirectAliases]', err);
  }

  // The room may have closed, or another round may already have started,
  // while the alias lookup above was in flight.
  if (getRoom(room.code) !== room || room.pendingRoundToken !== roundToken) return;

  const startedAt = Date.now();
  const endsAt = startedAt + room.config.roundSeconds * 1000;

  for (const p of room.players.values()) {
    p.status = 'far';
    p.currentTitle = pair.start_title;
    p.clicks = 0;
  }

  room.currentRound = {
    pair,
    targetAliases,
    startedAt,
    endsAt,
    finishers: [],
    timer: setTimeout(() => endRound(room, io), room.config.roundSeconds * 1000),
  };

  io.to(room.code).emit('round:start', {
    roundIndex: room.roundIndex,
    totalRounds: room.config.rounds,
    startTitle: pair.start_title,
    targetTitle: pair.target_title,
    targetAliases,
    endsAt,
    difficulty: room.config.difficulty,
    players: publicRoomState(room).players,
  });
}

function endRound(room, io) {
  if (!room.currentRound) return;
  clearTimeout(room.currentRound.timer);

  const finishedTokens = new Set(room.currentRound.finishers.map((f) => f.token));
  const finishedResults = room.currentRound.finishers.map((f, i) => ({
    name: f.name,
    rank: i + 1,
    timeMs: f.timeMs,
    clicks: f.clicks,
    points: scoreForRank(i + 1),
  }));
  const notFinished = [...room.players.values()]
    .filter((p) => !finishedTokens.has(p.token))
    .map((p) => ({ name: p.name, rank: null, timeMs: null, clicks: null, points: 0 }));

  io.to(room.code).emit('round:end', {
    roundIndex: room.roundIndex,
    totalRounds: room.config.rounds,
    startTitle: room.currentRound.pair.start_title,
    targetTitle: room.currentRound.pair.target_title,
    results: [...finishedResults, ...notFinished],
    leaderboard: sortedLeaderboard(room),
  });

  // Computed live against Wikipedia's own link graph (no precomputed index
  // exists for this), so it can take a few seconds or fail to resolve in
  // time for a distant pair — never blocks round:end above.
  const roundIndexForPath = room.roundIndex;
  const { start_title, target_title } = room.currentRound.pair;
  const lang = room.config.lang;
  findShortestPath(start_title, target_title, lang)
    .catch((err) => { console.error('[findShortestPath]', err); return null; })
    .then((path) => {
      if (getRoom(room.code) !== room) return;
      io.to(room.code).emit('round:shortestPath', { roundIndex: roundIndexForPath, startTitle: start_title, targetTitle: target_title, path });
    });

  room.currentRound = null;

  room.nextRoundTimer = setTimeout(() => {
    room.nextRoundTimer = null;
    if (room.roundIndex + 1 >= room.config.rounds) endGame(room, io);
    else startNextRound(room, io);
  }, RESULTS_DELAY_MS);
}

function endGame(room, io) {
  room.status = 'finished';
  io.to(room.code).emit('game:end', { leaderboard: sortedLeaderboard(room) });
  // The room and its code stay alive here on purpose: the host may start a
  // fresh match in the same room via host:playAgain. Cleanup happens the
  // normal way, through the host-disconnect grace timer, once they actually leave.
}
