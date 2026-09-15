// In-memory registry of live game rooms. Rooms are ephemeral by design —
// they live only while the process runs, gated by admin-issued codes in the DB.

export const rooms = new Map(); // code -> Room

export function createRoom(code, { hostSocketId, hostToken, hostName, difficulty, rounds, roundSeconds, lang }) {
  const room = {
    code,
    hostSocketId,
    hostToken,
    hostName,
    hostDisconnectTimer: null,
    status: 'lobby', // lobby | playing | finished
    config: { difficulty, rounds, roundSeconds, lang },
    players: new Map(), // playerToken -> { token, socketId, name, score, connected, status, currentTitle, clicks }
    roundIndex: -1,
    pairsQueue: [],
    currentRound: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function removeRoom(code) {
  const room = rooms.get(code);
  if (room?.currentRound?.timer) clearTimeout(room.currentRound.timer);
  if (room?.nextRoundTimer) clearTimeout(room.nextRoundTimer);
  if (room?.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
  rooms.delete(code);
}

export function publicRoomState(room) {
  return {
    code: room.code,
    status: room.status,
    hostName: room.hostName,
    config: room.config,
    players: [...room.players.values()].map((p) => ({ id: p.token, name: p.name, score: p.score, connected: p.connected, status: p.status, isHost: p.token === room.hostPlayerToken })),
    roundIndex: room.roundIndex,
  };
}

export function listActiveRoomsSummary() {
  return [...rooms.values()].map((r) => ({
    code: r.code,
    hostName: r.hostName,
    status: r.status,
    difficulty: r.config.difficulty,
    rounds: r.config.rounds,
    roundIndex: r.roundIndex,
    players: r.players.size,
  }));
}
