# assets/

Statische bestanden die lang gecachet mogen worden (`_headers`: immutable).

## inter.woff2 (zelf hosten - AVG)

`yp-design.css` verwacht hier `inter.woff2`. Zet dat bestand er handmatig neer;
het zit bewust niet in git (binair, licentie-bijlage hoort erbij).

Download de variabele Latin-subset, bijvoorbeeld:

```
curl -L -o planner/public/assets/inter.woff2 \
  https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5/files/inter-latin-wght-normal.woff2
```

Ontbreekt het bestand, dan valt de interface terug op `system-ui` - de app blijft
werken, alleen de typografie wijkt af. Laad Inter nooit via Google Fonts: dat lekt
het IP van elke bezoeker naar Google (zie AVG-punt in de hoofd-`CLAUDE.md`).

## app-icons

De PWA gebruikt inline data-URI SVG-icons in `manifest.webmanifest`; er zijn hier
geen PNG-iconen nodig.
