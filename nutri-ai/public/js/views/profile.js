/* views/profile.js — Profil, hedef düzenleme, veri yönetimi, hesap silme */
import { api, state } from '../api.js';
import { icon, esc, toast, confirmModal, openModal } from '../ui.js';
import { navigate } from '../main.js';

export function render(root) {
  const u = state.user;
  const t = u.targets;
  const p = u.profile;
  const initials = u.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const since = new Date(u.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const actLabel = { hareketsiz: 'Hareketsiz', az: 'Az Hareketli', orta: 'Orta', yuksek: 'Aktif', cok_yuksek: 'Çok Aktif' }[p.activity];
  const goalLabel = { kilo_ver: 'Kilo Vermek', koru: 'Kilomu Korumak', kazan: 'Kas / Kitle Kazanmak' }[p.goal];

  root.innerHTML = `
  <div class="view">
    <header class="view-head"><div><h1>Profil</h1><p class="muted">Hesap bilgilerin ve hedeflerin</p></div></header>

    <div class="profile-grid">
      <div class="card profile-card">
        <div class="avatar avatar-lg">${initials}</div>
        <h2>${esc(u.name)}</h2>
        <p class="muted">${esc(u.email)}</p>
        <span class="chip">Üyelik: ${since}</span>
        <div class="profile-rows">
          <div><span>Hedef</span><b>${goalLabel}</b></div>
          <div><span>Aktivite</span><b>${actLabel}</b></div>
          <div><span>Mevcut Kilo</span><b>${p.weight} kg</b></div>
          <div><span>Hedef Kilo</span><b>${p.targetWeight ? p.targetWeight + ' kg' : '—'}</b></div>
          <div><span>Boy</span><b>${p.height} cm</b></div>
        </div>
        <button class="btn btn-ghost btn-block" id="edit-targets">${icon('sliders', 17)} Hedeflerimi Düzenle</button>
      </div>

      <div>
        <div class="card">
          <h3 class="card-title">${icon('target', 18)} Güncel Hedeflerin</h3>
          <div class="target-grid">
            <div class="res-card big"><span>Günlük Kalori</span><b>${t.kcal} <i>kcal</i></b></div>
            <div class="res-card"><span>Protein</span><b>${t.protein} g</b></div>
            <div class="res-card"><span>Karbonhidrat</span><b>${t.carbs} g</b></div>
            <div class="res-card"><span>Yağ</span><b>${t.fat} g</b></div>
            <div class="res-card"><span>Su</span><b>${t.water} ml</b></div>
            <div class="res-card ghost"><span>BMR</span><b>${t.bmr} kcal</b></div>
            <div class="res-card ghost"><span>TDEE</span><b>${t.tdee} kcal</b></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">${icon('download', 18)} Verilerim</h3>
          <p class="muted">Günlük kayıtların, su ve kilo geçmişin dahil tüm verilerini JSON olarak indir.</p>
          <a class="btn btn-ghost" href="/api/export" download>${icon('download', 17)} Verilerimi İndir</a>
        </div>

        <div class="card session-card">
          <h3 class="card-title">${icon('logout', 18)} Oturum</h3>
          <button class="btn btn-ghost" id="logout-2">${icon('logout', 17)} Çıkış Yap</button>
        </div>

        <div class="card danger-card">
          <h3 class="card-title danger">${icon('trash', 18)} Tehlikeli Alan</h3>
          <p class="muted">Hesabını sildiğinde tüm verilerin (günlük, program, kilo geçmişi) <b>kalıcı olarak</b> silinir ve bu işlem geri alınamaz.</p>
          <button class="btn btn-danger" id="delete-account">${icon('trash', 17)} Hesabımı Sil</button>
        </div>
      </div>
    </div>
  </div>`;

  root.querySelector('#logout-2').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    toast('Çıkış yapıldı', 'ok');
    navigate('/giris');
  });

  root.querySelector('#edit-targets').addEventListener('click', () => openEditModal());

  root.querySelector('#delete-account').addEventListener('click', () => confirmModal({
    title: 'Hesabını kalıcı olarak sil',
    text: 'Bu işlem geri alınamaz. Onaylamak için aşağıya SİL yaz.',
    placeholder: 'SİL',
    confirmText: 'Hesabımı Sil',
    danger: true,
    enforceMatch: true,
    onConfirm: async () => {
      if (document.getElementById('confirm-input').value.trim().toUpperCase() !== 'SİL') throw new Error('Onay için SİL yazmalısın.');
      await api('/api/account', { method: 'DELETE' });
      state.user = null;
      toast('Hesabın ve tüm verilerin kalıcı olarak silindi.', 'ok');
      navigate('/giris');
    }
  }));
}

function openEditModal() {
  const p = state.user.profile;
  openModal(`
    <div class="modal-head"><h3>Hedeflerimi Düzenle</h3><button class="icon-btn" data-close>${icon('x', 18)}</button></div>
    <div class="modal-body">
      <div class="custom-grid">
        <label class="field"><span>Cinsiyet</span>
          <select class="input" id="e-gender">
            <option value="kadin" ${p.gender === 'kadin' ? 'selected' : ''}>Kadın</option>
            <option value="erkek" ${p.gender === 'erkek' ? 'selected' : ''}>Erkek</option>
          </select>
        </label>
        <label class="field"><span>Yaş</span><input class="input" type="number" id="e-age" value="${p.age}" min="14" max="90"/></label>
        <label class="field"><span>Boy (cm)</span><input class="input" type="number" id="e-height" value="${p.height}" min="120" max="230"/></label>
        <label class="field"><span>Kilo (kg)</span><input class="input" type="number" id="e-weight" value="${p.weight}" step="0.1" min="35" max="250"/></label>
        <label class="field"><span>Hedef Kilo (kg)</span><input class="input" type="number" id="e-tw" value="${p.targetWeight ?? ''}" step="0.1"/></label>
        <label class="field"><span>Aktivite</span>
          <select class="input" id="e-act">
            <option value="hareketsiz" ${p.activity === 'hareketsiz' ? 'selected' : ''}>Hareketsiz</option>
            <option value="az" ${p.activity === 'az' ? 'selected' : ''}>Az Hareketli</option>
            <option value="orta" ${p.activity === 'orta' ? 'selected' : ''}>Orta</option>
            <option value="yuksek" ${p.activity === 'yuksek' ? 'selected' : ''}>Aktif</option>
            <option value="cok_yuksek" ${p.activity === 'cok_yuksek' ? 'selected' : ''}>Çok Aktif</option>
          </select>
        </label>
        <label class="field span2"><span>Hedef</span>
          <select class="input" id="e-goal">
            <option value="kilo_ver" ${p.goal === 'kilo_ver' ? 'selected' : ''}>Kilo Vermek</option>
            <option value="koru" ${p.goal === 'koru' ? 'selected' : ''}>Kilomu Korumak</option>
            <option value="kazan" ${p.goal === 'kazan' ? 'selected' : ''}>Kas / Kitle Kazanmak</option>
          </select>
        </label>
      </div>
      <div class="form-err" id="e-err"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Vazgeç</button>
      <button class="btn btn-primary" id="e-save">${icon('sparkles', 17)} Yeniden Hesapla</button>
    </div>
  `, {
    width: 520,
    onMount(overlay, close) {
      overlay.querySelector('#e-save').addEventListener('click', async () => {
        const body = {
          gender: overlay.querySelector('#e-gender').value,
          age: overlay.querySelector('#e-age').value,
          height: overlay.querySelector('#e-height').value,
          weight: overlay.querySelector('#e-weight').value,
          targetWeight: overlay.querySelector('#e-tw').value || null,
          activity: overlay.querySelector('#e-act').value,
          goal: overlay.querySelector('#e-goal').value
        };
        try {
          const { user } = await api('/api/profile', { method: 'PUT', body });
          state.user = user;
          toast('Hedeflerin güncellendi ve programın yeniden hesaplandı', 'ok');
          close();
          render(document.getElementById('view'));
        } catch (e) {
          overlay.querySelector('#e-err').textContent = e.message;
        }
      });
    }
  });
}
