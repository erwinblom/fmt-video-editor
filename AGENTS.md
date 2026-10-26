# FMT Video Editor - lokale publicatiekandidaat

Lees README.md, PROJECT.md, PUBLICATIESTATUS.md en REDACTIEREGELS.md.

- Werk uitsluitend in deze kandidaat; de persoonlijke editor is een andere installatie.
- Geen echte interviews, sleutels, persoonlijke instellingen of oude Git-geschiedenis toevoegen. Testinhoud is fictief.
- Niet publiceren, pushen, remote toevoegen of licentierechten toekennen zonder expliciete opdracht.
- npm test en npm run candidate:check vóór een overdracht. npm run release:check blokkeert zolang PUBLICATIESTATUS.md open punten meldt.
- Gebruik poort 4319 en de eigen publicatiekandidaat-servicenaam. Installeer geen service of Dock-app zonder opdracht.
- Cloud staat uit. Geen betaalde model- of audio-opdrachten zonder toestemming.
- app/data en instellingen blijven buiten Git. Gebruik voor proeven npm run demo; dat maakt alleen gegenereerd beeld en een stille soundtrack.

## Vaste appiconen
Behoud de FMT-familie: witte tegel, zwart videoframe met montageblokken en canoniek target rechtsboven met rode stip. Browser/PWA en Mac-startapp gebruiken app/public/app-icon.* en app.webmanifest. npm test controleert bronhashes en verwijzingen. Neem alle icoonassets en scripts/make-mac-app.mjs mee in iedere download; installeer/werk de Mac-startapp bij met npm run app:mac. Dit verandert geen uitvoerstijl.

## Openbare bronproef CH-394
De bronproef v0.1.0-preview.1 is op verzoek van Erwin voorbereid voor erwinblom/fmt-video-editor. Gebruik npm run source:check voor het exacte pakket. candidate:check geldt alleen voor de lokale bronkandidaat zonder remote; release:check blijft voor een stabiele volledige uitgave geblokkeerd. Publiceer latere wijzigingen uitsluitend op opdracht. Het README-screenshot is expliciet aangeleverd voor deze presentatie, geen vrij te gebruiken testfixture.
