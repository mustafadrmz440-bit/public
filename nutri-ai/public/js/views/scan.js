/* views/scan.js — AI kamera yemek tarama ekranı */
import { api, state, todayStr } from '../api.js';
import { icon, esc, toast, openModal, MEALS, MEAL_ORDER, spinner } from '../ui.js';
import { navigate } from '../main.js';
import { ensureModel, startCamera, stopCamera, cameraActive, captureToCanvas, classify, colorFallback } from '../ai.js';

let result = null;      // aktif analiz sonucu
let shotURL = null;     // yakalanan karenin önizlemesi
let portion = 1;
let slot = guessSlot();
let analyzing = false;
let modelState = 'idle'; // idle | loading | ready | error

function guessSlot() {
  const hh = new Date().getHours();
  if (hh < 11) return 'kahvalti';
  if (hh < 16) return 'oglen';
  if (hh < 18.5) return 'ara';
  return 'aksam';
}

window.addEventListener('hashchange', () => {
  if (!location.hash.includes('/tara')) stopCamera();
});

export async function render(root, { query }) {
  const qd = query.get('date');
  if (qd && qd !== todayStr()) slot = guessSlot();
  paint(root);
  ensureModel().then(() => { modelState = 'ready'; }).catch(() => { modelState = 'error'; });
}

function paint(root) {
  root.innerHTML = `
  <div class="view">
    <header class="view-head">
      <div>
        <h1>AI Yemek Tarama</h1>
        <p class="muted">Yemeğinin fotoğrafını çek — kalori ve makrolarını yapay zekâ anında hesaplar.</p>
      </div>
      <div class="head-actions">
        <span class="privacy-chip">${icon('check', 15)} Fotoğraflar cihazdan çıkmaz</span>
      </div>
    </header>

    <div class="scan-grid">
      <div class="card scan-cam-card">
        <div class="cam-wrap" id="cam-wrap">
          <video id="cam" autoplay playsinline muted class="${result ? 'hidden' : ''}"></video>
          ${shotURL ? `<img src="${shotURL}" class="cam-shot" alt="çekilen yemek fotoğrafı"/>` : ''}
          <div class="cam-frame"></div>
          ${analyzing ? `<div class="scanline"></div>` : ''}
          ${!result && !analyzing ? `<div class="cam-hint">Yemeği çerçeveye al ${icon('camera', 15)}</div>` : ''}
          ${analyzing ? `<div class="cam-analyzing">${spinner(26)} <span>Analiz ediliyor…</span></div>` : ''}
        </div>
        <div class="cam-model-state" id="model-state">${
          modelState === 'ready' ? `${icon('sparkles', 15)} Yapay zekâ modeli hazır`
          : modelState === 'error' ? `${icon('info', 15)} Sinir ağı modeli yüklenemedi — hızlı tahmin modu kullanılacak`
          : `${spinner(14)} Yapay zekâ modeli hazırlanıyor…`
        }</div>
        <div class="cam-actions">
          <button class="btn btn-primary btn-lg" id="btn-capture" ${analyzing ? 'disabled' : ''}>${icon('camera', 20)} ${result ? 'Yeniden Çek' : 'Fotoğraf Çek'}</button>
          <label class="btn btn-ghost btn-lg upload-btn" ${analyzing ? 'data-disabled' : ''}>${icon('upload', 18)} Yükle
            <input type="file" id="file-in" accept="image/*" hidden/>
          </label>
        </div>
        <p class="cam-note">${icon('info', 14)} Analiz tarayıcınızda, cihazınızda yapılır. Fotoğraf hiçbir sunucuya gönderilmez.</p>
      </div>

      <div class="card scan-result-card" id="result-pane">${resultPaneHTML()}</div>
    </div>

    ${state.recentScans.length ? `
    <h2 class="section-title">Bu oturumdaki taramalar</h2>
    <div class="scan-history">
      ${state.recentScans.map((s, i) => `
        <button class="scan-thumb ${result === s.ref ? 'active' : ''}" data-i="${i}">
          <img src="${s.thumb}" alt=""/><span>${esc(s.name)}</span>
        </button>`).join('')}
    </div>` : ''}
  </div>`;

  bind(root);
  if (!result && !analyzing) initCamera(root);
}

async function initCamera(root) {
  const video = root.querySelector('#cam');
  try {
    await startCamera(video);
  } catch (e) {
    const wrap = root.querySelector('#cam-wrap');
    if (wrap) wrap.innerHTML = `
      <div class="cam-error">
        ${icon('camera', 34)}
        <b>Kameraya erişilemedi</b>
        <p class="muted">Tarayıcı izinlerini kontrol edin ya da "Yükle" ile fotoğraf seçin. (Kamera için güvenli bağlantı gerekir.)</p>
      </div>`;
  }
}

function resultPaneHTML() {
  if (analyzing) {
    return `
    <div class="scan-waiting">
      ${spinner(30)}
      <b>Yapay zekâ yemeğini inceliyor…</b>
      <div class="wait-steps">
        <span>Görüntü işleniyor</span> ${icon('chevronRight', 13)}
        <span>Yemek tanınıyor</span> ${icon('chevronRight', 13)}
        <span>Makrolar hesaplanıyor</span>
      </div>
    </div>`;
  }
  if (!result) {
    return `
    <div class="scan-empty">
      <div class="scan-empty-ic">${icon('scan', 36)}</div>
      <h3>Sonuç burada görünecek</h3>
      <p class="muted">Fotoğrafı çektiğinde yapay zekâ yemeği tanımlar; kalori, protein, karbonhidrat ve yağ değerlerini porsiyon ayarıyla günlüğüne ekleyebilirsin.</p>
      <div class="scan-tips">
        <div>${icon('check', 15)} Tabak çerçevenin içine tam girsin</div>
        <div>${icon('check', 15)} Mümkünse üstten ve iyi ışıkta çek</div>
        <div>${icon('check', 15)} Tanınmazsa listeden elle seçebilirsin</div>
      </div>
    </div>`;
  }

  const m = result.matched;
  const top = m[0];
  const conf = Math.round(top.prob * 100);
  const alt = m.slice(1, 4);
  const kcal = Math.round(top.food.kcal * portion);
  const uncertain = top.prob < 0.1;

  return `
  <div class="scan-result">
    ${result.engine === 'heuristic' ? `<div class="mode-warn">${icon('info', 15)} Hızlı Tahmin Modu — sinir ağı modeli yüklenemedi. Sonucu doğrulamak için listeyi kullan.</div>` : ''}
    ${uncertain ? `<div class="mode-warn soft">${icon('info', 15)} Emin olamadım — doğru yemeği aşağıdaki adaylardan seçebilirsin.</div>` : ''}
    <div class="sr-head">
      <div class="sr-conf">
        <span class="sr-conf-label">Tanıma güveni</span>
        <div class="sr-conf-bar"><div style="width:${Math.max(6, conf)}%"></div></div>
        <span class="sr-conf-val">%${conf}</span>
      </div>
      <h2>${esc(top.food.name)}</h2>
      <p class="muted">${esc(top.food.portion)} · ${esc(top.food.cat)}</p>
    </div>

    <div class="sr-macros">
      <div class="sr-macro main"><b>${kcal}</b><span>kcal</span></div>
      <div class="sr-macro"><b>${(top.food.protein * portion).toFixed(1)}g</b><span>protein</span></div>
      <div class="sr-macro"><b>${(top.food.carbs * portion).toFixed(1)}g</b><span>karb.</span></div>
      <div class="sr-macro"><b>${(top.food.fat * portion).toFixed(1)}g</b><span>yağ</span></div>
    </div>

    ${alt.length ? `
    <div class="sr-alt">
      <span>Alternatifler:</span>
      ${alt.map((a) => `<button class="chip chip-sm sr-alt-chip" data-fid="${a.food.id}">${esc(a.food.name)} <small>%${Math.round(a.prob * 100)}</small></button>`).join('')}
    </div>` : ''}

    <div class="sr-portion">
      <span>Porsiyon</span>
      <div class="portion-btns">
        ${[0.5, 1, 1.5, 2].map((p) => `<button class="pbtn ${portion === p ? 'active' : ''}" data-p="${p}">${p}×</button>`).join('')}
      </div>
    </div>

    <div class="sr-slot">
      <span>Öğün</span>
      <div class="slot-btns">
        ${MEAL_ORDER.map((s) => `<button class="pbtn ${slot === s ? 'active' : ''}" data-s="${s}">${MEALS[s].label}</button>`).join('')}
      </div>
    </div>

    <button class="btn btn-primary btn-block btn-lg" id="sr-add">${icon('plus', 18)} Günlüğe Ekle (${kcal} kcal)</button>
    <button class="btn btn-ghost btn-block" id="sr-manual">${icon('search', 16)} Listeden elle seç</button>
  </div>`;
}

function bind(root) {
  const captureBtn = root.querySelector('#btn-capture');
  const fileIn = root.querySelector('#file-in');
  if (fileIn) {
    const lbl = fileIn.closest('.upload-btn');
    fileIn.addEventListener('click', (e) => { if (lbl.dataset.disabled) { e.preventDefault(); toast('Analiz sürerken bekleyin', 'warn'); } });
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => analyzeFrom(img);
      img.onerror = () => toast('Görsel okunamadı', 'err');
      img.src = URL.createObjectURL(f);
    });
  }
  captureBtn.addEventListener('click', async () => {
    if (analyzing) return;
    const video = root.querySelector('#cam');
    if (!cameraActive()) { await initCamera(root); return; }
    if (!video.videoWidth) return toast('Kamera hazır değil, bir saniye bekleyin', 'warn');
    analyzeFrom(video);
  });

  // Sonuç panelindeki olaylar (delege)
  const pane = root.querySelector('#result-pane');
  pane.addEventListener('click', async (e) => {
    const altChip = e.target.closest('.sr-alt-chip');
    if (altChip) {
      const fid = altChip.dataset.fid;
      const food = state.catalog.find((f) => f.id === fid);
      result.matched.unshift({ food, prob: 0.85, rawClass: 'manual' });
      paint(root);
      return;
    }
    const pb = e.target.closest('.pbtn');
    if (pb && pb.dataset.p) { portion = Number(pb.dataset.p); paint(root); return; }
    if (pb && pb.dataset.s) { slot = pb.dataset.s; paint(root); return; }
    if (e.target.closest('#sr-manual')) { openManualPicker(); return; }
    if (e.target.closest('#sr-add')) {
      const top = result.matched[0];
      await api('/api/diary', {
        method: 'POST',
        body: {
          date: todayStr(), meal: slot, name: top.food.name,
          kcal: Math.round(top.food.kcal * portion),
          protein: +(top.food.protein * portion).toFixed(1),
          carbs: +(top.food.carbs * portion).toFixed(1),
          fat: +(top.food.fat * portion).toFixed(1),
          source: 'ai'
        }
      });
      toast(`${top.food.name} (${Math.round(top.food.kcal * portion)} kcal) ${MEALS[slot].label.toLowerCase()} öğününe eklendi 🎉`, 'ok');
      state.recentScans.unshift({ thumb: shotURL, name: top.food.name, ref: result });
      state.recentScans = state.recentScans.slice(0, 8);
      result = null;
      shotURL = null;
      paint(root);
    }
  });

  root.querySelectorAll('.scan-thumb').forEach((t) => t.addEventListener('click', () => {
    result = state.recentScans[Number(t.dataset.i)].ref;
    portion = 1;
    paint(root);
  }));
}

async function analyzeFrom(srcEl) {
  if (analyzing) return;
  analyzing = true;
  const canvas = captureToCanvas(srcEl);
  shotURL = canvas.toDataURL('image/jpeg', 0.85);
  result = null;
  paint(document.querySelector('#view'));

  const t0 = Date.now();
  let out;
  try {
    out = await classify(canvas);
  } catch {
    out = colorFallback(canvas);
  }
  // Analiz animasyonunun en az 1.6s görünmesi
  const wait = Math.max(0, 1600 - (Date.now() - t0));
  setTimeout(() => {
    analyzing = false;
    result = out;
    portion = 1;
    slot = guessSlot();
    paint(document.querySelector('#view'));
    if (out.engine === 'heuristic' && out.note) toast(out.note, 'warn');
  }, wait);
}

function openManualPicker() {
  openModal(`
    <div class="modal-head"><h3>Yemeği elle seç</h3><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <div class="search-row"><div class="search-box">${icon('search', 17)}<input id="mp-q" placeholder="Besin ara…"/></div></div>
      <div class="food-list" id="mp-list"></div>
    </div>
  `, {
    width: 560,
    onMount(overlay, close) {
      const list = overlay.querySelector('#mp-list');
      const paintList = (q = '') => {
        const items = state.catalog.filter((f) => !q || f.name.toLowerCase().includes(q));
        list.innerHTML = items.map((f) => `
          <button class="food-row" data-id="${f.id}">
            <div><b>${esc(f.name)}</b><small>${esc(f.portion)} · ${f.kcal} kcal</small></div>
            <span class="add-badge">${icon('plus', 15)}</span>
          </button>`).join('');
        list.querySelectorAll('.food-row').forEach((b) => b.addEventListener('click', () => {
          const food = state.catalog.find((f) => f.id === b.dataset.id);
          result.matched.unshift({ food, prob: 1, rawClass: 'manual' });
          close();
          paint(document.querySelector('#view'));
        }));
      };
      paintList();
      overlay.querySelector('#mp-q').addEventListener('input', (e) => paintList(e.target.value.toLowerCase()));
    }
  });
}
