# Yippie Logboek + Portaal

Project van Sebastian voor **Yippie** (begeleiding op middelbare scholen).
Doel: één GitHub-repo die het **Yippie-portaal** namaakt/overneemt en er het
**Logboek** in verwerkt, met de juiste toegangsregels.

**Wat is Wiskundeschool?** Geen 1-op-1-bijles, maar een **inschrijfuur**:
leerlingen schrijven zich in (of worden ingeschreven door mentoren/docenten) en
werken aan hun vak, met een Yippie erbij voor vragen. Het logboek legt per
leerling vast wat die wanneer heeft gedaan, zodat de **school en mentoren** het
kunnen terugzien (die openen het logboek alleen-lezen).

Dit bestand is de bron van waarheid voor de opzet. Werk het bij als er iets
structureels verandert.

---

## 1. Wat er is en wat er komt

| Onderdeel | Status | Bestand(en) |
|---|---|---|
| **Logboek** (per leerling loggen wat die in het inschrijfuur deed) | Werkt | `logboek.html` |
| **Portaal** (login -> dashboard -> gated logboek) | v1 werkt | `index.html`, `dashboard.html`, `portaal-data.js` |
| **Toegangspoort** (logboek vanaf 1e planning op Wiskundeschool) | Werkt | in `index.html` (vlag) + `logboek.html` (check) |
| **Rol mentor/school = alleen-lezen logboek** | Werkt | `logboek.html` (`READONLY`) |
| **Beveiliging & AVG-doorlichting** | Opgeleverd | artifact, zie §7 |
| Gescrapete kopie van het echte portaal | Referentie | `portaal.yippievoordeklas.nl/` (HTTrack, niet deployen) |
| **Mentor-mail** (wekelijkse update naar klasmentor) | Te bouwen | zie §5 |
| Dashboard verfijnen (meer secties uit origineel) | Kan later | `dashboard.html` |

**Live:** `https://sebastianrociu.github.io/logboek-yippie/` - de repo-root is nu
het **portaal-inlogscherm**. Na inloggen kom je op `dashboard.html`; het logboek
(`logboek.html`) is alleen bereikbaar met een sessie én toegang (§4).
Op `localhost`/`file:` slaat `logboek.html` de poort over zodat losstaand
ontwikkelen kan (`DEV`-vlag).

**Rollen:** `sessie.rol` = `yippie` (vol) of `mentor`/`school` (alleen-lezen:
geen compose, geen Beheer, geen verwijderen; gele "alleen-lezen"-balk).
De school/mentoren kunnen de notities dus wél inzien, niet wijzigen.

---

## 2. Repo-structuur

**Nu**

```
index.html                       het logboek (één self-contained bestand)
README.md
CLAUDE.md                        dit bestand
portaal.yippievoordeklas.nl/     HTTrack-scrape van het echte portaal (referentie)
```

**Gepland** (na de portaal-bouw)

```
index.html            portaal-entree: geen sessie -> login, wel sessie -> dashboard
dashboard.html        dashboard (Vandaag / Mijn week / Meer)
logboek.html          het huidige index.html, hierheen verplaatst
assets/               gedeelde css/js/afbeeldingen (portaal-stijl, self-hosted font)
portaal.yippievoordeklas.nl/   blijft als referentie, wordt niet geserveerd
```

GitHub Pages serveert de root; alles client-side; één deploy.

---

## 3. Het logboek (`index.html` / straks `logboek.html`)

Eén self-contained HTML-bestand, geen build, geen backend. Data in
`localStorage` sleutel `logboek_yippie_v1`. Favicon + logo zijn inline
data-URI's (favicon = het portaal-icoon `icon-yippie.svg`).

**Datamodel**

```
state = {
  organisatie: "Wiskundeschool",         // de "les" (naam)
  schooljaar:  "2026–2027",              // constante, niet meer wijzigbaar
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

**Belangrijkste gedrag**

- **Contextbalk** = één keuzemenu `Les (School)`, bijv. `Wiskundeschool (Helen Parkhurst)`.
  Van les wisselen schakelt mee naar de bijbehorende school. "Nieuwe les" vraagt de pincode.
- **Beheer** (tandwiel, pincode `BEHEER_PIN = "0000"`): scholen toevoegen/verwijderen,
  klassen & mentoren, lesuren-rooster. Plus "Alles wissen en opnieuw beginnen".
  **Schooljaar staat er niet meer in** - komt later via portaal-brede regels.
- **Nieuwe leerling**: naam + klas typen. Klascode wordt in hoofdletters gezet;
  mentor vult zich vanzelf in als de klas bekend is, anders typ je 'm zelf (en dan
  wordt de klas aangemaakt). Naam wordt genormaliseerd (`sanne de vries` →
  `Sanne de Vries`, tussenvoegsels klein). Dubbele leerling (zelfde naam+klas,
  hoofdletterongevoelig) wordt geweigerd, venster blijft open.
- **Toast** rendert via de Popover-API in de top-layer (ook boven een open dialoog).
- **Uitleg** = `?`-knop in de header, opent `#introDialog`. Verschijnt de eerste
  keer automatisch (`localStorage["logboek_yippie_intro"]`).
- **Pincode `0000`** is een rem tegen per-ongeluk, **geen beveiliging** (staat leesbaar
  in de bron). Echte rollen horen in het portaal.

**Ontwerp** = de echte Yippie-portaal-stijl, overgenomen uit
`portaal.yippievoordeklas.nl/dashboard/index.html` (`<style>`) +
`yp-designd1a7.css` + `yp-dialog.js`. Coral `#E8735A`, Inter, coral-header met
`.hdr-wave`-uitsparing, kaarten radius 20, native `<dialog>`.

**Werkafspraken voor de UI-copy**

- **Geen em-dash of losse en-dash** in zichtbare tekst; gebruik een gewoon
  koppelteken of herschrijf de zin. En-dash alleen in echte getalreeksen
  (`2026-2027`, `08:30-09:30`).
- Geen emoji in knop-/statustekst.
- Kort, feitelijk, actief. Een knop zegt wat er gebeurt.

---

## 4. Het portaal (te bouwen)

**Aanpak:** het echte portaal **trouw namaken** in dezelfde stijl, client-side,
met een nep-dataset - niet de HTTrack-code proberen te repareren (die hangt aan
een echte `/api`). Zoveel mogelijk **onderdelen** van het origineel overnemen.

### Flow

```
index.html (entree)
  ├─ geen sessie  → login: e-mail/wachtwoord (accepteert alles) OF snelkeuze demo-account
  └─ sessie       → dashboard.html

dashboard.html
  ├─ Header: begroeting · naam · datum · profiel-initialen
  ├─ Vandaag:   diensten van vandaag uit het nep-rooster, met incheck-knop (toast)
  ├─ Mijn week: 7 dagen rooster, vorige/volgende week
  ├─ Meer:      Beschikbaarheid · Mijn profiel · (evt. later meer)
  └─ Logboek-tegel:
       toegang?  → "Open het logboek →"  (link naar logboek.html)
       geen?     → grijs, "Beschikbaar zodra je op Wiskundeschool bent ingepland"

logboek.html
  bij laden: geen sessie of geen toegang → terug naar dashboard.html
```

### Toegangspoort

> "Je krijgt toegang vanaf het eerste moment dat je op Wiskundeschool staat gepland."

- Bij inloggen wordt uit het nep-rooster afgeleid of het account **ooit** een
  dienst op **Wiskundeschool** heeft (verleden of gepland).
- Zo ja: `localStorage["yippie_logboek_toegang"] = "1"` - blijft daarna staan,
  ook als de planning verandert.
- De logboek-tegel en `logboek.html` checken die vlag + een geldige sessie.
- Dit is **client-side** en dus te omzeilen door localStorage aan te passen.
  Dat is inherent aan een statische demo; in de echte versie doet de server dit
  (zie de doorlichting). Voor de presentatie is het genoeg.

### Demo-accounts (snelkeuze op het loginscherm)

| Account | Rooster bevat Wiskundeschool? | Logboek |
|---|---|---|
| Yippie mét planning op Wiskundeschool | ja | ontgrendeld |
| Yippie zonder die planning | nee | vergrendeld |
| Vrije e-mail/wachtwoord | nee | vergrendeld |

### Wat overnemen van het echte portaal

Uit `portaal.yippievoordeklas.nl/dashboard/index.html`:

- **Wel:** loading/error-schermen, header met golf, secties *Vandaag* / *Mijn week*
  / *Meer*, de dienst-kaart met incheck-knop, week-navigatie, profiel-sheet
  (naam tonen, uitloggen), `yp-dialog`-stijl modals.
- **Voorlopig niet (documenteren als "kan later"):** declaraties, betalingen,
  statistieken, verlof, ruildiensten, referral, coördinator-omgeving, PWA-install-prompts,
  Cmd+K-palet. Deze zijn in het origineel rol- of contract-afhankelijk en voor de
  demo niet nodig.

Sessie in `localStorage["yippie_portaal_sessie"] = { naam, email, rollen, ... }`.
Uitloggen wist sessie (+ evt. `yippie_logboek_toegang` laten staan of ook wissen -
kiezen bij de bouw; laten staan is dichter bij "vanaf het eerste moment").

---

## 5. Mentor-mail (te bouwen)

> Als beheerder een mailtje kunnen sturen naar de mentor(en) van een klas,
> bijv. wekelijks één update met hoe het gaat.

**Gewenst eindbeeld:** **elke week automatisch** een mail per klas naar de
mentor(en), maar alleen als er die week leerlingen bij de les zijn geweest en er
notities zijn toegevoegd. Automatisch versturen kan niet client-side (geen
server, geen cron) - dat hoort bij de portaal-backend.

**Nu haalbaar (client-side):** in Beheer of op de klas een knop **"Mail de mentor"**.
Die stelt een `mailto:`-link samen met:

- ontvanger: het mentor-veld van de klas (als dat een e-mail is; anders leeg laten
  en de beheerder vult 'm in),
- onderwerp: `Update Wiskundeschool <klas> - week <nr>`,
- body: een lijstje per leerling met de notities van die klas van de afgelopen
  7 dagen (datum + korte notitie), plus een korte kop.

De beheerder controleert en verstuurt vanuit z'n eigen mailclient. Geen server,
geen sleutel in de site.

**Later (met portaal-backend):**

- Echt versturen via de portaal-mailservice.
- Wekelijkse **automatische samenvatting** van de notities per klas, gegenereerd
  door een taalmodel (zie §6), die de beheerder alleen nog hoeft te controleren
  en goed te keuren.
- Opt-out per mentor, en logging van wat verstuurd is (audit).

---

## 6. Model- en kostenbeleid

"Zoveel mogelijk goedkope modellen waar het kan."

- **Standaard `claude-haiku-4-5`** voor alles wat samenvat, herschrijft of
  classificeert: de mentor-mail-samenvatting, notitie-opschoning, tekstsuggesties.
- Groter model (`claude-sonnet-5`) alleen als de kwaliteit aantoonbaar tekortschiet
  op een concrete taak - en dan gericht, niet als default.
- **Geen model-aanroepen vanuit de statische site.** Er hoort geen API-sleutel in
  client-code. AI-functies draaien server-side (portaal-backend) of als aparte
  goedgekeurde stap. Tot die er is: `mailto:` en handmatig.
- Prompts kort houden, alleen de nodige notities meesturen (dataminimalisatie telt
  ook hier), geen leerlingnamen naar een model sturen als een nummer/initiaal volstaat.

---

## 7. Beveiliging & AVG - samenvatting

Volledige doorlichting (bevindingen op ernst + AVG-checklist + passieve check van
het echte portaal): **artifact `Doorlichting Logboek Yippie`**
(`https://claude.ai/code/artifact/7d35c06d-eeb4-4b20-8a0c-9a48aea150a1`).

Kernpunten om vast te houden:

- **Demo met testdata lekt niets** (geen server, data alleen in de eigen browser).
  Risico ontstaat zodra er **echte leerlinggegevens** op publieke GitHub Pages komen.
- Alle Pages van dit account delen één origin (`sebastianrociu.github.io`) - een
  tweede project kan meelezen. Echte data hoort achter login op EU-opslag.
- **Font self-hosten** (nu via Google Fonts → lekt bezoekers-IP naar Google).
- Pincode `0000` = rem, geen beveiliging (staat leesbaar in de bron).
- Het **echte portaal** ziet er van buitenaf degelijk uit: `/api` achter server-sessie,
  `401` zonder login, strakke CSP, geen CORS-gat, Cloudflare ervoor. Aanscherpen:
  CSP zonder `'unsafe-inline'`/`'unsafe-eval'`, HSTS-header, `ACAO: *` van de
  login-pagina halen. Een echte uitspraak vraagt een ingelogde pentest.
- **AVG:** school = verwerkingsverantwoordelijke, Yippie = verwerker →
  verwerkersovereenkomst per school. Alleen **naam + klas** opslaan (leerlingnummer
  via Somtoday niet haalbaar; pas later pseudonimiseren). Notities feitelijk en over
  schoolwerk. Bewaartermijn afspreken + automatiseren. Rechten-proces (inzage /
  correctie / verwijdering) via de school. Lichte DPIA aangeraden (minderjarigen +
  beoordelende aantekeningen). Yippies transparant informeren wat van hen wordt
  vastgelegd en waarvoor.
- De **toegangspoort** (alleen zien wie je begeleidt) is meteen goede
  dataminimalisatie.

---

## 8. Roadmap / volgorde

1. **Logboek** - af, live. (klein onderhoud kan altijd)
2. **Portaal-skelet** - `index.html` (login + demo-accounts), `dashboard.html`
   (Vandaag / Mijn week / Meer), sessie in localStorage.
3. **Logboek verplaatsen** naar `logboek.html`, root wordt de portaal-entree.
4. **Toegangspoort** - afleiden uit nep-rooster, vlag zetten, tegel + `logboek.html`
   checken.
5. **Dashboard verfijnen** - meer secties uit het echte portaal overnemen zolang ze
   met nep-data zinnig zijn.
6. **Mentor-mail** - `mailto:`-versie in Beheer.
7. **Font self-hosten**, `noindex` op de demo zolang die publiek staat.
8. **Later, met backend:** echte auth + EU-opslag, echt mailen, AI-samenvatting
   (Haiku), bewaartermijn, audit-log.

---

## 9. Testen

- Lokaal: `python3 -m http.server` in de repo, openen in de browser.
- Fris beginnen: DevTools → Application → Local Storage wissen, of in Beheer
  "Alles wissen en opnieuw beginnen".
- Commit alleen `index.html` / de portaal-bestanden bewust (er is geen
  `.gitignore`; gebruik `git add <bestand>`, niet `-A`, i.v.m. `.DS_Store`).
- Commit-conventie: korte Nederlandse samenvatting, co-author-trailer zoals
  ingesteld.
