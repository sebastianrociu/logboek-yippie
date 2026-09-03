# Yippie voor de klas - repo

Twee losse projecten, bewust gescheiden:

| Map | Wat | Stack |
|---|---|---|
| [`logboek/`](logboek/) | Het bestaande logboek voor een inschrijfuur (Wiskundeschool). Ongewijzigd. | Eén self-contained HTML-bestand, client-side, GitHub Pages |
| [`planner/`](planner/) | Nieuw plannings- en inschrijfsysteem (opdracht). Fase 1 (MVP). | Cloudflare Pages + één Worker, KV, vanilla HTML/JS per pagina, PWA |

De opdracht staat in [`opdracht-planningssysteem-yippie.md`](opdracht-planningssysteem-yippie.md).
Projectafspraken en designtaal: [`CLAUDE.md`](CLAUDE.md).

## planner/ snel starten

```
cd planner
npm install
npm run dev        # npx wrangler pages dev public, met lokale KV-emulatie
```

Zie [`planner/docs/SETUP.md`](planner/docs/SETUP.md) voor deploy naar Cloudflare,
[`planner/docs/DATAMODEL.md`](planner/docs/DATAMODEL.md) voor de KV-structuur en
[`planner/docs/BEHEER.md`](planner/docs/BEHEER.md) voor het beheer.
