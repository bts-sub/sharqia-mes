/**
 * build-web.js — prepares the `www/` bundle that Capacitor ships.
 *
 * Steps:
 *  1. Generate `www/env.js` from `.env` (or `.env.example` defaults) — git-ignored.
 *  2. Copy the service layer (`src/`) into `www/src/` so on-device ES modules
 *     resolve with relative paths (no bundler needed for mock mode).
 *  3. Read the pristine app (`www/app/sharqia_mes.html`) and write `www/index.html`
 *     with three additions injected right before </body>:
 *        - <script src="env.js">           (runtime config)
 *        - <script type="module" src="src/bootstrap.js">  (service layer + Odoo hydration)
 *        - the SHARQIA DATA HOOK            (guarded; no-op unless __SHARQIA_DATA__ is set)
 *
 * The pristine app file is never modified, so the UI/design is untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');

function readEnvFile() {
  const envPath = fs.existsSync(path.join(root, '.env')) ? path.join(root, '.env') : path.join(root, '.env.example');
  const text = fs.readFileSync(envPath, 'utf8');
  const out = {};
  text.split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
  });
  return out;
}

function writeEnvJs(env) {
  const js = '/* AUTO-GENERATED from .env by scripts/build-web.js. Do not commit. */\n' +
    'window.__SHARQIA_ENV__ = ' + JSON.stringify(env, null, 2) + ';\n';
  fs.writeFileSync(path.join(www, 'env.js'), js);
  console.log('  ✓ www/env.js  (DATA_SOURCE=' + (env.SHARQIA_DATA_SOURCE || 'mock') + ')');
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// Hydration and sign-in used to be an inline hook here; they now live in
// src/ui/odooBridge.js (loaded by bootstrap in ODOO mode only), which also
// saves actions back to Odoo.
function buildIndex() {
  const appFile = path.join(www, 'app', 'sharqia_mes.html');
  let html = fs.readFileSync(appFile, 'utf8');
  const inject = '\n<script src="env.js"></script>\n' +
    '<script type="module" src="src/bootstrap.js"></script>\n';
  if (html.indexOf('</body>') >= 0) html = html.replace('</body>', inject + '</body>');
  else html += inject;
  fs.writeFileSync(path.join(www, 'index.html'), html);
  console.log('  ✓ www/index.html (app + env + bootstrap + data hook)');
}

console.log('Preparing web bundle…');
writeEnvJs(readEnvFile());
copyDir(path.join(root, 'src'), path.join(www, 'src'));
console.log('  ✓ www/src (service layer copied)');
buildIndex();
console.log('Done. Next: npx cap sync');
