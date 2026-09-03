# Het systeem beheren

Alles wat Yippie zelf moet kunnen instellen zit achter **Beheer (Yippie)** op de
landingspagina. Je hebt geen developer nodig voor scholen, vakken, jaarlagen,
blokken, begeleiders of accounts.

## Tabbladen

### Inschrijvingen
Alle binnengekomen inschrijvingen, nieuwste bovenaan. Per rij zie je school,
jaarlaag, de gekozen blokken (met dag, dagdeel en vakken per blok) en het
contactadres. De statuskolom (`nieuw` / `ingepland` / `afgerond` /
`geannuleerd`) pas je hier direct aan. Een inschrijving met status `geannuleerd`
telt niet meer mee in de groepeer-hint.

### Sessies en rooster
Het hart van fase 1.

- **Status en definitief maken.** Zolang het rooster `concept` is, ziet niemand
  buiten Yippie de indeling. "Rooster definitief maken" zet de status om en zet
  voor elke ingedeelde leerling een indelingsmail klaar (fase 1: de mail wordt
  gelogd, niet echt verstuurd). Je kunt daarna nog wijzigen en opnieuw versturen.
- **Knelpunten.** Automatisch gesignaleerd: een vak/jaarlaag zonder gekwalificeerde
  of beschikbare begeleider, groepen onder de minimale groepsgrootte, leerlingen
  die in geen enkele sessie zitten, en begeleiders boven hun max per weekend.
- **Groepeer-hint.** Inschrijvingen gebundeld op school + jaarlaag + blok + dag +
  dagdeel + vak. Vaknamen worden genormaliseerd, dus "wiskunde" en "Wiskunde"
  vallen samen. "Maak sessie(s)" maakt per groep een sessie aan en splitst
  automatisch zodra de groep groter is dan het ingestelde maximum.
- **Sessies.** Blok, dag, dagdeel, vak en school liggen vast per groep. Per sessie
  vul je de concrete kalenderdatum, locatie en begeleider in en vink je de
  leerlingen aan (kandidaten volgen uit hun blok-keuze). De begeleider-keuzelijst
  laat zien wie gekwalificeerd is voor dat vak en die jaarlaag.

### Begeleiders
Docenten, trainers en ondersteuners. Per begeleider: naam, e-mail, welke vakken
en jaarlagen die kan bedienen, de beschikbaarheid (datum + ochtend/middag/avond)
en het maximum aantal sessies per weekend. Begeleiders kunnen hun beschikbaarheid
ook zelf bijwerken via hun eigen inlog (rol Begeleider).

### Scholen en vakken
De beheerbare lijsten: scholen, vakken, jaarlagen, blokken en de minimale/
maximale groepsgrootte. Per blok geef je een naam, een begin- en einddatum en
welke weekenddagen (zaterdag, zondag) worden aangeboden; het eerste blok begint
na de herfstvakantie. Alles wat je hier toevoegt verschijnt meteen in het
inschrijfformulier. Leerlingen mogen op het formulier ook een vak intypen dat
niet in de lijst staat; komt dat vaker voor, voeg het dan hier toe.

### Accounts
Inlogaccounts voor mentoren/scholen en begeleiders (en extra beheerders).
- Rol **Mentor/school**: koppel aan één school. Die persoon ziet uitsluitend de
  leerlingen van die school, alleen-lezen.
- Rol **Begeleider**: koppel aan een begeleider uit het tabblad Begeleiders. Die
  persoon beheert de eigen beschikbaarheid en ziet het eigen rooster.
- Fase 1: je geeft het tijdelijke wachtwoord zelf door. Inloglinks per e-mail
  (magic links) komen in fase 2.

## Rollen en wat ze zien

| Rol | Toegang |
|---|---|
| Beheerder (Yippie) | Alles hierboven. |
| Begeleider | `/resource/`: eigen beschikbaarheid bijwerken, eigen rooster inzien. |
| School/mentor | `/school/`: alleen-lezen overzicht van de eigen leerlingen (deelname; aanwezigheid volgt in fase 3). |
| Leerling/ouder | `/mijn/?token=...`: eigen indeling inzien en zich afmelden voor een sessie. Geen account nodig. |

De scheiding wordt **server-side** afgedwongen: een mentor-request krijgt nooit
data van een andere school, ook niet met een aangepaste URL.

## Gegevens verwijderen (AVG)

- Eén inschrijving: zet de status op `geannuleerd`; volledige verwijdering kan via
  een `DELETE` op `inschrijvingen` (nu nog via de API / een korte ingreep - een
  knop in de UI is een kleine vervolgstap).
- Een account: verwijder het op het tabblad Accounts.
- Alles terug naar nul: alleen in dev via `POST /api/dev/reset`. In productie
  hoort dat niet te kunnen.
