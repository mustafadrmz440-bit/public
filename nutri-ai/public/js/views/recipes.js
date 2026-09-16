/* views/recipes.js — Tarif kataloğu + detay modalı */
import { api, state, todayStr } from '../api.js';
import { icon, esc, toast, openModal, MEALS, MEAL_ORDER, emptyState } from '../ui.js';

let filter = 'Tümü';
let q = '';

const FILTERS = ['Tümü', 'Kahvaltı', 'Öğle', 'Akşam', 'Ara Öğün', 'Vegan', 'Yüksek Protein', 'Glutensiz'];

function matchSlot(r, filter) {
  switch (filter) {
    case 'Tümü': return true;
    case 'Kahvaltı': return r.slots.includes('kahvalti');
    case 'Öğle': return r.slots.includes('oglen');
    case 'Akşam': return r.slots.includes('aksam');
    case 'Ara Öğün': return r.slots.includes('ara');
    case 'Vegan': return r.tags.includes('vegan');
    case 'Yüksek Protein': return r.tags.includes('yuksek-protein');
    case 'Glutensiz': return r.tags.includes('glutensiz');
    default: return true;
  }
}

export function render(root) {
  root.innerHTML = `
  <div class="view">
    <header class="view-head">
      <div>
        <h1>Tarifler</h1>
        <p class="muted">Diyetisyen onaylı, kalori kontrollü ${state.recipes.length} tarif</p>
      </div>
    </header>

    <div class="search-row recipes-search">
      <div class="search-box">${icon('search', 17)}<input id="rec-q" placeholder="Tarif ara… (menemen, somon, yulaf)" value="${esc(q)}"/></div>
    </div>
    <div class="chip-row" id="rec-chips">
      ${FILTERS.map((f) => `<button class="chip ${filter === f ? 'active' : ''}" data-f="${esc(f)}">${esc(f)}</button>`).join('')}
    </div>

    <div class="recipe-grid" id="rec-grid"></div>
  </div>`;

  const grid = root.querySelector('#rec-grid');

  function paintGrid() {
    const list = state.recipes.filter((r) =>
      matchSlot(r, filter) && (!q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)))
    );
    grid.innerHTML = list.map((r) => `
      <article class="recipe-card" data-id="${r.id}">
        <div class="recipe-img-wrap">
          <img src="${r.img}" alt="${esc(r.name)}" loading="lazy"/>
          <span class="recipe-kcal">${r.kcal} kcal</span>
        </div>
        <div class="recipe-body">
          <h3>${esc(r.name)}</h3>
          <p class="muted clamp2">${esc(r.desc)}</p>
          <div class="recipe-meta">
            <span>${icon('clock', 14)} ${r.time} dk</span>
            <span>${icon('flame', 14)} P ${r.protein}g · K ${r.carbs}g · Y ${r.fat}g</span>
          </div>
          <div class="tag-row">
            ${r.slots.map((s) => `<span class="tag">${MEALS[s].label}</span>`).join('')}
            ${r.tags.slice(0, 2).map((t) => `<span class="tag alt">${({ 'vegan': 'Vegan', 'vejetaryen': 'Vejetaryen', 'yuksek-protein': 'Yüksek Protein', 'glutensiz': 'Glutensiz', 'pratik': 'Pratik', 'lifli': 'Lifli', 'dusuk-kalori': 'Düşük Kalori', 'dusuk-karb': 'Düşük Karb.' })[t] || t}</span>`).join('')}
          </div>
        </div>
      </article>`).join('') || emptyState('🍳', 'Tarif bulunamadı', 'Arama veya filtreyi değiştirerek tekrar dene.');

    grid.querySelectorAll('.recipe-card').forEach((c) => c.addEventListener('click', () => {
      const r = state.recipes.find((x) => x.id === c.dataset.id);
      openRecipeModal(r, addToDiary);
    }));
  }

  async function addToDiary(recipe, slot) {
    await api('/api/diary', {
      method: 'POST',
      body: { date: todayStr(), meal: slot, name: recipe.name, kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, source: 'tarif' }
    });
    toast(`${recipe.name} bugünün ${MEALS[slot].label.toLowerCase()} öğününe eklendi`, 'ok');
  }

  root.querySelector('#rec-q').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); paintGrid(); });
  root.querySelectorAll('#rec-chips .chip').forEach((c) => c.addEventListener('click', () => {
    filter = c.dataset.f;
    root.querySelectorAll('#rec-chips .chip').forEach((x) => x.classList.toggle('active', x === c));
    paintGrid();
  }));

  paintGrid();
}

/* Detay modalı (plan görünümünden de kullanılır) */
export function openRecipeModal(r, onAdd) {
  openModal(`
    <div class="recipe-modal">
      <div class="rm-hero"><img src="${r.img}" alt="${esc(r.name)}"/><button class="icon-btn rm-close" data-close>${icon('x', 18)}</button></div>
      <div class="rm-body">
        <div class="tag-row">
          ${r.slots.map((s) => `<span class="tag">${MEALS[s].label}</span>`).join('')}
          ${r.tags.slice(0, 3).map((t) => `<span class="tag alt">${t}</span>`).join('')}
        </div>
        <h2>${esc(r.name)}</h2>
        <p class="muted">${esc(r.desc)}</p>

        <div class="rm-macros">
          <div><b>${r.kcal}</b><span>kcal</span></div>
          <div><b>${r.protein}g</b><span>protein</span></div>
          <div><b>${r.carbs}g</b><span>karb.</span></div>
          <div><b>${r.fat}g</b><span>yağ</span></div>
          <div><b>${r.time}dk</b><span>süre</span></div>
          <div><b>${esc(r.difficulty)}</b><span>zorluk</span></div>
        </div>

        <div class="rm-cols">
          <div>
            <h4>${icon('check', 16)} Malzemeler</h4>
            <ul class="rm-ing">
              ${r.ingredients.map((i) => `<li><span class="ing-q">${esc(i.q)}</span> ${esc(i.item)}</li>`).join('')}
            </ul>
          </div>
          <div>
            <h4>${icon('book', 16)} Hazırlanışı</h4>
            <ol class="rm-steps">
              ${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}
            </ol>
            <div class="rm-tip">${icon('sparkles', 15)} <span><b>Şef ipucu:</b> ${esc(r.tip)}</span></div>
          </div>
        </div>

        <div class="rm-actions">
          <span class="muted small">Öğün seç:</span>
          ${MEAL_ORDER.filter((s) => r.slots.includes(s)).map((s) => `<button class="btn btn-sm btn-primary rm-add" data-slot="${s}">${icon('plus', 15)} ${MEALS[s].label}</button>`).join('')}
        </div>
      </div>
    </div>
  `, {
    width: 720,
    onMount(overlay) {
      overlay.querySelectorAll('.rm-add').forEach((b) => b.addEventListener('click', async () => {
        await onAdd(r, b.dataset.slot);
        overlay._close();
      }));
    }
  });
}
