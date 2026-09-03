# Yippie Planner

Plannings- en inschrijfsysteem voor **Yippie voor de klas**: van inschrijving tot
roostering, communicatie en (later) aanwezigheid. Deze map is een losstaand
Cloudflare-Pages-project; het oude logboek staat ongewijzigd in `../logboek/`.

**Status: Fase 1 (MVP) + roostervoorstel.** Inschrijfformulier (vrije school met
suggesties, niveau/leerjaar, traject), beheer van scholen/vakken/jaarlagen/
begeleiders, beschikbaarheid, een weekrooster met greedy roostervoorstel en
knelpuntsignalering, persoonlijke indelingspagina en een alleen-lezen
schooloverzicht. E-mail (Gmail-OAuth), WebPush en aanwezigheid volgen in fase 2
en 3 (zie `docs/VRAGEN.md`).

## Stack (vastgelegd in de opdracht)

- Pure HTML + vanilla JS per pagina onder `public/<pagina>/index.html`, geen build.
- Zelf-gehoste Tailwind-subset (`public/vendor/tailwind.css`) + gedeeld
  design-systeem (`public/yp-design.css`), in de coral Yippie-portaalstijl.
- Eén Cloudflare Worker (`public/_worker.js`) voor alle `/api/*`-routes, auth en
  autorisatie. Opslag in Cloudflare KV, één JSON-object per domein-key.
- PWA: `manifest.webmanifest` + `sw.js` (HTML network-first, assets
  stale-while-revalidate).
- Losse `cron-worker/` draait elke 5 minuten (nu: dagelijkse KV-backup).

## Lokaal draaien

```
cd planner
npm install
npm run dev
```

Open http://localhost:8788. In dev-modus (`ENV=dev`) staat een seed-route aan:

```
curl -XPOST http://localhost:8788/api/dev/seed
```

Dat vult voorbeelddata en drie accounts:

| Rol | E-mail | Wachtwoord |
|---|---|---|
| Beheerder | `beheer@yippie.test` | `beheer1234` |
| Mentor (Stedelijk Lyceum) | `mentor@lyceum.test` | `mentor1234` |
| Begeleider | `trainer@yippie.test` | `begeleider1234` |

`curl -XPOST http://localhost:8788/api/dev/reset` wist alle keys weer.

## Documentatie

- [`docs/OPLEVERING.md`](docs/OPLEVERING.md) - lokaal draaien, deployen en de pre-go-live-checklist.
- [`docs/SETUP.md`](docs/SETUP.md) - Cloudflare-account, KV-namespace, secrets, deploy, Tailwind vervangen.
- [`docs/DATAMODEL.md`](docs/DATAMODEL.md) - KV-keys en JSON-structuur.
- [`docs/BEHEER.md`](docs/BEHEER.md) - het systeem beheren zonder developer.
- [`docs/AVG.md`](docs/AVG.md) - wat er wordt opgeslagen, toegang, bewaartermijn, verwijderen.
- [`docs/VRAGEN.md`](docs/VRAGEN.md) - antwoorden op de "vragen vooraf" uit de opdracht.

## Mapoverzicht

```
public/
  index.html              landing: rol kiezen / inloggen
  inschrijven/index.html   publiek inschrijfformulier
  mijn/index.html          persoonlijke indeling (token-link), afmelden
  beheer/index.html        Yippie: inschrijvingen, sessies, begeleiders, scholen, accounts
  resource/index.html      begeleider: eigen beschikbaarheid + eigen rooster
  school/index.html        school/mentor: alleen-lezen overzicht eigen leerlingen
  yp-design.css            design-systeem
  vendor/tailwind.css      zelf-gehoste utility-subset
  shared/                  api.js, dialog.js, me-badge.js, cmdk.js, version-check.js
  _worker.js               alle API-routes + auth + autorisatie
  _routes.json             Worker draait alleen op /api/*
  _headers                 security headers (CSP etc.)
  manifest.webmanifest, sw.js
cron-worker/               losse worker met cron-trigger (*/5)
wrangler.toml              Pages-config + KV-binding
```
