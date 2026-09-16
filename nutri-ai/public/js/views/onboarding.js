/* views/onboarding.js — Kurulum sihirbazı: hedef hesaplama */
import { api, state } from '../api.js';
import { icon, esc, toast } from '../ui.js';
import { navigate } from '../main.js';

let step = 0;
let data = { gender: null, age: '', height: 170, weight: 70, targetWeight: '', activity: null, goal: null };

const ACTIVITIES = [
  { id: 'hareketsiz', t: 'Hareketsiz', d: 'Masa başı iş, az hareket', ic: 'moon' },
  { id: 'az', t: 'Az Hareketli', d: 'Haftada 1-2 gün hafif spor', ic: 'activity' },
  { id: 'orta', t: 'Orta', d: 'Haftada 3-5 gün egzersiz', ic: 'activity' },
  { id: 'yuksek', t: 'Aktif', d: 'Haftada 6-7 gün egzersiz', ic: 'flame' },
  { id: 'cok_yuksek', t: 'Çok Aktif', d: 'Yoğun antrenman / ağır iş', ic: 'flame' }
];

const GOALS = [
  { id: 'kilo_ver', t: 'Kilo Vermek', d: 'Günlük ~500 kcal açık ile sürdürülebilir yağ yakımı', ic: 'target' },
  { id: 'koru', t: 'Kilomu Korumak', d: 'Dengeli kalori ile mevcut formunu koru', ic: 'check' },
  { id: 'kazan', t: 'Kas / Kitle Kazanmak', d: 'Kalori fazlası ile sağlıklı kilo alma', ic: 'plus' }
];

function progressHTML() {
  return `
  <div class="ob-progress">
    <div class="ob-bar"><div style="width:${((step + 1) / 5) * 100}%"></div></div>
    <span class="ob-count">${step + 1} / 5</span>
  </div>`;
}

function stepHTML() {
  switch (step) {
    case 0: return `
      <h2 class="ob-title">Sana uygun planı hazırlayalım</h2>
      <p class="muted">Cinsiyet ve yaşın, metabolizma hızını (BMR) hesaplamak için gerekli.</p>
      <div class="opt-grid two">
        <button type="button" class="opt ${data.gender === 'kadin' ? 'sel' : ''}" data-g="kadin">${icon('user', 22)}<b>Kadın</b></button>
        <button type="button" class="opt ${data.gender === 'erkek' ? 'sel' : ''}" data-g="erkek">${icon('user', 22)}<b>Erkek</b></button>
      </div>
      <label class="field"><span>Yaş</span><input class="input" type="number" min="14" max="90" id="ob-age" value="${esc(data.age)}" placeholder="Örn. 28" /></label>`;
    case 1: return `
      <h2 class="ob-title">Vücut ölçülerin</h2>
      <p class="muted">Kalori ihtiyacın boy, kilo ve hedef kiloyla birlikte netleşir.</p>
      <label class="field"><span>Boy (cm)</span><input class="input" type="number" min="120" max="230" id="ob-height" value="${data.height}" /></label>
      <label class="field"><span>Mevcut Kilo (kg)</span><input class="input" type="number" min="35" max="250" step="0.1" id="ob-weight" value="${data.weight}" /></label>
      <label class="field"><span>Hedef Kilo (kg) — <i>isteğe bağlı</i></span><input class="input" type="number" min="30" max="250" step="0.1" id="ob-tw" value="${esc(data.targetWeight)}" placeholder="Örn. 62" /></label>`;
    case 2: return `
      <h2 class="ob-title">Günlük hareket seviyen?</h2>
      <p class="muted">Mevcut iş/yaşam tempona en uygun olanı seç.</p>
      <div class="opt-list">
        ${ACTIVITIES.map((a) => `
        <button type="button" class="opt-row ${data.activity === a.id ? 'sel' : ''}" data-a="${a.id}">
          <span class="opt-ic">${icon(a.ic, 20)}</span>
          <span class="opt-tx"><b>${a.t}</b><small>${a.d}</small></span>
          ${data.activity === a.id ? icon('check', 20, 'opt-check') : ''}
        </button>`).join('')}
      </div>`;
    case 3: return `
      <h2 class="ob-title">Hedefin ne?</h2>
      <p class="muted">Programın, tarifler ve günlük kalori açığın buna göre şekillenecek.</p>
      <div class="opt-list">
        ${GOALS.map((g) => `
        <button type="button" class="opt-row ${data.goal === g.id ? 'sel' : ''}" data-go="${g.id}">
          <span class="opt-ic">${icon(g.ic, 20)}</span>
          <span class="opt-tx"><b>${g.t}</b><small>${g.d}</small></span>
          ${data.goal === g.id ? icon('check', 20, 'opt-check') : ''}
        </button>`).join('')}
      </div>`;
    case 4: {
      const t = state.user.targets || {};
      return `
      <div class="ob-result-head">${icon('sparkles', 26)}<h2>Hedeflerin hesaplandı!</h2></div>
      <p class="muted">Yapay zekâ motorumuz Mifflin-St Jeor bilimsel formülüyle metabolizmanı hesapladı ve programını kişiselleştirdi.</p>
      <div class="res-grid">
        <div class="res-card big"><span>Günlük Kalori Hedefi</span><b>${t.kcal} <i>kcal</i></b></div>
        <div class="res-card"><span>Protein</span><b>${t.protein} g</b></div>
        <div class="res-card"><span>Karbonhidrat</span><b>${t.carbs} g</b></div>
        <div class="res-card"><span>Yağ</span><b>${t.fat} g</b></div>
        <div class="res-card"><span>Su Hedefi</span><b>${t.water} ml</b></div>
        <div class="res-card ghost"><span>Bazal Metabolizma</span><b>${t.bmr} kcal</b></div>
        <div class="res-card ghost"><span>Günlük Harcama</span><b>${t.tdee} kcal</b></div>
      </div>`;
    }
  }
}

function validate() {
  if (step === 0) {
    if (!data.gender) return 'Cinsiyetini seçmelisin.';
    const a = Number(data.age);
    if (!(a >= 14 && a <= 90)) return 'Geçerli bir yaş gir (14–90).';
  }
  if (step === 1) {
    const hh = Number(data.height), w = Number(data.weight);
    if (!(hh >= 120 && hh <= 230)) return 'Boy 120–230 cm arasında olmalı.';
    if (!(w >= 35 && w <= 250)) return 'Kilo 35–250 kg arasında olmalı.';
  }
  if (step === 2 && !data.activity) return 'Hareket seviyeni seçmelisin.';
  if (step === 3 && !data.goal) return 'Hedefini seçmelisin.';
  return null;
}

export function render(root) {
  root.innerHTML = `
  <div class="ob">
    <div class="ob-brand">
      <svg viewBox="0 0 24 24" width="32" height="32"><rect width="24" height="24" rx="6" fill="rgba(163,230,53,.16)"/><path d="M11 19a6 6 0 0 1-1.04-11.9C14.7 6.1 15.9 5.65 17.5 3.6c.85 1.7 1.7 3.55 1.7 6.8C19.2 14.6 15.4 19 11 19z" fill="#a3e635"/></svg>
      <span>Nutri<b>AI</b></span>
    </div>
    <div class="ob-card">
      ${step < 4 ? progressHTML() : ''}
      <div class="ob-body">${stepHTML()}</div>
      <div class="ob-err" id="ob-err"></div>
      <div class="ob-actions">
        ${step > 0 && step < 4 ? `<button class="btn btn-ghost" id="ob-back">${icon('arrowLeft', 18)} Geri</button>` : '<span></span>'}
        <button class="btn btn-primary" id="ob-next">
          ${step === 4 ? 'Programımı Oluştur ' + icon('sparkles', 18) : (step === 3 ? 'Hesapla ' + icon('sparkles', 18) : 'Devam ' + icon('chevronRight', 18))}
        </button>
      </div>
    </div>
  </div>`;

  const errEl = root.querySelector('#ob-err');
  const showErr = (m) => { errEl.textContent = m || ''; };

  root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
    data.gender = b.dataset.g; render(root);
  }));
  root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    data.activity = b.dataset.a; render(root);
  }));
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    data.goal = b.dataset.go; render(root);
  }));

  const bind = (id, key, isNum = false) => {
    const el = root.querySelector(id);
    if (el) el.addEventListener('input', () => { data[key] = isNum ? el.value : el.value; });
  };
  bind('#ob-age', 'age');
  bind('#ob-height', 'height');
  bind('#ob-weight', 'weight');
  bind('#ob-tw', 'targetWeight');

  const back = root.querySelector('#ob-back');
  back && back.addEventListener('click', () => { step--; render(root); });

  root.querySelector('#ob-next').addEventListener('click', async () => {
    showErr(validate());
    if (errEl.textContent) return;
    if (step < 3) { step++; render(root); return; }
    if (step === 3) {
      try {
        const { user } = await api('/api/profile', {
          method: 'PUT',
          body: { ...data, targetWeight: data.targetWeight || null }
        });
        state.user = user;
        step = 4;
        render(root);
      } catch (e) { showErr(e.message); }
      return;
    }
    // Son adım: onboarded işaretle
    try {
      const { user } = await api('/api/profile', {
        method: 'PUT',
        body: { ...state.user.profile, onboarded: true }
      });
      state.user = user;
      toast('Hazırsın! Programın oluşturuldu. 🎉', 'ok');
      navigate('/bugun');
    } catch (e) { showErr(e.message); }
  });
}
