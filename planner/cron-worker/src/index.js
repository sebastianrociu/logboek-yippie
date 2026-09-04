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

// Retentie (AVG): geannuleerde/afgeronde inschrijvingen ouder dan config
// instellingen.bewaarMaanden opschonen, inclusief cascade uit rooster + aanwezigheid.
async function retentiePurge(env, now) {
  const raw = await env.PLANNER_KV.get('inschrijvingen');
  if (!raw) return { purge: 'geen data' };
  const ins = JSON.parse(raw);
  let cfg = {};
  try { cfg = JSON.parse((await env.PLANNER_KV.get('config')) || '{}'); } catch { /* ignore */ }
  const maanden = (cfg.instellingen && cfg.instellingen.bewaarMaanden) || 18;
  const grens = new Date(now.getTime() - maanden * 30 * 24 * 3600 * 1000).toISOString();
  const wegIds = new Set();
  ins.items = (ins.items || []).filter((r) => {
    const oud = (r.ts || '') < grens;
    const klaar = r.status === 'geannuleerd' || r.status === 'afgerond';
    if (oud && (klaar || r.verwijderVerzocht)) { wegIds.add(r.id); return false; }
    return true;
  });
  if (!wegIds.size) return { purge: 0 };
  ins.tombstones = ins.tombstones || {};
  for (const id of wegIds) ins.tombstones[id] = now.getTime();
  ins._rev = (ins._rev || 0) + 1; ins._at = now.toISOString();
  await env.PLANNER_KV.put('inschrijvingen', JSON.stringify(ins));
  let leegeSessies = new Set();
  const rraw = await env.PLANNER_KV.get('rooster');
  if (rraw) {
    const rooster = JSON.parse(rraw);
    for (const s of (rooster.sessies || [])) {
      s.leerlingIds = (s.leerlingIds || []).filter((x) => !wegIds.has(x));
      if (!s.leerlingIds.length) leegeSessies.add(s.id);
    }
    rooster._rev = (rooster._rev || 0) + 1; rooster._at = now.toISOString();
    await env.PLANNER_KV.put('rooster', JSON.stringify(rooster));
  }
  const araw = await env.PLANNER_KV.get('aanwezigheid');
  if (araw) {
    const aanw = JSON.parse(araw);
    for (const sid of Object.keys(aanw.perSessie || {})) for (const id of wegIds) delete aanw.perSessie[sid][id];
    // notitie van een sessie die door de purge leeg raakte, mag ook weg
    for (const sid of leegeSessies) if (aanw.notities) delete aanw.notities[sid];
    aanw._rev = (aanw._rev || 0) + 1; aanw._at = now.toISOString();
    await env.PLANNER_KV.put('aanwezigheid', JSON.stringify(aanw));
  }
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
