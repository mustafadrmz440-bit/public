#!/usr/bin/env node
/**
 * sign-apk.mjs — v1 (JAR) APK imzalama: node-forge ile PKCS#7/CMS üretir.
 * Kullanım: node sign-apk.mjs <unsigned.apk> <signed.apk>
 * Android 11-14 hedefli yüklemede targetSdk 29 için v1 imzası yeterlidir.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import AdmZip from 'adm-zip';
import forge from 'node-forge';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Kullanım: node sign-apk.mjs <unsigned.apk> <signed.apk>');
  process.exit(1);
}

/* ---------------------------- Anahtar & sertifika ------------------------- */
const KEY_FILE = new URL('./signing-key.json', import.meta.url).pathname;
let keyPem, certPem;

if (existsSync(KEY_FILE)) {
  ({ keyPem, certPem } = JSON.parse(readFileSync(KEY_FILE, 'utf8')));
} else {
  const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = '01' + Date.now().toString(16);
  cert.validity.notBefore = new Date(2026, 0, 1);
  cert.validity.notAfter = new Date(2046, 0, 1);
  const attrs = [
    { name: 'commonName', value: 'NutriAI' },
    { name: 'organizationName', value: 'NutriAI' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(privateKey, forge.md.sha256.create());
  keyPem = forge.pki.privateKeyToPem(privateKey);
  certPem = forge.pki.certificateToPem(cert);
  writeFileSync(KEY_FILE, JSON.stringify({ keyPem, certPem }));
}

const privateKey = forge.pki.privateKeyFromPem(keyPem);
const certificate = forge.pki.certificateFromPem(certPem);

/* ------------------------------ ZIP okuma --------------------------------- */
const zip = new AdmZip(inPath);
const entries = zip.getEntries();

function sha256b64(buf) {
  const md = forge.md.sha256.create();
  md.update(buf.toString('binary'), 'binary');
  return forge.util.encode64(md.digest().getBytes());
}

/* ------------------------------ MANIFEST.MF ------------------------------- */
const CRLF = '\r\n';
let manifest = 'Manifest-Version: 1.0' + CRLF + 'Created-By: 1.0 (NutriAI Build)' + CRLF + CRLF;
const sectionDigests = new Map();

for (const e of entries) {
  if (!e.isDirectory && !e.entryName.startsWith('META-INF/')) {
    const data = e.getData();
    const section = 'Name: ' + e.entryName + CRLF + 'SHA-256-Digest: ' + sha256b64(data) + CRLF + CRLF;
    sectionDigests.set(e.entryName, section);
    manifest += section;
  }
}
const manifestBytes = Buffer.from(manifest, 'binary');

/* ------------------------------- CERT.SF ---------------------------------- */
let sf = 'Signature-Version: 1.0' + CRLF + 'Created-By: 1.0 (NutriAI)' + CRLF +
  'SHA-256-Digest-Manifest: ' + sha256b64(manifestBytes) + CRLF + CRLF;
for (const [, section] of sectionDigests) {
  sf += 'Name: ' + section.slice('Name: '.length).split(CRLF)[0] + CRLF +
    'SHA-256-Digest: ' + sha256b64(Buffer.from(section, 'binary')) + CRLF + CRLF;
}
const sfBytes = Buffer.from(sf, 'binary');

/* ------------------------------- CERT.RSA --------------------------------- */
const p7 = forge.pkcs7.createSignedData();
p7.content = forge.util.createBuffer(sf.toString('binary'), 'binary');
p7.addCertificate(certificate);
p7.addSigner({
  key: privateKey,
  certificate,
  digestAlgorithm: forge.pki.oids.sha256,
  authenticatedAttributes: []
});
p7.sign({ detached: true });
const der = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');

/* --------------------------- Yeni zip'i yaz -------------------------------- */
const out = new AdmZip();
for (const e of entries) {
  if (e.isDirectory) { out.addFile(e.entryName + '/', Buffer.alloc(0)); continue; }
  const data = e.getData();
  const isArsc = e.entryName === 'resources.arsc';
  const entry = new (out.getEntries().constructor)();
  // adm-zip API: addFile(entryName, data) — sıkıştırmayı yönetmek için doğrudan ekle
  const z = out.addFile(e.entryName, data);
  if (isArsc) {
    // resources.arsc stored (sıkıştırmasız) kalsın
    z.compress = () => {};
  }
}
out.addFile('META-INF/MANIFEST.MF', manifestBytes);
out.addFile('META-INF/CERT.SF', sfBytes);
out.addFile('META-INF/CERT.RSA', der);

out.writeZip(outPath);
console.log('İmzalı APK yazıldı →', outPath);
console.log('Sertifika: CN=NutriAI (self-signed, RSA-2048)');
