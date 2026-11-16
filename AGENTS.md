# Video Editor aanpassen: instructies voor de AI

Je helpt iemand die deze editor naar eigen smaak wil maken. Ga ervan uit dat die persoon geen programmeur is. Dit bestand vertelt wat je vrij mag veranderen en wat heel moet blijven.

Werk je in opdracht van de maker aan de officiële FMT-uitgave? Lees dan eerst `docs/ONDERHOUD.md`. Die afspraken gelden niet voor een eigen versie.

## Hoe je werkt

- Werk in een kopie van de map. Het origineel en de bestaande projecten blijven onaangeroerd.
- Maak één wijziging per keer, zo klein als kan.
- Leg in gewone taal uit wat je hebt veranderd en hoe de gebruiker dat zelf controleert.
- Zeg eerlijk wat je werkelijk hebt getest en wat niet.
- Publiceer, verstuur of upload niets. Vraag niet om echte interviews, sleutels of persoonlijke instellingen. Test met `npm run demo`: dat maakt een fictieve stille video.
- Zet geen betaalde dienst of cloudfunctie aan zonder uitdrukkelijke vraag van de gebruiker.

## Waar alles staat

| Wat | Waar |
|---|---|
| Het scherm van de editor: indeling, knoppen, teksten | `app/public/index.html` en `app/public/app.js` |
| Kleuren en vormgeving van de editor | `app/public/style.css` |
| Losse panelen (knippen, elementen, thumbnail, eigen stijl) | de overige bestanden in `app/public/` |
| De vormgeving van de video zelf | `template/template.json` en `template/assets/` |
| De lokale server en opslag | `app/server.mjs` en `app/interviews.mjs` |
| De export naar MP4 | `app/build-export.py`, `app/export-plan.mjs` en `app/export-jobs.mjs` |
| Ondertitels | `app/subtitle-core.mjs` |
| Instellingen per installatie | `.fmt-local.json` (voorbeeld: `.fmt-local.example.json`) |
| Installeren, starten en controleren | `scripts/` |
| De werkwijze voor een AI-assistent bij het monteren | `skills/fmt-interview-video/SKILL.md` |
| Projecten van de gebruiker | `app/data/` (nooit meesturen, nooit in Git) |

De broncode is leesbaar opgemaakt. Sommige ingebedde HTML- en promptteksten staan op langere regels; zoek op de tekst van een knop of melding om de juiste plek te vinden.

## Vrij te veranderen

Kleuren, letters, indeling, naam, logo, icoon, alle teksten, de taal, de vormgeving van de video, extra kaartsoorten, extra exportformaten en nieuwe functies. Dit is een vertrekpunt: de vormgeving, de iconen en de redactieregels van de maker zijn geen voorschrift voor een eigen versie.

## Wat heel moet blijven

1. **De basis werkt zonder AI-account of betaalde dienst.** Handmatig monteren, ondertitelen en exporteren blijven lokaal werken.
2. **Projecten gaan niet verloren.** Een wijziging blijft bewaard en komt terug na herstart. Schrijf nooit over `app/data/` van een bestaande installatie heen.
3. **Cloud staat standaard uit** (`FMT_ALLOW_CLOUD=0`), en de modellen van Desert Ant starten pas na een bewuste keuze van de gebruiker (`FMT_ALLOW_LICENSE_NETWORK`). Verander die standaard niet stilletjes.
4. **Geen sleutels in de broncode.** Sleutels en persoonlijke instellingen horen in `.fmt-local.json` of `.env`, die buiten Git blijven.
5. **Eerlijk over wat automatisch is.** Werkfragmenten zijn geen voorgestelde knippen en een transcript is geen gecontroleerde tekst. Laat de menselijke kijk- en luistercontrole staan.
6. **Licenties van anderen.** Fonts, HyperFrames, GSAP en de onderdelen van Desert Ant hebben eigen voorwaarden en vallen niet onder MIT. Laat `LICENSE`, `docs/THIRD_PARTY_NOTICES.md`, `docs/MODELVOORWAARDEN.md` en de map `licenses/` staan.

## Controleren na elke wijziging

1. `npm test` moet slagen.
2. Start de kopie, maak een demo met `npm run demo` en open het project.
3. Verander iets in de montage, sluit de editor, start opnieuw en controleer dat de wijziging er nog is.
4. Exporteer een MP4 en open die buiten de editor.

`npm run source:check` vergelijkt de bestanden met de lijst en hashes van de officiële uitgave. Na een eigen wijziging wijken die af; dat is geen fout in de wijziging. Gebruik dan `npm test` en de stappen hierboven.

## Een eigen versie delen

Voor eigen gebruik hoeft de gebruiker niets te hernoemen. Wil hij zijn versie verspreiden, dan gelden de afspraken in `docs/MERKVOORWAARDEN.md`: eigen naam, eigen logo en eigen icoon, en geen FMT of fastmovingtargets.nl meer in beeld. Het screenshot in de README valt niet onder MIT; zie `docs/SCREENSHOT.md`. "Gebaseerd op FMT Video Editor" vermelden mag.
