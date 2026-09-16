/* api.js — İstemci durum yönetimi + API katmanı */

import { localAPI } from './local-backend.js';

export const state = {
  user: null,
  recipes: [],
  catalog: [],
  aiMap: {},
  recentScans: []
};

export async function api(path, opts = {}) {
  // APK / çevrimdışı mod: tüm API tarayıcı içinde çalışır
  if (typeof window !== 'undefined' && window.LOCAL_BACKEND) return localAPI(path, opts);
  const { body, ...rest } = opts;
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* boş gövde */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Bir şeyler ters gitti. Tekrar deneyin.');
    err.status = res.status;
    throw err;
  }
  return data;
}

/* Yerel tarihi YYYY-MM-DD olarak üretir (kullanıcının saat dilimi) */
export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function loadInitialData() {
  const [recipes, foods] = await Promise.all([api('/api/recipes'), api('/api/foods')]);
  state.recipes = recipes.recipes;
  state.catalog = foods.catalog;
  state.aiMap = foods.aiMap;
}
