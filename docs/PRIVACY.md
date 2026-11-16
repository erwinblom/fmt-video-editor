# Gegevens en externe verwerking

Deze lokale kandidaat begint zonder persoonlijke interviews, instellingen of sleutels. De ingebouwde demo gebruikt gegenereerd kleurbeeld, stilte en fictieve tekst. Die tekst is geen transcript.

## Lokaal

Opnamen, transcripties, montages, herstelbestanden, exports en caches staan in app/data binnen deze kandidaat. Deze map is uitgesloten van Git. Controleer vóór het delen altijd de werkelijk vastgelegde bestanden; een genegeerde map is geen back-up. De editor luistert alleen op 127.0.0.1, standaard poort 4319. Dit is geen server voor meerdere externe gebruikers.

## Cloud staat standaard uit

Zonder `FMT_ALLOW_CLOUD=1` blokkeert deze kandidaat OpenAI-aanvragen en Auphonic-verwerking voordat credentials of opname-inhoud worden gebruikt voor die aanvraag. Een nieuwe echte import kan na lokale transcriptie melden dat de cloudanalyse uitstaat; die fout verwijdert de lokale bron niet.

Bij bewust activeren kan de software:

- Transcripttekst, metadata en ondertiteltekst naar OpenAI sturen voor analyse en redactie. De API-aanvraag gebruikt store:false; dit is geen claim dat de hele route lokaal is of dat er geen overige aanbiederretentie bestaat.
- De volledige stem-muziekmix naar Auphonic sturen voor geluidsbewerking. De configuratie schakelt aanvullende publicatiediensten en spraakherkenning uit. Een eigen account en preset zijn nodig.
Modellen downloaden en SDK-licentieverkeer zijn afzonderlijk van cloudverwerking. De Desert Ant-ingangen blokkeren nu vóór SDK-start tenzij FMT_ALLOW_LICENSE_NETWORK=1 is gekozen; standaard 0. De broncode meldt installatie-/app-ID, SDK, platform en modelrevisie aan events.desertant.com, zonder audio/transcriptie in die berichten. Het werkelijke SDK-netwerkverkeer is niet gemeten. Lees MODELVOORWAARDEN.md: de Who-licentie wijkt af en is nog niet opgehelderd. FMT_ALLOW_CLOUD is geen algemene netwerkblokkade. De download-/installatiestappen gebruiken internet. De schone demoproef gebruikte geen SDK, modellen, accounts of cloudverwerking.

De gebruiker moet vóór activeren zelf bepalen of het bronmateriaal extern verwerkt mag worden en rekening houden met eigen kosten en providervoorwaarden. Er worden geen credentials met deze kandidaat geleverd.

## Eigen stijl en lokale export
Naam, website en het PNG-logo staan lokaal in app/data/eigen-stijl.json. Iedere export krijgt een eigen stijlsnapshot, zodat latere wijzigingen de bestaande film niet veranderen. De standaardexport gebruikt een lokale audiomix; optionele cloudmastering wordt uitsluitend gekozen via de expliciete cloudconfiguratie.

## Zelfstandige basis en optionele aanvullingen — CH-390

Nieuwe opnamen starten standaard met Zelf monteren: lokaal kopiëren, werkfragmenten maken en handmatig knippen/ondertitelen. Daarvoor worden geen Desert Ant-modellen, Auphonic of taalmodellen gestart. Deze werkfragmenten zijn geen transcript en krijgen geen automatische sprekeridentiteit.

Whisper is een afzonderlijk te installeren lokale transcriptieroute. Voz/Who is een expliciete importkeuze en vereist bovendien toestemming voor Desert Ant-licentieverkeer. Eye is optioneel; de handmatige thumbnailroute gebruikt alleen een lokaal bronbeeld en een door de gebruiker ingevoerde titel. Cloudverwerking blijft standaard uit. Een handmatige knip start alleen een automatische AI-voorstelronde wanneer cloudverwerking expliciet is ingeschakeld.

Auphonic staat los van cloudfuncties voor tekst: alleen `FMT_AUDIO_MASTERING=auphonic` plus `FMT_ALLOW_CLOUD=1` schakelt die extra mastering in. De standaard is lokale audio. Een Auphonic-fout levert de lokale mix met een zichtbare terugvalmelding op.
