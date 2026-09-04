# AVG en privacy

Het planningssysteem verwerkt **persoonsgegevens van minderjarigen**. Dit
document beschrijft wat er wordt opgeslagen, wie er bij kan, hoe lang het bewaard
blijft en hoe je gegevens verwijdert. De volledige doorlichting (pentest-checklist
+ AVG-checklist van het bestaande portaal) staat in het artifact **Doorlichting
Logboek Yippie** (`https://claude.ai/code/artifact/7d35c06d-eeb4-4b20-8a0c-9a48aea150a1`).

## Rollen (AVG)

- **School = verwerkingsverantwoordelijke.** Yippie voor de klas = **verwerker**.
  Sluit per school een **verwerkersovereenkomst**.
- **DPIA (verplicht traject, eigenaar = school).** Grootschalige verwerking van
  gegevens van minderjarigen met een beoordelend element (notities, aanwezigheid)
  vraagt een DPIA. Yippie levert de bouwstenen (dit document, `DATAMODEL.md`,
  de doorlichting); de school stelt de DPIA vast vóór de eerste echte leerling
  erin gaat. Zie de checklist onderaan.

## Wat wordt opgeslagen (dataminimalisatie)

| Gegeven | Waar | Waarom |
|---|---|---|
| Naam leerling | `inschrijvingen` | de indeling en terugkoppeling naar school |
| E-mail + telefoon leerling en ouder | `inschrijvingen` | de indeling versturen |
| Naam + e-mail mentor | `inschrijvingen` | de mentor laten meekijken |
| School, niveau, leerjaar, vak(ken), periodevoorkeur, traject | `inschrijvingen` | roosteren |
| Vrije toelichting (max 500) | `inschrijvingen` | planningswensen |
| Noodzakelijke praktische info (bijv. allergie, "wordt gebeld", opgehaald) | `inschrijvingen.bijzonderheden` | veiligheid tijdens de sessie |
| Rooster: sessie -> leerling- id's, begeleider, datum, locatie | `rooster` | de planning |
| Aanwezigheid per sessie per leerling | `aanwezigheid` | terugkoppeling naar school |
| Notitie per sessie (kort verslag van de begeleider) | `aanwezigheid.notities` | terugkoppeling naar school |
| Inlogaccounts (mentor, begeleider, beheer): e-mail, rol, PBKDF2-hash | `users` | toegang |

**Niet opgeslagen:** geen leerlingnummer, geen BSN, geen adres, geen
geboortedatum. De persoonlijke link gebruikt een 128-bit token; de server bewaart
alleen de **SHA-256-hash** daarvan, nooit het token zelf. De lichte
identiteitscheck op `/mijn` (de eerste keer de naam van de leerling bevestigen)
slaat **niets nieuws** op: hij vergelijkt met de al opgeslagen `leerling.naam` en
de browser onthoudt lokaal dat het is gelukt. Het token blijft de feitelijke
toegang; de check is een extra drempel, geen authenticatie.

Notities horen **feitelijk en over schoolwerk** te zijn (zelfde lijn als het
logboek): geen oordelen over gedrag of thuissituatie. De school ziet ze mee.

### Bijzondere / gevoelige gegevens

De vrije **toelichting** en het veld **bijzonderheden** kunnen gegevens over
gezondheid bevatten (allergie, medicijngebruik, "wordt na afloop gebeld"). Dat
zijn bijzondere persoonsgegevens (AVG art. 9).

- Het formulier vraagt **alleen wat nodig is voor de veiligheid tijdens de
  sessie**, met de expliciete tekst: *"Alleen praktische informatie die de
  begeleider moet weten. Geen uitgebreide medische dossiers."*
- Grondslag: **uitdrukkelijke toestemming** van de ouder/leerling bij het
  inschrijven (art. 9 lid 2 sub a), vastgelegd met een aanvinkvakje.
- Toegang: alleen de beheerder en de **toegewezen begeleider** van de sessie;
  niet in het school-/mentoroverzicht, niet in exports naar de mentor.
- Bewaartermijn: gelijk met de inschrijving; verdwijnt bij verwijderen en bij de
  retentie-purge.
- Wil een school dit veld niet, dan kan het per school uit (config).

## Toegang (need-to-know), server-side afgedwongen

- **Leerling/ouder:** alleen de eigen inschrijving en indeling, via de
  persoonlijke link. Geen account. Op die pagina staan de rechten van betrokkenen:
  inzage (de pagina zelf), **correctie** ("Gegevens kloppen niet") en
  **verwijdering** ("Verzoek tot verwijderen").
- **School/mentor:** alleen-lezen overzicht van **de eigen school**. Een
  aangepaste URL levert nooit data van een andere school (`auth.schoolId` komt
  alleen uit de sessiecookie).
- **Begeleider:** de eigen beschikbaarheid, het eigen rooster en de aanwezigheid
  van de eigen sessies.
- **Coördinator/gangsurveillant:** de volledige planning over alle scholen,
  alleen-lezen, met alleen een telling aanwezig/afwezig/afgemeld per sessie -
  geen leerlingnamen, geen notities, geen bijzonderheden. Een rol die over
  meerdere scholen/sessies kijkt krijgt zo niet meer te zien dan nodig is om te
  weten waar en wanneer iets speelt.
- **Beheerder (Yippie):** alles. Beperk het aantal beheerders.

De sessiecookie is HMAC-ondertekend, `HttpOnly`, `SameSite=Lax`, 12 uur geldig,
op https met het `__Host-`-prefix. Brute-force op inloggen wordt afgeremd (5
mislukte pogingen per account / 15 min -> `429`).

## Bewaartermijn en verwijderen

- **Bewaartermijn:** `config.instellingen.bewaarMaanden` (standaard 18). De
  cron-worker verwijdert `geannuleerd`/`afgerond` inschrijvingen (en die met een
  verwijderverzoek) ouder dan die termijn, inclusief cascade uit `rooster` en
  `aanwezigheid` (aanwezigheidsstatus én de notitie van een sessie die daardoor
  leeg raakt). De KV-schrijfacties van de purge gebruiken hetzelfde
  optimistic-lock als de Pages-Worker, zodat een gelijktijdige wijziging niet
  verloren gaat.
- **Einde schooljaar (belangrijk):** een inschrijving die `nieuw` of `ingepland`
  blijft, wordt **niet** automatisch opgeruimd. Sluit een schooljaar af met
  Beheer -> "Schooljaar archiveren": dat zet afgelopen inschrijvingen op
  `afgerond`, waarna de retentietermijn gaat lopen. Doe dit elk jaar.
- **Eén inschrijving nu wissen:** Beheer -> Inschrijvingen -> bij de leerling
  "Wissen" (dubbele bevestiging). Wist de inschrijving definitief en haalt de
  leerling uit alle sessies en de aanwezigheid.
- **Verzoek van leerling/ouder (AVG art. 12-17):** op de persoonlijke pagina
  "Verzoek tot verwijderen" of "Gegevens kloppen niet". Dat zet een vlag
  (`verwijderVerzocht` / `correctieVerzocht`) en meldt het bij Yippie.
  - **Eigenaar:** de Yippie-beheerder (privacy@yippievoordeklas.nl).
  - **Termijn:** afhandelen **binnen 1 maand** na het verzoek; bij weigering met
    reden reageren binnen diezelfde maand.
  - Een wisverzoek wordt door de beheerder uitgevoerd met "Wissen"; daarna
    verdwijnt de leerling ook uit nieuwe back-ups en uiterlijk na 60 dagen uit
    alle back-ups (zie hieronder).
- **Alles wissen:** alleen in dev via `POST /api/dev/reset`. In productie staat
  die route uit (`ENV=production`).

## Back-ups

- De cron-worker maakt **één keer per dag** een volledige kopie van alle
  domein-keys naar `backup:<datum>` in dezelfde KV-namespace. Die kopie bevat
  **alle persoonsgegevens én de PBKDF2-wachtwoordhashes**.
- **Bewaartermijn back-ups: 60 dagen** (`expirationTtl`), daarna verwijdert KV ze
  automatisch.
- Gevolg voor het recht op verwijdering: na uitvoeren van een wisverzoek kan de
  betrokkene nog maximaal 60 dagen in een oudere back-up staan. Dit is
  proportioneel (herstel na incident) en tijdelijk; leg het vast in de
  verwerkersovereenkomst.
- Back-ups zijn alleen benaderbaar met de KV-binding (geen route, geen publieke
  URL) en vallen onder dezelfde opslaglocatie-afweging als de rest.

## Opslaglocatie (openstaand besluit vóór productie)

Cloudflare KV wordt **wereldwijd** gerepliceerd. Persoonsgegevens van
minderjarigen verlaten daarmee de EER zonder dat er nu een doorgiftemechanisme is
vastgelegd. Dit **moet** geregeld zijn voordat er echte leerlingen in gaan. Twee
routes:

1. **EU-opslag.** Vervang KV door opslag met een EU-regio (Cloudflare D1 met
   `location-hint`/EU, of een EU-object-store). Raakt alleen de leeslaag
   (`readJSON`/`mutate`/`putSection`) in `_worker.js` en de cron-worker, niet de
   UI. Voorkeursroute.
2. **KV houden met onderbouwing.** Cloudflare's DPA + Standard Contractual
   Clauses als grondslag, plus een **Transfer Impact Assessment** die vastlegt
   waarom het risico aanvaardbaar is (versleuteld at rest en in transit,
   geen bijzondere gegevens tenzij bewust aangezet, korte bewaartermijnen).
   Vastleggen in de verwerkersovereenkomst per school.

Neem dit besluit expliciet met (een van) de scholen als verwerkingsverantwoordelijke.

## Externe diensten

- Fonts en alle assets zijn **self-hosted** (`connect-src 'self'`, geen CDN),
  dus er lekken geen bezoekers-IP's naar derden.
- Uitgaande mail loopt (fase 2) via de **Gmail-API met OAuth**; tot die er is
  wordt er niets verstuurd, alleen de link getoond.
- Geen analytics, geen trackers.

## Beveiligingsmaatregelen (samenvatting)

- Wachtwoorden: PBKDF2-SHA-256, 210.000 iteraties, per gebruiker een salt.
- Sessiecookie: HMAC-ondertekend, `HttpOnly`, `SameSite=Lax`, `__Host-`-prefix op
  https, 12 uur geldig. Bij elke ingelogde aanvraag wordt het account opnieuw
  tegen de `users`-store getoetst, zodat een verwijderd of gedegradeerd account
  meteen zonder toegang zit.
- Magic-link-tokens: 128-bit CSPRNG, server bewaart alleen de SHA-256-hash. De
  client haalt het token na gebruik uit de URL (`history.replaceState`).
- Rate-limiting op inloggen (5/account, 20/IP per 15 min) en inschrijven
  (15/IP per uur), IP uitsluitend uit `cf-connecting-ip`.
- Response-headers: HSTS (preload), CSP (`default-src 'self'`, geen externe
  bronnen), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` en
  `-Resource-Policy` op `same-origin`.
- Autorisatie server-side; de schoolscope van een mentor komt uitsluitend uit de
  sessiecookie, nooit uit de request.
- Dev-only routes (`/api/dev/*`, seed/reset) staan uit zodra `ENV=production`.
- Logs bevatten geen PII, geen tokens en geen stacktraces.

## DPIA-checklist (in te vullen door / met de school)

- [ ] Verwerkersovereenkomst getekend, incl. sub-verwerker Cloudflare + SCC's.
- [ ] Besluit opslaglocatie genomen (EU-opslag of TIA bij KV) en vastgelegd.
- [ ] Grondslagen benoemd: gerechtvaardigd belang/overeenkomst voor de planning;
      uitdrukkelijke toestemming voor het veld "bijzonderheden".
- [ ] Bewaartermijn (`bewaarMaanden`) per school afgestemd en gezet.
- [ ] Proces "Schooljaar archiveren" belegd (wie, wanneer).
- [ ] Afhandeling betrokkenenverzoeken belegd (eigenaar, termijn 1 maand).
- [ ] Informatie aan ouders/leerlingen: privacyverklaring bij het inschrijfformulier.
- [ ] Toegang tot Beheer beperkt tot een minimaal aantal personen; lijst bijgehouden.
- [ ] Afspraak over notitie-inhoud (feitelijk, over schoolwerk) gedeeld met begeleiders.
- [ ] Datalek-procedure bekend (melden aan de school binnen 24 uur).
