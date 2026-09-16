/* ui.js — DOM yardımcıları, ikonlar, modal/toast, grafik bileşenleri */

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* HTML string → Element */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* --------------------------------- İkonlar -------------------------------- */
const P = {
  home: '<path d="M3 12l9-9 9 9"/><path d="M9 21V12h6v9"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-4"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  sparkles: '<path d="M12 3l1.9 5.8L20 10.6l-6.1 1.6L12 18l-1.9-5.8L4 10.6l6.1-1.8L12 3z"/><path d="M19 3v4M21 5h-4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  drop: '<path d="M12 2.7s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0c0-4.4 6.5-11 6.5-11z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cookie: '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M9.5 14v.01M14 9.5v.01M7 12v.01"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>'
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* --------------------------------- Biçimler ------------------------------- */

export const MEALS = {
  kahvalti: { label: 'Kahvaltı', pct: 25 },
  oglen: { label: 'Öğle Yemeği', pct: 35 },
  aksam: { label: 'Akşam Yemeği', pct: 30 },
  ara: { label: 'Ara Öğün', pct: 10 }
};
export const MEAL_ORDER = ['kahvalti', 'oglen', 'aksam', 'ara'];

export const SOURCE_LABEL = { ai: 'AI Tarama', tarif: 'Tarif', plan: 'Program', manuel: 'Manuel' };

const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function parseDateISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDateLong(iso) {
  const d = parseDateISO(iso);
  return `${d.getDate()} ${TR_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ${TR_DAYS[d.getDay()]}`;
}
export function fmtDateShort(iso) {
  const d = parseDateISO(iso);
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
}
export function dayShort(iso) {
  const d = parseDateISO(iso);
  return TR_DAYS_SHORT[(d.getDay() + 6) % 7];
}
export function addDaysISO(iso, delta) {
  const d = parseDateISO(iso);
  d.setDate(d.getDate() + delta);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------------------------------- Toast --------------------------------- */

export function toast(msg, type = 'ok') {
  const root = document.getElementById('toast-root');
  const el = h(`<div class="toast toast-${type}">${icon(type === 'ok' ? 'check' : type === 'warn' ? 'info' : 'x', 18)}<span>${esc(msg)}</span></div>`);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3400);
}

/* ---------------------------------- Modal --------------------------------- */

export function openModal(contentHTML, { width = 560, onMount, onClose } = {}) {
  const root = document.getElementById('modal-root');
  const overlay = h(`<div class="modal-overlay"><div class="modal" style="max-width:${width}px" role="dialog" aria-modal="true">${contentHTML}</div></div>`);
  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => { overlay.remove(); onClose && onClose(); }, 180);
  };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  root.appendChild(overlay);
  document.body.classList.add('modal-open');
  const prev = onClose;
  overlay._close = () => { close(); };
  if (onMount) onMount(overlay, close);
  return close;
}

export function closeModalAll() {
  document.getElementById('modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
}

export function confirmModal({ title, text, placeholder, confirmText = 'Onayla', danger = false, enforceMatch = false, onConfirm }) {
  openModal(`
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <p class="muted">${esc(text)}</p>
      ${placeholder ? `<input id="confirm-input" class="input" placeholder="${esc(placeholder)}" autocomplete="off" />` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Vazgeç</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-go">${esc(confirmText)}</button>
    </div>
  `, {
    width: 440,
    onMount(overlay, close) {
      const go = overlay.querySelector('#confirm-go');
      const inp = overlay.querySelector('#confirm-input');
      if (inp && enforceMatch) go.disabled = true;
      inp && inp.addEventListener('input', () => {
        if (enforceMatch) go.disabled = inp.value.trim().toUpperCase() !== placeholder.trim().toUpperCase();
      });
      go.addEventListener('click', async () => {
        try { await onConfirm(); close(); } catch (e) { toast(e.message, 'err'); }
      });
    }
  });
}

/* --------------------------------- Grafikler ------------------------------ */

/* Donut halka: tüketilen / hedef */
export function donutSVG(consumed, target, { size = 190, stroke = 15, color = 'var(--primary)' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const over = consumed > target;
  const col = over ? 'var(--danger)' : color;
  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" class="donut-arc"/>
  </svg>`;
}

/* Yatay makro barı */
export function progressBar(value, target, color = 'var(--primary)') {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return `<div class="pbar"><div class="pbar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

/* Basit çizgi grafiği (SVG) */
export function lineChart(points, { w = 560, h = 160, pad = 28, color = 'var(--primary)', fmt = (v) => v } = {}) {
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (vals.length < 2) return `<div class="chart-empty muted">Grafik için en az 2 kayıt gerekli.</div>`;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const iw = w - pad * 2, ih = h - pad * 2;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * iw;
    const y = pad + ih - ((p.v - min) / range) * ih;
    return { x, y, ...p };
  });
  const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = xy.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--surface)" stroke="${color}" stroke-width="2"><title>${esc(p.label)}: ${esc(fmt(p.v))}</title></circle>`).join('');
  const first = xy[0], last = xy[xy.length - 1];
  return `
  <svg viewBox="0 0 ${w} ${h}" class="linechart">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="${first.x}" y1="${h - pad}" x2="${last.x}" y2="${h - pad}" stroke="var(--border)" stroke-dasharray="3 4"/>
    <text x="${pad}" y="${h - 8}" class="chart-label">${esc(xy[0].label)}</text>
    <text x="${w - pad}" y="${h - 8}" text-anchor="end" class="chart-label">${esc(last.label)}</text>
    <text x="${pad}" y="${pad - 8}" class="chart-label">${esc(fmt(max))}</text>
    ${dots}
  </svg>`;
}

/* Sütun grafiği (SVG) */
export function barChart(items, { w = 560, h = 180, pad = 30, target = null, color = 'var(--primary)' } = {}) {
  if (!items.length) return '';
  const iw = w - pad * 2, ih = h - pad * 2 - 8;
  const maxV = Math.max(...items.map((i) => i.v), target || 0) * 1.1 || 1;
  const bw = Math.min(34, (iw / items.length) * 0.62);
  const step = iw / items.length;
  let bars = '', labels = '';
  items.forEach((it, i) => {
    const bh = Math.max(2, (it.v / maxV) * ih);
    const x = pad + i * step + (step - bw) / 2;
    const y = pad + ih - bh;
    const over = target && it.v > target;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="6" fill="${it.v === 0 ? 'var(--ring-bg)' : over ? 'var(--danger)' : color}" opacity="${it.v === 0 ? 1 : it.dim ? 0.45 : 0.9}"><title>${esc(it.label)}: ${esc(it.v)} kcal</title></rect>`;
    if (items.length <= 16 || i % 2 === 0) labels += `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="chart-label">${esc(it.label)}</text>`;
  });
  let tline = '';
  if (target) {
    const ty = pad + ih - (target / maxV) * ih;
    tline = `<line x1="${pad - 6}" y1="${ty.toFixed(1)}" x2="${w - pad + 6}" y2="${ty.toFixed(1)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/><text x="${w - pad}" y="${(ty - 6).toFixed(1)}" text-anchor="end" class="chart-label">Hedef ${target}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="barchart">${tline}${bars}${labels}</svg>`;
}

export function spinner(size = 22) {
  return `<svg class="spinner" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
}

export function emptyState(emoji, title, text, actionHTML = '') {
  return `<div class="empty">
    <div class="empty-emoji">${emoji}</div>
    <div class="empty-title">${esc(title)}</div>
    <div class="muted">${esc(text)}</div>
    ${actionHTML}
  </div>`;
}
