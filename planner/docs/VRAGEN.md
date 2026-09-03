# Antwoorden op de "vragen vooraf"

Uit de opdracht. Kort en concreet; graag checken waar aannames staan.

## 1. Het roosteralgoritme (fase 2) en de Worker-CPU-limiet

**Aanpak: greedy one-pass, geen solver, geen achtergrondproces.**

1. Bundel inschrijvingen tot **sessiegroepen** op de sleutel
   `school | jaarlaag | blok | dag | dagdeel | vak (genormaliseerd)` (dit doet de
   groepeer-hint nu al, client-side). Splits groepen groter dan `groepMax`,
   markeer groepen kleiner dan `groepMin` als knelpunt. Een leerling die per blok
   andere vakken of dagen kiest, telt in elke bijbehorende groep mee.
2. **Sorteer de groepen op schaarste**: eerst de groepen waarvoor de minste
   gekwalificeerde + beschikbare begeleiders bestaan. Zo lopen de moeilijke
   gevallen niet vast op capaciteit die al vergeven is.
3. **Wijs toe in één pass**: voor elke groep pak de begeleider met de meeste
   resterende ruimte (`maxPerWeekend` minus al toegewezen) die het vak en de
   jaarlaag kan en op het gevraagde dagdeel beschikbaar is. Geen match ->
   registreer als conflict, ga door.
4. Lever het resultaat als **voorstel** op; de planner schuift daarna handmatig
   (dat deel werkt in fase 1 al).

Waarom dit binnen de Worker past: het is O(groepen x begeleiders), in de praktijk
honderden x tientallen = enkele duizenden vergelijkingen, ruim onder de
CPU-limiet (richttijd < 50 ms). De zwaardere sortering en toewijzing draaien
alleen wanneer de planner op "genereer voorstel" klikt, niet bij elke request.
Geen wachtrij, geen cron voor het rekenen zelf. Zou het ooit te groot worden, dan
knippen we per blok of per school in losse runs.

## 2. KV-keys en concurrency-risico's

**Keys:** `config`, `resources`, `inschrijvingen`, `rooster`, `users`,
`aanwezigheid` (+ `backup:<datum>` van de cron). Eén namespace, één JSON-object
per key, elk met `_rev` / `_at` / `_by`. Zie `DATAMODEL.md`.

**Waar zit gelijktijdigheid:**

- **Inschrijvingen** in dezelfde seconde (meerdere ouders tegelijk). Opgelost met
  append + merge-op-`id`: een schrijf die de race verliest wordt opnieuw
  toegepast op de verse versie; bestaande items blijven staan.
- **Aanwezigheid** (fase 3): twee begeleiders die tegelijk afvinken. Zelfde
  patroon, merge per `sessieId` -> `leerlingId`, laatste waarde wint per cel.
- **Rooster** tijdens handmatig schuiven: volledige-sectie-`PUT` met `_rev`-check
  -> `409` bij verschil -> client haalt opnieuw op en herprobeert. Geen stille
  overschrijving.

Alle schrijfacties gaan door één helper (`mutate`) met **write-verify** (na de
`put` opnieuw lezen en `_rev`/`_by` controleren) en tot 3 retries. Verwijderingen
laten een **tombstone** achter zodat een gelijktijdige merge ze niet terugzet.
Per-worker-stempel `_by` maakt in de logs zichtbaar wie won.

## 3. Tijdsinschatting per fase

Indicatief, één ontwikkelaar met AI-ondersteuning:

| Fase | Inhoud | Schatting |
|---|---|---|
| 1 | Inschrijfformulier, beheer, beschikbaarheid, handmatig sessies + indelen, rollen/auth, PWA-basis | **gereed in deze oplevering** |
| 2 | Roostervoorstel-generator, Gmail-OAuth + indelings-/wijzigingsmails, persoonlijke roosterpagina's afmaken, WebPush | ca. 1 tot 1,5 week |
| 3 | Aanwezigheidsregistratie, mentor-/schooloverzichten met signalering, export (pdf/excel), cron-herinneringen | ca. 1 week |

## 4. Aannames die jullie moeten checken

- **Eén KV-namespace** met domein-keys volstaat; geen aparte namespace per domein.
- **Sessie = stateless HMAC-cookie** (`yp_sess`, HttpOnly/Secure/SameSite=Lax),
  geen KV-write per login. `__Host-`-prefix niet gebruikt zodat het ook op
  `http://localhost` werkt; op productie mag dat alsnog aangezet worden.
- **Wachtwoordlogin met tijdelijk wachtwoord** voor mentor/begeleider in fase 1;
  magic-links via e-mail zijn fase 2. Wachtwoord-hash: PBKDF2-SHA256, 210k
  iteraties, per-user salt.
- **Tailwind** is nu een handmatige subset (geen toolchain), met
  Tailwind-compatibele klassen; de echte CLI-build kan later zonder de pagina's
  te wijzigen.
- **Geen captcha/rate-limit** op het publieke inschrijfformulier in fase 1;
  Cloudflare Turnstile is een kleine toevoeging voor fase 2.
- **Alleen naam + contact + jaarlaag/vak** worden opgeslagen, geen leerlingnummer
  (AVG, minderjarigen). Bewaartermijn en verwerkersovereenkomst per school buiten
  de code afspreken.
- **CSP** staat `script-src 'self' 'unsafe-inline'` toe omdat elke pagina zijn
  eigen inline script heeft (huisstijl van het platform). Wil je strikter, dan
  verhuizen de page-scripts naar losse bestanden of krijgen ze een hash; de
  functionaliteit verandert daar niet van.
- **Mappen** heten `logboek/` en `planner/`; de naam `planner` is vrij te wijzigen
  (raakt alleen `wrangler.toml` `name` en de docs).
- **`schooljaar`** is (net als in het logboek) niet in de app instelbaar; kan als
  veld in `config` als dat nodig blijkt.
