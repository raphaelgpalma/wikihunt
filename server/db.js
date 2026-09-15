// Lightweight JSON-file persistence. Avoids native modules entirely (no build
// tools / prebuilt-binary issues) — fine at this scale (a handful of small tables).
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const filePath = path.join(dataDir, 'wikihunt.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function load() {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return { admins: [], roomCodes: [], wordPairs: [] };
}

const data = load();

function save() {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

class Collection {
  constructor(name) {
    this.name = name;
  }
  get rows() {
    return data[this.name];
  }
  all(sortFn) {
    return sortFn ? [...this.rows].sort(sortFn) : [...this.rows];
  }
  find(pred) {
    return this.rows.filter(pred);
  }
  findOne(pred) {
    return this.rows.find(pred) || null;
  }
  count(pred = () => true) {
    return this.rows.filter(pred).length;
  }
  insert(fields) {
    const nextId = this.rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    const row = { id: nextId, created_at: new Date().toISOString(), ...fields };
    this.rows.push(row);
    save();
    return row;
  }
  updateOne(pred, patch) {
    const row = this.rows.find(pred);
    if (!row) return null;
    Object.assign(row, patch);
    save();
    return row;
  }
  removeWhere(pred) {
    const before = this.rows.length;
    data[this.name] = this.rows.filter((r) => !pred(r));
    save();
    return before - data[this.name].length;
  }
}

export const admins = new Collection('admins');
export const roomCodes = new Collection('roomCodes');
export const wordPairs = new Collection('wordPairs');

export function pickRandom(array, n) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ---- Seeding ----
if (admins.count() === 0) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  admins.insert({ username, password_hash: bcrypt.hashSync(password, 10) });
  console.log(`[seed] Admin criado -> usuário: "${username}" senha: "${password}" (altere depois de logar)`);
}

if (wordPairs.count() === 0) {
  const seedPairs = [
    ['Cachorro', 'Gato', 'easy'],
    ['Futebol', 'Brasil', 'easy'],
    ['Chuva', 'Oceano', 'easy'],
    ['Guitarra', 'Rock', 'easy'],
    ['Computador', 'Internet', 'medium'],
    ['Napoleão Bonaparte', 'Rússia', 'medium'],
    ['Fotossíntese', 'Dinossauro', 'medium'],
    ['Café', 'Colômbia', 'medium'],
    ['Buraco negro', 'Queijo', 'hard'],
    ['Império Romano', 'Inteligência artificial', 'hard'],
    ['Vulcão', 'Sinfonia', 'hard'],
    ['Origami', 'Guerra Fria', 'hard'],
  ];
  for (const [start_title, target_title, difficulty] of seedPairs) {
    wordPairs.insert({ start_title, target_title, difficulty });
  }
  console.log(`[seed] ${seedPairs.length} pares de palavras de exemplo criados.`);
}
