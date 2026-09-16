/* views/auth.js — Giriş / Kayıt ekranı */
import { api, state, loadInitialData } from '../api.js';
import { icon, esc, toast } from '../ui.js';
import { navigate } from '../main.js';

let mode = 'login';

function feature(iconName, title, text) {
  return `
  <div class="feat">
    <div class="feat-ic">${icon(iconName, 20)}</div>
    <div><div class="feat-t">${title}</div><div class="feat-d">${text}</div></div>
  </div>`;
}

export function render(root) {
  root.innerHTML = `
  <div class="auth ${mode === 'register' ? 'is-register' : ''}">
    <section class="auth-hero">
      <div class="auth-hero-inner">
        <a class="brand brand-light">
          <svg viewBox="0 0 24 24" width="36" height="36"><rect width="24" height="24" rx="6" fill="rgba(163,230,53,.16)"/><path d="M11 19a6 6 0 0 1-1.04-11.9C14.7 6.1 15.9 5.65 17.5 3.6c.85 1.7 1.7 3.55 1.7 6.8C19.2 14.6 15.4 19 11 19z" fill="#a3e635"/></svg>
          <span>Nutri<b>AI</b></span>
        </a>
        <h1>Kameranla tanı,<br/>yapay zekâyla beslen.</h1>
        <p class="auth-sub">Yemeğinin fotoğrafını çek; kalori ve makrolarını yapay zekâ anında hesaplasın. Sana özel haftalık beslenme programın ve şef onaylı tarifler hazır.</p>
        <div class="feats">
          ${feature('scan', 'AI Yemek Tarama', 'Fotoğraftan kalori & makro analizi')}
          ${feature('map', 'Kişisel Program', 'Hedefine göre haftalık yemek planı')}
          ${feature('book', 'Şef Tarifleri', 'Kalori kontrollü, adım adım tarifler')}
          ${feature('chart', 'Akıllı Raporlar', 'Kilo, kalori ve serilerini izle')}
        </div>
        <div class="auth-stats">
          <div><b>1M+</b><span>tanınan yemek varyasyonu</span></div>
          <div><b>16</b><span>diyetisyen onaylı tarif</span></div>
          <div><b>%100</b><span>cihazda gizlilik</span></div>
        </div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="auth-card">
        <div class="tabs">
          <button class="tab ${mode === 'login' ? 'active' : ''}" data-mode="login">Giriş Yap</button>
          <button class="tab ${mode === 'register' ? 'active' : ''}" data-mode="register">Kayıt Ol</button>
        </div>

        <h2 class="auth-title">${mode === 'login' ? 'Tekrar hoş geldin 👋' : 'Hesabını oluştur ✨'}</h2>
        <p class="muted auth-desc">${mode === 'login' ? 'Beslenme yolculuğuna kaldığın yerden devam et.' : '30 saniyede kaydol, kişisel beslenme koçunla tanış.'}</p>

        <form id="auth-form" novalidate>
          ${mode === 'register' ? `
          <label class="field">
            <span>Ad Soyad</span>
            <input class="input" name="name" type="text" placeholder="Adın" autocomplete="name" required />
          </label>` : ''}
          <label class="field">
            <span>E-posta</span>
            <input class="input" name="email" type="email" placeholder="ornek@mail.com" autocomplete="email" required />
          </label>
          <label class="field">
            <span>Şifre</span>
            <div class="pw-wrap">
              <input class="input" name="password" type="password" placeholder="${mode === 'register' ? 'En az 6 karakter' : 'Şifren'}" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" required minlength="6" />
              <button type="button" class="pw-toggle" tabindex="-1">${icon('eye', 18)}</button>
            </div>
          </label>
          <div class="form-err" id="auth-err"></div>
          <button class="btn btn-primary btn-block" type="submit">${mode === 'login' ? 'Giriş Yap' : 'Hesabımı Oluştur'} ${icon('chevronRight', 18)}</button>
        </form>

        <div class="auth-switch">
          ${mode === 'login'
            ? `Hesabın yok mu? <a href="#" id="switch">Ücretsiz kayıt ol</a>`
            : `Zaten hesabın var mı? <a href="#" id="switch">Giriş yap</a>`}
        </div>
        <p class="auth-legal">Devam ederek <b>Kullanım Koşulları</b>'nı ve <b>Gizlilik Politikası</b>'nı kabul etmiş olursun. Fotoğrafların yalnızca cihazında analiz edilir.</p>
      </div>
    </section>
  </div>`;

  // Sekme değişimi
  root.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => { mode = t.dataset.mode; render(root); })
  );
  const sw = root.querySelector('#switch');
  sw && sw.addEventListener('click', (e) => { e.preventDefault(); mode = mode === 'login' ? 'register' : 'login'; render(root); });

  // Şifre göster
  const pwToggle = root.querySelector('.pw-toggle');
  pwToggle && pwToggle.addEventListener('click', () => {
    const inp = root.querySelector('input[name=password]');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    pwToggle.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
  });

  // Gönderim
  const form = root.querySelector('#auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = root.querySelector('#auth-err');
    errEl.textContent = '';
    const fd = new FormData(form);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const { user } = await api(path, { method: 'POST', body: { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') } });
      state.user = user;
      await loadInitialData();
      toast(mode === 'login' ? `Hoş geldin, ${user.name.split(' ')[0]}!` : 'Hesabın oluşturuldu! 🎉', 'ok');
      navigate(user.onboarded ? '/bugun' : '/onboarding');
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
    }
  });
}
