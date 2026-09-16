# NutriAI → Çalışan Native Uygulama Tarifi

Bu rehber, elindeki NutriAI web uygulamasını **gerçek, mağazaya yüklenebilir bir
mobil uygulamaya** dönüştürmenin yollarını adım adım anlatır. Üç yol var;
önce hızlıca seç, sonra seçtiğin bölümün tarifini uygula.

---

## 0) Hangi yolu seçmeliyim?

| Yol | Ne zaman? | Efor | Sonuç |
|---|---|---|---|
| **A) PWA** — tarayıcıdan "ana ekrana ekle" | En hızlı deneme, mağaza yok | 1-2 saat | Web gibi çalışır, ikonla açılır |
| **B) Hibrit (önerilen başlangıç)** — Android Studio + WebView veya Capacitor | Bu APK'yı düzgün araç zinciriyle üretmek, mağazaya girmek | Yarım gün | Gerçek .apk/.aab, çevrimdışı, mağaza uyumlu |
| **C) Tam native** — Kotlin + Jetpack Compose + Room + CameraX | Uygulamayı ileriye taşımak, en iyi performans/denetim | 1-3 hafta | %100 native Android |

> Elimde şu an zaten `android/dist/NutriAI-v1.0.apk` var (sandbox'ta SDK'sız
> ürettiğim hibrit APK). **B yolu** onun "profesyonel" hâli; **C yolu** ise
> arayüzün tamamını native'e taşıyor. Önerilen strateji: **B ile başla, parça
> parça C'ye göç et.**

---

## A) Yolu — PWA (30 dakika)

1. `public/` klasörüne `manifest.json` ekle:
   ```json
   {
     "name": "NutriAI",
     "short_name": "NutriAI",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#0b1f16",
     "theme_color": "#0b1f16",
     "icons": [{ "src": "/img/icon-512.png", "sizes": "512x512", "type": "image/png" }]
   }
   ```
2. `index.html` `<head>` kısmına:
   ```html
   <link rel="manifest" href="/manifest.json" />
   ```
3. Sunucuyu **HTTPS** ile yayına al (Render/Railway/VDS + Caddy ücretsiz sertifika).
4. Telefonda Chrome ile siteyi aç → menü → **"Ana ekrana ekle"**.
   Uygulama tam ekran, ikonlu açılır; veriler cihazda kalır.

Sınırları: mağazada listelenmez, kamera izni tarayıcı iznidir, push bildirimi
kısıtlıdır. Hızlı kullanım için yeterli.

---

## B) Yolu — Önerilen: Android Studio + Kotlin WebView (yarım gün)

Sandbox'ta Google/Maven engelli olduğu için APK'yı apktool ile üretmiştim.
Kendi bilgisayarında bunu **doğru araç zinciriyle** yeniden kurmak 10 kat
daha kolay. Sonuç: imzalı APK **ve** Play Store'a uygun AAB.

### Adım 1 — Kurulum (bir kez)
1. https://developer.android.com/studio → **Android Studio**'yu kur
   (JDK ve Android SDK'yı kendisi getirir).
2. İlk açılış sihirbazında SDK 34/35 kurulumunu onayla.

### Adım 2 — Proje oluştur
1. **New Project → Empty Views Activity**
2. Ayarlar:
   - Name: `NutriAI`
   - Package: `com.nutriai.app`
   - Language: **Kotlin**
   - Minimum SDK: **API 24 (Android 7.0)**
3. Finish. Gradle ilk senkronizasyonu 5-10 dk sürebilir (internet gerekir).

### Adım 3 — Web uygulamasını içine göm
```bash
# depo kökünden:
cd nutri-ai/android
node build-webapp.mjs        # → proj/assets/www/ (tek dosyalık çevrimdışı paket)
```
Oluşan `proj/assets/www/` klasörünü kopyala:
```
app/src/main/assets/www/     ← Android Studio projesinde
```
(assets klasörü yoksa `app/src/main` altında `assets` dizini aç.)

### Adım 4 — Kotlin MainActivity (smali'nin okunabilir hâli)
`app/src/main/java/com/nutriai/app/MainActivity.kt` içeriğini şununla değiştir:

```kotlin
package com.nutriai.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // localStorage = veritabanın
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webChromeClient = object : WebChromeClient() {
            // kamera izni istekleriniWebView'e ilet
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }
            // dosya yükleme (AI Tarama → "Yükle" butonu)
            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback = callback
                try {
                    startActivityForResult(params.createIntent(), 1001)
                } catch (e: Exception) {
                    filePathCallback = null
                    return false
                }
                return true
            }
        }

        webView.webViewClient = WebViewClient()

        // kamera iznini baştan iste
        if (checkSelfPermission(Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 41)
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1001) {
            val uri = if (resultCode == RESULT_OK && data?.data != null)
                arrayOf(data.data!!) else null
            filePathCallback?.onReceiveValue(uri)
            filePathCallback = null
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
```

### Adım 5 — Manifest
`app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.CAMERA"/>
  <uses-feature android:name="android.hardware.camera" android:required="false"/>

  <application
      android:label="NutriAI"
      android:icon="@mipmap/ic_launcher"
      android:theme="@style/Theme.AppCompat.NoActionBar"
      android:hardwareAccelerated="true">
    <activity
        android:name=".MainActivity"
        android:exported="true"
        android:configChanges="orientation|screenSize|keyboardHidden"
        android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
```

### Adım 6 — Çalıştır & imzala
1. Telefonu USB ile bağla → Geliştirici seçenekleri + USB hata ayıklamayı aç →
   Android Studio'da **Run ▶** (anında cihazda test).
2. İmzalı çıkış için: **Build → Generate Signed App Bundle / APK → APK →
   Create new… keystore**
   - Keystore dosyasını (`nutriai.jks`) **güvenli bir yere arşivle** — kaybedersen
     mağazada güncelleme yapamazsın.
   - Şifreleri kaydet.
3. Aynı sihirbaz **AAB** de üretir (Play Store bunu ister).

### Adım 6-alternatif — Capacitor ile (iOS'ta da istersen)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init NutriAI com.nutriai.app --web-dir=public
npx cap add android
npx cap sync
npx cap open android        # Android Studio açılır
# Mac'in varsa: npx cap add ios
```
Capacitor; kamera, dosya, bildirim gibi her şeyi eklenti olarak verir ve tek
kod tabanından iki platform çıkarır.

---

## C) Yolu — Tam Native (Kotlin + Compose, 1-3 hafta)

Arayüzü de native yapmak istiyorsan mevcut mantığı birebir taşıyabilirsin.
Karşılık tablosu:

| Web'deki hâl | Native karşılığı |
|---|---|
| `store.js` / localStorage JSON | **Room** veritabanı (SQLite) |
| `server.js` REST uçları | **Repository + ViewModel** (doğrudan Room'a gider) |
| `engine.js` hedef/plan motoru | Saf Kotlin sınıfı — olduğu gibi çevrilir |
| `recipes.json` / `foods.json` | `assets/`'ten ilk açılışta Room'a seed |
| TF.js + MobileNet (tarayıcı) | **TensorFlow Lite** veya **ML Kit Image Labeling** |
| Kamera `<video>` | **CameraX** |
| `app.css` ekranlar | **Jetpack Compose** ekranları |

### Önerilen kurulum sırası (milestone'lar)
1. **Gün 1-2:** Proje + Room şeması
   - `@Entity`: `User`, `DiaryEntry(date, meal, name, kcal, protein, carbs, fat, source)`,
     `WaterLog(date, ml)`, `WeightEntry(date, kg)`, `PlanEntity`
   - İlk açılışta `assets/data/*.json` dosyalarını Room'a seed et.
2. **Gün 3:** Hedef motoru (Mifflin-St Jeor) Kotlin fonksiyonu — `engine.js`'in
   birebir çevirisi, birim testli.
3. **Gün 4-6:** Compose ekranları: Bugün (kalori ringi, makro barlar, su),
   Günlük, Profil/onboarding sihirbazı.
4. **Gün 7-8:** Program ekranı (plan üretici + "Yedim" ekleme).
5. **Gün 9-10:** AI tarama: CameraX + ML Kit:
   ```kotlin
   val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
   // sonucu foods.json'daki aiMap ile eşle (JS'teki mantığın aynısı)
   ```
   İleri seviye: MobileNet v2'yi TFLite'a çevirip (`tfjsconverter`) tam
   olasılık listesi al — JS'teki `classify()` birebir taşınır.
6. **Gün 11-12:** Raporlar (Compose Canvas ile grafik) + ayarlar/veri dışa aktarma.
7. **Gün 13-14:** İnce ayar: karanlık tema, animasyonlar, hata durumları, test.

### Native'e geçiş püf noktaları
- Veri taşınabilirliği: web sürümündeki JSON dışa aktarma formatını koru;
  native uygulamaya "web verilerini içe aktar" ekleyerek kullanıcılarını
  kaybetmezsin.
- `engine.js`'teki tohumlama (seed) mantığını aynen taşı: aynı kullanıcı+tarih
  aynı planı üretmeli (testlerde bunu doğrula).
- AI eşleme haritası (`foods.json → aiMap`) native'de de tek doğruluk
  kaynağıdır; ikinize de aynı JSON'u ver.

---

## Mağazaya gönderim (B veya C sonrası)

1. **Play Console** (25 $ tek seferlik) → Uygulama oluştur.
2. **AAB** yükle (imzalı, B/6'daki keystore ile).
3. Hazırlanacaklar:
   - Uygulama adı + kısa/uzun açıklama (TR)
   - Ekran görüntüleri (telefon + 7" tablet), özellik grafiği (1024×500)
   - Gizlilik politikası URL'si (verilerin cihazda kaldığını yaz — senin lehine)
   - **Veri güvenliği formu**: "Veri toplanmıyor / cihazda saklanıyor" seçimi
   - İçerik derecelendirme anketi, hedef kitle (18+ işaretle, sağlık uygulaması)
4. İlk inceleme genelde 1-7 gün. Sağlık iddialarından kaçın
   ("tıbbi tavsiye değildir" ibaresi ekle — README'de zaten var).

## Test kontrol listesi (her yolda)

- [ ] Kayıt → sihirbaz → hedef hesaplandı → program oluştu
- [ ] Öğün ekle/sil, su ekle/çıkar, kilo ekle
- [ ] Kamera tarama: izin istendi, fotoğraf çözümlendi, günlüğe eklendi
- [ ] Uçak modu: uygulama tamamen çalışıyor (B ve C yollarında)
- [ ] Uygulama kapatılıp açılınca veriler duruyor
- [ ] Hesap silme: veriler gerçekten siliniyor
- [ ] Farklı ekran boyutları (küçük telefon + tablet)

---

**Önerim:** Bugün B yolu ile Android Studio'da çalışan imzalı APK'yı üret
(yarım gün), mağaza hesabını aç, sonra C yoluna hafta hafta göç et.
İstersen bir sonraki adımda **B yolunun tam Android Studio projesini
(Kotlin dosyaları, Gradle, manifest, ikonlar dahil)** depoya hazırlayayım —
sen sadece Android Studio'da açıp Run'a basarsın.
