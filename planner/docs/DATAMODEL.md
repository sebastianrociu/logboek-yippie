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
    "vakIds": ["vak_wi", "vak_na"],
    "vakVoorkeuren": ["vak_wi"],
    "jaarlaagIds": ["jl_3h", "jl_4v"],
    "maxPerWeekend": 3,
    "beschikbaarheid": [{ "datum": "2027-01-17", "dagdeel": "ochtend" }]
  }],
  "tombstones": { "res_9": 1730000000000 }
}
```

`tombstones` markeert verwijderde ids zodat een gelijktijdige merge ze niet
terugzet.

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

Per gekozen blok één `keuze` met een dag (`za`/`zo`), een dagdeel
(`ochtend`/`middag`) en de vakken voor dat blok. `vakken` zijn vrije
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
    "blokId": "blok1", "dag": "za", "dagdeel": "ochtend",
    "datum": "2026-11-07", "locatie": "Lokaal 2",
    "resourceId": "res_1", "begeleiderNaam": "K. Jansen",
    "leerlingIds": ["a1b2c3", "d4e5f6"],
    "min": 4, "max": 12
  }],
  "conflicten": []
}
```

Een sessie hoort bij precies één groep: `schoolId | jaarlaagId | blokId | dag |
dagdeel | vak (genormaliseerd)`. `datum` is de concrete kalenderdatum die de
planner invult; `dag` blijft de weekenddag-voorkeur.

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
    "salt": "base64url", "hash": "base64url"  // PBKDF2-SHA256, 210k iteraties
  }]
}
```

Eerste beheerder komt uit de secrets `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASS` bij de
eerste geslaagde login met dat adres.

## `aanwezigheid` (fase 3, nu leeg geïnitialiseerd)

```jsonc
{ "_rev": 0, "perSessie": { "<sessieId>": { "<leerlingId>": "aanwezig" } } }
```

Waarden: `aanwezig` | `afwezig` | `afgemeld`.

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
