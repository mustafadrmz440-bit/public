/* local-backend.js — Çevrimdışı mod (APK): tüm API'nin localStorage tabanlı uygulaması.
 * Sunucu sürümüyle birebir aynı uç noktalar/yanıt şekilleri.
 * Tarif/besin verileri: window.__NUTRI_DATA__ (paketlenmiş) veya /data/*.json (http geliştirme).
 */

const DB_KEY = 'nutriai.db.v1';
const SID_KEY = 'nutriai.sid.v1';

function emptyDB() {
  return { users: [], sessions: {}, diary: {}, water: {}, weights: {}, plans: {} };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDB();
    return Object.assign(emptyDB(), JSON.parse(raw));
  } catch {
    return emptyDB();
  }
}

let _db = (typeof window !== 'undefined' && window.__NUTRI_DB__) || null;
function db() {
  if (!_db) _db = loadDB();
  return _db;
}
function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db())); } catch (e) { /* kota dolabilir */ }
}

/* ------------------------------ Yardımcılar ------------------------------ */

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const sidGen = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

const todayLocalISO = (off = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + off);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder().encode(String(pw));
  const key = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:120000:${hex(salt.buffer)}:${hex(bits)}`;
}

async function verifyPassword(pw, stored) {
  try {
    const [, iterStr, saltHex, hashHex] = String(stored).split(':');
    const iters = parseInt(iterStr, 10) || 100000;
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256);
    const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
    return hex(bits) === hashHex;
  } catch {
    return false;
  }
}

function sanitizeUser(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, onboarded: u.onboarded, profile: u.profile, targets: u.targets };
}

function currentUser() {
  const d = db();
  const sid = localStorage.getItem(SID_KEY);
  if (!sid) return null;
  const s = d.sessions[sid];
  if (!s) return null;
  return d.users.find((u) => u.id === s.userId) || null;
}

function requireUser() {
  const u = currentUser();
  if (!u) fail(401, 'Oturum bulunamadı. Lütfen giriş yapın.');
  return u;
}

/* ------------------------------- Veri dosyaları --------------------------- */

let _data = null;
async function getData() {
  if (_data) return _data;
  if (typeof window !== 'undefined' && window.__NUTRI_DATA__) {
    _data = window.__NUTRI_DATA__;
    return _data;
  }
  const [r, f] = await Promise.all([fetch('/data/recipes.json').then((x) => x.json()), fetch('/data/foods.json').then((x) => x.json())]);
  _data = { recipes: r, foods: f };
  return _data;
}

/* ------------------------------ Hedef hesabı ------------------------------ */

const ACTIVITY = { hareketsiz: 1.2, az: 1.375, orta: 1.55, yuksek: 1.725, cok_yuksek: 1.9 };
const round5 = (n) => Math.round(n / 5) * 5;

function computeTargets(p) {
  const act = ACTIVITY[p.activity] || 1.375;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.gender === 'erkek' ? 5 : -161);
  const tdee = bmr * act;
  let kcal = p.goal === 'kilo_ver' ? tdee - 500 : p.goal === 'kazan' ? tdee + 300 : tdee;
  const floor = p.gender === 'erkek' ? 1500 : 1200;
  if (kcal < floor) kcal = floor;
  kcal = round5(kcal);
  const split = p.goal === 'kilo_ver' ? { p: 0.30, c: 0.35, f: 0.35 } : p.goal === 'kazan' ? { p: 0.25, c: 0.50, f: 0.25 } : { p: 0.25, c: 0.45, f: 0.30 };
  const protein = Math.round((kcal * split.p) / 4);
  const carbs = Math.round((kcal * split.c) / 4);
  const fat = Math.round((kcal * split.f) / 9);
  const water = Math.min(3500, Math.max(2000, Math.round((p.weight * 35) / 50) * 50));
  return { kcal, protein, carbs, fat, water, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

/* ------------------------------ Plan üretimi ------------------------------ */

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SLOT_SPLITS = { kahvalti: 0.25, oglen: 0.35, aksam: 0.3, ara: 0.1 };
const SLOT_ORDER = ['kahvalti', 'oglen', 'aksam', 'ara'];

function dateOffsetISO(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function weekMondayISO(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  return dateOffsetISO(dateISO, -day);
}

function generatePlan(user, weekKey, seedOffset = 0, recipes) {
  const t = user.targets || { kcal: 2000 };
  const rng = mulberry32(hashStr(user.id + weekKey) + seedOffset);
  const lastUsed = {};
  const days = [];
  for (let dd = 0; dd < 7; dd++) {
    const date = dateOffsetISO(weekKey, dd);
    const usedToday = new Set();
    const meals = [];
    for (const slot of SLOT_ORDER) {
      const budget = t.kcal * SLOT_SPLITS[slot];
      const cands = recipes.filter((r) => r.slots.includes(slot));
      let best = null, bestScore = Infinity;
      for (const r of cands) {
        let s = Math.abs(r.kcal - budget) + rng() * 260;
        if (usedToday.has(r.id)) s += 1e6;
        if (lastUsed[r.id] === dd - 1) s += 900;
        if (lastUsed[r.id] === dd) s += 1e6;
        if (s < bestScore) { bestScore = s; best = r; }
      }
      const servings = Math.min(2, Math.max(0.5, Math.round((budget / best.kcal) * 2) / 2));
      meals.push({ slot, recipeId: best.id, servings, kcal: Math.round(best.kcal * servings) });
      usedToday.add(best.id);
      lastUsed[best.id] = dd;
    }
    days.push({ date, meals });
  }
  return { weekKey, seedOffset, days };
}

/* --------------------------------- Doğrulama ------------------------------ */

function validateProfile(b) {
  if (!['kadin', 'erkek'].includes(b.gender)) return 'Cinsiyet seçimi geçersiz.';
  const a = Number(b.age), hh = Number(b.height), w = Number(b.weight);
  if (!(a >= 14 && a <= 90)) return 'Yaş 14–90 arasında olmalı.';
  if (!(hh >= 120 && hh <= 230)) return 'Boy 120–230 cm arasında olmalı.';
  if (!(w >= 35 && w <= 250)) return 'Kilo 35–250 kg arasında olmalı.';
  if (!['hareketsiz', 'az', 'orta', 'yuksek', 'cok_yuksek'].includes(b.activity)) return 'Aktivite seviyesi geçersiz.';
  if (!['kilo_ver', 'koru', 'kazan'].includes(b.goal)) return 'Hedef seçimi geçersiz.';
  if (b.targetWeight != null && b.targetWeight !== '' && !(Number(b.targetWeight) >= 30 && Number(b.targetWeight) <= 250))
    return 'Hedef kilo 30–250 kg arasında olmalı.';
  return null;
}

/* ---------------------------------- Router -------------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function localAPI(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body || {};
  const [pathOnly, queryStr] = String(path).split('?');
  const q = new URLSearchParams(queryStr || '');
  const d = db();

  /* ---------- auth ---------- */
  if (method === 'POST' && pathOnly === '/api/auth/register') {
    const name = String(body.name || '').trim();
    const mail = String(body.email || '').trim().toLowerCase();
    const pw = String(body.password || '');
    if (name.length < 2) fail(400, 'Lütfen geçerli bir isim girin (en az 2 karakter).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) fail(400, 'Geçerli bir e-posta adresi girin.');
    if (pw.length < 6) fail(400, 'Şifre en az 6 karakter olmalıdır.');
    if (d.users.some((u) => u.email === mail)) fail(409, 'Bu e-posta ile kayıtlı bir hesap zaten var.');
    const user = { id: uid(), name: name.slice(0, 60), email: mail, passHash: await hashPassword(pw), createdAt: Date.now(), onboarded: false, profile: null, targets: null };
    d.users.push(user);
    d.diary[user.id] = [];
    d.water[user.id] = {};
    d.weights[user.id] = [];
    const tok = sidGen();
    d.sessions[tok] = { userId: user.id, createdAt: Date.now() };
    save();
    localStorage.setItem(SID_KEY, tok);
    return { user: sanitizeUser(user) };
  }

  if (method === 'POST' && pathOnly === '/api/auth/login') {
    const mail = String(body.email || '').trim().toLowerCase();
    const pw = String(body.password || '');
    const user = d.users.find((u) => u.email === mail);
    if (!user || !(await verifyPassword(pw, user.passHash))) fail(401, 'E-posta veya şifre hatalı.');
    const tok = sidGen();
    d.sessions[tok] = { userId: user.id, createdAt: Date.now() };
    save();
    localStorage.setItem(SID_KEY, tok);
    return { user: sanitizeUser(user) };
  }

  if (method === 'POST' && pathOnly === '/api/auth/logout') {
    const sid = localStorage.getItem(SID_KEY);
    if (sid) { delete d.sessions[sid]; save(); }
    localStorage.removeItem(SID_KEY);
    return { ok: true };
  }

  if (method === 'GET' && pathOnly === '/api/me') {
    const u = currentUser();
    if (!u) fail(401, 'Oturum yok');
    return { user: sanitizeUser(u) };
  }

  /* ---------- profil ---------- */
  if (method === 'PUT' && pathOnly === '/api/profile') {
    const u = requireUser();
    const err = validateProfile(body);
    if (err) fail(400, err);
    u.profile = {
      gender: body.gender,
      age: Number(body.age),
      height: Number(body.height),
      weight: Number(body.weight),
      activity: body.activity,
      goal: body.goal,
      targetWeight: body.targetWeight != null && body.targetWeight !== '' ? Number(body.targetWeight) : null
    };
    u.targets = computeTargets(u.profile);
    if (body.onboarded) u.onboarded = true;
    if (!d.weights[u.id] || d.weights[u.id].length === 0) {
      d.weights[u.id] = [{ date: todayLocalISO(), kg: u.profile.weight }];
    }
    save();
    return { user: sanitizeUser(u) };
  }

  if (method === 'DELETE' && pathOnly === '/api/account') {
    const u = requireUser();
    d.users = d.users.filter((x) => x.id !== u.id);
    delete d.diary[u.id];
    delete d.water[u.id];
    delete d.weights[u.id];
    delete d.plans[u.id];
    for (const t of Object.keys(d.sessions)) if (d.sessions[t].userId === u.id) delete d.sessions[t];
    save();
    localStorage.removeItem(SID_KEY);
    return { ok: true };
  }

  /* ---------- tarif / besin ---------- */
  if (method === 'GET' && pathOnly === '/api/recipes') {
    return { recipes: (await getData()).recipes };
  }
  if (method === 'GET' && pathOnly === '/api/foods') {
    const f = (await getData()).foods;
    return { catalog: f.catalog, aiMap: f.aiMap };
  }

  /* ---------- plan ---------- */
  if (method === 'GET' && pathOnly === '/api/plan') {
    const u = requireUser();
    const base = DATE_RE.test(q.get('date') || '') ? q.get('date') : todayLocalISO();
    const wk = weekMondayISO(base);
    const refresh = q.get('refresh') === '1';
    let plan = d.plans[u.id];
    if (!plan || plan.weekKey !== wk || refresh) {
      const seedOffset = refresh && plan && plan.weekKey === wk ? (plan.seedOffset || 0) + 1 + Math.floor(Math.random() * 97) : 0;
      plan = generatePlan(u, wk, seedOffset, (await getData()).recipes);
      d.plans[u.id] = plan;
      save();
    }
    const rmap = {};
    (await getData()).recipes.forEach((r) => (rmap[r.id] = r));
    return {
      weekKey: plan.weekKey,
      days: plan.days.map((day) => ({
        date: day.date,
        meals: day.meals.map((m) => ({ slot: m.slot, servings: m.servings, kcal: m.kcal, recipe: rmap[m.recipeId] }))
      }))
    };
  }

  /* ---------- günlük ---------- */
  if (method === 'GET' && pathOnly === '/api/day') {
    const u = requireUser();
    const date = DATE_RE.test(q.get('date') || '') ? q.get('date') : todayLocalISO();
    const entries = (d.diary[u.id] || []).filter((e) => e.date === date);
    const totals = entries.reduce((t, e) => ({ kcal: t.kcal + e.kcal, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    const water = (d.water[u.id] && d.water[u.id][date]) || 0;
    return { date, entries, totals, water, targets: u.targets };
  }

  if (method === 'POST' && pathOnly === '/api/diary') {
    const u = requireUser();
    if (!DATE_RE.test(body.date || '')) fail(400, 'Geçersiz tarih.');
    const meal = ['kahvalti', 'oglen', 'aksam', 'ara'].includes(body.meal) ? body.meal : 'ara';
    const kcal = Number(body.kcal);
    if (!body.name || String(body.name).trim().length < 1) fail(400, 'Besin adı gerekli.');
    if (!(kcal >= 0 && kcal <= 5000)) fail(400, 'Kalori değeri geçersiz.');
    if (!d.diary[u.id]) d.diary[u.id] = [];
    const entry = {
      id: uid(),
      date: body.date,
      meal,
      name: String(body.name).trim().slice(0, 80),
      kcal: Math.round(kcal),
      protein: Math.round((Number(body.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(body.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(body.fat) || 0) * 10) / 10,
      source: ['ai', 'manuel', 'plan', 'tarif'].includes(body.source) ? body.source : 'manuel',
      createdAt: Date.now()
    };
    d.diary[u.id].push(entry);
    save();
    return { entry };
  }

  const diaryDel = pathOnly.match(/^\/api\/diary\/([^/]+)$/);
  if (method === 'DELETE' && diaryDel) {
    const u = requireUser();
    const list = d.diary[u.id] || [];
    const i = list.findIndex((e) => e.id === decodeURIComponent(diaryDel[1]));
    if (i === -1) fail(404, 'Kayıt bulunamadı.');
    const [removed] = list.splice(i, 1);
    save();
    return { ok: true, removed };
  }

  /* ---------- su ---------- */
  if (method === 'POST' && pathOnly === '/api/water') {
    const u = requireUser();
    if (!DATE_RE.test(body.date || '')) fail(400, 'Geçersiz tarih.');
    if (!d.water[u.id]) d.water[u.id] = {};
    const cur = d.water[u.id][body.date] || 0;
    d.water[u.id][body.date] = Math.min(6000, Math.max(0, cur + (Number(body.delta) || 0)));
    save();
    return { water: d.water[u.id][body.date] };
  }

  /* ---------- tartı ---------- */
  if (method === 'GET' && pathOnly === '/api/weights') {
    const u = requireUser();
    return { weights: (d.weights[u.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date)) };
  }
  if (method === 'POST' && pathOnly === '/api/weights') {
    const u = requireUser();
    if (!DATE_RE.test(body.date || '')) fail(400, 'Geçersiz tarih.');
    const kg = Number(body.kg);
    if (!(kg >= 30 && kg <= 300)) fail(400, 'Kilo 30–300 kg arasında olmalı.');
    const list = d.weights[u.id] || (d.weights[u.id] = []);
    const i = list.findIndex((w) => w.date === body.date);
    if (i >= 0) list[i].kg = kg;
    else list.push({ date: body.date, kg });
    save();
    return { ok: true };
  }

  /* ---------- istatistik ---------- */
  if (method === 'GET' && pathOnly === '/api/stats') {
    const u = requireUser();
    const end = DATE_RE.test(q.get('end') || '') ? q.get('end') : todayLocalISO();
    const days = Math.min(30, Math.max(7, Number(q.get('days')) || 14));
    const list = d.diary[u.id] || [];
    const waterMap = d.water[u.id] || {};
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = dateOffsetISO(end, -i);
      const e = list.filter((x) => x.date === date);
      const t = e.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
      const w = (d.weights[u.id] || []).find((x) => x.date === date);
      out.push({ date, ...t, meals: e.length, water: waterMap[date] || 0, weight: w ? w.kg : null });
    }
    const withData = new Set(list.map((e) => e.date));
    let streak = 0;
    let cursor = withData.has(end) ? end : dateOffsetISO(end, -1);
    while (withData.has(cursor)) { streak++; cursor = dateOffsetISO(cursor, -1); }
    return { days: out, streak, weights: (d.weights[u.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date)), targets: u.targets };
  }

  /* ---------- dışa aktarma ---------- */
  if (method === 'GET' && pathOnly === '/api/export') {
    const u = requireUser();
    return {
      exportedAt: new Date().toISOString(),
      profile: sanitizeUser(u),
      diary: d.diary[u.id] || [],
      water: d.water[u.id] || {},
      weights: d.weights[u.id] || []
    };
  }

  fail(404, 'Uç nokta bulunamadı: ' + pathOnly);
}
