# Het systeem beheren

Alles wat Yippie zelf moet kunnen instellen zit achter **Beheer (Yippie)** op de
landingspagina. Je hebt geen developer nodig voor scholen, vakken, jaarlagen,
blokken, begeleiders of accounts.

## Tabbladen

### Inschrijvingen
Alle binnengekomen inschrijvingen, gegroepeerd op **school -> jaarlaag** (klik een
jaarlaag open/dicht). Bovenaan staat een **Aandacht**-strook met de punten die
eerst moeten: een vrij ingetypte school die nog gekoppeld moet worden, een
inschrijving zonder gekoppelde jaarlaag, een vak dat niet in de vakkenlijst
staat, of een leerling die (nog) in geen sessie zit. Per inschrijving zie je het
traject, de mentor, de keuzes als chips en het contactadres; de status
(`nieuw` / `ingepland` / `afgerond` / `geannuleerd`) loopt bij het genereren
vanzelf door van `nieuw` naar `ingepland` en je kunt 'm hier bijstellen. Bij een
vrije school kies je in dezelfde rij "Koppel aan school" (bestaande school of
"Maak school ..."); alle inschrijvingen met diezelfde schoolnaam gaan mee.
`geannuleerd` telt niet meer mee bij het groeperen.

### Planning
Het hart van fase 1.

- **Status en definitief maken.** Zolang het rooster `concept` is, ziet niemand
  buiten Yippie de indeling. "Rooster definitief maken" zet de status om en zet
  voor elke ingedeelde leerling een indelingsmail klaar (fase 1: gelogd, niet
  echt verstuurd). Je kunt daarna nog wijzigen en opnieuw versturen.
- **Genereer voorstel.** Kies **Volledig voorstel** (vervangt de sessies in het
  bereik) of **Alleen aanvullen** (laat sessies met een begeleider staan, vult de
  rest), eventueel per blok. Het greedy-algoritme bundelt de groepen en zet ze bij
  de begeleider met de meeste resterende weekend-capaciteit die het vak en de
  jaarlaag kan en die dag/dagdeel beschikbaar is; vakvoorkeuren wegen mee. Alles
  is daarna met de hand bij te schaven. Een voorstel over een `definitief` rooster
  vraagt een extra bevestiging en zet de status terug op `concept`.
- **Knelpunten.** Gegroepeerd op ernst (Los eerst op / Aandacht / Klein), met een
  pijl-knop die naar de plek springt om het op te lossen.
- **Weekrooster.** Kies een blok; de kolommen zijn de weekenddatums, met een
  ochtend- en middagvak per dag. Elke sessie is een blokje met vak, jaarlaag,
  school, begeleider en de bezetting. Klik een blokje voor datum, locatie,
  begeleider en de leerlingen. Een sessie zonder datum staat in de balk **Nog te
  plannen**; tik 'm aan en klik daarna een geldig vak in het rooster.
- **Buiten beschikbaarheid.** Een begeleider koppelen op een datum waarop die zich
  niet beschikbaar meldde kan, maar alleen na een extra waarschuwing.

### Begeleiders
Docenten, trainers en ondersteuners. Per begeleider: naam, e-mail, welke vakken
en jaarlagen die kan bedienen, de **vakvoorkeuren** (wat die het liefst geeft) en
het maximum aantal sessies per weekend. De **beschikbaarheid** is hier alleen-
lezen: normaal vult de begeleider die zelf in via de eigen inlog. Aanpassen kan
na "Wijzig beschikbaarheid" en een extra bevestiging.

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
