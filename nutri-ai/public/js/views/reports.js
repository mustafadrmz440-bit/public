/* views/reports.js — İstatistikler: kalori grafiği, makro ortalamaları, kilo takibi */
import { api, todayStr } from '../api.js';
import { icon, toast, confirmModal, barChart, lineChart, fmtDateShort } from '../ui.js';

let stats = null;
let range = 14;

export async function render(root) {
  stats = await api(`/api/stats?end=${todayStr()}&days=${range}`);
  paint(root);
}

function paint(root) {
  const t = stats.targets;
  const days = stats.days.slice(-range);
  const active = days.filter((d) => d.meals > 0);
  const avgKcal = active.length ? Math.round(active.reduce((a, d) => a + d.kcal, 0) / active.length) : 0;
  const avgProtein = active.length ? Math.round(active.reduce((a, d) => a + d.protein, 0) / active.length) : 0;
  const avgCarbs = active.length ? Math.round(active.reduce((a, d) => a + d.carbs, 0) / active.length) : 0;
  const avgFat = active.length ? Math.round(active.reduce((a, d) => a + d.fat, 0) / active.length) : 0;
  const avgWater = active.length ? Math.round(active.reduce((a, d) => a + d.water, 0) / active.length) : 0;
  const totalLogs = active.reduce((a, d) => a + d.meals, 0);
  const weights = stats.weights;
  const wDelta = weights.length >= 2 ? +(weights[weights.length - 1].kg - weights[0].kg).toFixed(1) : null;
  const macroSum = avgProtein + avgCarbs + avgFat || 1;

  root.innerHTML = `
  <div class="view">
    <header class="view-head">
      <div>
        <h1>Raporlar</h1>
        <p class="muted">Son ${range} günlük beslenme performansın</p>
      </div>
      <div class="head-actions">
        ${[7, 14, 30].map((r) => `<button class="chip ${range === r ? 'active' : ''}" data-r="${r}">${r} gün</button>`).join('')}
      </div>
    </header>

    <div class="stat-cards">
      <div class="card stat"><span class="stat-ic fire">${icon('flame', 19)}</span><div><b>${stats.streak}</b><span>günlük seri</span></div></div>
      <div class="card stat"><span class="stat-ic green">${icon('book', 19)}</span><div><b>${totalLogs}</b><span>kayıt girilen öğün</span></div></div>
      <div class="card stat"><span class="stat-ic blue">${icon('target', 19)}</span><div><b>${avgKcal || '—'}</b><span>ort. günlük kcal</span></div></div>
      <div class="card stat"><span class="stat-ic cyan">${icon('drop', 19)}</span><div><b>${avgWater || '—'} ml</b><span>ort. günlük su</span></div></div>
    </div>

    <div class="card chart-card">
      <h3 class="card-title">${icon('chart', 18)} Günlük Kalori Alımı <small class="muted">— kesikli çizgi hedef (${t.kcal} kcal)</small></h3>
      ${barChart(
        days.map((d) => ({ label: fmtDateShort(d.date), v: Math.round(d.kcal), dim: d.meals === 0 })),
        { w: 760, h: 200, target: t.kcal }
      )}
      ${active.length === 0 ? `<p class="muted center pad">Henüz kayıt yok. "Bugün" sekmesinden öğün ekleyerek grafiklerini doldurmaya başla.</p>` : ''}
    </div>

    <div class="reports-row">
      <div class="card chart-card">
        <h3 class="card-title">${icon('chart', 18)} Ortalama Makro Dağılımı</h3>
        <div class="macro-donut-row">
          <div class="macro-stack">
            <div class="mstack"><span>Protein <b>${avgProtein}g</b></span><div class="pbar"><div style="width:${Math.round((avgProtein / macroSum) * 100)}%;background:var(--primary)"></div></div></div>
            <div class="mstack"><span>Karbonhidrat <b>${avgCarbs}g</b></span><div class="pbar"><div style="width:${Math.round((avgCarbs / macroSum) * 100)}%;background:#0ea5e9"></div></div></div>
            <div class="mstack"><span>Yağ <b>${avgFat}g</b></span><div class="pbar"><div style="width:${Math.round((avgFat / macroSum) * 100)}%;background:#f59e0b"></div></div></div>
          </div>
          <div class="macro-circle">
            <svg viewBox="0 0 42 42" width="130" height="130">
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--ring-bg)" stroke-width="6"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--primary)" stroke-width="6" stroke-dasharray="${(avgProtein / macroSum * 100).toFixed(1)} 100" transform="rotate(-90 21 21)" stroke-dashoffset="0"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#0ea5e9" stroke-width="6" stroke-dasharray="${(avgCarbs / macroSum * 100).toFixed(1)} 100" stroke-dashoffset="${(-avgProtein / macroSum * 100).toFixed(1)}" transform="rotate(-90 21 21)"/>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f59e0b" stroke-width="6" stroke-dasharray="${(avgFat / macroSum * 100).toFixed(1)} 100" stroke-dashoffset="${(-(avgProtein + avgCarbs) / macroSum * 100).toFixed(1)}" transform="rotate(-90 21 21)"/>
              <text x="21" y="22" text-anchor="middle" class="mc-text">Makro</text>
            </svg>
          </div>
        </div>
      </div>

      <div class="card chart-card">
        <div class="card-title-row">
          <h3 class="card-title">${icon('activity', 18)} Kilo Takibi</h3>
          <button class="btn btn-sm btn-ghost" id="w-add">${icon('plus', 15)} Kilo Ekle</button>
        </div>
        ${wDelta !== null ? `<div class="w-delta ${wDelta <= 0 ? 'good' : ''}">${wDelta <= 0 ? '▼' : '▲'} ${Math.abs(wDelta)} kg ${wDelta <= 0 ? 'kayıt başlangıcından beri' : 'artış'}</div>` : ''}
        ${lineChart(
          weights.map((w) => ({ v: w.kg, label: fmtDateShort(w.date) })),
          { w: 380, h: 170, fmt: (v) => v + ' kg' }
        )}
        ${weights.length === 0 ? `<p class="muted center pad">Kilo ekle, gelişimini burada izle.</p>` : ''}
      </div>
    </div>
  </div>`;

  root.querySelectorAll('.head-actions .chip').forEach((c) => c.addEventListener('click', async () => {
    range = Number(c.dataset.r);
    stats = await api(`/api/stats?end=${todayStr()}&days=${range}`);
    paint(root);
  }));

  root.querySelector('#w-add').addEventListener('click', () => confirmModal({
    title: 'Bugünün kilosu',
    text: 'Sabah aç karnına tartım en doğru sonucu verir.',
    placeholder: 'Örn. 68.5',
    confirmText: 'Kaydet',
    onConfirm: async () => {
      const v = parseFloat(document.getElementById('confirm-input').value.replace(',', '.'));
      if (!(v >= 30 && v <= 300)) throw new Error('Geçerli bir kilo gir (30–300 kg).');
      await api('/api/weights', { method: 'POST', body: { date: todayStr(), kg: v } });
      stats = await api(`/api/stats?end=${todayStr()}&days=${range}`);
      paint(root);
      toast('Kilo kaydedildi', 'ok');
    }
  }));
}
