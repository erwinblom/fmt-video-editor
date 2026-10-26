# Rechtencontrole vóór publicatie — FMT Video Editor

21 oktober 2026 · CH-199, afgerond en bijgewerkt met CH-201 · lokale kandidaat. **Geen publicatievrijgave.**

Dit onderzoek combineert de aanvullende bronrechtencontrole (CH-199), de inmiddels beschikbare pakket-/modelaudit en installatiebewijzen (CH-197) en de expliciete logoverklaring van Erwin (CH-201). Het licentieonderzoek is uitgevoerd en de concrete uitkomsten staan hieronder. Onderzoek afgerond betekent niet dat ontbrekende rechten of tegenstrijdige voorwaarden van derden zijn opgelost.

## Nu opgelost of bevestigd

- Eigen code/technische uitleg: MIT en afzonderlijke FMT-merkvoorwaarden bestaan en spreken elkaar niet tegen. Eigen stijl instellen is gewoon gebruik; een gewijzigde app verspreiden vraagt een eigen merk. Geen verplichte FMT-credit in video's.
- Inter en Paper Mono: volledige OFL aanwezig. De oude, niet-bundelbare Timeless-fonts zijn eerder vervangen en uit de kandidaatgeschiedenis gehaald.
- Beat: eigen synthese, CC0 vastgelegd, blijft buiten deze uitgave. Geen muziek- of interviewrechten toegevoegd aan de kandidaat.
- Pyannote-segmentatie: de officiële sherpa-documentatie noemt exact de gebruikte conversie van segmentation-3.0. Het model heeft MIT. De gedownloade, reeds aanwezige tarball heeft exact de SHA-256 uit het installatiescript. De **oorspronkelijk meegeleverde** MIT-tekst is toegevoegd als [Pyannote-Sherpa-CNRS-MIT.txt](../licenses/Pyannote-Sherpa-CNRS-MIT.txt), zonder modelgewichten of persoonlijke gegevens over te nemen. De tarball vermeldt copyright 2022 CNRS; de actuele oorspronkelijke modelrepository vermeldt 2023 CNRS. De geleverde tekst is bewust niet aangepast. Herkomstbewijs staat lokaal in `controle/CH199-rechten/pyannote-herkomst.json`.
- De publieke oorspronkelijke pyannote-download vraagt contactgegevens. Dat is onderscheiden van de MIT-licentie zelf; de huidige installatie gebruikt de officieel gedocumenteerde sherpa-conversie, inclusief haar licentietekst. Er is niet ingelogd, geen toegangspoort omzeild en geen contactinformatie verstrekt.
- Npm-lock gecontroleerd: 125 platformafhankelijke pakketvermeldingen, 77 lokaal geïnstalleerd. Alle 125 vermelden een licentie. Dit bewijst geen complete copyright-/noticeketen. De inventaris staat lokaal in `controle/CH199-rechten/npm-inventaris.json`.

## Afgeronde beoordeling per onderdeel

| Onderdeel | Conclusie en actie |
|---|---|
| FMT-logo en merk | **Afgehandeld:** Erwin bevestigt dat het logo van FMT is en hiervoor gebruikt mag worden. Zie [verklaring](FMT-LOGO-BEVESTIGING.md). Merkvoorwaarden blijven afzonderlijk; geen algemene MIT-logo-licentie. |
| Eigen code, fonts, eigen beat | **Afgehandeld voor de beschreven bronuitgave:** MIT voor eigen code/uitleg; OFL-teksten bij Inter/Paper Mono; beat CC0 maar niet meegeleverd. |
| GSAP | **Beoordeeld:** volledige Standard License aanwezig voor template-GSAP; HyperFrames bevat ook GSAP. Geprogrammeerde vaste kaarten passen naar interpretatie bij nichegebruik uit de officiële FAQ. Geen bewezen vervangplicht nu; geen algemene visuele animatiebouwer beloven zonder nieuwe beoordeling. Geen OSI-open-sourcelicentie. |
| Npm/Python/Swift en modelinventaris | **Controle uitgevoerd:** exacte versies, oorspronkelijke teksten en modelverwijzingen verzameld in [pakketrapport](../EXTERNE-PAKKETTEN.md), [modelrapport](../MODELVOORWAARDEN.md) en [verzamelde notices](../licenses/DEPENDENCY-NOTICES.txt). Geen algemene claim dat alle onderdelen MIT zijn. |
| Pyannote en 3D-Speaker | **Herkomst/licenties vastgelegd:** de pakket-/modelaudit heeft inmiddels ook de 3D-Speaker-voorwaarden onderzocht; de eerdere aanvullende onzekerheid daarover is opgevolgd. Pyannote-notice blijft letterlijk behouden. Modelgewichten worden niet meegeleverd; native herverpakking blijft hieronder apart. |
| Gemma/Qwen/Whisper | **Licenties gecontroleerd:** zie exacte bestandscommits/hashes en oorspronkelijke teksten in MODELVOORWAARDEN.md, scripts/models-manifest.json en licenses/models. Geen modelgewichten in het bronpakket. De optionele modellen zijn niet uitgevoerd; dit is een licentiecontrole. |
| FFmpeg, Chrome, externe diensten | **Distributiegrens vastgesteld:** gebruiker installeert eigen systeemvoorzieningen; geen binaries/accounts/sleutels meeleveren. Geen herdistributierecht op Auphonic aangenomen. |

## Resterende pakketkwestie en opgevolgde Desert Ant-vraag

1. **Ontbrekende exacte notices:** brotli 1.3.3, dfa 1.2.0, fontkit 2.0.4, dockview 8.3.1 en dockview-react 8.3.1 vermelden MIT, maar de gecontroleerde archieven/broncommits leverden geen volledige oorspronkelijke licentietekst voor de exacte code. Een generieke MIT-tekst met verzonnen copyright is geen oplossing. De vastgelegde exacte broncommits staan in het lokale auditbewijs `controle/CH197-licenties-installatie/`; pakketrapport en notices beschrijven de scope. Vóór eigen verspreiding van die code/bundels: originele teksten verkrijgen van de makers, of het betrokken onderdeel vervangen. Die externe pakketten worden niet in ons bron-ZIP opgenomen; een package-lock is geen kopie van hun code. Dit punt blijft wel zichtbaar voor een volledige installatie/binaryvrijgave.
2. **Who-licentieverwijzing opgevolgd (CH-230):** de door Erwin aangeleverde reactie van Desert Ant verwijst alle modellen en de SDK naar https://license.desertant.com en noemt bronvermelding en een licentiescherm voldoende. Beide zijn toegevoegd; zie [reactie](DESERT-ANT-REACTIE.md). De oude tekst blijft historisch behouden. Geen aanvullende onbeperkte rechten of technische werkingsgarantie afgeleid. De vraag om verduidelijking is daarmee opgevolgd; aanvullende model-/SDK-voorwaarden en de aparte netwerkkeuze blijven gelden.

De vijf ontbrekende exacte pakketnotices blijven een concrete externe restkwestie voor eigen verspreiding van die pakketcode/bundels. Er staat geen algemene opdracht 'alle licenties nog onderzoeken' open. Geen makers benaderd.

## Buiten de eerste bronuitgave: runtime- en modelbundels

**Niet meeleveren:** node_modules, Python-omgevingen, Swift-builds, .runtime-*, modelgewichten, browser-/FFmpeg-binaries en dependency-geluidseffecten. Een toekomstige kant-en-klare app is een eigen distributiecontrole:

- Native Sharp/libvips, Sherpa/ONNX, NumPy en SoundFile hebben aanvullende notices en mogelijke LGPL-/MPL-bron- en herlinkvoorwaarden. Die zijn niet volledig afgehandeld voor eigen binarybundeling.
- HyperFrames bevat 19 Pixabay-geluidseffecten zonder bewezen individuele herkomst; de editor gebruikt die niet. Niet in een eigen dependency-/geluidsbibliotheek of binarypakket opnemen zonder afhandeling of verwijdering.
- Mediabunny heeft MPL-2.0-bronbeschikbaarheidsvoorwaarden bij verspreiding van bundels. HyperFrames Studio bevat meer code dan de root-lock; geen complete SBOM-vrijgave voor herverpakking.
- Desert Ant blijft source-available met attributie, telemetrie en aanvullende gebruiksvoorwaarden. Geen claim 'volledig open source' of 'volledig offline' voor de totale optionele installatie.

Deze voorwaarden zijn niet stilzwijgend goedgekeurd. Voor de **bronuitgave zonder externe code/binaries/gewichten** is vastgelegd waarom zij geen meegeleverde component zijn; voor een toekomstige runtimebundel zijn ze echte resterende verplichtingen.

## Publicatiestatus en volgende stap

Logo-vraag afgesloten; Desert Ant-reactie verwerkt en actuele verwijzing toegevoegd aan broncode en licentiescherm. Geen toestemming tot publicatie. Het schone bronpakket bevat eigen code, gecontroleerde assets, uitleg, locks en licenties, zonder externe runtimecode of modelgewichten. Een stille demo bewijst geen opnameverwerking. De andere-Mac-/beginnersproef en expliciete publicatieopdracht uit PUBLICATIESTATUS.md blijven nodig. De resterende externe rechtenactie betreft de exacte pakketnotices bij eigen verspreiding van die code/bundels.

## Bronnen

- [Officiële sherpa-conversie en meegeleverde LICENSE](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html)
- [Oorspronkelijke segmentation-3.0: MIT, CNRS 2023](https://huggingface.co/pyannote/segmentation-3.0/blob/main/LICENSE)
- [Pyannote-modelkaart en oorspronkelijke downloadvoorwaarden](https://huggingface.co/pyannote/segmentation-3.0)
- [3D-Speaker bron en exacte modelverwijzingen](https://github.com/modelscope/3D-Speaker/blob/main/speakerlab/bin/infer_sv_batch.py)
- [Desert Ant Source-Available License 1.0](https://license.desertant.com/1.0)
- [GSAP Standard License en nichetool-FAQ](https://gsap.com/community/standard-license/)

## Uitgevoerde controle en grenzen

Kandidaatdocumentatie bijgewerkt en één oorspronkelijke pyannote-licentietekst toegevoegd. Geen runtime, persoonlijke editor, interview, model, account of logo gewijzigd. Geen nieuwe export-/UI-test nodig voor deze documentwijziging; de CH-197-basisinstallatie is een proef in een lege bronmap op dezelfde Mac, geen andere Mac of proef van nieuwe echte opnamen. Controleer de toegevoegde bestanden met de links hierboven; lokale machinebewijzen blijven buiten de bronuitgave. De kandidaat- en releasecontrole worden bij oplevering uitgevoerd; release blijft geblokkeerd.
