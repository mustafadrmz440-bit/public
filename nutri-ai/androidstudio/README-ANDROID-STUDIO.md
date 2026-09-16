# NutriAI — Android Studio Projesi (Native Kotlin + WebView)

Bu klasör, **Android Studio ile açıp tek tuşla (Run ▶) çalıştırabileceğin**
tam native Android projesidir. Uygulamanın tamamı (arayüz, veritabanı,
yapay zekâ) `app/src/main/assets/www/` içinde gömülüdür — **sunucu
gerektirmez, tamamen çevrimdışı çalışır.**

---

## 1) Gereksinimler (tek seferlik)

| Araç | Nereden | Not |
|---|---|---|
| Android Studio (Koala veya yenisi) | https://developer.android.com/studio | JDK 17 içerir, ayrıca Java kurma |
| Android SDK 34 | Studio ilk açılışta indirir | İnternet gerekir |
| Bir Android telefon **veya** emülatör | — | Telefon: USB hata ayıklama açık |

## 2) Aç ve Çalıştır (3 adım)

1. Android Studio → **File → Open** → bu klasörü (`androidstudio/`) seç.
2. İlk **Gradle Sync** 5-10 dk sürer (bağımlılıkları indirir). Sağ alttaki
   ilerleme bitene dek bekle.
3. Telefonu USB ile bağla (Geliştirici seçenekleri + USB hata ayıklamayı aç) →
   üstte cihazını gör → **Run ▶ (Shift+F10)**.

Telefonda "NutriAI" açılır: kayıt ol → sihirbazı doldur → programın hazır. 🎉

> Emülatörde kamera: AVD'nin kamera ayarını "Emulated" veya webcam'i seç.
> Gerçek kamera taraması için fiziksel telefon önerilir.

## 3) İmzalı APK / AAB üretme

**Build → Generate Signed App Bundle / APK → APK → Create new… keystore**

- Keystore: `nutriai.jks` (adını isteğe göre ver), **geçerlilik: 25+ yıl** seç.
- Şifre ve alias bilgilerini güvenli yere kaydet — kaybedersen mağazada
  güncelleme yapamazsın.
- Aynı sihirbaz **AAB** (Play Store formatı) da üretir.

CLI'dan (isteğe bağlı):
```bash
./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # imzalama sonrası
```

## 4) Projede ne var?

```
app/src/main/
├── AndroidManifest.xml         INTERNET + CAMERA izinleri
├── java/com/nutriai/app/
│   └── MainActivity.kt         WebView kabuğu: kamera izni + dosya seçim köprüsü
├── assets/www/                 UYGULAMANIN TAMAMI (tek dosyalık çevrimdışı paket)
│   ├── index.html              Arayüz + veritabanı + AI motoru (satır içi)
│   ├── img/                    Tarif fotoğrafları
│   └── vendor/                 TensorFlow.js + MobileNet (cihazda AI)
└── res/                        İkonlar (mipmap-*), strings
```

Web uygulamasını güncellersen paketi yeniden üret:
```bash
cd ../android && node build-webapp.mjs
cp -r ../android/proj/assets/www ../androidstudio/app/src/main/assets/
# sonra Studio'da Run ▶
```

## 5) Sık karşılaşılan sorunlar

| Sorun | Çözüm |
|---|---|
| "Gradle wrapper jar missing" | File → Sync Project with Gradle Files; ya da terminalde `gradle wrapper` bir kez çalıştır |
| "SDK location not found" | Studio otomatik yazar; yazmazsa `local.properties` → `sdk.dir=/Android/sdk/yolu` |
| Lisans hatası | Tools → SDK Manager → kabul et, ya da `sdkmanager --licenses` |
| Kamera açılmıyor | Telefon ayarları → Uygulamalar → NutriAI → İzinler → Kamera: izin ver |
| "Yükle" butonu dosya açmıyor | Dosya yöneticisinden görsel seç; bazı ROM'larda Documents UI gerekir |

## 6) Play Store'a gönderim (kısa yol haritası)

1. https://play.google.com/console → 25 $ tek seferlik kayıt.
2. **Uygulama oluştur** → AAB yükle (3. adımdaki imzalı).
3. Ekran görüntüleri (min. 2 telefon), 1024×500 özellik grafiği, TR açıklamalar.
4. **Veri güvenliği formu**: "Kullanıcı verisi toplanmıyor / cihazda saklanıyor".
5. Gizlilik politikası URL'si + içerik anketi → Gönder. İlk inceleme 1-7 gün.

> Sağlık uygulaması kategorisinden kaçınma nedeni yok; ancak "tıbbi tavsiye
> değildir" ibaresini açıklamaya ekle (README'de zaten mevcut).

## 7) Sonraki adım: %100 native UI

Compose/Room/CameraX ile tam native'e geçiş planı için kök dizindeki
**NATIVE-APP-REHBERI.md → C yolu** bölümüne bak.
