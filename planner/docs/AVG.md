# AVG en privacy

Het planningssysteem verwerkt **persoonsgegevens van minderjarigen**. Dit
document beschrijft wat er wordt opgeslagen, wie er bij kan, hoe lang het bewaard
blijft en hoe je gegevens verwijdert. De volledige doorlichting (pentest-checklist
+ AVG-checklist van het bestaande portaal) staat in het artifact **Doorlichting
Logboek Yippie** (`https://claude.ai/code/artifact/7d35c06d-eeb4-4b20-8a0c-9a48aea150a1`).

## Rollen (AVG)

- **School = verwerkingsverantwoordelijke.** Yippie voor de klas = **verwerker**.
  Sluit per school een **verwerkersovereenkomst**. Een lichte **DPIA** is
  aangeraden (minderjarigen + roostering).

## Wat wordt opgeslagen (dataminimalisatie)

| Gegeven | Waar | Waarom |
|---|---|---|
| Naam leerling | `inschrijvingen` | de indeling en terugkoppeling naar school |
| E-mail + telefoon leerling en ouder | `inschrijvingen` | de indeling versturen |
| Naam + e-mail mentor | `inschrijvingen` | de mentor laten meekijken |
| School, niveau, leerjaar, vak(ken), periodevoorkeur, traject | `inschrijvingen` | roosteren |
| Vrije toelichting (max 500) | `inschrijvingen` | planningswensen |
| Rooster: sessie -> leerling- id's, begeleider, datum, locatie | `rooster` | de planning |
| Aanwezigheid per sessie per leerling | `aanwezigheid` | fase 3 |
| Inlogaccounts (mentor, begeleider, beheer): e-mail, rol, PBKDF2-hash | `users` | toegang |

**Niet opgeslagen:** geen leerlingnummer, geen BSN, geen adres, geen
geboortedatum. De persoonlijke link gebruikt een 128-bit token; de server bewaart
alleen de **SHA-256-hash** daarvan, nooit het token zelf.

## Toegang (need-to-know), server-side afgedwongen

- **Leerling/ouder:** alleen de eigen inschrijving en indeling, via de
  persoonlijke link. Geen account.
- **School/mentor:** alleen-lezen overzicht van **de eigen school**. Een
  aangepaste URL levert nooit data van een andere school (`auth.schoolId` komt
  alleen uit de sessiecookie).
- **Begeleider:** de eigen beschikbaarheid, het eigen rooster en de aanwezigheid
  van de eigen sessies.
- **Beheerder (Yippie):** alles. Beperk het aantal beheerders.

De sessiecookie is HMAC-ondertekend, `HttpOnly`, `SameSite=Lax`, 12 uur geldig,
op https met het `__Host-`-prefix. Brute-force op inloggen wordt afgeremd (5
mislukte pogingen per account / 15 min -> `429`).

## Bewaartermijn en verwijderen

- **Bewaartermijn:** `config.instellingen.bewaarMaanden` (standaard 18). De
  cron-worker verwijdert `geannuleerd`/`afgerond` inschrijvingen ouder dan die
  termijn, inclusief cascade uit `rooster` en `aanwezigheid`.
- **Eén inschrijving nu wissen:** Beheer -> Inschrijvingen -> bij de leerling
  "Wissen" (dubbele bevestiging). Wist de inschrijving definitief en haalt de
  leerling uit alle sessies en de aanwezigheid.
- **Verzoek van leerling/ouder:** op de persoonlijke pagina "Verzoek tot
  verwijderen". Dat zet een vlag (`verwijderVerzocht`) en meldt het bij Yippie;
  de beheerder wist het daarna.
- **Alles wissen:** alleen in dev via `POST /api/dev/reset`. In productie staat
  die route uit (`ENV=production`).

## Opslaglocatie

Cloudflare KV wordt **wereldwijd** gerepliceerd. Bespreek met de scholen of dat
acceptabel is; wil je EU-only, dan is een andere opslag (bijv. D1 met een
EU-regio, of een EU-object-store) nodig - dat raakt alleen de opslaglaag in
`_worker.js`, niet de UI.

## Externe diensten

- Fonts en alle assets zijn **self-hosted** (`connect-src 'self'`, geen CDN),
  dus er lekken geen bezoekers-IP's naar derden.
- Uitgaande mail loopt (fase 2) via de **Gmail-API met OAuth**; tot die er is
  wordt er niets verstuurd, alleen de link getoond.
- Geen analytics, geen trackers.
