# Oplevering en livegang

Alles wat nodig is om de planner live te zetten en te draaien, op één plek.
Deployen is één wrangler-commando; terugdraaien is `git revert` + opnieuw
deployen.

## 1. Lokaal draaien (ontwikkelen)

```
cd planner
npm install
npm run dev            # http://localhost:8788, ENV=dev, lokale KV
```

Testdata + accounts:

```
curl -XPOST http://localhost:8788/api/dev/seed     # vult voorbeelddata
curl -XPOST http://localhost:8788/api/dev/reset    # wist alles (incl. rate-limit)
```

| Rol | E-mail | Wachtwoord |
|---|---|---|
| Beheerder | `beheer@yippie.test` | `beheer1234` |
| Mentor (Stedelijk Lyceum) | `mentor@lyceum.test` | `mentor1234` |
| Begeleider (K. Jansen) | `trainer@yippie.test` | `begeleider1234` |

De dev-wachtwoorden voldoen niet aan de productieregels (min. 10 tekens); dat is
alleen voor de seed.

`npm run check` doet een snelle zelfcontrole (headers, geen tokens in broncode,
`npm audit`).

## 2. Eenmalig: Cloudflare inrichten

```
npx wrangler login
npx wrangler kv namespace create PLANNER_KV
npx wrangler kv namespace create PLANNER_KV --preview
```

Zet de twee id's in **`wrangler.toml`** (`id`, `preview_id`) en dezelfde `id` in
**`cron-worker/wrangler.toml`**.

Secrets (niet in git, niet in `wrangler.toml`):

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # -> SESSION_SECRET
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put SEED_ADMIN_EMAIL
npx wrangler pages secret put SEED_ADMIN_PASS      # sterk; alleen nodig bij de eerste login
```

`ENV` staat op `production` via `[vars]` in `wrangler.toml`. **Zet die nooit op
`dev` in productie** - dan komen `/api/dev/seed` en `/api/dev/reset` beschikbaar.

## 3. Deploy

```
npx wrangler pages deploy public
npx wrangler deploy --config cron-worker/wrangler.toml
```

De eerste keer maakt wrangler het Pages-project (`yippie-planner`). Koppel daarna
in het dashboard de KV-namespace `PLANNER_KV` aan het Pages-project
(Settings -> Functions -> KV namespace bindings) als de binding uit
`wrangler.toml` niet is overgenomen.

## 4. Pre-go-live-checklist

- [ ] `SESSION_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASS` als Pages-secrets gezet
- [ ] `ENV = "production"` in `wrangler.toml`; `/api/dev/*` geeft `403`
- [ ] KV-namespace `PLANNER_KV` gebonden aan het Pages-project **en** de cron-worker
- [ ] `curl -I https://<project>` toont: `Strict-Transport-Security`,
      `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
      `Content-Security-Policy`, `Permissions-Policy`
- [ ] Cloudflare-zone: **Rate limiting rule** op `/api/*` + **Bot Fight Mode** aan
      (de app-teller is de tweede laag; optioneel Turnstile op `/inschrijven/`)
- [ ] cron-worker heeft **geen** `workers.dev`-route (de `fetch`-trigger geeft in
      productie `404`, maar zet de route helemaal uit)
- [ ] `git grep -n "token=" -- 'planner/*'` : geen auth-tokens in URL's in de logs
- [ ] Eerste login als `SEED_ADMIN_EMAIL` -> beheerder aangemaakt
- [ ] Beheer -> Scholen en vakken ingevuld (scholen, vakken, jaarlagen, blokken
      met begin/einddatum, groepsgrootte, `bewaarMaanden`)
- [ ] Beheer -> Begeleiders toegevoegd met vakken, jaarlagen, beschikbaarheid
- [ ] Beheer -> Accounts: mentor- en begeleider-accounts, wachtwoorden doorgegeven
- [ ] Verwerkersovereenkomst per school geregeld; bewaartermijn afgesproken
- [ ] Inschrijflink `https://<project>/inschrijven/` gedeeld

## 5. Beheer zonder developer

Zie `BEHEER.md`. Scholen, vakken, jaarlagen, blokken, begeleiders, accounts,
groepsgrootte en de bewaartermijn zijn allemaal in de UI in te stellen.

## 6. Terugdraaien

```
git revert <commit>
npx wrangler pages deploy public
```

De KV-data blijft; alleen de code gaat terug. Bewaar bij twijfel eerst een dump
(de cron-worker schrijft dagelijks `backup:<datum>`, 60 dagen TTL).

## 7. Nog in te richten (fase 2/3)

- **Gmail-API via OAuth** voor uitgaande mail: `GMAIL_CLIENT_ID` /
  `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` als Pages-secrets; `stubMail`
  vervangen. Zolang de secrets ontbreken verstuurt het systeem niets.
- **WebPush** (pure WebCrypto): VAPID-sleutelpaar als secret, subscriptions in
  KV-key `pushsubs`, versturen vanuit `_worker.js`, tonen via `sw.js`.
- **Cron-taken**: sessieherinneringen en afwezigheidssignalering in
  `cron-worker/src/index.js` (backup + retentie-purge draaien al).
