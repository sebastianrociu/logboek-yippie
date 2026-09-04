# Datamodel - KV-keys

Eén KV-namespace, binding `PLANNER_KV`. Per domein één key met één JSON-object.
Elk object heeft `_rev` (integer, optimistic lock), `_at` (ISO-tijd) en `_by`
(id van de worker-invocatie die het laatst schreef). `DEFAULTS` in `_worker.js`
levert de lege startvorm; `normalize(key, obj)` draait bij elke read (ook op de
`DEFAULTS`-fallback), is puur + idempotent en raakt `_rev`/`_at`/`_by` nooit aan.
Het vult nieuwe velden en migreert oude vormen (o.a. `avond` -> `middag`,
`conflicten`-strings -> objecten). Wegschrijven in de nieuwe vorm gebeurt vanzelf
bij de eerstvolgende `mutate()` van die sectie; er is geen bulk-migratie.

## `config`

```jsonc
{
  "_rev": 3,
  "scholen":   [{ "id": "sch_lyceum", "naam": "Stedelijk Lyceum" }],
  "vakken":    [{ "id": "vak_wi", "naam": "Wiskunde" }],
  "jaarlagen": [{ "id": "jl_3h", "label": "3 havo", "niveau": "havo", "leerjaar": 3 }],
  "blokken":   [{ "id": "blok1", "label": "Blok 1 (na de herfstvakantie)",
                  "van": "2026-10-26", "tot": "2026-12-13", "dagen": ["za", "zo"] }],
  "instellingen": { "groepMin": 4, "groepMax": 12, "mavoLabel": "vmbo-tl", "splitOpTraject": true }
}
```

`jaarlagen[]` mag met de hand `{id,label}` blijven; het inschrijfformulier maakt
er automatisch bij met `niveau` (`mavo`/`havo`/`vwo`) + `leerjaar`. `mavoLabel`
bepaalt het label voor die auto-jaarlagen (`"4 vmbo-tl"`). `splitOpTraject` zet
`traject` wel/niet in de sessiegroep-sleutel (zie `rooster`). Dagdelen zijn
`ochtend` / `middag` (geen `avond` meer).

Trainingen lopen in het weekend en in de vakanties. Een blok is een aaneengesloten
periode; `dagen` zegt welke weekenddagen (`za` / `zo`) in dat blok worden
aangeboden. Leerlingen kiezen per blok een dag en dagdeel.

`id` wordt uit de naam geslugd (kleine letters, `_`). Publiek leesbaar deel via
`GET /api/config-public` (zonder instellingen).

## `resources` (begeleiders: docent / trainer / ondersteuner)

```jsonc
{
  "_rev": 5,
  "items": [{
    "id": "res_1",
    "naam": "K. Jansen",
    "email": "trainer@yippie.test",
    "vakIds": ["vak_wi", "vak_na"],          // wat beheer toekent (kan het vak)
    "jaarlaagIds": ["jl_3h", "jl_4v"],       // wat beheer toekent (kan de jaarlaag)
    "vakVoorkeuren": ["vak_wi"],             // trainer-eigen: geeft het liefst
    "voorkeurJaarlagen": ["jl_4v"],          // trainer-eigen: jaarlaag-voorkeur
    "voorkeurVakVrij": "wiskunde D",         // trainer-eigen: gewenst vak dat niet in de lijst staat
    "maxPerWeekend": 3,
    "afwezigheid": [{ "datum": "2027-01-17", "dagdeel": "ochtend" }]
  }],
  "tombstones": { "res_9": 1730000000000 }
}
```

`tombstones` markeert verwijderde ids zodat een gelijktijdige merge ze niet
terugzet.

**Beschikbaarheid is omgedraaid.** Een begeleider is standaard beschikbaar op elk
trainingsdagdeel; `afwezigheid[]` bevat de `{datum,dagdeel}` waarop die **niet**
kan. `beschikbaarOp()` in `_worker.js` = "niet in `afwezigheid`". Het oude opt-in
`beschikbaarheid`-veld wordt niet meer gebruikt of geschreven (er was geen live
data; dev-KV is resetbaar, dus geen bulk-migratie).

**Rechten.** `PUT /api/beheer/resources` laat beheer alleen `naam`, `email`,
`vakIds`, `jaarlaagIds` en `maxPerWeekend` wijzigen. `vakVoorkeuren`,
`voorkeurJaarlagen` en `voorkeurVakVrij` kan beheer **nooit** overschrijven
(alleen de begeleider via `PUT /api/resource/beschikbaarheid`). `afwezigheid`
overschrijft beheer alleen als het request `staAfwezigheidToe: true` meestuurt
(UI: na een expliciete ontgrendeling met dubbele bevestiging).

Een begeleider ontstaat nu samen met het account: `POST /api/beheer/users` met
`rol: "resource"` en zonder `resourceId` maakt de `resources`-entry aan
(optioneel met `vakIds`/`jaarlaagIds` uit de cijferlijst-match) en koppelt hem.

## `inschrijvingen`

```jsonc
{
  "_rev": 12,
  "items": [{
    "id": "a1b2c3",
    "token": "24-tekens-opaque",           // persoonlijke link /mijn/?token=
    "ts": "2026-09-03T10:00:00.000Z",
    "status": "nieuw",                       // nieuw | ingepland | afgerond | geannuleerd
    "schoolId": "sch_lyceum",                // '' als de leerling een onbekende school typte
    "schoolVrij": "",                        // vrije schoolnaam; beheer koppelt 'm later
    "niveau": "havo",                        // mavo | havo | vwo
    "leerjaar": 3,
    "jaarlaagId": "jl_3h",                   // afgeleid uit (niveau, leerjaar); '' als koppelen faalde
    "traject": "bijspijker",                 // examentraining | bijspijker (auto-voorstel, leerling bevestigt)
    "keuzes": [
      { "blokId": "blok1", "dag": "za", "dagdeel": "ochtend",
        "vakken": ["Wiskunde", "Aardrijkskunde"] }
    ],
    "toelichting": "vrije tekst, max 500",
    "leerling": { "naam": "Sanne de Vries", "email": "", "tel": "" },
    "ouder":    { "naam": "", "email": "ouder@example.test", "tel": "" },
    "mentor":   { "naam": "M. de Wit", "email": "mentor@lyceum.test" }
  }],
  "tombstones": {}
}
```

Eén `keuze` per gekozen **moment** binnen een blok: dag (`za`/`zo`) + dagdeel
(`ochtend`/`middag`). Een leerling mag meerdere momenten per blok kiezen (bijv.
za-ochtend én zo-middag); dat zijn dan meerdere `keuze`-entries met hetzelfde
`blokId` en dezelfde `vakken`. `vakken` zijn vrije
namen (strings): de bekende vakken plus wat de leerling zelf typt. Voor groeperen
worden ze genormaliseerd (trim + lowercase), zodat "wiskunde" en "Wiskunde"
samenvallen. Alleen naam + contact + jaarlaag/vak worden opgeslagen, geen
leerlingnummer (AVG, zie hoofd-`CLAUDE.md`).

## `rooster`

```jsonc
{
  "_rev": 8,
  "status": "concept",                       // concept | definitief
  "sessies": [{
    "id": "s_ab12cd",
    "vak": "Wiskunde", "jaarlaagId": "jl_3h", "schoolId": "sch_lyceum",
    "blokId": "blok1", "dag": "za", "dagdeel": "ochtend", "traject": "bijspijker",
    "datum": "2026-11-07", "locatie": "Lokaal 2",
    "resourceId": "res_1", "begeleiderNaam": "K. Jansen",
    "leerlingIds": ["a1b2c3", "d4e5f6"],
    "min": 4, "max": 12,
    "bron": "voorstel",                       // voorstel | handmatig
    "buitenBeschikbaarheid": false            // begeleider buiten z'n eigen beschikbaarheid ingepland
  }],
  "conflicten": [{ "id": "k_...", "type": "geen-gekwalificeerde", "severity": "hoog",
                   "titel": "...", "detail": "...", "ref": { "kind": "begeleider", "id": "" } }]
}
```

Een sessie hoort bij precies één groep: `schoolId | jaarlaagId | blokId | dag |
dagdeel | vak (genormaliseerd) | traject?` (`traject` telt mee als
`config.instellingen.splitOpTraject`). `datum` is de concrete kalenderdatum; `dag`
blijft de weekenddag. `PUT /api/beheer/rooster` vervangt de sessies volledig
(met `_rev`-check), zodat een verwijderde sessie ook echt weg blijft.

`POST /api/beheer/rooster/genereer` (`{blokId?, modus:'volledig'|'aanvullen',
bevestigDefinitief?}`) draait de greedy one-pass: bundel -> splits > `groepMax` ->
sorteer op schaarste -> wijs de begeleider met de meeste resterende
weekend-capaciteit toe die het vak/de jaarlaag kan en op datum+dagdeel
beschikbaar is (niet in `afwezigheid`), met `vakVoorkeuren` en `voorkeurJaarlagen`
als zachte tiebreak. De generator zet **nooit** twee sessies bij dezelfde
begeleider op hetzelfde `datum`+`dagdeel`; de UI weigert dat ook bij slepen en in
het sessievenster, en `analyse` geeft er een `trainer-dubbel`-knelpunt (hoog) op.
`GET /api/beheer/rooster/analyse` geeft dezelfde knelpunten + groep-info voor het
huidige rooster, zonder toe te wijzen. `conflicten` zijn objecten met
`severity` (`hoog`/`midden`/`laag`) en een `ref` naar de plek om het op te lossen.

`GET /api/mijn` en `GET /api/school/overzicht` tonen sessies pas als
`status === "definitief"`.

## `users`

```jsonc
{
  "_rev": 3,
  "items": [{
    "id": "u_admin",
    "email": "beheer@yippie.test",
    "rol": "beheerder",                      // beheerder | resource | mentor
    "naam": "Beheerder",
    "schoolId": null,                         // gevuld bij rol mentor
    "resourceId": null,                       // gevuld bij rol resource
    "salt": "base64url", "hash": "base64url", // PBKDF2-SHA256, 210k iteraties
    "loginTokenHash": "sha256hex",            // persoonlijke inloglink /?login=<token>
    "loginTokenExp": 1730000000000            // 30 dagen; beheer maakt een nieuwe
  }]
}
```

Eerste beheerder komt uit de secrets `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASS` bij de
eerste geslaagde login met dat adres. Inloggen kan met wachtwoord (`POST
/api/login`) of met een persoonlijke inloglink (`POST /api/auth/link`, aangeroepen
door `/?login=<token>` op de landingspagina).

**Wachtwoord is optioneel.** `POST /api/beheer/users` zonder `wachtwoord` maakt een
account zonder `salt`/`hash`: inloggen kan dan alleen via de persoonlijke
inloglink. `POST /api/login` op zo'n account geeft een nette melding ("gebruik je
inloglink").

## `aanwezigheid`

```jsonc
{
  "_rev": 0,
  "perSessie": { "<sessieId>": { "<leerlingId>": "aanwezig" } },
  "notities":  { "<sessieId>": { "tekst": "kort verslag", "ts": "2026-11-07T..." } }
}
```

Aanwezigheidswaarden: `aanwezig` | `afwezig` | `afgemeld`. De begeleider zet ze
per leerling (`POST /api/resource/aanwezigheid`) en schrijft één notitie per
sessie (`POST /api/resource/notitie`, leeg = wissen, max 1000 tekens). Beheer en
de school lezen de notitie mee (`/api/school/overzicht`); de begeleider ziet de
eigen notitie terug in `/api/resource/mij`.

## Persoonlijke pagina leerling/ouder

`GET /api/mijn?token=` geeft de indeling voor een geldig link-token.
`POST /api/mijn/verifieer` `{token, naam}` is de **lichte identiteitscheck**: de
opgegeven naam moet (genormaliseerd) kloppen met `leerling.naam`; bij een match
komt dezelfde payload terug. Er wordt niets extra opgeslagen; de client onthoudt
lokaal (`localStorage`) dat het is gelukt en slaat de vraag daarna over.

## `backup:<jjjj-mm-dd>` (door de cron-worker)

Dagelijkse dump van alle bovenstaande keys, TTL 60 dagen.

## Concurrency

`_worker.js` schrijft uitsluitend via `mutate(key, fn)`:

1. lees de key, onthoud `_rev`;
2. pas `fn` toe op een kopie;
3. `_rev + 1`, `_at`, `_by = <worker-id>`, `KV.put`;
4. **verify**: lees opnieuw; klopt `_rev` en `_by`, dan klaar;
5. zo niet: een andere schrijver won de race, ga terug naar 1 (max 3 pogingen).

Volledige-sectie-`PUT`s (`putSection`) checken bovendien de door de client
meegestuurde `_rev` en geven bij verschil `409` met de actuele versie terug; de
client (`YP.api.save`) haalt dan opnieuw op en probeert opnieuw. Arrays met een
`id` per item (`inschrijvingen.items`, `resources.items`, `rooster.sessies`)
worden gemerged op `id` met respect voor `tombstones`, zodat een gelijktijdige
toevoeging niet verdwijnt.
