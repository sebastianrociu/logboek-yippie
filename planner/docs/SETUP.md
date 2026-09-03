# Setup en deploy

Alles draait bij Cloudflare Pages met één Worker. Deployen is één
wrangler-commando; terugdraaien is een git-revert plus opnieuw deployen.

## 1. Eenmalig: account en KV-namespace

```
npm install                     # in planner/
npx wrangler login              # opent de browser

# KV-namespace aanmaken (productie + preview)
npx wrangler kv namespace create PLANNER_KV
npx wrangler kv namespace create PLANNER_KV --preview
```

Zet de twee id's die je terugkrijgt in **`wrangler.toml`** bij
`[[kv_namespaces]]` (`id` en `preview_id`) en dezelfde `id` in
**`cron-worker/wrangler.toml`**.

## 2. Secrets

Niet in git, niet in `wrangler.toml`. Zet ze als Pages-secrets:

```
npx wrangler pages secret put SESSION_SECRET     # lange willekeurige string (HMAC-sleutel sessiecookie)
npx wrangler pages secret put SEED_ADMIN_EMAIL   # e-mail van de eerste beheerder
npx wrangler pages secret put SEED_ADMIN_PASS    # sterk wachtwoord; alleen nodig bij de eerste login
```

`ENV` staat op `production` via `[vars]` in `wrangler.toml`. Zet die nooit op
`dev` in productie: dan komen de `/api/dev/*`-routes (seed, reset) beschikbaar.

Genereer een `SESSION_SECRET` bijvoorbeeld met:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Verander je `SESSION_SECRET` later, dan zijn alle bestaande sessies ongeldig
(gebruikers moeten opnieuw inloggen).

## 3. Deploy

```
npx wrangler pages deploy public          # de app
npx wrangler deploy --config cron-worker/wrangler.toml   # de cron-worker
```

De eerste keer maakt wrangler het Pages-project aan (naam `yippie-planner`).
Koppel daarna in het Cloudflare-dashboard de KV-namespace `PLANNER_KV` aan het
Pages-project (Settings -> Functions -> KV namespace bindings) als de binding uit
`wrangler.toml` niet automatisch is overgenomen.

## 4. Eerste keer inrichten

1. Ga naar `https://<project>.pages.dev/`, kies **Beheer (Yippie)** en log in met
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASS`. Daarmee wordt de beheerder aangemaakt.
2. Tabblad **Scholen en vakken**: voeg scholen, vakken, jaarlagen en een periode
   toe, en stel de groepsgrootte in.
3. Tabblad **Begeleiders**: voeg begeleiders toe met hun vakken, jaarlagen en
   beschikbaarheid.
4. Tabblad **Accounts**: maak mentor- en begeleider-accounts en geef die mensen
   hun tijdelijke wachtwoord door.
5. Deel de inschrijflink `https://<project>.pages.dev/inschrijven/`.

## Lokaal ontwikkelen

```
npm run dev        # wrangler pages dev public, met lokale KV-emulatie + ENV=dev
npm run cron:dev   # cron-worker lokaal, met --test-scheduled
```

De dev-run zet ENV=dev en dummy-secrets; `POST /api/dev/seed` vult testdata.

## Tailwind vervangen

`public/vendor/tailwind.css` is nu een met de hand samengestelde subset (geen
toolchain), met Tailwind-compatibele klassenamen. Wil je later de echte build:

```
npx tailwindcss -i tailwind-src.css -o public/vendor/tailwind.css --minify
```

met een `content`-glob op `public/**/*.html`. De pagina's hoeven dan niet te
veranderen. Laad Tailwind nooit via een CDN of `@import` naar een externe host
(CSP blokkeert dat, en het lekt bezoekers-IP's).

## Fase 2/3 (nog in te richten)

- **Gmail API via OAuth** voor uitgaande mail. Zet client-id/secret en
  refresh-token als Pages-secrets; de mailfunctie hoort in `_worker.js`
  (`stubMail` vervangen). Nu logt de Worker alleen de intentie.
- **WebPush in pure WebCrypto**: VAPID-sleutelpaar als secret, subscriptions in
  KV-key `pushsubs`, versturen vanuit `_worker.js`, tonen via `sw.js`
  (`push`-handler staat al klaar).
- **Cron-taken**: sessieherinneringen en afwezigheidssignalering in
  `cron-worker/src/index.js` (haken staan als TODO klaar).
