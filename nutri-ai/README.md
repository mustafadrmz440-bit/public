# NutriAI — Yapay Zekâ Destekli Kişisel Beslenme Koçu

Welmi benzeri, tamamen kendi sunucunuzda çalışan profesyonel bir beslenme uygulaması:

- 🔐 **Hesap sistemi** — kayıt, giriş, çıkış ve **hesap kalıcı silme** (tüm verilerle birlikte)
- 📷 **Kameradan AI yemek tanıma** — fotoğraf çek, kalori/makroları anında hesapla
  (TensorFlow.js + MobileNet v2 **tamamen tarayıcıda** çalışır; fotoğraflar sunucuya gönderilmez)
- 🎯 **Kişisel hedefler** — Mifflin-St Jeor ile BMR/TDEE, hedefe göre kalori + makro + su hesabı
- 📅 **Haftalık AI yemek programı** — hedefinize göre otomatik, "yeni varyasyon" üretilebilen plan
- 🍳 **16 diyetisyen onaylı tarif** — malzeme, adım adım hazırlanış, şef ipuçları, makrolar
- 📈 **Raporlar** — kalori grafiği, makro dağılımı, kilo takibi, günlük seri (streak)
- 💧 Su takibi, ✍️ manuel besin girişi, 🗑 kayıt silme, ⬇️ veri dışa aktarma (JSON)

## Çalıştırma

```bash
cd nutri-ai
npm install
npm start          # http://0.0.0.0:3000
```

`PORT` ortam değişkeni ile bağlantı noktası değiştirilebilir.

## Mimari

```
nutri-ai/
├── server.js          Express API + statik sunum
├── store.js           Atomik yazan JSON veri katmanı (scrypt şifre hash'i)
├── engine.js          Hedef hesap motoru + haftalık plan üretici
├── data/
│   ├── recipes.json   Tarif veritabanı
│   ├── foods.json     Besin kataloğu (80+) + ImageNet→besin eşleme haritası
│   └── db.json        Çalışma zamanı verisi (git'e girmez)
└── public/
    ├── index.html     Tek sayfa uygulama kabuğu
    ├── css/app.css    Tasarım sistemi
    └── js/            ES modülleri: router, görünümler, AI motoru
```

## API Özeti

| Yöntem | Uç Nokta | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Kayıt (ad, e-posta, şifre) |
| POST | `/api/auth/login` | Giriş |
| POST | `/api/auth/logout` | Çıkış |
| GET | `/api/me` | Aktif kullanıcı |
| PUT | `/api/profile` | Profil + hedef yeniden hesaplama |
| DELETE | `/api/account` | Hesabı ve tüm verileri kalıcı sil |
| GET | `/api/recipes` | Tarifler |
| GET | `/api/foods` | Besin kataloğu + AI eşleme |
| GET | `/api/plan?date=&refresh=1` | Haftalık program (refresh: yeni varyasyon) |
| GET/POST/DELETE | `/api/diary…` | Günlük kayıtları |
| POST | `/api/water` | Su ekle/çıkar |
| GET/POST | `/api/weights` | Kilo geçmişi |
| GET | `/api/stats?end=&days=` | Grafik verileri + seri |
| GET | `/api/export` | Tüm verileri JSON indir |

> Not: Bu uygulama bilgilendirme amaçlıdır; tıbbi tavsiye yerine geçmez.
