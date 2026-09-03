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
    try {
      done.push(await dailyBackup(env, now));
    } catch (e) {
      console.error('cron backup faalde', e && e.stack || e);
    }
    // TODO fase 2: sessieherinneringen
    // TODO fase 3: afwezigheidssignalering
    console.log('[cron]', now.toISOString(), JSON.stringify(done));
  },

  // handig voor lokaal testen: GET / triggert dezelfde logica
  async fetch(request, env) {
    const done = await dailyBackup(env, new Date()).catch((e) => ({ error: String(e) }));
    return new Response(JSON.stringify(done), { headers: { 'content-type': 'application/json' } });
  },
};
