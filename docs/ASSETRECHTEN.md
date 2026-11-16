# FMT Editor — assetrechten

Controle: 21 oktober 2026 · CH-184, bijgewerkt met fontvervanging CH-189 · alleen lokale publicatiekandidaat.

**Inter heeft Timeless vervangen. De eigen code heeft MIT, de eigen beat CC0 en het FMT-merk aparte voorwaarden (CH-196).** Zie [RECHTEN.md](RECHTEN.md) voor de actuele afbakening. Overige publicatiecontroles blijven open. Er is niets gepubliceerd. De oorspronkelijke dagelijkse editor en interviews zijn intact.

## Huidige gebundelde assets

| Onderdeel | Uitkomst en voorwaarden |
|---|---|
| Inter 4.1 Regular, Bold, SemiBold: vijf fontkopieën | Mag mee onder SIL OFL 1.1. Ongewijzigde statische bestanden uit de officiële release. Copyright en volledige OFL in `licenses/Inter-OFL.txt`, `app/public/Inter-OFL.txt` en `template/assets/Inter-OFL.txt`. Het font blijft OFL, onafhankelijk van de eigen MIT-codelicentie; niet los verkopen. |
| Paper Mono Regular 1.000 | Mag mee onder SIL OFL 1.1. Exact gelijk aan de oorspronkelijke download. Copyright en volledige oorspronkelijke OFL in `licenses/PaperMono-OFL.txt` en bij de templatefonts. |
| `beat-80bpm.wav` | Eigen lokale procedurele synthese zonder samples of stem, bytegelijk gereconstrueerd. [CC0](BEATVOORWAARDEN.md) vastgelegd voor de eigen rechten, zonder verplichte credits. De beat is bij CH-195 buiten het bronpakket geplaatst en wordt niet opnieuw toegevoegd. |
| FMT-target: twee SVG’s en target-PNG | Technische herkomst bewezen tot de lokale FMT-merkbron en vaste template; bevoegdheid op 21 oktober 2026 expliciet bevestigd door Erwin, zie `docs/FMT-LOGO-BEVESTIGING.md`. [Merkvoorwaarden](MERKVOORWAARDEN.md) vastgelegd. De eerdere bevoegdheidsvraag aan de opdrachtgever is afgehandeld. De actuele uitvoer is neutraal of gebruikt de eigen stijl. |
| `interview-frame.png` | Lokaal samengestelde vormgeving zonder persoon of interviewbeeld. Het kader is bij CH-195 neutraal gemaakt; het oudere gerasterde FMT-kader uit CH-189 is historische vormgeving. |
| `gsap.min.js` 3.14.2 | Bytegelijk aan upstream, onder de eigen Standard License. Huidige vaste kaartanimaties lijken toegestaan; dit is een onderbouwde interpretatie, geen schriftelijke toestemming van Webflow. Copyrightheader en volledige voorwaarden behouden. Opnieuw beoordelen bij uitbreiding naar een algemene visuele animatiebouwer. |

Bronnen: [Inter 4.1](https://github.com/rsms/inter/releases/tag/v4.1), [Inter OFL](https://github.com/rsms/inter/blob/v4.1/LICENSE.txt), [Paper Mono OFL](https://github.com/paper-design/paper-mono/blob/main/OFL.txt), [GSAP Standard License](https://gsap.com/community/standard-license/).

## Fontvervanging en Git-geschiedenis

Timeless 1.094 vermeldde in de embedded metadata de [Timeless Free Font License 1.2](https://www.timeless.co/type/license). De officiële versie van 18 september 2026 verbiedt bundeling en een publieke repository (§6). Die vijf fontbestanden zijn daarom verwijderd en vervangen door Inter 4.1 Regular, Bold en SemiBold. De reguliere en vette varianten worden in zowel de UI als de template gebruikt; SemiBold blijft als templatevariant beschikbaar. De monospace labels blijven Paper Mono.

De nieuwe fontmaten gelden voor het scherm, ondertitelafbrekingen, kaartkoppen, audio-kaarten en het vaste beeldkader. De exportcacheversie is verhoogd zodat een nieuwe export geen oude kaartbestanden hergebruikt. De volledige OFL gaat ook mee wanneer de kaartgenerator de templateassets kopieert.

De lokale Git-repository is opnieuw opgebouwd met één schone rootcommit. Er zijn geen oude branches, tags, reflogs, remotes of oude fontobjecten in die repository. De kandidaatcontrole weigert de drie bekende oude fontblobs ook wanneer ze onbereikbaar of hernoemd zijn. Historische verwijzingen naar de naam Timeless in deze documentatie zijn alleen uitleg; er worden geen oude fontbestanden verspreid.

## Bewijs en grenzen

Inter is afkomstig uit het officiële `Inter-4.1.zip`: SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`. Fontbestanden en licentie zijn zonder bewerking uit datzelfde pakket gehaald. De oorspronkelijke en nieuwe assetinventaris, verificatie en testresultaten staan in de lokale, genegeerde controledossiers `controle/CH184-assets/` en `controle/CH189-inter/`.

Paper Mono is bytegelijk aan v1.000 uit de oorspronkelijke lokale download; de OFL is uit datzelfde ZIP-bestand gekopieerd. Zowel de ingebedde copyrightvermelding The Paper Mono Project Authors als de licentievermelding The Paper-Mono.Git Project Authors blijven behouden.

De oorspronkelijke 80-BPM-generator bouwt kick, rim en hi-hat op uit sinusgolven en ruis. Herhaling van alleen deze synthese, zonder interviewaudio, levert exact SHA-256 `0a026f87427380c1f9bd8071fb147dea0b4de694ea91f47f1397870667a7805a`. Dat bewijst de technische herkomst, niet exclusief auteursrecht op een eenvoudig ritme. De betrokken eigen rechten zijn nu afzonderlijk onder CC0 beschikbaar gesteld (CH-196).

GSAP gebruikt de huidige code uitsluitend voor geprogrammeerde intro-, onderwerp- en outroanimaties. De Standard License beperkt concurrerende visuele animatiebouwers; de officiële FAQ laat ruimte voor nichetools. Vervanging door ingebouwde browseranimaties blijft een aanbeveling voor verdere productontwikkeling, geen bewezen verplichting voor de huidige toepassing.

Logo en ouder kader zijn technisch herleidbaar. Erwin heeft de bevoegdheid voor dit logogebruik expliciet bevestigd (CH-201); de afzonderlijke merkvoorwaarden voor derden blijven gelden. Dat is een verklaring van de opdrachtgever, geen onafhankelijk overdrachtsonderzoek. De fonts mogen onder OFL mee; dat geeft geen aanvullende rechten op het FMT-merk.

De oorspronkelijke CH-184/CH-189-controle behandelde twaalf font-, muziek-, beeld- en animatiebestanden. De latere CH-195-ronde heeft de beat uit het actieve pakket gehaald en het kader aangepast; de huidige rechtenkeuzes staan in RECHTEN.md. De fictieve demo bevat gegenereerde kleurvlakken en stilte. De aanvullende pakket-/modelaudit staat inmiddels in EXTERNE-PAKKETTEN.md en MODELVOORWAARDEN.md; het afgeronde onderzoek met concrete restkwesties staat in docs/RECHTEN-CONTROLE.md. De eigen softwarelicentie is MIT; de schone-Mac-installatieproef blijft open. `npm run release:check` blijft bewust blokkeren.
