/* views/plan.js — Haftalık kişisel beslenme programı */
import { api, state, todayStr } from '../api.js';
import { icon, esc, toast, confirmModal, MEALS, MEAL_ORDER, fmtDateLong, dayShort, fmtDateShort } from '../ui.js';
import { navigate } from '../main.js';

let plan = null;
let selDate = todayStr();
let adding = new Set();

export async function render(root) {
  await load();
  paint(root);
}

async function load(refresh = false) {
  plan = await api(`/api/plan?date=${todayStr()}${refresh ? '&refresh=1' : ''}`);
  const t = todayStr();
  selDate = plan.days.find((d) => d.date === t) ? t : plan.days[0].date;
}

function paint(root) {
  const targets = state.user.targets;
  const day = plan.days.find((d) => d.date === selDate);
  const totalKcal = day.meals.reduce((a, m) => a + m.kcal, 0);

  root.innerHTML = `
  <div class="view">
    <header class="view-head">
      <div>
        <h1>Haftalık Programın</h1>
        <p class="muted">${fmtDateShort(plan.weekKey)} – ${fmtDateShort(plan.days[6].date)} · Hedefin: ${targets.kcal} kcal/gün</p>
      </div>
      <div class="head-actions">
        <span class="ai-badge">${icon('sparkles', 16)} AI ile kişiselleştirildi</span>
        <button class="btn btn-ghost" id="plan-refresh">${icon('refresh', 17)} Yeni Varyasyon</button>
      </div>
    </header>

    <div class="day-tabs">
      ${plan.days.map((d) => `
        <button class="day-tab ${d.date === selDate ? 'active' : ''} ${d.date === todayStr() ? 'today' : ''}" data-date="${d.date}">
          <span>${dayShort(d.date)}</span><b>${fmtDateShort(d.date)}</b>
        </button>`).join('')}
    </div>

    <div class="card plan-day-summary">
      <div>
        <b>${fmtDateLong(selDate)}</b>
        <span class="muted"> — planlanan toplam ${totalKcal} kcal</span>
      </div>
      <div class="plan-balance ${Math.abs(totalKcal - targets.kcal) <= targets.kcal * 0.1 ? 'ok' : ''}">
        ${Math.abs(totalKcal - targets.kcal) <= targets.kcal * 0.1 ? icon('check', 16) + ' Hedefe uygun' : `${totalKcal > targets.kcal ? '+' : ''}${totalKcal - targets.kcal} kcal sapma`}
      </div>
    </div>

    <div class="plan-meals">
      ${MEAL_ORDER.map((slot) => {
        const m = day.meals.find((x) => x.slot === slot);
        if (!m) return '';
        const key = selDate + slot;
        return `
        <div class="card plan-meal">
          <img class="plan-img" src="${m.recipe.img}" alt="${esc(m.recipe.name)}" loading="lazy"/>
          <div class="plan-body">
            <div class="plan-slot">${MEALS[slot].label}</div>
            <h3 class="plan-name">${esc(m.recipe.name)}</h3>
            <div class="plan-meta">
              <span>${icon('flame', 14)} ${m.kcal} kcal</span>
              <span>${icon('clock', 14)} ${m.recipe.time} dk</span>
              <span class="chip">${m.servings} porsiyon</span>
            </div>
          </div>
          <div class="plan-actions">
            <button class="btn btn-sm btn-ghost plan-detail" data-rid="${m.recipe.id}">${icon('book', 15)} Tarif</button>
            <button class="btn btn-sm btn-primary plan-eat" data-slot="${slot}" data-i="${plan.days.indexOf(day)}" ${adding.has(key) ? 'disabled' : ''}>${icon('check', 15)} Yedim</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  root.querySelectorAll('.day-tab').forEach((b) => b.addEventListener('click', () => { selDate = b.dataset.date; paint(root); }));

  root.querySelector('#plan-refresh').addEventListener('click', () => confirmModal({
    title: 'Yeni program varyasyonu',
    text: 'Yapay zekâ bu hafta için farklı yemek kombinasyonlarından oluşan yeni bir plan oluşturacak. Mevcut plan değişecek, devam edilsin mi?',
    confirmText: 'Planı Yenile',
    onConfirm: async () => { await load(true); paint(root); toast('Yeni program hazır! ✨', 'ok'); }
  }));

  root.querySelectorAll('.plan-detail').forEach((b) => b.addEventListener('click', () => {
    const r = state.recipes.find((x) => x.id === b.dataset.rid);
    import('./recipes.js').then((m) => m.openRecipeModal(r, async (recipe, slot) => {
      await api('/api/diary', {
        method: 'POST',
        body: { date: selDate, meal: slot, name: recipe.name, kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, source: 'tarif' }
      });
      toast(`${recipe.name}, ${MEALS[slot].label.toLowerCase()} öğününe eklendi`, 'ok');
    }));
  }));

  root.querySelectorAll('.plan-eat').forEach((b) => b.addEventListener('click', async () => {
    const slot = b.dataset.slot;
    const d = plan.days[Number(b.dataset.i)];
    const m = d.meals.find((x) => x.slot === slot);
    const key = d.date + slot;
    adding.add(key);
    b.disabled = true;
    try {
      await api('/api/diary', {
        method: 'POST',
        body: {
          date: d.date, meal: slot, name: m.recipe.name, kcal: m.kcal,
          protein: Math.round(m.recipe.protein * m.servings),
          carbs: Math.round(m.recipe.carbs * m.servings),
          fat: Math.round(m.recipe.fat * m.servings),
          source: 'plan'
        }
      });
      toast(`${m.recipe.name} ${d.date === todayStr() ? 'bugünün' : 'günün'} ${MEALS[slot].label.toLowerCase()} öğününe eklendi`, 'ok');
    } finally {
      adding.delete(key);
      b.disabled = false;
    }
  }));
}
