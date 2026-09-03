# Datamodel - KV-keys

Eén KV-namespace, binding `PLANNER_KV`. Per domein één key met één JSON-object.
Elk object heeft `_rev` (integer, optimistic lock), `_at` (ISO-tijd) en `_by`
(id van de worker-invocatie die het laatst schreef). `normalize` bestaat nog niet;
`DEFAULTS` in `_worker.js` levert de lege startvorm.

## `config`

```jsonc
{
  "_rev": 3,
  "scholen":   [{ "id": "sch_lyceum", "naam": "Stedelijk Lyceum" }],
  "vakken":    [{ "id": "vak_wi", "naam": "Wiskunde" }],
  "jaarlagen": [{ "id": "jl_3h", "label": "3 havo" }],
  "periodes":  [{ "id": "p_jan", "label": "Januari - maart", "van": "2027-01-10", "tot": "2027-03-28" }],
  "instellingen": { "groepMin": 4, "groepMax": 12 }
}
```

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
    "schoolId": "sch_lyceum",
    "jaarlaagId": "jl_3h",
    "vakIds": ["vak_wi"],
    "voorkeur": {
      "dagen": ["za"],                       // za | zo | wk
      "dagdelen": ["ochtend"],               // ochtend | middag
      "periodeId": "p_jan",
      "toelichting": "vrije tekst, max 500"
    },
    "leerling": { "naam": "Sanne de Vries", "email": "", "tel": "" },
    "ouder":    { "naam": "", "email": "ouder@example.test", "tel": "" },
    "mentor":   { "naam": "M. de Wit", "email": "mentor@lyceum.test" }
  }],
  "tombstones": {}
}
```

Alleen naam + contact + jaarlaag/vak worden opgeslagen. Geen leerlingnummer
(AVG, zie hoofd-`CLAUDE.md`).

## `rooster`

```jsonc
{
  "_rev": 8,
  "status": "concept",                       // concept | definitief
  "sessies": [{
    "id": "s_ab12cd",
    "vakId": "vak_wi", "jaarlaagId": "jl_3h", "schoolId": "sch_lyceum",
    "periodeId": "p_jan", "dagdeel": "ochtend",
    "datum": "2027-01-17", "locatie": "Lokaal 2",
    "resourceId": "res_1", "begeleiderNaam": "K. Jansen",
    "leerlingIds": ["a1b2c3", "d4e5f6"],
    "min": 4, "max": 12
  }],
  "conflicten": []
}
```

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
