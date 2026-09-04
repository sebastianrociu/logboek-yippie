/* cron-worker - draait elke 5 minuten (zie wrangler.toml).
   Fase 1: alleen een dagelijkse backup van de KV-keys naar backup:<datum>.
   Haken voor fase 2/3 staan als TODO klaar:
     - sessieherinneringen (mail 24u van tevoren)
     - afwezigheidssignalering (na aanwezigheidsregistratie)
     - opschonen oude backups
   Alle uitgaande mail hoort via de Gmail-API in de Pages-Worker te lopen; deze
   worker zet hooguit een taak-vlag in KV die de Pages-Worker afhandelt, zodat de
   OAuth-tokens op een plek blijven. */

const DOMAIN_KEYS = ['config', 'resources', 'inschrijvingen', 'rooster', 'users', 'aanwezigheid'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => Math.random().toString(36).slice(2, 10);

// Zelfde optimistic-lock als mutate() in de Pages-Worker: lees -> wijzig -> schrijf
// -> lees terug en controleer _rev + _by. Zo gaat een gelijktijdige schrijfactie
// van de Pages-Worker tijdens de cron-run niet verloren. fn() geeft null terug = niets te doen.
async function mutateVerified(env, key, fn, now) {
  const by = stamp();
  for (let poging = 0; poging < 3; poging++) {
    let cur = {};
    try { cur = JSON.parse((await env.PLANNER_KV.get(key)) || '{}'); } catch { cur = {}; }
    const next = fn(cur);
    if (next == null) return { changed: false, value: cur };
    next._rev = (cur._rev || 0) + 1;
    next._at = now.toISOString();
    next._by = by;
    await env.PLANNER_KV.put(key, JSON.stringify(next));
    let check = {};
    try { check = JSON.parse((await env.PLANNER_KV.get(key)) || '{}'); } catch { check = {}; }
    if (check._rev === next._rev && check._by === by) return { changed: true, value: check };
    await sleep(80 * (poging + 1));
  }
  throw new Error('rev-conflict op ' + key);
}

// Retentie (AVG): geannuleerde/afgeronde inschrijvingen ouder dan config
// instellingen.bewaarMaanden opschonen, inclusief cascade uit rooster + aanwezigheid.
async function retentiePurge(env, now) {
  let cfg = {};
  try { cfg = JSON.parse((await env.PLANNER_KV.get('config')) || '{}'); } catch { /* ignore */ }
  const maanden = (cfg.instellingen && cfg.instellingen.bewaarMaanden) || 18;
  const grens = new Date(now.getTime() - maanden * 30 * 24 * 3600 * 1000).toISOString();

  const wegIds = new Set();
  const insRes = await mutateVerified(env, 'inschrijvingen', (ins) => {
    if (!ins.items) return null;
    wegIds.clear();
    ins.items = ins.items.filter((r) => {
      const oud = (r.ts || '') < grens;
      const klaar = r.status === 'geannuleerd' || r.status === 'afgerond';
      if (oud && (klaar || r.verwijderVerzocht)) { wegIds.add(r.id); return false; }
      return true;
    });
    if (!wegIds.size) return null;
    ins.tombstones = ins.tombstones || {};
    for (const id of wegIds) ins.tombstones[id] = now.getTime();
    return ins;
  }, now);
  if (!insRes.changed || !wegIds.size) return { purge: 0 };

  const leegeSessies = new Set();
  await mutateVerified(env, 'rooster', (rooster) => {
    if (!rooster.sessies) return null;
    let veranderd = false;
    for (const s of rooster.sessies) {
      const n = (s.leerlingIds || []).length;
      s.leerlingIds = (s.leerlingIds || []).filter((x) => !wegIds.has(x));
      if (s.leerlingIds.length !== n) veranderd = true;
      if (!s.leerlingIds.length) leegeSessies.add(s.id);
    }
    return veranderd ? rooster : null;
  }, now);

  await mutateVerified(env, 'aanwezigheid', (aanw) => {
    let veranderd = false;
    for (const sid of Object.keys(aanw.perSessie || {})) {
      for (const id of wegIds) if (aanw.perSessie[sid][id] != null) { delete aanw.perSessie[sid][id]; veranderd = true; }
    }
    for (const sid of leegeSessies) if (aanw.notities && aanw.notities[sid]) { delete aanw.notities[sid]; veranderd = true; }
    return veranderd ? aanw : null;
  }, now);

  return { purge: wegIds.size };
}

async function dailyBackup(env, now) {
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const marker = `backup:${stamp}`;
  if (await env.PLANNER_KV.get(marker)) return { backup: 'al gedaan' };
  const dump = {};
  for (const k of DOMAIN_KEYS) {
    const raw = await env.PLANNER_KV.get(k);
    dump[k] = raw ? JSON.parse(raw) : null;
  }
  dump._at = now.toISOString();
  // 60 dagen bewaren
  await env.PLANNER_KV.put(marker, JSON.stringify(dump), { expirationTtl: 60 * 24 * 3600 });
  return { backup: stamp };
}

export default {
  async scheduled(event, env, ctx) {
    const now = new Date();
    const done = [];
    try { done.push(await dailyBackup(env, now)); } catch (e) { console.error('cron backup faalde', e && e.message); }
    try { done.push(await retentiePurge(env, now)); } catch (e) { console.error('cron retentie faalde', e && e.message); }
    // TODO fase 2: sessieherinneringen
    // TODO fase 3: afwezigheidssignalering
    console.log('[cron]', now.toISOString(), JSON.stringify(done));
  },

  // Alleen lokaal testen: GET / triggert dezelfde logica. In productie uit
  // (workers.dev uitzetten / geen route), zodat niemand het ongeauthenticeerd kan aftrappen.
  async fetch(request, env) {
    if ((env.ENV || 'production') !== 'dev') return new Response('not found', { status: 404 });
    const done = [];
    done.push(await dailyBackup(env, new Date()).catch((e) => ({ error: String(e && e.message) })));
    done.push(await retentiePurge(env, new Date()).catch((e) => ({ error: String(e && e.message) })));
    return new Response(JSON.stringify(done), { headers: { 'content-type': 'application/json' } });
  },
};
