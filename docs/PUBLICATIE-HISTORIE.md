# Publicatiestatus FMT Video Editor

## Openbare bronproef v0.1.0-preview.1 · 26 oktober 2026

Opdracht CH-394: Erwin vraagt de deelversie met zijn screenshot beschikbaar te maken voor de nieuwsbrief van vrijdag 30 oktober. Bestemming: https://github.com/erwinblom/fmt-video-editor. De persoonlijke editor blijft een afzonderlijke private repository.

Deze uitgave is een **openbare proefversie van de broncode**, geen volledig gevalideerde installatie voor iedere Mac. Zij bevat uitsluitend de expliciete bestanden uit release-files.txt: software, handleiding, gecontroleerde assets, licentieteksten en het aangeleverde screenshot. Geen oude Git-geschiedenis, echte interviewbestanden, accounts, modelgewichten, node_modules of runtimebundels.

### Bewezen en nog te controleren

- 275 softwaretests geslaagd op 26 oktober. De basisroute uit CH-390 is gecontroleerd vanuit een uitgepakt pakket: fictieve import, bewaren/heropenen, thumbnail en lokale MP4-export met en zonder ondertitels.
- De nieuwe uitgave voegt een screenshot, downloadlinks en bronpakketcontrole toe. De montagecode is in deze publicatiestap niet gewijzigd.
- Niet bewezen: installatie op een andere Mac, eerste gebruik door een beginner, volledige kwaliteit van echte transcriptie en optionele model-/cloudroutes. Deze blijven voorwaarden voor een latere stabiele volledige uitgave. De stille demo is geen luistertest.
- Eigen code: MIT. Fonts, GSAP, HyperFrames, optionele modellen en andere onderdelen houden hun eigen voorwaarden. Externe runtimes en modellen worden door de gebruiker afzonderlijk geïnstalleerd. De eerder genoemde bundelnotices zijn geen vrijgave voor het meeleveren van die bundels.
- Het screenshot is aangeleverd voor deze presentatie; portret, interviewbeeld en merken vallen buiten de MIT-codevrijheden.

Controleer het bronpakket met `npm run source:check`. `npm run release:check` blijft bewust geblokkeerd voor de stabiele volledige uitgave. Actueel lokaal publicatie- en downloadbewijs wordt bijgehouden in controle/CH394/RESULTAAT.md; die private controlemappen zitten niet in de download.

## Eerdere controleverslagen

Onderstaande verslagen beschrijven de situatie vóór deze expliciet aangevraagde openbare bronproef. Eerdere vermeldingen ‘niet openbaar’ slaan op die voorbereidingsmomenten. De open proeven hierboven zijn niet alsnog als geslaagd aangemerkt.

# Historische voorbereiding

Lokale publicatiekandidaat; niet vrijgegeven om openbaar te delen.

## Gereed in de kandidaat

Afzonderlijke softwarebron en lokale gegevensmap op poort 4319, geen remote, geen oude persoonlijke Git-geschiedenis of echte interviews. Inter en Paper Mono met volledige OFL. Eigen code en technische documentatie onder MIT; FMT-merkvoorwaarden apart.

Naam FMT Video Editor. Merkloze standaardvideo; optionele Eigen stijl voor naam, logo en website op de kaarten. Neutraal videokader. Geen ingebouwde beat in het distributiepakket. Standaard lokale export zonder cloudmastering. Voor echte bronnen blijft controle verplicht: expliciet handmatig of via de bestaande automatische audiocontrole met eigen vereisten. Een handmatig vinkje wordt na montagewijzigingen ingetrokken. De stille demo is fictief en geldt niet als spraakcontrole.

Simpele README met installatie, eerste montage, Eigen stijl, privacy, problemen en zelf bouwen met ChatGPT/Claude. Schoon bron-ZIP en controlebewijs afzonderlijk. De actuele controles staan in controle/CH195-open-source/RESULTAAT.md. Oudere assetrapporten beschrijven de toen aanwezige bestanden en zijn geen actuele algemene releasevrijgave.

## Nog nodig vóór openbare vrijgave

1. Een schone installatie en de volledige route op een andere Mac, inclusief lokale transcriptie-/sprekerhulpmiddelen voor nieuwe echte opnamen. De demo en lokale tests bewijzen die installatie niet.
2. De concrete externe restkwesties uit docs/RECHTEN-CONTROLE.md afhandelen voor de gekozen distributievorm. De FMT-logobevoegdheid is door Erwin bevestigd en vormt geen open punt meer. Inter/Paper Mono behouden OFL; GSAP, HyperFrames en optionele Desert Ant-componenten behouden hun eigen voorwaarden. Geen nieuwe claim dat alle onderdelen MIT zijn.
3. Een echte eerste-gebruiktest met een niet-programmeur. AI-aanpasproeven door een agent zijn geen gebruikersonderzoek met een beginner.
4. Expliciete opdracht van Erwin voor het concrete publieke pakket en de bestemming. Daarna openbare readback en echte download-/installatiecontrole.

Geen push, remote, upload naar publicatieplatform, externe release of Dock/service-installatie. Alleen het schone bronpakket is voor de geautoriseerde AI-aanpasproef aan een nieuwe ChatGPT-chat gegeven; er is geen openbare sharelink gemaakt.

npm run candidate:check controleert de lokale Git-historie; het ZIP-manifest controleert ook de huidige nieuwe bestanden. npm run release:check blijft bewust exit 2. Deze wijzigingen staan lokaal; er is geen nieuwe commit of publieke versie geclaimd.

## Aanvullende rechtencontrole CH-199

Zie [de concrete rechtencheck en resterende bewijsstukken](docs/RECHTEN-CONTROLE.md). De exacte MIT-notice voor de sherpa/pyannote-conversie is toegevoegd. De FMT-logobevoegdheid is daarna expliciet bevestigd bij CH-201. De pakket-/modelaudit staat in EXTERNE-PAKKETTEN.md en MODELVOORWAARDEN.md. De actuele conclusie en concrete upstreamvragen staan in docs/RECHTEN-CONTROLE.md. Het definitieve bronpakket wordt na deze aanvulling opnieuw samengesteld.

## Pakket-/modelaudit en installatieproef CH-197

De basisinstallatie uit een lege bronmap is op deze Mac uitgevoerd met nieuw opgehaalde Node 24.22.1, npm ci en een nieuwe Python-omgeving. Geen persoonlijke editorbestanden, browserprofiel, interviews, modellen of credentials overgenomen. Systeem-Python, FFmpeg en Chrome zijn expliciete bestaande voorzieningen. Fictieve demo, bewaren/heropenen en volledige lokale 42s-export gecontroleerd. Dit is geen nieuwe Mac of nieuw macOS-account, en geen proef van nieuwe echte opnamen.

Zie EXTERNE-PAKKETTEN.md en MODELVOORWAARDEN.md voor volledige scope en open punten. Het Who-verwijzingsverschil is later opgevolgd met de leveranciersreactie bij CH-230; native/bundelnotices, Pixabay-herkomst en vijf exacte JS-notices zijn nog niet volledig afgehandeld. Alleen een bronuitgave voorbereiden; geen kant-en-klare runtime/modelbundel vrijgegeven. SDK-licentienetwerk vraagt nu afzonderlijk opt-in. De overige releasepunten hierboven blijven gelden. Het nieuwste bewijs staat in controle/CH197-licenties-installatie/RESULTAAT.md; het daar gecontroleerde bron-ZIP vervangt oudere bronmomentopnamen als controleobject. Niets openbaar gemaakt.

## Afronding licentiecontrole CH-201

Erwin heeft het FMT-logogebruik expliciet bevestigd; zie docs/FMT-LOGO-BEVESTIGING.md. De licentiecontrole is afgerond met destijds twee afgebakende externe restkwesties in docs/RECHTEN-CONTROLE.md; de Who-verwijzing is daarna opgevolgd bij CH-230, de vijf exacte pakketnotices blijven open. Dit is geen releasevrijgave. Het bijgewerkte lokale bronpakket is FMT-Video-Editor-bron-CH201.zip; 146 tests, kandidaatcheck en bytegelijke ZIP-readback gecontroleerd. Runtimebundels blijven buiten scope; geen andere-Mac- of nieuwe echte-opnameproef in deze stap.

## Desert Ant-reactie en licentiescherm CH-230

De door Erwin aangeleverde reactie is vastgelegd in docs/DESERT-ANT-REACTIE.md. Actuele licentieverwijzing https://license.desertant.com in Swift/JavaScript-integratie en in het scherm /licenties; de editor en eerste-startpagina hebben een link Licenties. De eerdere Who-verwijzingsvraag is opgevolgd; de oorspronkelijke notice blijft historisch behouden. Geen wijziging in modelversies, netwerktoestemming of privacykeuzes. Dit is geen algemene releasevrijgave; exacte pakketnotices, native/bundelverplichtingen en de gebruikers-/andere-Mac-proeven blijven zoals hierboven beschreven.

Actueel bronpakket na deze wijziging: FMT-Video-Editor-bron-CH230.zip. Controlebewijs in controle/CH230-desert-ant/RESULTAAT.md. Oudere ZIPs zijn eerdere momentopnamen.


## Tekstupdate CH-247 — 22 oktober 2026

Motivatie toegevoegd aan handleiding en Over. De bestaande licentiepagina heet nu Over en licenties. Nieuwe privébronmomentopname: FMT-Video-Editor-bron-CH247.zip. Niet openbaar vrijgegeven. Bestaande releasepunten blijven gelden.


## Volgordecontrole CH-253 — 22 oktober 2026

Actuele Over-tekst en handleiding: eerst Waarom ik dit deel, daarna licentie-uitleg en credits. Nieuw actueel privébronpakket: FMT-Video-Editor-bron-CH253.zip; de algemene bron-kandidaat.zip is daaraan gelijk. Oudere CH-pakketten blijven historische momentopnamen. Geen openbare vrijgave. Bestaande releasepunten blijven gelden.


## CH-252 — blijvende FMT-appiconen, 22 oktober 2026

Goedgekeurde icoonbron en bouw-/installatieroute opgenomen in het nieuwe private bronpakket FMT-Video-Editor-bron-CH252.zip. De actuele bron-kandidaat.zip wordt hieraan gelijk. Uitgave via expliciete release-files.txt en scripts/make-source-package.py; uitpakken en bytevergelijking onderdeel van de verpakkingsstap. Oudere CH-pakketten blijven historische versies. Geen openbare vrijgave; alle bestaande installatie-/rechten-/releasepunten blijven gelden.

## Kandidaat CH-390 — 26 oktober 2026

Bijgewerkt met de recente montage-, knip-, beeldvoorstel- en thumbnailfuncties uit de persoonlijke software tot 18be2e2, met behoud van de afzonderlijke publicatie-inrichting, fictieve voorbeelden, Inter/Paper Mono, eigen stijl en standaard uitgeschakelde cloud-/licentienetwerktoestemming. Niet blind over de persoonlijke editor gekopieerd.

Nieuwe productregel: de basis werkt zonder Desert Ant Labs en Auphonic. Zelf monteren is de standaard bij import; er worden werkfragmenten gemaakt, geen transcript of automatisch goedgekeurde knippen. Handmatige ondertitels en export zonder ondertitels zijn mogelijk. Whisper en Voz zijn afzonderlijke importkeuzes. Eye is optioneel, met een handmatige thumbnailroute als basis. Auphonic is een afzonderlijke opt-in en fouten vallen zichtbaar terug op lokale audio. Een expliciet gekozen model kan installatie vragen; dat blokkeert de basis niet.

275 softwaretests zijn geslaagd in de geïsoleerde proef. Nieuwe fictieve video geïmporteerd via de browser, zonder modellen of cloud; handmatige thumbnail bewaard/heropend; volledige lokale 60-seconden-MP4 met 1500 frames zonder ondertitels gemaakt en volledig gedecodeerd. Daarnaast de bestaande fictieve 42-secondenroute met ondertitels uitgevoerd. Geen echte transcriptie of menselijke luisterkwaliteit bewezen met deze stille voorbeelden.

De begeleidende skill staat in skills/fmt-interview-video/SKILL.md en is structureel gevalideerd. De bron bevat exacte overgenomen pakketroot-notices voor de geïnstalleerde Node-dependencies. Dit is geen onbeperkte rechtenverklaring voor model- of native runtimebundels; die worden niet meegeleverd.

De eerder genoemde echte andere-Mac-proef, beginnerstest en resterende rechtenbeoordeling zijn hiermee niet opgelost. Openbaar maken, release-upload en een openbare downloadroute zijn niet uitgevoerd. Het concrete pakket wordt apart gecontroleerd; alleen dat resultaat geldt als pakketbewijs.
