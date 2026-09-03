# Yippie Logboek

Project van Sebastian voor **Yippie** (begeleiding op middelbare scholen).

Dit bestand is de bron van waarheid voor de opzet. Werk het bij als er iets
structureels verandert.

---

## 0. Repo-indeling (twee losse projecten)

De repo is gesplitst in twee mappen die niets van elkaar hoeven te weten:

- **`logboek/`** - het logboek waar de rest van dit bestand over gaat. Ongewijzigd
  self-contained HTML, client-side, GitHub Pages. (Stond eerder in de repo-root;
  de live URL serveert nu vanaf `/logboek/`.)
- **`planner/`** - het **plannings- en inschrijfsysteem** (werkgeveropdracht
  `opdracht-planningssysteem-yippie.md`). Aparte stack: Cloudflare Pages + één
  Worker, KV, vanilla HTML/JS per pagina, PWA. Fase 1 (MVP) staat er. Eigen
  documentatie in `planner/docs/` en `planner/README.md`. Deelt de designtaal
  (coral portaal-stijl) via `planner/public/yp-design.css`.

De rest van dit bestand beschrijft **alleen het logboek**.

---

## 1. Wat is dit

**Wiskundeschool** = geen 1-op-1-bijles maar een **inschrijfuur**: leerlingen
schrijven zich in (of worden ingeschreven door mentoren/docenten) en werken aan
hun vak, met een Yippie erbij voor vragen.

Het **logboek** legt per leerling vast wat die heeft gedaan, zodat de **school
en mentoren** kunnen meelezen. **Aanwezigheid gaat via Somtoday** - het logboek
is puur voor de notities. Niet toevoegen: aanwezigheidsregistratie.

### Bestanden

```
index.html    het logboek (één self-contained bestand, geen build/backend)
rollen.html   voorbeeldweergave: bekijk het logboek als elke rol
README.md
CLAUDE.md     dit bestand
```

Live: `https://sebastianrociu.github.io/logboek-yippie/`. Alles client-side,
data in `localStorage` sleutel `logboek_yippie_v1`.

---

## 2. Rollen

Het logboek leest `localStorage["yippie_portaal_sessie"]` = `{ rol, naam, klas? }`.
**Zonder sessie: gewone Yippie-weergave.** `rollen.html` zet die sessie en
opent `index.html`; rechtsboven staat dan "Andere rol" terug naar `rollen.html`.

| rol | in het logboek |
|---|---|
| (geen) / `yippie` | volledige toegang; Beheer achter pincode `0000` |
| `beheer` | zelfde, maar **Beheer opent zonder pincode** (`askPin()` geeft meteen `true` als `isBeheer`); blauwe balk bovenaan |
| `mentor` / `school` | **alleen-lezen** (`html.readonly`: geen compose, geen Beheer, geen verwijderen); gele balk |
| + `klas` erbij | de lijst en het detail zijn beperkt tot die ene klas (`rolKlas`) |

`rollen.html` laadt bij een lege installatie een kleine voorbeelddataset
(klas TV17 met M. de Wit als mentor, wat leerlingen met notities) zodat elke
rol-weergave iets te zien heeft. Bestaande data wordt niet overschreven.

---

## 3. Datamodel

```
state = {
  organisatie: "Wiskundeschool",         // de "les" (naam)
  schooljaar:  "2026-2027",              // constante, niet wijzigbaar in de app
  lessen: [{ naam, school }],            // elke les hoort bij één school
  school: "<actieve school>",
  scholen: {
    "<schoolnaam>": {
      klassen:    { "<KLAS>": { mentor } },
      leerlingen: [{ id, naam, klas, entries:[{id,datum,lesVan,lesTot,lesuren,van,tot,notitie}] }],
      prullenbak: [ ... ]
    }
  },
  roosters: { "<school>": [{n,van,tot}] },  // override op het vaste BELROOSTER
  drafts:   { "<leerlingId>": {...} }
}
```

`normalize()` migreert oudere vormen. `function aanwezigheid(e)` in de code is
een **misnomer**: geeft "lesuren · tijd" terug, niets met presence. Niet gebruiken.

### Belangrijkste gedrag

- **Contextbalk** = één keuzemenu `Les (School)`. Van les wisselen schakelt mee
  naar de bijbehorende school.
- **Beheer** (tandwiel, pincode `0000`): scholen, lessen, klassen & mentoren,
  lesuren-rooster, en "Alles wissen en opnieuw beginnen". **Nieuwe les alleen
  hier** (niet meer in het keuzemenu). Schooljaar staat er niet in.
- **Nieuwe leerling**: naam + klas typen. Klascode wordt hoofdletters; mentor
  vult zich vanzelf in bij een bekende klas, anders typ je 'm zelf (klas wordt
  dan aangemaakt). Naam genormaliseerd (`sanne de vries` -> `Sanne de Vries`,
  tussenvoegsels klein). Dubbele leerling (zelfde naam+klas) wordt geweigerd.
- **Toast** via de Popover-API (valt ook boven een open dialoog).
- **Uitleg** = `?`-knop in de header (`#introDialog`), eerste keer automatisch.

### Ontwerp

De echte Yippie-portaal-stijl: coral `#E8735A`, Inter, coral-header met
`.hdr-wave`-uitsparing, kaarten radius 20, native `<dialog>` in `yp-dialog`-stijl.

### UI-copy-afspraken

- **Geen em-dash of losse en-dash** in zichtbare tekst; koppelteken of
  herschrijven. En-dash alleen in getalreeksen.
- Geen emoji in knop-/statustekst.
- Kort, feitelijk, actief, rustig. Een knop zegt wat er gebeurt.
- Niet zeggen dat het "1-op-1" is; niet over "huiswerkklas". Het gaat **per
  leerling** om notities.

---

## 4. Later (niet nu bouwen, wel bedacht)

- **Portaal terug**: login -> dashboard -> logboek achter toegang (zat in git
  t/m commit `a8ccae0`, daarna verwijderd). Toegang zodra je op Wiskundeschool
  gepland staat.
- **Mentor-mail**: wekelijks per klas een mail naar de mentor(en) met de
  notities van die week, alleen als er die week iets is genoteerd. Automatisch
  versturen hoort bij een backend; client-side kan een `mailto:` met een
  samenvatting.
- **Model-/kostenbeleid** voor AI-features: `claude-haiku-4-5` waar het kan
  (samenvatten, herschrijven); groter model alleen als de kwaliteit echt
  tekortschiet. **Nooit een API-sleutel in client-code**; AI draait server-side.

---

## 5. Beveiliging & AVG

Volledige doorlichting (bevindingen + AVG-checklist + passieve check van het
echte portaal + pentest-checklist): artifact **Doorlichting Logboek Yippie**
(`https://claude.ai/code/artifact/7d35c06d-eeb4-4b20-8a0c-9a48aea150a1`).

Kort:

- **Demo met testdata lekt niets** (geen server, data alleen in de eigen
  browser). Risico ontstaat zodra er **echte leerlinggegevens** op publieke
  GitHub Pages komen, of een tweede project op hetzelfde `github.io`-adres.
- **Font self-hosten** (nu via Google Fonts -> lekt bezoekers-IP).
- Pincode `0000` = rem, geen beveiliging (leesbaar in de bron).
- **AVG**: school = verwerkingsverantwoordelijke, Yippie = verwerker ->
  verwerkersovereenkomst per school. Alleen **naam + klas** opslaan
  (leerlingnummer via Somtoday niet haalbaar; later pseudonimiseren). Notities
  feitelijk en over schoolwerk. Bewaartermijn afspreken. Lichte DPIA aangeraden
  (minderjarigen + beoordelende aantekeningen).
- Echte versie hoort achter login op EU-opslag met toegang op need-to-know.

---

## 6. Testen

- Lokaal: `python3 -m http.server` in de repo, openen in de browser.
- Fris beginnen: DevTools -> Application -> Local Storage wissen, of in Beheer
  "Alles wissen en opnieuw beginnen".
- Er is geen `.gitignore`; stage bestanden expliciet (`git add <bestand>`,
  niet `-A`) i.v.m. `.DS_Store`.
- Commit-conventie: korte Nederlandse samenvatting + de ingestelde
  co-author-trailer.
