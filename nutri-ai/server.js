/**
 * NutriAI — Sunucu (Express)
 * Kimlik doğrulama (kayıt / giriş / çıkış / hesap silme),
 * kişisel hedefler, haftalık AI yemek planı, günlük, su, tartı ve istatistik API'leri.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const store = require('./store');
const { computeTargets, generatePlan, dateOffsetISO } = require('./engine');

const foods = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'foods.json'), 'utf8'));

const { db, save, hashPassword, verifyPassword, id, token } = store;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

/* ------------------------------- Yardımcılar ------------------------------ */

function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSessionCookie(res, tok) {
  res.setHeader(
    'Set-Cookie',
    `sid=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`
  );
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    onboarded: u.onboarded,
    profile: u.profile,
    targets: u.targets
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Rotaları try/catch ile sar
const h = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    bad(res, 'Sunucuda beklenmeyen bir hata oluştu.', 500);
  });
};

function requireAuth(req, res, next) {
  if (!req.user) return bad(res, 'Oturum bulunamadı. Lütfen giriş yapın.', 401);
  next();
}

/* ------------------------------ Oturum yükleyici -------------------------- */
app.use((req, res, next) => {
  req.user = null;
  const sid = parseCookies(req).sid;
  if (sid) {
    const s = db.sessions[sid];
    if (s) {
      const u = db.users.find((x) => x.id === s.userId);
      if (u) {
        req.user = u;
        req.sid = sid;
      }
    }
  }
  next();
});

/* --------------------------------- Kimlik -------------------------------- */

app.post('/api/auth/register', h((req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) return bad(res, 'Lütfen geçerli bir isim girin (en az 2 karakter).');
  const mail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return bad(res, 'Geçerli bir e-posta adresi girin.');
  if (!password || String(password).length < 6) return bad(res, 'Şifre en az 6 karakter olmalıdır.');

  if (db.users.some((u) => u.email === mail))
    return bad(res, 'Bu e-posta ile kayıtlı bir hesap zaten var.', 409);

  const user = {
    id: id(),
    name: String(name).trim().slice(0, 60),
    email: mail,
    passHash: hashPassword(password),
    createdAt: Date.now(),
    onboarded: false,
    profile: null,
    targets: null
  };
  db.users.push(user);
  db.diary[user.id] = [];
  db.water[user.id] = {};
  db.weights[user.id] = [];

  const tok = token();
  db.sessions[tok] = { userId: user.id, createdAt: Date.now() };
  save();
  setSessionCookie(res, tok);
  res.json({ user: sanitizeUser(user) });
}));

app.post('/api/auth/login', h((req, res) => {
  const mail = String((req.body || {}).email || '').trim().toLowerCase();
  const pw = String((req.body || {}).password || '');
  const user = db.users.find((u) => u.email === mail);
  if (!user || !verifyPassword(pw, user.passHash))
    return bad(res, 'E-posta veya şifre hatalı.', 401);

  const tok = token();
  db.sessions[tok] = { userId: user.id, createdAt: Date.now() };
  save();
  setSessionCookie(res, tok);
  res.json({ user: sanitizeUser(user) });
}));

app.post('/api/auth/logout', h((req, res) => {
  if (req.sid) {
    delete db.sessions[req.sid];
    save();
  }
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/me', h((req, res) => {
  if (!req.user) return bad(res, 'Oturum yok', 401);
  res.json({ user: sanitizeUser(req.user) });
}));

/* --------------------------------- Profil -------------------------------- */

function validateProfile(body) {
  const { gender, age, height, weight, activity, goal } = body;
  if (!['kadin', 'erkek'].includes(gender)) return 'Cinsiyet seçimi geçersiz.';
  const a = Number(age), hcm = Number(height), w = Number(weight);
  if (!(a >= 14 && a <= 90)) return 'Yaş 14–90 arasında olmalı.';
  if (!(hcm >= 120 && hcm <= 230)) return 'Boy 120–230 cm arasında olmalı.';
  if (!(w >= 35 && w <= 250)) return 'Kilo 35–250 kg arasında olmalı.';
  if (!['hareketsiz', 'az', 'orta', 'yuksek', 'cok_yuksek'].includes(activity)) return 'Aktivite seviyesi geçersiz.';
  if (!['kilo_ver', 'koru', 'kazan'].includes(goal)) return 'Hedef seçimi geçersiz.';
  if (body.targetWeight != null && body.targetWeight !== '' && !(Number(body.targetWeight) >= 30 && Number(body.targetWeight) <= 250))
    return 'Hedef kilo 30–250 kg arasında olmalı.';
  return null;
}

app.put('/api/profile', requireAuth, h((req, res) => {
  const err = validateProfile(req.body || {});
  if (err) return bad(res, err);
  const b = req.body;
  const profile = {
    gender: b.gender,
    age: Number(b.age),
    height: Number(b.height),
    weight: Number(b.weight),
    activity: b.activity,
    goal: b.goal,
    targetWeight: b.targetWeight != null && b.targetWeight !== '' ? Number(b.targetWeight) : null
  };
  req.user.profile = profile;
  req.user.targets = computeTargets(profile);
  if (b.onboarded) req.user.onboarded = true;

  // Profildeki kilo için başlangıç tartı kaydı
  if (!db.weights[req.user.id] || db.weights[req.user.id].length === 0) {
    db.weights[req.user.id] = [{ date: dateOffsetISO(new Date().toISOString().slice(0, 10), 0), kg: profile.weight }];
  }
  save();
  res.json({ user: sanitizeUser(req.user) });
}));

app.delete('/api/account', requireAuth, h((req, res) => {
  const uid = req.user.id;
  db.users = db.users.filter((u) => u.id !== uid);
  delete db.diary[uid];
  delete db.water[uid];
  delete db.weights[uid];
  delete db.plans[uid];
  for (const [t, s] of Object.entries(db.sessions)) {
    if (s.userId === uid) delete db.sessions[t];
  }
  save();
  clearSessionCookie(res);
  res.json({ ok: true });
}));

/* -------------------------------- Tarifler ------------------------------- */

app.get('/api/recipes', h((req, res) => res.json({ recipes: require('./engine').recipes })));

app.get('/api/foods', h((req, res) => res.json({ catalog: foods.catalog, aiMap: foods.aiMap })));

/* ---------------------------- Haftalık program --------------------------- */

function weekMondayISO(dateISO) {
  const d = new Date(dateISO + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // Pzt=0
  return dateOffsetISO(dateISO, -day);
}

app.get('/api/plan', requireAuth, h((req, res) => {
  const base = DATE_RE.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  const wk = weekMondayISO(base);
  let plan = db.plans[req.user.id];
  const refresh = req.query.refresh === '1';

  if (!plan || plan.weekKey !== wk || refresh || !req.user.targets) {
    const seedOffset = refresh && plan && plan.weekKey === wk ? (plan.seedOffset || 0) + 1 + Math.floor(Math.random() * 97) : 0;
    plan = generatePlan(req.user, wk, seedOffset);
    db.plans[req.user.id] = plan;
    save();
  }
  const recipes = require('./engine').recipes;
  const rmap = Object.fromEntries(recipes.map((r) => [r.id, r]));
  res.json({
    weekKey: plan.weekKey,
    days: plan.days.map((d) => ({
      date: d.date,
      meals: d.meals.map((m) => ({
        slot: m.slot,
        servings: m.servings,
        kcal: m.kcal,
        recipe: rmap[m.recipeId]
      }))
    }))
  });
}));

/* ------------------------------- Günlük ---------------------------------- */

app.get('/api/day', requireAuth, h((req, res) => {
  const date = DATE_RE.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  const entries = (db.diary[req.user.id] || []).filter((e) => e.date === date);
  const totals = entries.reduce(
    (t, e) => ({ kcal: t.kcal + e.kcal, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const water = (db.water[req.user.id] && db.water[req.user.id][date]) || 0;
  res.json({ date, entries, totals, water, targets: req.user.targets });
}));

app.post('/api/diary', requireAuth, h((req, res) => {
  const b = req.body || {};
  if (!DATE_RE.test(b.date || '')) return bad(res, 'Geçersiz tarih.');
  const meal = ['kahvalti', 'oglen', 'aksam', 'ara'].includes(b.meal) ? b.meal : 'ara';
  const kcal = Number(b.kcal), p = Number(b.protein) || 0, c = Number(b.carbs) || 0, f = Number(b.fat) || 0;
  if (!b.name || String(b.name).trim().length < 1) return bad(res, 'Besin adı gerekli.');
  if (!(kcal >= 0 && kcal <= 5000)) return bad(res, 'Kalori değeri geçersiz.');
  if (!db.diary[req.user.id]) db.diary[req.user.id] = [];
  const entry = {
    id: id(),
    date: b.date,
    meal,
    name: String(b.name).trim().slice(0, 80),
    kcal: Math.round(kcal),
    protein: Math.round(p * 10) / 10,
    carbs: Math.round(c * 10) / 10,
    fat: Math.round(f * 10) / 10,
    source: ['ai', 'manuel', 'plan', 'tarif'].includes(b.source) ? b.source : 'manuel',
    createdAt: Date.now()
  };
  db.diary[req.user.id].push(entry);
  save();
  res.json({ entry });
}));

app.delete('/api/diary/:id', requireAuth, h((req, res) => {
  const list = db.diary[req.user.id] || [];
  const i = list.findIndex((e) => e.id === req.params.id);
  if (i === -1) return bad(res, 'Kayıt bulunamadı.', 404);
  const [removed] = list.splice(i, 1);
  save();
  res.json({ ok: true, removed });
}));

/* --------------------------------- Su ------------------------------------ */

app.post('/api/water', requireAuth, h((req, res) => {
  const b = req.body || {};
  if (!DATE_RE.test(b.date || '')) return bad(res, 'Geçersiz tarih.');
  const delta = Number(b.delta) || 0;
  if (!db.water[req.user.id]) db.water[req.user.id] = {};
  const cur = db.water[req.user.id][b.date] || 0;
  db.water[req.user.id][b.date] = Math.min(6000, Math.max(0, cur + delta));
  save();
  res.json({ water: db.water[req.user.id][b.date] });
}));

/* -------------------------------- Tartı ---------------------------------- */

app.get('/api/weights', requireAuth, h((req, res) => {
  res.json({ weights: (db.weights[req.user.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date)) });
}));

app.post('/api/weights', requireAuth, h((req, res) => {
  const b = req.body || {};
  if (!DATE_RE.test(b.date || '')) return bad(res, 'Geçersiz tarih.');
  const kg = Number(b.kg);
  if (!(kg >= 30 && kg <= 300)) return bad(res, 'Kilo 30–300 kg arasında olmalı.');
  const list = db.weights[req.user.id] || (db.weights[req.user.id] = []);
  const i = list.findIndex((w) => w.date === b.date);
  if (i >= 0) list[i].kg = kg;
  else list.push({ date: b.date, kg });
  save();
  res.json({ ok: true });
}));

/* ------------------------------ İstatistik ------------------------------- */

app.get('/api/stats', requireAuth, h((req, res) => {
  const end = DATE_RE.test(req.query.end || '') ? req.query.end : new Date().toISOString().slice(0, 10);
  const days = Math.min(30, Math.max(7, Number(req.query.days) || 14));
  const list = db.diary[req.user.id] || [];
  const waterMap = db.water[req.user.id] || {};

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateOffsetISO(end, -i);
    const e = list.filter((x) => x.date === date);
    const t = e.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    const w = (db.weights[req.user.id] || []).find((x) => x.date === date);
    out.push({ date, ...t, meals: e.length, water: waterMap[date] || 0, weight: w ? w.kg : null });
  }

  // Seri (streak): bugünden (veya dünden) geriye dolu günler
  const withData = new Set(list.map((e) => e.date));
  let streak = 0;
  let cursor = withData.has(end) ? end : dateOffsetISO(end, -1);
  while (withData.has(cursor)) {
    streak++;
    cursor = dateOffsetISO(cursor, -1);
  }

  const weights = (db.weights[req.user.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  res.json({ days: out, streak, weights, targets: req.user.targets });
}));

/* -------------------------------- Veri dışa aktarma ---------------------- */

app.get('/api/export', requireAuth, h((req, res) => {
  const uid = req.user.id;
  const data = {
    exportedAt: new Date().toISOString(),
    profile: sanitizeUser(req.user),
    diary: db.diary[uid] || [],
    water: db.water[uid] || {},
    weights: db.weights[uid] || []
  };
  res.setHeader('Content-Disposition', 'attachment; filename="nutriai-verilerim.json"');
  res.json(data);
}));

/* -------------------------------- Statik --------------------------------- */

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return bad(res, 'Uç nokta bulunamadı.', 404);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NutriAI sunucusu http://0.0.0.0:${PORT} üzerinde çalışıyor`);
});
