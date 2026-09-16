/**
 * engine.js — Beslenme motoru:
 *  • Mifflin-St Jeor ile BMR, TDEE ve makro hedef hesabı
 *  • Kullanıcı hedefine göre kişisel haftalık yemek planı üretimi (tohumlanabilir RNG)
 */
const fs = require('fs');
const path = require('path');

const recipes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'recipes.json'), 'utf8'));

/* ---------------- Hesaplamalar ---------------- */

const ACTIVITY = {
  hareketsiz: 1.2,
  az: 1.375,
  orta: 1.55,
  yuksek: 1.725,
  cok_yuksek: 1.9
};

function round5(n) {
  return Math.round(n / 5) * 5;
}

function computeTargets(profile) {
  const { gender, age, height, weight, activity, goal } = profile;
  const act = ACTIVITY[activity] || 1.375;

  // Mifflin-St Jeor
  const bmr =
    10 * weight + 6.25 * height - 5 * age + (gender === 'erkek' ? 5 : -161);
  let tdee = bmr * act;

  let kcal;
  if (goal === 'kilo_ver') kcal = tdee - 500;
  else if (goal === 'kazan') kcal = tdee + 300;
  else kcal = tdee;

  // Sağlıklı alt sınırlar
  const floor = gender === 'erkek' ? 1500 : 1200;
  if (kcal < floor) kcal = floor;
  kcal = round5(kcal);

  // Makro dağılımı hedefe göre
  const split =
    goal === 'kilo_ver'
      ? { p: 0.30, c: 0.35, f: 0.35 }
      : goal === 'kazan'
        ? { p: 0.25, c: 0.50, f: 0.25 }
        : { p: 0.25, c: 0.45, f: 0.30 };

  const protein = Math.round((kcal * split.p) / 4);
  const carbs = Math.round((kcal * split.c) / 4);
  const fat = Math.round((kcal * split.f) / 9);

  // Su hedefi: 35 ml/kg (2000–3500 ml)
  const water = Math.min(3500, Math.max(2000, Math.round((weight * 35) / 50) * 50));

  return { kcal, protein, carbs, fat, water, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

/* ---------------- Plan üretimi ---------------- */

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
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function generatePlan(user, weekMondayISO, seedOffset = 0) {
  const t = user.targets || { kcal: 2000, protein: 100, carbs: 225, fat: 67 };
  const rng = mulberry32(hashStr(user.id + weekMondayISO) + seedOffset);
  const lastUsed = {}; // recipeId -> gün indeksi
  const days = [];

  for (let d = 0; d < 7; d++) {
    const date = dateOffsetISO(weekMondayISO, d);
    const usedToday = new Set();
    const meals = [];

    for (const slot of SLOT_ORDER) {
      const budget = t.kcal * SLOT_SPLITS[slot];
      const cands = recipes.filter((r) => r.slots.includes(slot));
      let best = null;
      let bestScore = Infinity;
      for (const r of cands) {
        let s = Math.abs(r.kcal * 1 - budget) + rng() * 260;
        if (usedToday.has(r.id)) s += 1e6;
        if (lastUsed[r.id] === d - 1) s += 900; // üst üste gün tekrarını kıs
        if (lastUsed[r.id] === d) s += 1e6;
        if (s < bestScore) {
          bestScore = s;
          best = r;
        }
      }
      const servings = Math.min(2, Math.max(0.5, Math.round((budget / best.kcal) * 2) / 2));
      meals.push({
        slot,
        recipeId: best.id,
        servings,
        kcal: Math.round(best.kcal * servings)
      });
      usedToday.add(best.id);
      lastUsed[best.id] = d;
    }
    days.push({ date, meals });
  }
  return { weekKey: weekMondayISO, seedOffset, days };
}

module.exports = { computeTargets, generatePlan, recipes, dateOffsetISO, ACTIVITY };
