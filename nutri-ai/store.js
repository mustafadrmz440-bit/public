/**
 * store.js — Basit, güvenilir JSON kalıcılık katmanı.
 * Tüm yazma işlemleri sıraya alınır ve atomik (tmp + rename) olarak diske yazılır.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function emptyDb() {
  return {
    users: [],
    sessions: {},   // token -> { userId, createdAt }
    diary: {},      // userId -> [entry]
    water: {},      // userId -> { date: ml }
    weights: {},    // userId -> [{ date, kg }]
    plans: {}       // userId -> { weekKey, seedOffset, days }
  };
}

function load() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    return Object.assign(emptyDb(), db);
  } catch {
    return emptyDb();
  }
}

const db = load();

let chain = Promise.resolve();
function save() {
  const p = chain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmp = DB_FILE + '.tmp';
        fs.writeFile(tmp, JSON.stringify(db), (err) => {
          if (err) return reject(err);
          fs.rename(tmp, DB_FILE, (err2) => (err2 ? reject(err2) : resolve()));
        });
      })
  );
  chain = p.catch(() => {});
  return p;
}

/* ---------- Şifre hash'leme (Node crypto.scrypt, bağımlılıksız) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const test = crypto.scryptSync(String(pw), salt, 64);
    const real = Buffer.from(hash, 'hex');
    return real.length === test.length && crypto.timingSafeEqual(real, test);
  } catch {
    return false;
  }
}

const id = () => crypto.randomUUID();
const token = () => crypto.randomBytes(32).toString('hex');

/* Eski oturumları temizle (60 günden eski) */
(function cleanupSessions() {
  const cut = Date.now() - 60 * 24 * 3600 * 1000;
  for (const [t, s] of Object.entries(db.sessions)) {
    if (!s || s.createdAt < cut) delete db.sessions[t];
  }
})();

module.exports = { db, save, hashPassword, verifyPassword, id, token };
