/* scripts/check.mjs - snelle zelfcontrole voor de planner.
   node scripts/check.mjs [basisURL]
   - broncode: geen auth-token in URL's, geen externe CDN's
   - _headers: de security-headers staan er
   - als een basisURL is opgegeven (bijv. http://localhost:8788): live headers
   - npm audit (best effort)
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let fouten = 0;
const fout = (m) => { console.log('  FOUT  ' + m); fouten++; };
const ok = (m) => console.log('  ok    ' + m);

function walk(dir, ext, cb) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, cb);
    else if (ext.some((e) => name.endsWith(e))) cb(p, readFileSync(p, 'utf8'));
  }
}

console.log('# broncode');
walk(join(root, 'public'), ['.html', '.js'], (p, src) => {
  if (/[?&](t|token)=\$?\{?[a-z]*token/i.test(src) && !p.endsWith('mijn/index.html') && !p.endsWith('inschrijven/index.html')) {
    // /mijn en /inschrijven bouwen bewust een ?token=-link voor de gebruiker
    fout(p + ' bevat mogelijk een auth-token in een URL');
  }
  if (/https?:\/\/(cdn|unpkg|jsdelivr|fonts\.googleapis|ajax\.googleapis)/i.test(src)) {
    fout(p + ' verwijst naar een externe CDN (moet self-hosted)');
  }
});
ok('geen externe CDN-verwijzingen / geen losse token-URLs');

console.log('# _headers');
const headers = readFileSync(join(root, 'public/_headers'), 'utf8');
for (const h of ['Strict-Transport-Security', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Content-Security-Policy', 'Permissions-Policy']) {
  if (headers.includes(h)) ok(h); else fout('_headers mist: ' + h);
}
if (headers.includes("connect-src 'self'")) ok("CSP connect-src 'self'"); else fout("CSP zonder connect-src 'self'");

const base = process.argv[2];
if (base) {
  console.log('# live headers (' + base + ')');
  try {
    const res = await fetch(base.replace(/\/$/, '') + '/');
    for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options']) {
      if (res.headers.get(h)) ok(h + ': ' + res.headers.get(h)); else fout('respons mist header: ' + h);
    }
  } catch (e) { fout('kon ' + base + ' niet bereiken: ' + e.message); }
}

console.log('# npm audit');
try {
  execSync('npm audit --omit=dev --audit-level=high', { cwd: root, stdio: 'pipe' });
  ok('geen high/critical kwetsbaarheden');
} catch (e) {
  const out = (e.stdout || e.stderr || '').toString();
  console.log(out.split('\n').slice(0, 12).join('\n'));
  fout('npm audit meldt kwetsbaarheden (zie hierboven)');
}

console.log(fouten ? ('\n' + fouten + ' punt(en) om te bekijken.') : '\nAlles ok.');
process.exit(fouten ? 1 : 0);
