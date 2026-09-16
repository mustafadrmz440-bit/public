#!/usr/bin/env node
/**
 * build-webapp.mjs — NutriAI web uygulamasını APK içi tek dosyalı çevrimdışı sürüme paketler.
 * Çıktı: android/proj/assets/www/
 *   index.html  (CSS + veri + tüm JS modülleri satır içi, ES modül yok → file:// uyumlu)
 *   img/        (tarif görselleri)
 *   vendor/     (tf.min.js, mobilenet.min.js)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const OUT = join(ROOT, 'android', 'proj', 'assets', 'www');

/* Modül sırası: bağımlılıklar önce, main.js en son çalışır */
const MODULES = [
  'js/api.js',
  'js/ui.js',
  'js/ai.js',
  'js/local-backend.js',
  'js/views/auth.js',
  'js/views/onboarding.js',
  'js/views/today.js',
  'js/views/plan.js',
  'js/views/recipes.js',
  'js/views/scan.js',
  'js/views/reports.js',
  'js/views/profile.js',
  'js/main.js'
];

function stripImports(src) {
  return src.replace(/^import\s.+?;[ \t]*$/gm, '');
}

function stripExports(src) {
  return src
    .replace(/^export\s+async\s+function\s+([A-Za-z_$][\w$]*)/gm, 'async function $1')
    .replace(/^export\s+function\s+([A-Za-z_$][\w$]*)/gm, 'function $1')
    .replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, '$1 $2');
}

function topLevelNames(src) {
  const names = new Set();
  const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1] || m[2]);
  return names;
}

function renameIdent(src, from, to) {
  return src.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
}

/* ---- 1) Modülleri hazırla ---- */
const segments = MODULES.map((rel) => {
  let src = readFileSync(join(PUB, rel), 'utf8');
  src = stripImports(src);
  src = stripExports(src);
  return { rel, src };
});

/* dinamik içe aktarmayı çöz (plan.js → recipes.js) */
const planSeg = segments.find((s) => s.rel === 'js/views/plan.js');
{
  const marker = "import('./recipes.js').then((m) => m.openRecipeModal(";
  const idx = planSeg.src.indexOf(marker);
  if (idx === -1) { console.error('HATA: plan.js dinamik import bulunamadı'); process.exit(1); }
  planSeg.src = planSeg.src.replace(marker + "r, async (recipe, slot) => {", 'openRecipeModal(r, async (recipe, slot) => {');
  // .then( kapanışındaki fazladan parantezi kaldır: ilk '}));' → '});'
  const from = planSeg.src.indexOf('openRecipeModal(r, async (recipe, slot) => {');
  const tailIdx = planSeg.src.indexOf('}));', from);
  if (tailIdx === -1) { console.error('HATA: dinamik import kapanışı bulunamadı'); process.exit(1); }
  planSeg.src = planSeg.src.slice(0, tailIdx) + '});' + planSeg.src.slice(tailIdx + 4);
  if (planSeg.src.includes("import('./recipes.js')")) {
    console.error('HATA: plan.js içindeki dinamik import çözülemedi');
    process.exit(1);
  }
}

/* ---- 2) Görünüm modüllerinde deterministik yeniden adlandırma ---- */
const VIEW_RENAMES = {
  'js/views/auth.js': { render: 'render_auth' },
  'js/views/onboarding.js': { render: 'render_onboarding' },
  'js/views/today.js': { render: 'render_today', paint: 'paint_today' },
  'js/views/plan.js': { render: 'render_plan', paint: 'paint_plan' },
  'js/views/recipes.js': { render: 'render_recipes' },
  'js/views/scan.js': { render: 'render_scan', paint: 'paint_scan' },
  'js/views/reports.js': { render: 'render_reports', paint: 'paint_reports', stats: 'repStats' },
  'js/views/profile.js': { render: 'render_profile' }
};
for (const [rel, map] of Object.entries(VIEW_RENAMES)) {
  const seg = segments.find((s) => s.rel === rel);
  for (const [from, to] of Object.entries(map)) seg.src = renameIdent(seg.src, from, to);
}

/* ---- 2b) Kalan üst düzey çakışmaları çöz ---- */
const seen = new Map();
for (const seg of segments) {
  const names = topLevelNames(seg.src);
  for (const n of names) {
    if (seen.has(n)) {
      const renamed = `${n}__${seg.rel.replace(/[^\w]/g, '_')}`;
      console.log(`  çakışma: "${n}" (${seen.get(n)} ↔ ${seg.rel}) → "${renamed}"`);
      seg.src = renameIdent(seg.src, n, renamed);
    } else {
      seen.set(n, seg.rel);
    }
  }
}

/* ---- 3) main.js için modül bağlamaları ---- */
const mainSeg = segments.find((s) => s.rel === 'js/main.js');
mainSeg.src = `const Auth = { render: render_auth };
const Onboarding = { render: render_onboarding };
const Today = { render: render_today };
const Plan = { render: render_plan };
const Recipes = { render: render_recipes, openRecipeModal };
const Scan = { render: render_scan };
const Reports = { render: render_reports };
const Profile = { render: render_profile };
` + mainSeg.src;

const bundle = segments.map((s) => `/* ===== ${s.rel} ===== */\n${s.src}`).join('\n\n');

/* ---- 4) Veri dosyalarını göm ---- */
const recipes = readFileSync(join(PUB, '..', 'data', 'recipes.json'), 'utf8')
  .replaceAll('"/img/', '"img/'); // file:// uyumu için göreli yol
const foods = readFileSync(join(PUB, '..', 'data', 'foods.json'), 'utf8');
const dataScript = `window.__NUTRI_DATA__ = { recipes: ${recipes}, foods: ${foods} };\nwindow.LOCAL_BACKEND = true;\n`;

/* ---- 5) index.html üret ---- */
let html = readFileSync(join(PUB, 'index.html'), 'utf8');
const css = readFileSync(join(PUB, 'css', 'app.css'), 'utf8');

const cssTag = `<style>\n${css}\n</style>`;
const cssPattern = /<link rel="stylesheet" href="\/css\/app\.css" \/>/;
if (!cssPattern.test(html)) { console.error('HATA: css link bulunamadı'); process.exit(1); }
html = html.replace(cssPattern, () => cssTag);

const jsPattern = /<script type="module" src="\/js\/main\.js"><\/script>/;
if (!jsPattern.test(html)) { console.error('HATA: main.js script etiketi bulunamadı'); process.exit(1); }
const jsTag = `<script>\n${dataScript}\n</script>\n  <script>\n${bundle}\n</script>`;
html = html.replace(jsPattern, () => jsTag);

if (/src="\/js\/main\.js"/.test(html)) {
  console.error('HATA: main.js referansı değiştirilemedi');
  process.exit(1);
}

/* ---- 6) Çıktı ---- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
cpSync(join(PUB, 'img'), join(OUT, 'img'), { recursive: true });
if (existsSync(join(PUB, 'vendor'))) cpSync(join(PUB, 'vendor'), join(OUT, 'vendor'), { recursive: true });

mkdirSync(join(ROOT, 'android', 'build'), { recursive: true });
writeFileSync(join(ROOT, 'android', 'build', 'bundle-check.js'), bundle);
console.log('www paketi hazır →', OUT);
console.log('bundle boyutu:', (Buffer.byteLength(bundle) / 1024).toFixed(0) + ' KB');
