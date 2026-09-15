import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { admins, roomCodes, wordPairs } from '../db.js';
import { signAdminToken, requireAdmin } from '../auth.js';
import { resolveTitle } from '../wiki.js';
import { listActiveRoomsSummary } from '../rooms.js';

const router = Router();
const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = admins.findOne((a) => a.username === String(username || '').trim());
  if (!admin || !bcrypt.compareSync(String(password || ''), admin.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  res.json({ token: signAdminToken(admin), username: admin.username });
});

router.use(requireAdmin);

router.get('/me', (req, res) => res.json({ username: req.admin.username }));

// ---- Admin users ----
router.get('/admins', (req, res) => {
  res.json(admins.all((a, b) => a.id - b.id).map(({ password_hash, ...rest }) => rest));
});

router.post('/admins', (req, res) => {
  const { username, password } = req.body || {};
  const uname = String(username || '').trim();
  if (uname.length < 3 || String(password || '').length < 6) {
    return res.status(400).json({ error: 'Usuário (min 3) e senha (min 6) obrigatórios.' });
  }
  if (admins.findOne((a) => a.username === uname)) {
    return res.status(409).json({ error: 'Já existe um admin com esse usuário.' });
  }
  const row = admins.insert({ username: uname, password_hash: bcrypt.hashSync(password, 10) });
  res.status(201).json({ id: row.id, username: uname });
});

router.delete('/admins/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (admins.count() <= 1) return res.status(400).json({ error: 'Não é possível remover o último administrador.' });
  if (id === req.admin.id) return res.status(400).json({ error: 'Você não pode remover a si mesmo.' });
  admins.removeWhere((a) => a.id === id);
  res.status(204).end();
});

// ---- Room codes ----
router.get('/room-codes', (req, res) => {
  res.json(roomCodes.all((a, b) => b.id - a.id));
});

router.post('/room-codes', (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 1, 1), 50);
  const label = req.body?.label ? String(req.body.label).trim().slice(0, 60) : null;
  const created = [];
  for (let i = 0; i < count; i++) {
    let code;
    do { code = genCode(); } while (roomCodes.findOne((c) => c.code === code));
    roomCodes.insert({ code, status: 'available', label, claimed_at: null, closed_at: null });
    created.push(code);
  }
  res.status(201).json({ created });
});

router.delete('/room-codes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  roomCodes.removeWhere((c) => c.id === id && c.status === 'available');
  res.status(204).end();
});

// ---- Word pairs ----
router.get('/word-pairs', (req, res) => {
  res.json(wordPairs.all((a, b) => b.id - a.id));
});

router.post('/word-pairs', async (req, res) => {
  try {
    const { difficulty } = req.body || {};
    let { startTitle, targetTitle } = req.body || {};
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Dificuldade inválida.' });
    }
    const [resolvedStart, resolvedTarget] = await Promise.all([
      resolveTitle(String(startTitle || '').trim()),
      resolveTitle(String(targetTitle || '').trim()),
    ]);
    if (!resolvedStart) return res.status(400).json({ error: `Artigo inicial não encontrado: "${startTitle}"` });
    if (!resolvedTarget) return res.status(400).json({ error: `Artigo alvo não encontrado: "${targetTitle}"` });
    if (resolvedStart === resolvedTarget) return res.status(400).json({ error: 'Os dois artigos precisam ser diferentes.' });

    const row = wordPairs.insert({ start_title: resolvedStart, target_title: resolvedTarget, difficulty });
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Erro ao consultar a Wikipedia.' });
  }
});

router.delete('/word-pairs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  wordPairs.removeWhere((p) => p.id === id);
  res.status(204).end();
});

// ---- Live rooms (monitoring) ----
router.get('/rooms', (req, res) => {
  res.json(listActiveRoomsSummary());
});

export default router;
