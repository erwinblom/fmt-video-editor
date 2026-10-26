# Externe pakketten

Gecontroleerd op 21 oktober 2026. Dit is een lokale bronkandidaat, geen toestemming om een complete installatie of appbinary te verspreiden. Eigen FMT-code blijft MIT; onderstaande onderdelen behouden hun eigen rechten. Volledige verzamelde teksten staan in [DEPENDENCY-NOTICES.txt](licenses/DEPENDENCY-NOTICES.txt). De verzameling is aantoonbaar onvolledig voor alle mogelijke native/bundelonderdelen.

## Wat is gecontroleerd?

De basis-package-lock bevat 125 pakketvermeldingen; 77 waren geïnstalleerd in de eerdere kandidaat en 75 in de schone proef. Besturingssysteem en optionele pakketten verklaren verschillen; de lock bevat ook 48 vermeldingen die niet in de eerdere installatie stonden. npm-metadata alleen geldt niet als volledige licentietekst. Daarnaast zijn de 30 originele npm-archieven uit de nieuwe optionele Voz-lock op SRI-SHA512 gecontroleerd en gelezen, zonder die optionele runtime te installeren.

| Onderdeel | Voorwaarden en uitkomst |
|---|---|
| HyperFrames 0.8.171 | Apache-2.0 voor eigen code; de volledige upstreamlicentie is verzameld. De meegebundelde Studio bevat meer onderdelen dan de root-lock toont. Geen volledige SBOM van alle ingebouwde code bewezen. |
| GSAP | Template 3.14.2 en HyperFrames-bundel 3.15.0: afzonderlijke Standard License, geen MIT. Huidige vaste kaartanimaties lijken toegestaan; een algemene visuele animatiebouwer opnieuw beoordelen. |
| Mediabunny | 1.45.3 in HyperFrames en 1.62.0 in de optionele Voz-lock: MPL-2.0. Originele npm-archieven bevatten respectievelijk 128 en 132 TypeScript-bronbestanden. Bij verspreiden van bundels de MPL-bronbeschikbaarheid en notices regelen; eigen afzonderlijke code wordt daarmee niet automatisch MPL. |
| React/React DOM/scheduler en overige JS | Overwegend MIT/BSD/Apache/ISC; volledige gevonden teksten verzameld. Bij brotli 1.3.3, dfa 1.2.0, fontkit 2.0.4, dockview 8.3.1 en dockview-react 8.3.1 ontbreekt nog een rechtstreeks meegeleverde volledige licentietekst voor de exacte verspreide code; metadata/bundelbanners bewijzen geen complete notice-dekking. |
| Sharp/libvips | Native libvips-bundel bevat meerdere onafhankelijke componenten, waaronder LGPL en Cairo MPL-1.1. Bron-/herlinkplichten zijn niet volledig afgehandeld voor eigen binaryverspreiding. Niet als uitsluitend Apache behandelen. |
| Python basis | Pillow 12.3.0 MIT-CMU met lange notices voor ingesloten bibliotheken; NumPy 2.3.5 BSD-3-Clause. De gecontroleerde NumPy 2.3.5-wheel voor cp314/macosx_14_0_arm64 gebruikt systeem-Accelerate; andere wheels kunnen andere native rechten hebben. Bewaar de volledige wheelnotices. |
| Optionele sprekerroute | Sherpa ONNX 1.13.8 Apache-2.0; pyannote-conversie MIT met eigen meegeleverde notice. Sherpa-core- en ONNX-native subcomponenten zijn niet volledig vrijgegeven voor herverpakken. SoundFile 0.14 BSD-3-Clause bevat libsndfile LGPL-2.1; NumPy 2.5.4 kan OpenBLAS/GCC-runtime/libquadmath bevatten. De optionele Python-transitie is niet volledig gelockt. |
| Optionele Node-route | Voz 4.0.0 en Desert Ant core 4.1.0 zijn source-available. ONNX Runtime 1.24.3 MIT plus omvangrijke ThirdPartyNotices; sommige npm-archieven missen deze teksten, daarom officiële versieteksten toegevoegd. Postinstall kan extra binaries ophalen: dat pakket is daarmee niet volledig gecontroleerd. |
| HyperFrames-geluidseffecten | 19 losse Pixabay-MP3s in de geïnstalleerde dependency, met globale credits maar zonder individuele herkomst. Pixabay staat geen zelfstandige distributie als geluidsbibliotheek toe. De FMT-export gebruikt deze bestanden niet. Niet opnemen in een eigen runtime/binarypakket zonder afhandeling of verwijdering. Dit is andere muziek dan de afzonderlijke eigen CC0-beat. |
| FFmpeg/Chrome | Systeemvoorwaarden; niet meegeleverd. Homebrew-FFmpeg kan GPL-componenten zoals x264 bevatten. Een eigen binarybundel vraagt de juiste broncode/notices/bouwopties; een nonfree-build kan niet herdistribueerbaar zijn. Chrome/Chromium behouden hun eigen voorwaarden en notices. |
| Auphonic | Optionele externe dienst/CLI; geen recht op herverpakken vastgesteld. Niet meegeleverd of automatisch geïnstalleerd, geen account of betaalde verwerking getest. |

## Aanbevolen distributiegrens

Bereid alleen een bronpakket voor: eigen code, expliciet gecontroleerde template-assets, package-locks, instructies en licenties. Sluit node_modules, .venv, .runtime-*, modelgewichten, browserbinaries, accounts, app/data en controlebewijs uit. De gebruiker haalt afhankelijkheden zelf uit hun officiële distributies; dit verklaart die afhankelijkheden niet alsnog onbeperkt vrij. De source-available modelroute blijft afzonderlijk optioneel, met de voorwaarden uit [MODELVOORWAARDEN.md](MODELVOORWAARDEN.md).

Een toekomstige kant-en-klare app/installer is een afzonderlijke rechtencontrole. Openstaande upstreamnotices, native plichten, GSAP-functiegrens, Pixabay-herkomst en modelvoorwaarden moeten vóór zo’n bundel worden afgehandeld. Een nieuwe dependencyversie vraagt een nieuwe controle.
