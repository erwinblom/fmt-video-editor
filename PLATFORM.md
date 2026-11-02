# Platformcontrole

Werkronde CH-514, 2 november 2026. De platformport wordt gecontroleerd met dezelfde bron op macOS 14 (ARM), Windows Server 2022 en Ubuntu 24.04, met Node 22, Python 3.12, FFmpeg en Chrome.

De automatische proef installeert de afhankelijkheden, voert de softwaretests uit, opent de editor in Chrome, bewaart een gewijzigde montage, herstart de lokale server, exporteert een fictieve montage en decodeert de MP4 volledig. Een thumbnail wordt als JPEG gemaakt. De fictieve video bevat geen echte spraak; deze proef beoordeelt dus geen transcriptie- of luisterkwaliteit.

Resultaten volgen na de definitieve run. Een andere Windows-desktopversie, Linux-distributie, browser of optioneel model is niet automatisch meegetest.

## Optionele AI en audiomastering

Handmatig monteren en lokale export vormen de platformbasis. De meegeleverde Desert Ant Swift-installer is specifiek voor macOS; gebruik hem niet op Windows/Linux. Whisper kan afzonderlijk voor je systeem worden geïnstalleerd; wijs het programma en model aan met FMT_WHISPER_BIN en FMT_WHISPER_MODEL. Whisper, Voz/Who, Eye, lokale taalmodellen, cloudfuncties en Auphonic hebben hun eigen vereisten en zijn geen onderdeel van deze platformproef. Lees MODELVOORWAARDEN.md voordat je een model kiest.

## Installatievorm

Het ZIP bevat broncode, afbeeldingen, fonts met licenties en start-/installatiebestanden. Node, Python, FFmpeg, Chrome, modelgewichten en persoonlijke gegevens worden niet gebundeld. Er wordt geen achtergrondservice geïnstalleerd. De bestaande Mac-appbouwer blijft optioneel beschikbaar met npm run app:mac.
