# Vibe Code Opdracht: Plannings- & Inschrijfsysteem voor Yippie voor de klas

## Over ons

Yippie voor de klas organiseert examentrainingen en bijspijkersessies voor middelbare scholieren. Leerlingen van verschillende scholen schrijven zich in voor sessies per vak en jaarlaag. Wij plannen deze sessies in op basis van de voorkeuren van leerlingen en de beschikbaarheid van onze docenten, examentrainers en ondersteuners. Op dit moment doen we dit grotendeels handmatig, en dat willen we automatiseren.

## De opdracht

Bouw een webapplicatie die het hele proces ondersteunt: van inschrijving tot roostering, communicatie en aanwezigheidsregistratie. Je mag AI-tools (vibe coding) gebruiken zoals je zelf wilt. We beoordelen op werkend resultaat, gebruiksvriendelijkheid en onderhoudbaarheid, niet op hoe de code tot stand is gekomen.

De **architectuur en stack liggen wél vast**: dit systeem sluit aan bij ons bestaande platform en volgt dezelfde conventies en principes (zie *Technische uitgangspunten* hieronder). Afwijken kan alleen in overleg en met goede argumenten.

## Functionele eisen

### 1. Inschrijving van leerlingen

Leerlingen (of hun ouders) schrijven zich in via een formulier met de volgende combinatie:

- **School** (uit een beheerbare lijst)
- **Jaarlaag** (bijv. 3 havo, 5 vwo, 4 vmbo-tl)
- **Vak(ken)** (meerdere vakken per inschrijving mogelijk)
- **Periodevoorkeur**. Dit is flexibel, denk aan:
  - Voorkeursdagen (bijv. alleen zaterdagen, alleen zondagen, beide)
  - Voorkeursperiode (bijv. januari t/m maart, of vlak voor de examenperiode)
  - Eventueel dagdelen (ochtend/middag)

Daarnaast: contactgegevens van leerling én ouder/verzorger, en de naam van de mentor of contactpersoon op school.

### 2. Beschikbaarheid van resources

Beheerders moeten per resource (docent, examentrainer, ondersteuner) kunnen vastleggen:

- Welke vakken en jaarlagen diegene kan bedienen
- Beschikbaarheidsrooster (datums, dagen, dagdelen)
- Maximale inzet (bijv. max. aantal sessies per weekend)

### 3. Roostering

Het hart van het systeem. Op basis van de inschrijvingen en de beschikbaarheid van resources moet een rooster gegenereerd (of ondersteund samengesteld) kunnen worden:

- Groepeer leerlingen met dezelfde combinatie school/jaarlaag/vak/periodevoorkeur in sessiegroepen (met een instelbare minimale en maximale groepsgrootte)
- Match sessiegroepen aan beschikbare resources
- Signaleer conflicten en knelpunten (bijv. te weinig beschikbaarheid voor een vak, of leerlingen die nergens in passen)
- De planner moet het gegenereerde voorstel handmatig kunnen aanpassen voordat het definitief wordt. Volledige automatisering is een pre, maar een goed "voorstel + handmatig bijschaven"-flow is prima voor de eerste versie

### 4. Communicatie van de indeling

Zodra het rooster definitief is:

- Leerlingen en ouders ontvangen hun persoonlijke indeling (per e-mail, en/of via een persoonlijke pagina/link)
- Bij wijzigingen worden betrokkenen automatisch geïnformeerd
- Resources zien hun eigen rooster

### 5. Aanwezigheidsregistratie

- Per sessie kan de docent/trainer of ondersteuner de aanwezigheid afvinken (aanwezig / afwezig / afgemeld)
- Overzicht per leerling over de hele periode
- Signalering bij herhaalde afwezigheid

### 6. Terugkoppeling naar school/mentor

- Per school en per mentor moet een overzicht gedeeld kunnen worden van deelname en aanwezigheid van hun leerlingen
- Denk aan een export (PDF/Excel) of een beveiligde inzagepagina per school
- De school ziet alleen de eigen leerlingen

## Rollen

| Rol | Kan |
|---|---|
| Beheerder (Yippie) | Alles: scholen, vakken, resources, roostering, communicatie, rapportages |
| Resource (docent/trainer/ondersteuner) | Eigen beschikbaarheid beheren, eigen rooster inzien, aanwezigheid registreren |
| Leerling/ouder | Inschrijven, eigen indeling inzien, afmelden voor een sessie |
| School/mentor | Overzicht van eigen leerlingen inzien (deelname + aanwezigheid) |

## Technische uitgangspunten (verplicht)

We bouwen bewust simpel en serverless. Dit zijn geen suggesties maar de kaders van de opdracht.

### Frontend

- **Pure HTML + vanilla JavaScript per pagina** (`public/<pagina>/index.html`). Geen React, Vue of Angular, geen build-stap, geen npm-bundels. Elke pagina is één zelfstandig HTML-bestand met z'n eigen script. Wat je in de code ziet, is letterlijk wat de browser draait.
- **Tailwind CSS voor de opmaak**, maar als kant-en-klaar, zelf-gehost bestand (`public/vendor/tailwind.css`), niet via de toolchain. Daarbovenop ligt één gedeeld design-systeem (`yp-design.css`). Gebruik dat, zodat de nieuwe pagina's er hetzelfde uitzien als de rest.
- **Gedeelde scripts hergebruiken** voor dingen die overal terugkomen: de topbar (`me-badge.js`), Cmd+K-zoeken, versie-check, dialogen en het check-in-vangnet. Vind niets opnieuw uit wat er al ligt.
- **PWA**: manifest + service worker (`sw.js`) maken er een installeerbare app van, met de bestaande cache-strategie (HTML altijd vers, assets stale-while-revalidate) en push-notificaties.

### Backend

- **Cloudflare Pages + één Worker** (`public/_worker.js`): alle API-routes, authenticatie, autorisatie en mail-logica draaien in één bestand aan de rand van Cloudflare's netwerk. Geen aparte server, geen Node-backend, niets om te patchen of te herstarten.
- **Cloudflare KV als opslag**: de hoofddatabase is één JSON-blob, met aparte keys voor gescheiden domeinen. Geen SQL-database. Voor dit project betekent dat waarschijnlijk eigen keys voor bijv. inschrijvingen, resources/beschikbaarheid, rooster en aanwezigheid.
- **Let op: KV kent geen transacties.** Gelijktijdige schrijfacties (bijv. twee begeleiders die tegelijk aanwezigheid afvinken, of meerdere inschrijvingen in dezelfde seconde) moeten defensief worden afgevangen volgens de bestaande patronen: optimistic locking (`_rev`), defensieve merges per sectie, tombstones, per-worker-stempels en schrijf-verificatie (verify-retries).
- **WebPush in pure WebCrypto** (geen library) voor notificaties, en **Gmail API via OAuth** voor alle uitgaande mail (indelingen, wijzigingen, herinneringen).
- **Cron-worker** (`cron-worker/`) draait elke 5 minuten en trapt geplande taken af. Sluit daarop aan voor zaken als sessieherinneringen, afwezigheidssignalering en backups.

### De principes erachter

1. **Zo min mogelijk bewegende delen**: geen frameworks, geen build-pipeline, geen dependencies die verouderen. Deployen is één wrangler-commando; terugdraaien is één git-revert.
2. **Serverless & onderhoudsvrij**: alles draait bij Cloudflare, schaalt vanzelf en kost bijna niets.
3. **Server is de waarheid**: rechten, validatie en gevoelige gegevens worden altijd server-side afgedwongen en gestript; de UI verbergt hooguit knoppen. Concreet: een school/mentor krijgt server-side nooit data van andere scholen te zien, en een leerling/ouder alleen de eigen indeling.
4. **Defensief tegen gelijktijdigheid**: zie hierboven bij KV; dit is bij inschrijvingen en aanwezigheidsregistratie extra relevant.
5. **Zuinig**: caches, debounced saves en conditional GETs houden het binnen de KV-limieten en snel op de telefoon.

## Belangrijke randvoorwaarden

- **AVG / privacy**: het gaat om persoonsgegevens van minderjarigen. Sla niet meer op dan nodig, regel toegang per rol strikt af, gebruik beveiligde verbindingen, en maak gegevens verwijderbaar. Geen gegevens naar externe diensten sturen zonder overleg.
- **Nederlands** als taal van de interface.
- **Mobielvriendelijk**: ouders en leerlingen gebruiken vooral hun telefoon.
- **Beheerbaar zonder developer**: scholen, vakken, periodes en resources moeten door ons zelf toe te voegen zijn.

## Voorgestelde fasering (MVP eerst)

1. **Fase 1: Basis**: inschrijfformulier, beheer van scholen/vakken/resources, beschikbaarheid vastleggen, handmatig sessies aanmaken en leerlingen indelen.
2. **Fase 2: Roostering & communicatie**: automatisch indelingsvoorstel, e-mailnotificaties, persoonlijke roosterpagina's.
3. **Fase 3: Aanwezigheid & rapportage**: aanwezigheidsregistratie, mentor-/schooloverzichten, exports.

## Oplevering

- Werkende applicatie, deploybaar met één wrangler-commando op onze Cloudflare-omgeving
- Korte documentatie: hoe beheer je het systeem, welke KV-keys zijn er en hoe zit de datastructuur in elkaar
- Broncode in de repository, in nette commits zodat terugdraaien per stap kan
- Korte demo/walkthrough

## Vragen die we graag vooraf van je horen

- Hoe pak je het roosteralgoritme aan (fase 2), en hoe houd je dat werkbaar binnen de Worker (CPU-limieten, geen lange achtergrondprocessen)?
- Hoe structureer je de KV-keys voor dit domein, en waar zie je concurrency-risico's?
- Wat is je inschatting qua tijd per fase?
- Welke aannames doe je die we moeten checken?
