/** Static syntax check of every JS file in src/ and scripts/ (no build tools). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(path.join(root, 'src'));
files.push(path.join(root, 'scripts', 'build-web.js'));
files.push(path.join(root, 'scripts', 'smoke-mock.js'));

let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error('✗', path.relative(root, f), '\n', String(e.stderr || e.message)); }
}
console.log(bad === 0 ? ('✓ all ' + files.length + ' JS files parse') : ('✗ ' + bad + ' file(s) failed'));
process.exit(bad === 0 ? 0 : 1);
