# Logboek Yippie

Logboek voor een inschrijfuur zoals **Wiskundeschool**: leerlingen werken aan
hun vak. Je noteert per leerling kort wat die heeft gedaan, zodat de school en
de mentoren kunnen meelezen. Aanwezigheid gaat via Somtoday; dit is puur voor
de notities.

- **`index.html`** - het logboek. Openen kan op
  https://sebastianrociu.github.io/logboek-yippie/
- **`rollen.html`** - voorbeeldweergave: bekijk het logboek als Yippie,
  als beheerder, of als mentor van een klas (alleen-lezen).

Alles draait client-side; de gegevens blijven in je eigen browser. School,
klassen, mentoren en lesuren pas je aan in Beheer (tandwiel, pincode `0000`).

## Let op na de mapsplitsing

Deze bestanden stonden eerder in de repo-root en werden door GitHub Pages op
`https://sebastianrociu.github.io/logboek-yippie/` geserveerd. Nu ze in
`logboek/` staan, is het pad `/logboek/`. Pas de Pages-instelling aan of zet een
redirect vanaf de root als de oude URL moet blijven werken. Het nieuwe
planningssysteem staat los in `../planner/`.
