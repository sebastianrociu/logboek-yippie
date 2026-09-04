# Het systeem beheren

Alles wat Yippie zelf moet kunnen instellen zit achter **Beheer (Yippie)** op de
landingspagina. Je hebt geen developer nodig voor scholen, vakken, jaarlagen,
blokken, begeleiders of accounts.

## Tabbladen

### Inschrijvingen
Alle binnengekomen inschrijvingen, **inklapbaar per school** (open/dicht wordt
onthouden; de kop toont het aantal en hoeveel aandacht nodig hebben) en daarin
gegroepeerd op jaarlaag. Bovenaan staat een **Aandacht**-strook met de punten die
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
  ochtend- en middagrij per dag. Elke sessie is een compacte chip met vak, een
  E/B-pill (examentraining of bijspijker), de jaarlaag, de begeleider en de
  bezetting. **Sleep** een chip naar een ander dagdeel (werkt met muis en op
  touch): groen = kan hier, rood = zelfde begeleider al bezet of andere
  weekenddag. Klik een chip voor datum, locatie, begeleider en leerlingen. Filter
  op school of traject als er veel sessies tegelijk lopen; een tijdvak met 10+
  sessies scrollt binnen de cel. Een sessie zonder datum staat in de balk **Nog te
  plannen**; sleep 'm, of tik 'm aan en klik daarna een cel.
- **Dubbelboeking.** Een begeleider komt nooit op twee sessies tegelijk (zelfde
  datum + dagdeel): de generator vermijdt het, slepen en het sessievenster
  weigeren het (met een extra "toch doen"-bevestiging).
- **Absenties.** Het sessievenster toont per leerling de aanwezigheid
  (aanwezig/afwezig/afgemeld) en de notitie die de begeleider heeft ingevuld -
  alleen inzien; de begeleider vult ze in op `/resource/`.
- **Afgemeld.** Een begeleider koppelen op een datum waarop die zich afmeldde kan,
  maar alleen na een extra waarschuwing.

### Begeleiders
Docenten, trainers en ondersteuners. Nieuwe begeleiders maak je aan bij
**Accounts** (het trainerprofiel ontstaat meteen mee). Elke begeleider staat als
**compacte kaart** (niets inklappen): naam, e-mail, max. per weekend, en welke
**vakken** en **jaarlagen** die kan bedienen (dichte chips). De **voorkeuren**
(liefste vakken, liefste jaarlagen, gewenste vakken die niet in de lijst staan)
staan er **alleen-inzien** op één regel met een slotje - de begeleider beheert
die zelf. De **afwezigheid** ("kan niet op ...") staat op één regel; aanpassen kan
alleen na een onopvallende ontgrendeling met dubbele bevestiging. Bovenaan een
zoekveld op naam.

### Scholen en vakken
De beheerbare lijsten: scholen, vakken, jaarlagen, blokken, de minimale/maximale
groepsgrootte en de **tijden per dagdeel** (standaard 09:00-16:00; die tijden
staan op elke sessie voor trainer, leerling en school). De lijsten scrollen
binnen hun eigen blok als ze lang worden. Per blok geef je een naam, een begin-
en einddatum en welke weekenddagen worden aangeboden. Alles wat je hier toevoegt
verschijnt meteen in het inschrijfformulier. Leerlingen mogen ook een vak intypen
dat niet in de lijst staat; komt dat vaker voor, voeg het hier toe.

### Accounts
Inlogaccounts voor mentoren/scholen en begeleiders (en extra beheerders).
- Rol **Begeleider**: één stap. Je vult naam en e-mail in en kent vakken en
  jaarlagen toe - met de hand of via **"Voorstel uit cijferlijst"** (vink de
  vakken aan met het hoogst gehaalde niveau mavo/havo/vwo en of dat is afgerond;
  Yippie stelt vakken en jaarlagen voor, die je daarna bijstelt). Het
  trainerprofiel ontstaat meteen mee; je hoeft niet apart bij Begeleiders iets aan
  te maken.
- Rol **Mentor/school**: koppel aan één school. Die persoon ziet uitsluitend de
  leerlingen van die school, alleen-lezen.
- **Wachtwoord is optioneel.** Laat je het leeg, dan logt de persoon in via de
  **persoonlijke inloglink** (30 dagen geldig; knop "Inloglink" per account, of
  het venster dat na aanmaken opent). Vul je wel een wachtwoord in, dan kan dat
  ook. Stuur er een door. Een echte uitnodigingsmail volgt met de Gmail-koppeling.

## Rollen en wat ze zien

| Rol | Toegang |
|---|---|
| Beheerder (Yippie) | Alles hierboven. |
| Begeleider | `/resource/`: afwezigheid en voorkeuren doorgeven, eigen rooster inzien, op de dag aanwezigheid + notitie per sessie. |
| School/mentor | `/school/`: alleen-lezen overzicht van de eigen leerlingen - gevolgde vakken, sessies, aanwezigheid en de notities van de begeleider. |
| Leerling/ouder | `/mijn/?token=...`: eigen indeling en rooster inzien en zich afmelden voor een sessie. Geen account; eerste keer wordt de naam ter controle gevraagd. |

De scheiding wordt **server-side** afgedwongen: een mentor-request krijgt nooit
data van een andere school, ook niet met een aangepaste URL.

## Gegevens verwijderen (AVG)

- Eén inschrijving: zet de status op `geannuleerd`; volledige verwijdering kan via
  een `DELETE` op `inschrijvingen` (nu nog via de API / een korte ingreep - een
  knop in de UI is een kleine vervolgstap).
- Een account: verwijder het op het tabblad Accounts.
- Alles terug naar nul: alleen in dev via `POST /api/dev/reset`. In productie
  hoort dat niet te kunnen.
