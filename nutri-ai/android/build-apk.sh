#!/usr/bin/env bash
# build-apk.sh — NutriAI APK derleme hattı
# 1) Web uygulamasını tek dosyaya paketle  2) apktool ile APK üret  3) v1 imzala  4) doğrula
set -euo pipefail
cd "$(dirname "$0")"

JAVA="${JAVA:-$(ls /home/user/.venv-jdk/lib/python3.11/site-packages/jdk4py/java-runtime/bin/java 2>/dev/null || which java)}"
APKTOOL="tools/apktool.jar"
AAPT2="${AAPT2:-tools/aapt2}"
OUTDIR="dist"

echo "==> 1/4 Web uygulaması paketleniyor"
node build-webapp.mjs

echo "==> 2/4 APK oluşturuluyor (apktool)"
mkdir -p build "$OUTDIR"
rm -f build/NutriAI-unsigned.apk
"$JAVA" -jar "$APKTOOL" b proj -o build/NutriAI-unsigned.apk

echo "==> 3/4 İmzalanıyor (v1 JAR imzası)"
node sign-apk.mjs build/NutriAI-unsigned.apk "$OUTDIR/NutriAI-v1.0.apk"

echo "==> 4/4 Doğrulama"
"$JAVA" -jar "$APKTOOL" d -f -o build/verify-decode "$OUTDIR/NutriAI-v1.0.apk" >/dev/null
echo "  - apktool geri çözümleme: OK"
"$AAPT2" dump badging "$OUTDIR/NutriAI-v1.0.apk" | head -8 || true

ls -lh "$OUTDIR"
echo "Hazır: $OUTDIR/NutriAI-v1.0.apk"
