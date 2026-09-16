/* views/today.js — Ana gösterge paneli: kalori ringi, makrolar, su, öğünler */
import { api, state, todayStr } from '../api.js';
import { icon, esc, toast, openModal, confirmModal, donutSVG, progressBar, MEALS, MEAL_ORDER, SOURCE_LABEL, fmtDateLong } from '../ui.js';
import { navigate } from '../main.js';

let date = todayStr();
let day = null;
let stats = null;

export async function render(root, { query }) {
  date = query.get('date') || todayStr();
  [day, stats] = await Promise.all([
    api(`/api/day?date=${date}`),
    api(`/api/stats?end=${todayStr()}&days=7`)
  ]);
  paint(root);
}

function macroRow(label, val, target, color) {
  return `
  <div class="macro">
    <div class="macro-top"><span>${label}</span><b>${Math.round(val)} / ${target} g</b></div>
    ${progressBar(val, target, color)}
  </div>`;
}

function coachNote() {
  const t = day.targets;
  const eaten = day.totals.kcal;
  const now = new Date();
  const hour = now.getHours();
  const notes = [];
  const rem = t.kcal - eaten;

  if (eaten === 0) {
    notes.push(hour < 11
      ? 'Güne hayırlı başlangıçlar! Kahvaltını fotoğraflayıp benimle taratırsan kalorilerini anında kaydederim. 🍳'
      : 'Bugün henüz kayıt yok. İlk öğününü ekleyerek güne dengeli başla — program sekmesinden hazır planına göz atabilirsin.');
  } else if (rem < 0) {
    notes.push(`Hedefinin ${Math.abs(rem)} kcal üzerine geçtin. Panik yok: akşam yürüyüşü ve yarın hafif bir menü bunu kolayca dengeler. 🚶`);
  } else if (hour >= 20 && rem > t.kcal * 0.35) {
    notes.push(`Bugün ${rem} kcal alanın kaldı ama saat ilerledi. Ağır yemek yerine süzme yoğurt gibi hafif bir ara öğün iyi gider. 🌙`);
  } else {
    const proteinPct = t.protein ? (day.totals.protein / t.protein) * 100 : 0;
    const waterPct = t.water ? (day.water / t.water) * 100 : 0;
    if (proteinPct < 55 && eaten > t.kcal * 0.4) notes.push(`Protein hedefinin %${Math.round(proteinPct)}'indesin. Izgara tavuk, yumurta veya süzme yoğurt eklemek kas korumana çok katkı sağlar. 💪`);
    else if (waterPct < 50 && hour > 14) notes.push(`Su tüketimin hedefinin yarısının altında. Bir bardak su içmeyi hatırlatmamı ister misin? İşte bitti: içtin bile. 💧`);
    else if (rem < t.kcal * 0.15) notes.push('Kalori dengesi harika görünüyor! Bugünü böyle kapatmak kilo hedefine birebir uygun. 👏');
    else notes.push(`Şu ana kadar ${eaten} kcal aldın, ${Math.round(rem)} kcal hakkın kaldı. Bu akşam için programındaki akşam yemeği tarifi ideal porsiyonda sizi bekliyor. ✨`);
  }
  if (notes.length === 0) notes.push('Dengeli bir gün! Küçük ama tutarlı adımlar büyük sonuçlar getirir. 🌱');
  return notes[0];
}

function mealSectionHTML(slot) {
  const m = MEALS[slot];
  const entries = day.entries.filter((e) => e.meal === slot);
  const sum = entries.reduce((a, e) => a + e.kcal, 0);
  const rows = entries.map((e) => `
    <div class="entry" data-id="${e.id}">
      <div class="entry-ic">${icon({ ai: 'sparkles', plan: 'map', tarif: 'book', manuel: 'plus' }[e.source] || 'plus', 17)}</div>
      <div class="entry-main">
        <div class="entry-name">${esc(e.name)}</div>
        <div class="entry-meta"><span class="src src-${e.source}">${SOURCE_LABEL[e.source] || 'Manuel'}</span>P ${e.protein}g · K ${e.carbs}g · Y ${e.fat}g</div>
      </div>
      <div class="entry-kcal">${e.kcal} <small>kcal</small></div>
      <button class="icon-btn entry-del" title="Sil">${icon('trash', 16)}</button>
    </div>`).join('');

  return `
  <div class="meal-card" data-slot="${slot}">
    <div class="meal-head">
      <div class="meal-title"><span class="meal-ic">${icon({ kahvalti: 'sun', oglen: 'flame', aksam: 'moon', ara: 'cookie' }[slot], 18)}</span>
        <b>${m.label}</b><span class="meal-pct">≈ %${m.pct} günlük</span></div>
      <div class="meal-right">
        <span class="meal-sum">${sum} kcal</span>
        <button class="btn btn-sm btn-primary meal-add">${icon('plus', 16)} Ekle</button>
      </div>
    </div>
    ${rows || `<div class="meal-empty">Bu öğün için henüz kayıt yok.</div>`}
  </div>`;
}

function paint(root) {
  const t = day.targets;
  const eaten = day.totals.kcal;
  const rem = Math.max(0, t.kcal - eaten);
  const streak = stats.streak || 0;
  const glasses = Math.round(t.water / 250);
  const filled = Math.min(glasses, Math.round(day.water / 250));

  root.innerHTML = `
  <div class="view">
    <header class="view-head">
      <div>
        <h1>${date === todayStr() ? 'Bugün' : fmtDateLong(date)}</h1>
        <p class="muted">${date === todayStr() ? fmtDateLong(date) : 'Seçili günün özeti'}</p>
      </div>
      <div class="head-actions">
        ${streak > 0 ? `<span class="streak">${icon('flame', 18)} ${streak} günlük seri</span>` : ''}
        <button class="btn btn-primary" id="quick-scan">${icon('scan', 18)} Yemek Tara</button>
      </div>
    </header>

    <div class="grid-main">
      <div class="card kcal-card">
        <div class="kcal-ring">
          ${donutSVG(eaten, t.kcal)}
          <div class="kcal-center">
            <b>${Math.round(eaten).toLocaleString('tr-TR')}</b>
            <span>/ ${t.kcal.toLocaleString('tr-TR')} kcal</span>
            <em class="${eaten > t.kcal ? 'over' : ''}">${eaten > t.kcal ? 'Hedef aşıldı' : rem + ' kcal kaldı'}</em>
          </div>
        </div>
        <div class="kcal-caption">Yapay zekâ hedefin: <b>${t.kcal} kcal</b> · BMR ${t.bmr} · TDEE ${t.tdee}</div>
      </div>

      <div class="card">
        <h3 class="card-title">${icon('chart', 18)} Makro Dağılımı</h3>
        ${macroRow('Protein', day.totals.protein, t.protein, 'var(--primary)')}
        ${macroRow('Karbonhidrat', day.totals.carbs, t.carbs, '#0ea5e9')}
        ${macroRow('Yağ', day.totals.fat, t.fat, '#f59e0b')}
      </div>

      <div class="card water-card">
        <h3 class="card-title">${icon('drop', 18)} Su Takibi</h3>
        <div class="water-glasses">${Array.from({ length: glasses }, (_, i) => `<span class="glass ${i < filled ? 'full' : ''}">${icon('drop', 15)}</span>`).join('')}</div>
        <div class="water-val"><b>${day.water} ml</b> / ${t.water} ml</div>
        ${progressBar(day.water, t.water, '#0ea5e9')}
        <div class="water-actions">
          <button class="btn btn-sm btn-ghost water-btn" data-d="250">${icon('plus', 15)} 250 ml</button>
          <button class="btn btn-sm btn-ghost water-btn" data-d="500">${icon('plus', 15)} 500 ml</button>
          <button class="btn btn-sm btn-ghost water-btn" data-d="-250">${icon('minus', 15)} 250 ml</button>
        </div>
      </div>

      <div class="card coach-card">
        <div class="coach-head">${icon('sparkles', 20)}<span>AI Koç Notu</span></div>
        <p>${coachNote()}</p>
      </div>
    </div>

    <h2 class="section-title">Öğünler</h2>
    <div class="meals-grid">
      ${MEAL_ORDER.map(mealSectionHTML).join('')}
    </div>
  </div>`;

  /* --- olaylar --- */
  root.querySelector('#quick-scan').addEventListener('click', () => navigate(`/tara?date=${date}`));

  root.querySelectorAll('.water-btn').forEach((b) => b.addEventListener('click', async () => {
    const d = Number(b.dataset.d);
    const { water } = await api('/api/water', { method: 'POST', body: { date, delta: d } });
    day.water = water;
    paint(root);
  }));

  root.querySelectorAll('.meal-add').forEach((b) => b.addEventListener('click', () => {
    const slot = b.closest('.meal-card').dataset.slot;
    openAddModal(slot);
  }));

  root.querySelectorAll('.entry-del').forEach((b) => b.addEventListener('click', () => {
    const id = b.closest('.entry').dataset.id;
    confirmModal({
      title: 'Kaydı sil',
      text: 'Bu besin kaydı günlüğünden kalıcı olarak silinecek.',
      confirmText: 'Sil',
      danger: true,
      onConfirm: async () => {
        await api(`/api/diary/${id}`, { method: 'DELETE' });
        day = await api(`/api/day?date=${date}`);
        stats = await api(`/api/stats?end=${todayStr()}&days=7`);
        paint(root);
        toast('Kayıt silindi', 'ok');
      }
    });
  }));
}

/* --------------------------- Besin ekleme modalı -------------------------- */

function openAddModal(slot) {
  const categories = [...new Set(state.catalog.map((f) => f.cat))];
  let cat = 'Tümü';
  let q = '';

  openModal(`
    <div class="modal-head"><h3>${MEALS[slot].label} için besin ekle</h3><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <div class="seg-tabs">
        <button class="seg active" data-tab="catalog">Besin Kataloğu</button>
        <button class="seg" data-tab="plan">Programımdan</button>
        <button class="seg" data-tab="custom">Kendi Besinin</button>
      </div>
      <div id="add-pane"></div>
    </div>
  `, {
    width: 620,
    onMount(overlay, close) {
      const pane = overlay.querySelector('#add-pane');
      overlay.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', () => {
        overlay.querySelectorAll('.seg').forEach((x) => x.classList.remove('active'));
        s.classList.add('active');
        ({ catalog: paintCatalog, plan: paintPlan, custom: paintCustom }[s.dataset.tab])();
      }));

      function addEntry(name, kcal, p, c, f, source) {
        return api('/api/diary', { method: 'POST', body: { date, meal: slot, name, kcal, protein: p, carbs: c, fat: f, source } })
          .then(async () => {
            day = await api(`/api/day?date=${date}`);
            close();
            const r = document.querySelector('.meals-grid');
            if (r) paint(r.closest('.view'));
            toast(`${name} eklendi (+${Math.round(kcal)} kcal)`, 'ok');
          });
      }

      function paintCatalog() {
        pane.innerHTML = `
          <div class="search-row">
            <div class="search-box">${icon('search', 17)}<input id="food-q" placeholder="Besin ara… (simit, tavuk, muz)" /></div>
            <select class="input sel-cat" id="food-cat">
              <option>Tümü</option>${categories.map((c) => `<option>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="food-list" id="food-list"></div>`;
        const list = pane.querySelector('#food-list');
        const paintList = () => {
          const items = state.catalog.filter((f) =>
            (cat === 'Tümü' || f.cat === cat) &&
            (!q || f.name.toLowerCase().includes(q))
          );
          list.innerHTML = items.map((f) => `
            <button class="food-row" data-id="${f.id}">
              <div><b>${esc(f.name)}</b><small>${esc(f.portion)} · ${f.kcal} kcal</small></div>
              <span class="add-badge">${icon('plus', 15)}</span>
            </button>`).join('') || `<div class="pad muted">Sonuç bulunamadı.</div>`;
          list.querySelectorAll('.food-row').forEach((b) => b.addEventListener('click', () => {
            const f = state.catalog.find((x) => x.id === b.dataset.id);
            addEntry(f.name, f.kcal, f.protein, f.carbs, f.fat, 'manuel');
          }));
        };
        paintList();
        pane.querySelector('#food-q').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); paintList(); });
        pane.querySelector('#food-cat').addEventListener('change', (e) => { cat = e.target.value; paintList(); });
      }

      async function paintPlan() {
        pane.innerHTML = `<div class="pad center">${spinner(20)} <span class="muted">Program yükleniyor…</span></div>`;
        try {
          const plan = await api(`/api/plan?date=${date}`);
          const d = plan.days.find((x) => x.date === date);
          const meals = d ? d.meals.filter((m) => m.slot === slot) : [];
          if (!meals.length) { pane.innerHTML = `<div class="pad muted">Bu öğün için programda plan bulunmuyor.</div>`; return; }
          pane.innerHTML = meals.map((m, i) => `
            <button class="food-row" data-i="${i}">
              <img class="food-thumb" src="${m.recipe.img}" alt="" loading="lazy"/>
              <div><b>${esc(m.recipe.name)}</b><small>${m.servings} porsiyon · ${m.kcal} kcal</small></div>
              <span class="add-badge">${icon('plus', 15)}</span>
            </button>`).join('');
          pane.querySelectorAll('.food-row').forEach((b) => b.addEventListener('click', () => {
            const m = meals[Number(b.dataset.i)];
            addEntry(m.recipe.name, m.kcal, Math.round(m.recipe.protein * m.servings), Math.round(m.recipe.carbs * m.servings), Math.round(m.recipe.fat * m.servings), 'plan');
          }));
        } catch (e) { pane.innerHTML = `<div class="pad muted">${esc(e.message)}</div>`; }
      }

      function paintCustom() {
        pane.innerHTML = `
          <div class="custom-grid">
            <label class="field span2"><span>Besin adı</span><input class="input" id="c-name" placeholder="Örn. Annemin böreği" /></label>
            <label class="field"><span>Kalori (kcal)</span><input class="input" type="number" min="0" id="c-kcal" placeholder="350" /></label>
            <label class="field"><span>Protein (g)</span><input class="input" type="number" min="0" id="c-p" placeholder="0" /></label>
            <label class="field"><span>Karbonhidrat (g)</span><input class="input" type="number" min="0" id="c-c" placeholder="0" /></label>
            <label class="field"><span>Yağ (g)</span><input class="input" type="number" min="0" id="c-f" placeholder="0" /></label>
            <div class="span2"><button class="btn btn-primary btn-block" id="c-add">${icon('plus', 17)} Günlüğe Ekle</button></div>
          </div>`;
        pane.querySelector('#c-add').addEventListener('click', () => {
          const name = pane.querySelector('#c-name').value.trim();
          const kcal = Number(pane.querySelector('#c-kcal').value);
          if (!name) return toast('Besin adı gir', 'err');
          if (!(kcal >= 0)) return toast('Geçerli bir kalori gir', 'err');
          addEntry(name, kcal, Number(pane.querySelector('#c-p').value) || 0, Number(pane.querySelector('#c-c').value) || 0, Number(pane.querySelector('#c-f').value) || 0, 'manuel');
        });
      }

      paintCatalog();
    }
  });
}
