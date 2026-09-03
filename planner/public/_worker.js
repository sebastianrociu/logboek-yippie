/* ============================================================================
   _worker.js - Cloudflare Pages Advanced-mode Worker.
   Alle /api/*-routes, authenticatie, autorisatie en (stub) mail in dit bestand.
   Statische bestanden serveert Pages zelf (zie public/_routes.json).

   Opslag: één KV-namespace PLANNER_KV, één JSON-object per domein-key.
   Concurrency: mutate() = read -> wijzig -> put -> write-verify -> retry (max 3),
   met _rev (optimistic lock), _by (per-worker-stempel) en defensieve merge van
   inschrijvingen (append) zodat gelijktijdige schrijfacties niet verdwijnen.
   ========================================================================== */

const VERSION = '2026-09-04.2';

const KEYS = {
  config: 'config',
  resources: 'resources',
  inschrijvingen: 'inschrijvingen',
  rooster: 'rooster',
  users: 'users',
  aanwezigheid: 'aanwezigheid',
};

const DAGDELEN = ['ochtend', 'middag'];
const NIVEAUS = ['mavo', 'havo', 'vwo'];
const LEERJAAR_MAX = { mavo: 4, havo: 5, vwo: 6 };
const TRAJECTEN = ['examentraining', 'bijspijker'];

const DEFAULTS = {
  config: {
    _rev: 0,
    scholen: [], vakken: [], jaarlagen: [], blokken: [],
    instellingen: { groepMin: 4, groepMax: 12, mavoLabel: 'vmbo-tl', splitOpTraject: true },
  },
  resources: { _rev: 0, items: [], tombstones: {} },
  inschrijvingen: { _rev: 0, items: [], tombstones: {} },
  rooster: { _rev: 0, status: 'concept', sessies: [], conflicten: [] },
  users: { _rev: 0, items: [] },
  aanwezigheid: { _rev: 0, perSessie: {} },
};

/* ---------- helpers -------------------------------------------------------- */
const enc = new TextEncoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
class HttpError extends Error {
  constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra || {}; }
}

function b64urlFromBuf(buf) {
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function uid(n = 12) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join('');
}

/* ---------- normalisatie ------------------------------------------------- */
// slug zoals in beheer/index.html: kleine letters, niet-alnum -> "_", max 24.
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
}
function afgeleidTraject(niveau, leerjaar) {
  if (!NIVEAUS.includes(niveau) || !leerjaar) return '';
  return Number(leerjaar) >= LEERJAAR_MAX[niveau] ? 'examentraining' : 'bijspijker';
}
function hashStr(s) {
  let h = 5381;
  s = String(s || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'k_' + h.toString(36);
}
const DAGDEEL_OK = (d) => (d === 'middag' ? 'middag' : 'ochtend'); // 'avond' en onbekend -> 'ochtend'

// normalize: pure + idempotent. Raakt _rev/_at/_by NOOIT aan (mutate vertrouwt daarop).
// Vult nieuwe velden en migreert oude vormen bij het lezen; wegschrijven gebeurt
// vanzelf bij de eerstvolgende mutate()/putSection() van die sectie.
function normalize(key, o) {
  if (!o || typeof o !== 'object') return o;
  if (key === 'config') {
    o.scholen = o.scholen || []; o.vakken = o.vakken || [];
    o.jaarlagen = o.jaarlagen || []; o.blokken = o.blokken || [];
    o.instellingen = Object.assign({ groepMin: 4, groepMax: 12, mavoLabel: 'vmbo-tl', splitOpTraject: true }, o.instellingen || {});
    for (const b of o.blokken) if (!Array.isArray(b.dagen) || !b.dagen.length) b.dagen = ['za', 'zo'];
  } else if (key === 'resources') {
    o.items = o.items || []; o.tombstones = o.tombstones || {};
    for (const r of o.items) {
      r.vakIds = r.vakIds || []; r.jaarlaagIds = r.jaarlaagIds || []; r.vakVoorkeuren = r.vakVoorkeuren || [];
      r.beschikbaarheid = (r.beschikbaarheid || []).map((s) => ({ datum: s.datum, dagdeel: DAGDEEL_OK(s.dagdeel) }));
    }
  } else if (key === 'inschrijvingen') {
    o.items = o.items || []; o.tombstones = o.tombstones || {};
    for (const r of o.items) {
      if (r.schoolVrij == null) r.schoolVrij = '';
      if (r.niveau == null) r.niveau = '';
      if (r.leerjaar == null) r.leerjaar = null;
      if (!r.traject) r.traject = afgeleidTraject(r.niveau, r.leerjaar);
      r.keuzes = (r.keuzes || []).map((k) => Object.assign({}, k, { dagdeel: DAGDEEL_OK(k.dagdeel) }));
    }
  } else if (key === 'rooster') {
    o.status = o.status || 'concept'; o.sessies = o.sessies || [];
    o.conflicten = (o.conflicten || []).map((c) => (typeof c === 'string'
      ? { id: hashStr(c), type: 'legacy', severity: 'midden', titel: c, detail: '', ref: null }
      : c));
    for (const s of o.sessies) {
      s.dagdeel = DAGDEEL_OK(s.dagdeel);
      if (s.bron == null) s.bron = 'handmatig';
      if (s.buitenBeschikbaarheid == null) s.buitenBeschikbaarheid = false;
      if (s.traject == null) s.traject = '';
    }
  } else if (key === 'aanwezigheid') {
    o.perSessie = o.perSessie || {};
  }
  return o;
}

/* ---------- KV ----------------------------------------------------------- */
async function readJSON(env, key) {
  const raw = await env.PLANNER_KV.get(key);
  const fallback = DEFAULTS[key] ? structuredClone(DEFAULTS[key]) : {};
  if (!raw) return normalize(key, fallback);
  try { return normalize(key, JSON.parse(raw)); } catch { return normalize(key, fallback); }
}

// mutate: apply fn to a fresh copy, write, verify, retry on lost race.
async function mutate(env, key, fn) {
  const workerId = uid(8);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await readJSON(env, key);
    const curRev = cur._rev || 0;
    let next;
    try {
      next = fn(structuredClone(cur), cur);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastErr = e; throw e;
    }
    if (next == null) return cur; // no-op
    next._rev = curRev + 1;
    next._at = new Date().toISOString();
    next._by = workerId;
    await env.PLANNER_KV.put(key, JSON.stringify(next));
    // write-verify: did our write survive?
    const check = await readJSON(env, key);
    if (check._rev === next._rev && check._by === workerId) return check;
    await sleep(70 * (attempt + 1)); // lost the race, re-read and re-apply
  }
  throw new HttpError(409, 'rev-conflict', { key });
}

// Full-section PUT with optimistic lock. arrays[] = velden die per id gemerged
// worden zodat een gelijktijdige toevoeging door een andere schrijver blijft staan.
async function putSection(env, key, body, arrays = []) {
  return mutate(env, key, (draft, cur) => {
    if (body._rev != null && body._rev !== (cur._rev || 0)) {
      throw new HttpError(409, 'rev-conflict', { latest: cur });
    }
    const out = { ...draft, ...body };
    for (const f of arrays) {
      const incoming = Array.isArray(body[f]) ? body[f] : [];
      const tomb = (body.tombstones && body.tombstones) || out.tombstones || {};
      const byId = new Map(incoming.map((it) => [it.id, it]));
      for (const old of (cur[f] || [])) {
        if (!byId.has(old.id) && !tomb[old.id]) byId.set(old.id, old); // survived concurrent add
      }
      out[f] = Array.from(byId.values());
    }
    out._rev = cur._rev || 0; // mutate() bumps it
    return out;
  });
}

/* ---------- crypto: sessie-cookie + wachtwoord ------------------------- */
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signSession(env, payload) {
  const body = b64urlFromBuf(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.SESSION_SECRET || 'dev-secret-change-me');
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return body + '.' + b64urlFromBuf(sig);
}
async function verifySession(env, token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, sig] = token.split('.');
  const key = await hmacKey(env.SESSION_SECRET || 'dev-secret-change-me');
  const ok = await crypto.subtle.verify('HMAC', key, b64urlToBuf(sig), enc.encode(body));
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBuf(body))); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}
function cookieHeader(token, maxAgeSec, secure) {
  const parts = [
    'yp_sess=' + (token || ''),
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    'Max-Age=' + (token ? maxAgeSec : 0),
  ];
  // Secure alleen op https; anders weigeren browsers (o.a. Safari) de cookie op
  // http://localhost en werkt inloggen lokaal niet.
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
function readCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? m[1] : null;
}
async function pbkdf2(pw, saltBuf, iterations = 210000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' }, key, 256);
  return b64urlFromBuf(bits);
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pw, salt.buffer);
  return { salt: b64urlFromBuf(salt.buffer), hash };
}
async function checkPassword(pw, saltB64, hashB64) {
  const got = await pbkdf2(pw, b64urlToBuf(saltB64));
  // constant-time-ish compare
  if (got.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}

/* ---------- auth context --------------------------------------------------- */
async function getAuth(env, req) {
  const payload = await verifySession(env, readCookie(req, 'yp_sess'));
  if (!payload) return null;
  return { uid: payload.uid, rol: payload.rol, schoolId: payload.sid || null, resourceId: payload.rid || null, naam: payload.naam || '' };
}
function requireRole(auth, rol) {
  if (!auth || auth.rol !== rol) throw new HttpError(403, 'geen toegang');
  return auth;
}

/* ---------- stub-mail --------------------------------------------------- */
// Fase 1: geen echte verzending. Log de intentie zodat het in de Worker-logs
// zichtbaar is; de UI toont zelf een mailto: / kopieerbare link.
function stubMail(kind, to, data) {
  console.log('[stub-mail]', kind, '->', to, JSON.stringify(data || {}));
}

/* ---------- validatie inschrijving -------------------------------------- */
function str(v, max = 200) { return String(v == null ? '' : v).trim().slice(0, max); }
function cleanEmail(v) { const s = str(v, 254).toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : ''; }

// Vaknaam normaliseren voor groeperen: "  Wiskunde A " en "wiskunde a" horen bij
// elkaar. Toont de eerst ingevoerde schrijfwijze, groepeert op de genormaliseerde.
function vakNaam(v) { return str(v, 60).replace(/\s+/g, ' '); }
function vakKey(v) { return vakNaam(v).toLowerCase(); }

function validateInschrijving(body, config) {
  const schoolIds = new Set((config.scholen || []).map((s) => s.id));
  const blokById = new Map((config.blokken || []).map((b) => [b.id, b]));

  // School: bekende id, anders vrije tekst die beheer later koppelt.
  let schoolId = str(body.schoolId, 40);
  let schoolVrij = '';
  if (!schoolIds.has(schoolId)) {
    schoolId = '';
    schoolVrij = str(body.schoolVrij, 120).replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Niveau + leerjaar (segmented op het formulier).
  const niveau = NIVEAUS.includes(str(body.niveau, 8)) ? str(body.niveau, 8) : '';
  let leerjaar = parseInt(body.leerjaar, 10);
  if (!niveau || !(leerjaar >= 1 && leerjaar <= LEERJAAR_MAX[niveau])) leerjaar = null;

  // Traject: expliciet, anders afgeleid uit het examenjaar.
  let traject = TRAJECTEN.includes(str(body.traject, 20)) ? str(body.traject, 20) : '';
  if (!traject) traject = afgeleidTraject(niveau, leerjaar);

  const leerlingNaam = str(body.leerling && body.leerling.naam, 120);
  const ouderEmail = cleanEmail(body.ouder && body.ouder.email);
  const leerlingEmail = cleanEmail(body.leerling && body.leerling.email);

  // keuzes: één per gekozen blok, met dag + dagdeel + vakken
  const keuzesIn = Array.isArray(body.keuzes) ? body.keuzes : [];
  const keuzes = [];
  for (const k of keuzesIn) {
    const blok = blokById.get(str(k && k.blokId, 40));
    if (!blok) continue;
    const dagenVanBlok = Array.isArray(blok.dagen) && blok.dagen.length ? blok.dagen : ['za', 'zo'];
    let dag = str(k.dag, 4);
    if (!dagenVanBlok.includes(dag)) dag = dagenVanBlok[0];
    const dagdeel = DAGDELEN.includes(str(k.dagdeel, 10)) ? str(k.dagdeel, 10) : 'ochtend';
    const seen = new Set();
    const vakken = (Array.isArray(k.vakken) ? k.vakken : [])
      .map(vakNaam).filter((v) => v && !seen.has(vakKey(v)) && seen.add(vakKey(v)))
      .slice(0, 15);
    if (!vakken.length) continue;
    keuzes.push({ blokId: blok.id, dag, dagdeel, vakken });
  }
  // dubbele blok-keuzes samenvoegen (één keuze per blok)
  const perBlok = new Map();
  for (const k of keuzes) {
    if (perBlok.has(k.blokId)) {
      const cur = perBlok.get(k.blokId);
      const seen = new Set(cur.vakken.map(vakKey));
      for (const v of k.vakken) if (!seen.has(vakKey(v))) { cur.vakken.push(v); seen.add(vakKey(v)); }
    } else perBlok.set(k.blokId, k);
  }
  const keuzesClean = Array.from(perBlok.values());

  const fouten = [];
  if (!schoolId && !schoolVrij) fouten.push('Kies een school of vul een schoolnaam in.');
  if (!niveau || !leerjaar) fouten.push('Kies je niveau en leerjaar.');
  if (!keuzesClean.length) fouten.push('Kies minstens een blok met dag en vak(ken).');
  if (!leerlingNaam) fouten.push('Vul de naam van de leerling in.');
  if (!ouderEmail && !leerlingEmail) fouten.push('Vul een e-mailadres in (leerling of ouder).');

  const clean = {
    schoolId, schoolVrij,
    niveau, leerjaar, traject,
    jaarlaagId: '', // gevuld door de route (find-or-create)
    keuzes: keuzesClean,
    toelichting: str(body.toelichting, 500),
    leerling: { naam: leerlingNaam, email: leerlingEmail, tel: str(body.leerling && body.leerling.tel, 30) },
    ouder: {
      naam: str(body.ouder && body.ouder.naam, 120), email: ouderEmail, tel: str(body.ouder && body.ouder.tel, 30),
    },
    mentor: { naam: str(body.mentor && body.mentor.naam, 120), email: cleanEmail(body.mentor && body.mentor.email) },
  };
  return { fouten, clean };
}

// Zoek de jaarlaag voor (niveau, leerjaar); maak hem aan als hij nog niet bestaat.
// Bounded: niveau x leerjaar geeft hooguit ~18 auto-jaarlagen ooit.
async function vindOfMaakJaarlaag(env, config, niveau, leerjaar) {
  if (!niveau || !leerjaar) return '';
  const label = leerjaar + ' ' + (niveau === 'mavo' ? (config.instellingen.mavoLabel || 'vmbo-tl') : niveau);
  const wantSlug = slug(label);
  const past = (j) => j.id === wantSlug
    || (j.niveau === niveau && Number(j.leerjaar) === Number(leerjaar))
    || String(j.label || '').trim().toLowerCase() === label.toLowerCase();
  const bestaand = (config.jaarlagen || []).find(past);
  if (bestaand) return bestaand.id;
  try {
    const c2 = await mutate(env, KEYS.config, (d) => {
      if (d.jaarlagen.find((j) => j.id === wantSlug || (j.niveau === niveau && Number(j.leerjaar) === Number(leerjaar)))) return null; // race: al aangemaakt
      d.jaarlagen.push({ id: wantSlug, label, niveau, leerjaar: Number(leerjaar) });
      return d;
    });
    const jl = (c2.jaarlagen || []).find(past);
    return jl ? jl.id : wantSlug;
  } catch (e) {
    return ''; // inschrijving faalt hier nooit op; beheer koppelt later
  }
}

/* ---------- routes ---------------------------------------------------------- */
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;
  const isDev = (env.ENV || 'production') === 'dev';
  const secure = url.protocol === 'https:' || (request.headers.get('x-forwarded-proto') || '') === 'https';
  const body = ['POST', 'PUT', 'PATCH'].includes(method)
    ? await request.json().catch(() => ({})) : {};

  /* --- open --- */
  if (path === '/api/version') return json({ version: VERSION });

  if (path === '/api/me' && method === 'GET') {
    const auth = await getAuth(env, request);
    if (!auth) return json({ rol: null });
    return json({ rol: auth.rol, naam: auth.naam, schoolId: auth.schoolId, resourceId: auth.resourceId });
  }

  if (path === '/api/login' && method === 'POST') {
    const email = cleanEmail(body.email);
    const pw = String(body.password || '');
    if (!email || !pw) throw new HttpError(400, 'e-mail en wachtwoord verplicht');
    let users = await readJSON(env, KEYS.users);
    let user = users.items.find((u) => u.email === email);

    // eerste keer: seed-beheerder uit secrets
    if (!user && email === cleanEmail(env.SEED_ADMIN_EMAIL) && pw === String(env.SEED_ADMIN_PASS || '') && env.SEED_ADMIN_PASS) {
      const { salt, hash } = await hashPassword(pw);
      const nu = { id: uid(), email, rol: 'beheerder', naam: 'Beheerder', salt, hash };
      await mutate(env, KEYS.users, (d) => {
        if (!d.items.find((u) => u.email === email)) d.items.push(nu);
        return d;
      });
      user = nu;
    }
    if (!user || !user.hash) throw new HttpError(401, 'onjuiste inloggegevens');
    const ok = await checkPassword(pw, user.salt, user.hash);
    if (!ok) throw new HttpError(401, 'onjuiste inloggegevens');

    const maxAge = 60 * 60 * 12;
    const token = await signSession(env, {
      uid: user.id, rol: user.rol, naam: user.naam,
      sid: user.schoolId || null, rid: user.resourceId || null,
      exp: Date.now() + maxAge * 1000,
    });
    return json({ rol: user.rol, naam: user.naam }, 200, { 'set-cookie': cookieHeader(token, maxAge, secure) });
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0, secure) });
  }

  /* --- publieke inschrijving --- */
  if (path === '/api/config-public' && method === 'GET') {
    const c = await readJSON(env, KEYS.config);
    return json({
      scholen: c.scholen, vakken: c.vakken, jaarlagen: c.jaarlagen, blokken: c.blokken || [],
    });
  }

  if (path === '/api/inschrijving' && method === 'POST') {
    const config = await readJSON(env, KEYS.config);
    const { fouten, clean } = validateInschrijving(body, config);
    if (fouten.length) throw new HttpError(400, fouten.join(' '));
    // Jaarlaag zoeken-of-aanmaken uit (niveau, leerjaar). Deterministische id zodat
    // gelijktijdige publieke inschrijvingen op dezelfde combinatie samenvallen.
    clean.jaarlaagId = await vindOfMaakJaarlaag(env, config, clean.niveau, clean.leerjaar);
    const rec = {
      id: uid(), token: uid(24), ts: new Date().toISOString(), status: 'nieuw', ...clean,
    };
    await mutate(env, KEYS.inschrijvingen, (d) => {
      if (!d.items.find((x) => x.id === rec.id)) d.items.push(rec); // merge-safe append
      return d;
    });
    stubMail('inschrijving-ontvangen', rec.ouder.email || rec.leerling.email, { token: rec.token });
    return json({ ok: true, token: rec.token });
  }

  /* --- persoonlijke pagina leerling/ouder (token) --- */
  if (path === '/api/mijn' && method === 'GET') {
    const token = str(url.searchParams.get('token'), 40);
    if (!token) throw new HttpError(400, 'token ontbreekt');
    const [ins, rooster, config] = await Promise.all([
      readJSON(env, KEYS.inschrijvingen), readJSON(env, KEYS.rooster), readJSON(env, KEYS.config),
    ]);
    const rec = ins.items.find((x) => x.token === token);
    if (!rec) throw new HttpError(404, 'niet gevonden');
    const naam = (n) => (config[n] || []).reduce((m, x) => (m[x.id] = x.label || x.naam, m), {});
    const schoolN = naam('scholen'), jaarN = naam('jaarlagen'), blokN = naam('blokken');
    const sessies = (rooster.status === 'definitief' ? rooster.sessies : [])
      .filter((s) => (s.leerlingIds || []).includes(rec.id))
      .map((s) => ({
        id: s.id, datum: s.datum, dag: s.dag, dagdeel: s.dagdeel, locatie: s.locatie,
        blok: blokN[s.blokId] || '', vak: s.vak || '', begeleider: s.begeleiderNaam || '',
      }));
    return json({
      inschrijving: {
        leerling: rec.leerling.naam,
        school: schoolN[rec.schoolId] || rec.schoolVrij || '',
        jaarlaag: jaarN[rec.jaarlaagId] || (rec.niveau && rec.leerjaar ? rec.leerjaar + ' ' + rec.niveau : ''),
        traject: rec.traject || '',
        status: rec.status, toelichting: rec.toelichting || '',
        keuzes: (rec.keuzes || []).map((k) => ({
          blok: blokN[k.blokId] || '', dag: k.dag, dagdeel: k.dagdeel, vakken: k.vakken || [],
        })),
      },
      roosterStatus: rooster.status, sessies,
    });
  }

  if (path === '/api/mijn/afmelden' && method === 'POST') {
    const token = str(url.searchParams.get('token'), 40);
    const sessieId = str(body.sessieId, 40);
    const ins = await readJSON(env, KEYS.inschrijvingen);
    const rec = ins.items.find((x) => x.token === token);
    if (!rec) throw new HttpError(404, 'niet gevonden');
    await mutate(env, KEYS.rooster, (d) => {
      const s = d.sessies.find((x) => x.id === sessieId);
      if (s) s.leerlingIds = s.leerlingIds.filter((id) => id !== rec.id);
      return d;
    });
    stubMail('afmelding', 'planning@yippie.test', { leerling: rec.leerling.naam, sessieId });
    return json({ ok: true });
  }

  /* --- BEHEER (rol beheerder) --- */
  if (path.startsWith('/api/beheer/')) {
    const auth = requireRole(await getAuth(env, request), 'beheerder');
    const sub = path.slice('/api/beheer/'.length);

    if (sub === 'config') {
      if (method === 'GET') return json(await readJSON(env, KEYS.config));
      if (method === 'PUT') return json(await putSection(env, KEYS.config, body, ['scholen', 'vakken', 'jaarlagen', 'blokken']));
    }
    if (sub === 'resources') {
      if (method === 'GET') return json(await readJSON(env, KEYS.resources));
      if (method === 'PUT') return json(await putSection(env, KEYS.resources, body, ['items']));
    }
    if (sub === 'inschrijvingen') {
      if (method === 'GET') return json(await readJSON(env, KEYS.inschrijvingen));
      if (method === 'PUT') return json(await putSection(env, KEYS.inschrijvingen, body, ['items']));
    }
    if (sub === 'rooster') {
      if (method === 'GET') return json(await readJSON(env, KEYS.rooster));
      if (method === 'PUT') return json(await putSection(env, KEYS.rooster, body, ['sessies']));
    }
    if (sub === 'rooster/definitief' && method === 'POST') {
      const out = await mutate(env, KEYS.rooster, (d) => { d.status = 'definitief'; return d; });
      const ins = await readJSON(env, KEYS.inschrijvingen);
      let mails = 0;
      for (const rec of ins.items) {
        if (out.sessies.some((s) => s.leerlingIds.includes(rec.id))) {
          stubMail('indeling-definitief', rec.ouder.email || rec.leerling.email, { token: rec.token });
          mails++;
        }
      }
      return json({ ok: true, status: 'definitief', mailsGepland: mails });
    }
    if (sub === 'users') {
      if (method === 'GET') {
        const u = await readJSON(env, KEYS.users);
        return json({ _rev: u._rev, items: u.items.map((x) => ({ id: x.id, email: x.email, rol: x.rol, naam: x.naam, schoolId: x.schoolId || null, resourceId: x.resourceId || null })) });
      }
      if (method === 'POST') {
        const email = cleanEmail(body.email);
        const rol = ['beheerder', 'resource', 'mentor'].includes(body.rol) ? body.rol : null;
        const wachtwoord = String(body.wachtwoord || '');
        if (!email || !rol || wachtwoord.length < 8) throw new HttpError(400, 'e-mail, rol en wachtwoord (min. 8 tekens) verplicht');
        const { salt, hash } = await hashPassword(wachtwoord);
        const nu = {
          id: uid(), email, rol, naam: str(body.naam, 120) || email, salt, hash,
          schoolId: rol === 'mentor' ? str(body.schoolId, 40) : null,
          resourceId: rol === 'resource' ? str(body.resourceId, 40) : null,
        };
        await mutate(env, KEYS.users, (d) => {
          if (d.items.find((x) => x.email === email)) throw new HttpError(409, 'e-mailadres bestaat al');
          d.items.push(nu); return d;
        });
        return json({ ok: true, id: nu.id });
      }
      if (method === 'DELETE') {
        const id = str(url.searchParams.get('id'), 40);
        await mutate(env, KEYS.users, (d) => {
          if (id === auth.uid) throw new HttpError(400, 'je kunt jezelf niet verwijderen');
          d.items = d.items.filter((x) => x.id !== id); return d;
        });
        return json({ ok: true });
      }
    }
    throw new HttpError(404, 'onbekende beheer-route');
  }

  /* --- RESOURCE (rol resource) --- */
  if (path.startsWith('/api/resource/')) {
    const auth = requireRole(await getAuth(env, request), 'resource');
    const sub = path.slice('/api/resource/'.length);
    const rid = auth.resourceId;

    if (sub === 'mij' && method === 'GET') {
      const [res, rooster, config] = await Promise.all([
        readJSON(env, KEYS.resources), readJSON(env, KEYS.rooster), readJSON(env, KEYS.config),
      ]);
      const me = res.items.find((x) => x.id === rid) || null;
      const blokN = (config.blokken || []).reduce((m, x) => (m[x.id] = x.label, m), {});
      const sessies = rooster.sessies
        .filter((s) => s.resourceId === rid)
        .map((s) => ({ id: s.id, datum: s.datum, dag: s.dag, dagdeel: s.dagdeel, locatie: s.locatie, blok: blokN[s.blokId] || '', vak: s.vak || '', aantal: (s.leerlingIds || []).length }));
      return json({ resource: me, sessies, roosterStatus: rooster.status });
    }
    if (sub === 'beschikbaarheid' && method === 'PUT') {
      await mutate(env, KEYS.resources, (d) => {
        const me = d.items.find((x) => x.id === rid);
        if (!me) throw new HttpError(404, 'resource niet gevonden');
        if (Array.isArray(body.beschikbaarheid)) {
          me.beschikbaarheid = body.beschikbaarheid.slice(0, 400).map((b) => ({
            datum: str(b.datum, 10), dagdeel: DAGDELEN.includes(b.dagdeel) ? b.dagdeel : 'ochtend',
          }));
        }
        if (body.maxPerWeekend != null) me.maxPerWeekend = Math.max(0, Math.min(20, Number(body.maxPerWeekend) || 0));
        return d;
      });
      return json({ ok: true });
    }
    throw new HttpError(404, 'onbekende resource-route');
  }

  /* --- SCHOOL / MENTOR (rol mentor) - server stript naar eigen school --- */
  if (path.startsWith('/api/school/')) {
    const auth = requireRole(await getAuth(env, request), 'mentor');
    const sub = path.slice('/api/school/'.length);
    const eigenSchool = auth.schoolId; // NOOIT uit de request; alleen uit de cookie

    if (sub === 'overzicht' && method === 'GET') {
      if (!eigenSchool) return json({ school: null, leerlingen: [] });
      const [ins, rooster, config] = await Promise.all([
        readJSON(env, KEYS.inschrijvingen), readJSON(env, KEYS.rooster), readJSON(env, KEYS.config),
      ]);
      const jaarN = (config.jaarlagen || []).reduce((m, x) => (m[x.id] = x.label, m), {});
      const blokN = (config.blokken || []).reduce((m, x) => (m[x.id] = x.label, m), {});
      const schoolNaam = (config.scholen.find((s) => s.id === eigenSchool) || {}).naam || '';
      const leerlingen = ins.items
        .filter((r) => r.schoolId === eigenSchool)
        .map((r) => {
          const sessies = (rooster.status === 'definitief' ? rooster.sessies : [])
            .filter((s) => (s.leerlingIds || []).includes(r.id))
            .map((s) => ({ datum: s.datum, dag: s.dag, dagdeel: s.dagdeel, blok: blokN[s.blokId] || '', vak: s.vak || '' }));
          const vakken = [];
          for (const k of (r.keuzes || [])) for (const v of k.vakken) if (!vakken.includes(v)) vakken.push(v);
          return {
            leerling: r.leerling.naam,
            jaarlaag: jaarN[r.jaarlaagId] || (r.niveau && r.leerjaar ? r.leerjaar + ' ' + r.niveau : ''),
            traject: r.traject || '',
            vakken,
            blokken: (r.keuzes || []).map((k) => (blokN[k.blokId] || '') + ' (' + k.dag + ' ' + k.dagdeel + ')'),
            mentor: r.mentor.naam || '', status: r.status,
            ingedeeld: sessies.length, sessies,
          };
        });
      return json({ school: schoolNaam, roosterStatus: rooster.status, leerlingen });
    }
    throw new HttpError(404, 'onbekende school-route');
  }

  /* --- DEV --- */
  if (path.startsWith('/api/dev/')) {
    if (!isDev) throw new HttpError(403, 'alleen in dev');
    if (path === '/api/dev/seed' && method === 'POST') return json(await seed(env));
    if (path === '/api/dev/reset' && method === 'POST') {
      await Promise.all(Object.values(KEYS).map((k) => env.PLANNER_KV.delete(k)));
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'onbekende route');
}

/* ---------- dev seed ---------------------------------------------------- */
async function seed(env) {
  const config = {
    _rev: 0,
    scholen: [{ id: 'sch_lyceum', naam: 'Stedelijk Lyceum' }, { id: 'sch_college', naam: 'Noorderpoort College' }],
    vakken: [
      { id: 'vak_wi', naam: 'Wiskunde' }, { id: 'vak_na', naam: 'Natuurkunde' },
      { id: 'vak_sk', naam: 'Scheikunde' }, { id: 'vak_en', naam: 'Engels' },
      { id: 'vak_ne', naam: 'Nederlands' }, { id: 'vak_bio', naam: 'Biologie' }, { id: 'vak_ec', naam: 'Economie' },
    ],
    jaarlagen: [
      { id: 'jl_3h', label: '3 havo', niveau: 'havo', leerjaar: 3 },
      { id: 'jl_4h', label: '4 havo', niveau: 'havo', leerjaar: 4 },
      { id: 'jl_5h', label: '5 havo', niveau: 'havo', leerjaar: 5 },
      { id: 'jl_4v', label: '4 vwo', niveau: 'vwo', leerjaar: 4 },
      { id: 'jl_5v', label: '5 vwo', niveau: 'vwo', leerjaar: 5 },
      { id: 'jl_6v', label: '6 vwo', niveau: 'vwo', leerjaar: 6 },
      { id: 'jl_3t', label: '3 vmbo-tl', niveau: 'mavo', leerjaar: 3 },
      { id: 'jl_4t', label: '4 vmbo-tl', niveau: 'mavo', leerjaar: 4 },
    ],
    blokken: [
      { id: 'blok1', label: 'Blok 1 (na de herfstvakantie)', van: '2026-10-26', tot: '2026-12-13', dagen: ['za', 'zo'] },
      { id: 'blok2', label: 'Blok 2 (na de kerstvakantie)', van: '2027-01-11', tot: '2027-02-14', dagen: ['za', 'zo'] },
      { id: 'blok3', label: 'Blok 3 (voorjaar, richting examens)', van: '2027-03-02', tot: '2027-04-19', dagen: ['za', 'zo'] },
    ],
    instellingen: { groepMin: 4, groepMax: 12, mavoLabel: 'vmbo-tl', splitOpTraject: true },
  };
  await mutate(env, KEYS.config, () => config);

  const { salt, hash } = await hashPassword(env.SEED_ADMIN_PASS || 'beheer1234');
  const m = await hashPassword('mentor1234');
  const b = await hashPassword('begeleider1234');
  await mutate(env, KEYS.users, () => ({
    _rev: 0,
    items: [
      { id: 'u_admin', email: cleanEmail(env.SEED_ADMIN_EMAIL) || 'beheer@yippie.test', rol: 'beheerder', naam: 'Beheerder', salt, hash },
      { id: 'u_mentor', email: 'mentor@lyceum.test', rol: 'mentor', naam: 'M. de Wit', schoolId: 'sch_lyceum', salt: m.salt, hash: m.hash },
      { id: 'u_res1', email: 'trainer@yippie.test', rol: 'resource', naam: 'K. Jansen', resourceId: 'res_1', salt: b.salt, hash: b.hash },
    ],
  }));

  await mutate(env, KEYS.resources, () => ({
    _rev: 0, tombstones: {},
    items: [
      { id: 'res_1', naam: 'K. Jansen', email: 'trainer@yippie.test', vakIds: ['vak_wi', 'vak_na'], jaarlaagIds: ['jl_3h', 'jl_4h', 'jl_4v'], vakVoorkeuren: ['vak_wi'], maxPerWeekend: 3,
        beschikbaarheid: [{ datum: '2026-11-07', dagdeel: 'ochtend' }, { datum: '2026-11-14', dagdeel: 'ochtend' }] },
      { id: 'res_2', naam: 'L. Bakker', email: 'lbakker@yippie.test', vakIds: ['vak_en', 'vak_ne'], jaarlaagIds: ['jl_3h', 'jl_4t', 'jl_5h'], vakVoorkeuren: [], maxPerWeekend: 2,
        beschikbaarheid: [{ datum: '2026-11-08', dagdeel: 'middag' }] },
    ],
  }));

  const mk = (over) => ({
    id: uid(), token: uid(24), ts: new Date().toISOString(), status: 'nieuw',
    toelichting: '',
    ouder: { naam: 'Ouder van ' + (over.leerling ? over.leerling.naam : ''), email: 'ouder@example.test', tel: '06 1234 5678' },
    mentor: { naam: 'M. de Wit', email: 'mentor@lyceum.test' }, ...over,
  });
  await mutate(env, KEYS.inschrijvingen, () => ({
    _rev: 0, tombstones: {},
    items: [
      mk({ schoolId: 'sch_lyceum', jaarlaagId: 'jl_3h', niveau: 'havo', leerjaar: 3, traject: 'bijspijker', leerling: { naam: 'Sanne de Vries', email: '', tel: '' },
        keuzes: [{ blokId: 'blok1', dag: 'za', dagdeel: 'ochtend', vakken: ['Wiskunde'] }] }),
      mk({ schoolId: 'sch_lyceum', jaarlaagId: 'jl_3h', niveau: 'havo', leerjaar: 3, traject: 'bijspijker', leerling: { naam: 'Tim Post', email: '', tel: '' },
        keuzes: [{ blokId: 'blok1', dag: 'za', dagdeel: 'ochtend', vakken: ['wiskunde'] }] }),
      mk({ schoolId: 'sch_lyceum', jaarlaagId: 'jl_3h', niveau: 'havo', leerjaar: 3, traject: 'bijspijker', leerling: { naam: 'Noor Smit', email: '', tel: '' },
        keuzes: [
          { blokId: 'blok1', dag: 'za', dagdeel: 'ochtend', vakken: ['Wiskunde', 'Natuurkunde'] },
          { blokId: 'blok2', dag: 'zo', dagdeel: 'middag', vakken: ['Natuurkunde'] },
        ] }),
      mk({ schoolId: 'sch_college', jaarlaagId: 'jl_4v', niveau: 'vwo', leerjaar: 4, traject: 'bijspijker', leerling: { naam: 'Daan Mulder', email: '', tel: '' },
        keuzes: [{ blokId: 'blok1', dag: 'zo', dagdeel: 'ochtend', vakken: ['Natuurkunde'] }] }),
      mk({ schoolId: '', schoolVrij: 'Het Nieuwe Lyceum', jaarlaagId: 'jl_6v', niveau: 'vwo', leerjaar: 6, traject: 'examentraining', leerling: { naam: 'Lisa Groen', email: 'lisa@example.test', tel: '' },
        keuzes: [{ blokId: 'blok3', dag: 'za', dagdeel: 'ochtend', vakken: ['nask'] }] }),
    ],
  }));
  await mutate(env, KEYS.rooster, () => structuredClone(DEFAULTS.rooster));
  await mutate(env, KEYS.aanwezigheid, () => structuredClone(DEFAULTS.aanwezigheid));

  return { ok: true, seeded: true, logins: { beheerder: config && (cleanEmail(env.SEED_ADMIN_EMAIL) || 'beheer@yippie.test'), mentor: 'mentor@lyceum.test / mentor1234', resource: 'trainer@yippie.test / begeleider1234' } };
}

/* ---------- entry ------------------------------------------------------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (e) {
        if (e instanceof HttpError) {
          return json({ error: e.message, ...(e.extra || {}) }, e.status);
        }
        console.error('worker-error', e && e.stack || e);
        return json({ error: 'interne fout' }, 500);
      }
    }
    // niet-/api: laat Pages de statische assets serveren
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('not found', { status: 404 });
  },
};
