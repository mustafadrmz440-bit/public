/* main.js — Uygulama önyükleme + hash yönlendirici */
import { api, state, loadInitialData } from './api.js';
import { icon, toast } from './ui.js';
import * as Auth from './views/auth.js';
import * as Onboarding from './views/onboarding.js';
import * as Today from './views/today.js';
import * as Plan from './views/plan.js';
import * as Recipes from './views/recipes.js';
import * as Scan from './views/scan.js';
import * as Reports from './views/reports.js';
import * as Profile from './views/profile.js';

const app = document.getElementById('app');

const ROUTES = {
  '/giris': Auth,
  '/onboarding': Onboarding,
  '/bugun': Today,
  '/program': Plan,
  '/tarifler': Recipes,
  '/tara': Scan,
  '/raporlar': Reports,
  '/profil': Profile
};

const NAV = [
  { path: '/bugun', label: 'Bugün', icon: 'home' },
  { path: '/program', label: 'Programım', icon: 'map' },
  { path: '/tara', label: 'AI Tarama', icon: 'scan' },
  { path: '/tarifler', label: 'Tarifler', icon: 'book' },
  { path: '/raporlar', label: 'Raporlar', icon: 'chart' },
  { path: '/profil', label: 'Profil', icon: 'user' }
];

let bootDone = false;

export function navigate(path) {
  if (location.hash === '#' + path) render();
  else location.hash = '#' + path;
}

function parseHash() {
  const raw = (location.hash || '#/bugun').slice(1);
  const [path, query] = raw.split('?');
  return { path: path || '/bugun', query: new URLSearchParams(query || '') };
}

/* --------------------------- Uygulama kabuğu (shell) ---------------------- */

function shellHTML(active) {
  const u = state.user;
  const navItems = NAV.map(
    (n) => `
    <a class="nav-item ${active === n.path ? 'active' : ''}" href="#${n.path}" data-path="${n.path}">
      ${icon(n.icon, 20)}<span>${n.label}</span>
    </a>`
  ).join('');

  const initials = (u.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return `
  <aside class="sidebar">
    <a class="brand" href="#/bugun">
      <svg viewBox="0 0 24 24" width="34" height="34"><rect width="24" height="24" rx="6" fill="rgba(163,230,53,.14)"/><path d="M11 19a6 6 0 0 1-1.04-11.9C14.7 6.1 15.9 5.65 17.5 3.6c.85 1.7 1.7 3.55 1.7 6.8C19.2 14.6 15.4 19 11 19z" fill="#a3e635"/></svg>
      <span>Nutri<b>AI</b></span>
    </a>
    <nav class="side-nav">${navItems}</nav>
    <div class="side-user">
      <div class="avatar">${initials}</div>
      <div class="side-user-info">
        <div class="side-user-name">${u.name}</div>
        <div class="side-user-mail">${u.email}</div>
      </div>
      <button class="icon-btn" id="logout-btn" title="Çıkış Yap">${icon('logout', 18)}</button>
    </div>
  </aside>

  <header class="mobile-topbar">
    <a class="brand" href="#/bugun">
      <svg viewBox="0 0 24 24" width="28" height="28"><rect width="24" height="24" rx="6" fill="rgba(163,230,53,.14)"/><path d="M11 19a6 6 0 0 1-1.04-11.9C14.7 6.1 15.9 5.65 17.5 3.6c.85 1.7 1.7 3.55 1.7 6.8C19.2 14.6 15.4 19 11 19z" fill="#a3e635"/></svg>
      <span>Nutri<b>AI</b></span>
    </a>
    <a class="avatar-link" href="#/profil"><div class="avatar avatar-sm">${initials}</div></a>
  </header>

  <main class="content" id="view"></main>

  <nav class="bottom-nav">
    <a class="bnav ${active === '/bugun' ? 'active' : ''}" href="#/bugun">${icon('home', 22)}<span>Bugün</span></a>
    <a class="bnav ${active === '/program' ? 'active' : ''}" href="#/program">${icon('map', 22)}<span>Program</span></a>
    <a class="bnav-fab ${active === '/tara' ? 'active' : ''}" href="#/tara" aria-label="AI Tarama">${icon('scan', 24)}</a>
    <a class="bnav ${active === '/tarifler' ? 'active' : ''}" href="#/tarifler">${icon('book', 22)}<span>Tarifler</span></a>
    <a class="bnav ${active === '/profil' ? 'active' : ''}" href="#/profil">${icon('user', 22)}<span>Profil</span></a>
  </nav>`;
}

function bindShell() {
  const lb = document.getElementById('logout-btn');
  if (lb) lb.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    toast('Çıkış yapıldı. Görüşmek üzere!', 'ok');
    navigate('/giris');
  });
}

/* --------------------------------- Render --------------------------------- */

async function render() {
  const { path, query } = parseHash();
  const user = state.user;

  // Yönlendirme kuralları
  if (!user && path !== '/giris') return navigate('/giris');
  if (user && !user.onboarded && path !== '/onboarding' && path !== '/giris') return navigate('/onboarding');
  if (user && user.onboarded && (path === '/giris' || path === '/onboarding')) return navigate('/bugun');
  if (!ROUTES[path]) return navigate(user ? '/bugun' : '/giris');

  const view = ROUTES[path];
  const needsShell = user && user.onboarded;

  if (needsShell) {
    app.innerHTML = shellHTML(path);
    bindShell();
  }

  const container = needsShell ? document.getElementById('view') : app;
  try {
    await view.render(container, { query, navigate, state });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="view"><div class="card pad"><h3>Bir hata oluştu</h3><p class="muted">${e.message}</p></div></div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

(async function boot() {
  try {
    const me = await api('/api/me').catch(() => null);
    state.user = me ? me.user : null;
    if (state.user) await loadInitialData();
  } catch (e) {
    console.warn(e);
  }
  bootDone = true;
  render();
})();
