/* ai.js — Tarayıcıda çalışan yapay zekâ yemek tanıma motoru
 * TensorFlow.js + MobileNet v2 (ImageNet) ile yerel sınıflandırma.
 * Fotoğraflar ASLA sunucuya gönderilmez; tüm analiz cihazda yapılır.
 */
import { state } from './api.js';

let modelPromise = null;
let stream = null;

const CDN_TF = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
const CDN_MN = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error('script-load-failed'));
    document.head.appendChild(s);
  });
}

/* Modeli önden hazırla (arka planda çağrılabilir) */
export function ensureModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await loadScript(CDN_TF);
      await loadScript(CDN_MN);
      if (!window.mobilenet) throw new Error('model-load-failed');
      return window.mobilenet.load({ version: 2, alpha: 1.0 });
    })().catch((e) => { modelPromise = null; throw e; });
  }
  return modelPromise;
}

export function modelReady() {
  return modelPromise ? modelPromise.catch(() => null) : Promise.resolve(null);
}

/* ------------------------------- Kamera ---------------------------------- */

export async function startCamera(video) {
  stopCamera();
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  return video;
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

export function cameraActive() {
  return !!stream;
}

/* Video veya <img> → kare → canvas */
export function captureToCanvas(srcEl, maxDim = 720) {
  const w = srcEl.videoWidth || srcEl.naturalWidth;
  const h = srcEl.videoHeight || srcEl.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(srcEl, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* --------------------------- Sınıflandırma + eşleme ----------------------- */

function normalize(s) {
  return String(s).toLowerCase().trim();
}

export async function classify(canvas) {
  const model = await ensureModel();
  const preds = await model.classify(canvas, 6);
  // Eşleşen yiyecek adayları (olasılık sırasıyla)
  const matched = [];
  for (const p of preds) {
    const cn = normalize(p.className);
    let foodId = state.aiMap[cn];
    if (!foodId) {
      for (const key of Object.keys(state.aiMap)) {
        if (cn.includes(key) || key.includes(cn)) { foodId = state.aiMap[key]; break; }
      }
    }
    if (foodId) {
      const food = state.catalog.find((f) => f.id === foodId);
      if (food && !matched.some((m) => m.food.id === food.id)) {
        matched.push({ food, prob: p.probability, rawClass: p.className });
      }
    }
  }
  return { predictions: preds, matched, engine: 'neural' };
}

/* Model yüklenemezse: renk analizi tabanlı hızlı tahmin (açıkça işaretlenir) */
export function colorFallback(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 40) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  r /= n; g /= n; b /= n;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  const d = max - min;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const sat = max === 0 ? 0 : d / max;

  let food, note;
  if (g > r && g > b && hue > 60 && hue < 180) {
    food = state.catalog.find((f) => f.id === 'f-salata');
    note = 'Yeşil tonlar baskın — sebze/salata ağırlıklı bir tabak gibi görünüyor.';
  } else if (hue < 45 && sat > 0.25 && r > 120) {
    food = state.catalog.find((f) => f.id === 'f-menemen');
    note = 'Sıcak (turuncu-kırmızı) tonlar — soslu sıcak yemek gibi görünüyor.';
  } else if (sat < 0.22 && max > 140) {
    food = state.catalog.find((f) => f.id === 'f-simit');
    note = 'Açık/bej tonlar — ekmek, hamur işi veya tahıl ağırlıklı olabilir.';
  } else {
    food = state.catalog.find((f) => f.id === 'f-corba');
    note = 'Tabakta karışık tonlar — çorba veya güveç türü bir yemek olabilir.';
  }
  return {
    predictions: [{ className: food.name, probability: 0.45 }],
    matched: [{ food, prob: 0.45, rawClass: 'heuristic' }],
    engine: 'heuristic',
    note
  };
}
