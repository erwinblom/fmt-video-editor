# Derde partijen en licentievoorwaarden

De gebundelde assets zijn op 21 oktober 2026 gecontroleerd. Zie [ASSETRECHTEN.md](ASSETRECHTEN.md) voor bewijs, voorwaarden en het onderscheid tussen verplichte vervanging en aanbevolen vereenvoudiging. Dit is nog geen publicatievrijgave.

Dit is een inventaris voor een **lokale kandidaat**, geen vervanging van volledige licentieteksten. De eigen rechten zijn op opdracht van Erwin afzonderlijk vastgelegd in LICENSE, BEATVOORWAARDEN.md en MERKVOORWAARDEN.md.

| Onderdeel | Bekende aanwijzing | Nog te doen vóór distributie |
|---|---|---|
| Eigen FMT Video Editor-code en technische documentatie | MIT, copyright 2026 Erwin Blom; zie [LICENSE](LICENSE) | MIT-notice behouden; merk, beat en externe onderdelen vallen onder hun eigen voorwaarden, zie [RECHTEN.md](RECHTEN.md) |
| Inter 4.1 Regular, Bold en SemiBold | Ongewijzigde statische fonts uit officiële Inter 4.1-uitgave; SIL OFL 1.1 | Mag mee met [copyright en volledige OFL](licenses/Inter-OFL.txt). Timeless vervangen, ook uit Git-objecten; fonts blijven OFL, los van de eigen softwarelicentie |
| Paper Mono Regular 1.000 | Exact gelijk aan oorspronkelijke download met SIL OFL 1.1 | Mag mee met [volledige oorspronkelijke licentie](licenses/PaperMono-OFL.txt); copyright behouden; font blijft OFL |
| Eigen 80-BPM-beat, momenteel buiten bronpakket | Eigen procedurele synthese zonder samples, exact geïdentificeerd | [CC0](BEATVOORWAARDEN.md) vastgelegd voor eigen rechten; geen verplichte credits. Dit voegt de beat niet toe aan de app of het pakket |
| FMT-naam, logo en afgeleide merkuitingen | Eigen [merkvoorwaarden](MERKVOORWAARDEN.md), afzonderlijk van MIT en CC0 | Feitelijk verwijzen en ongewijzigde kopieën toegestaan onder voorwaarden; gewijzigde verspreide software een eigen merk. Erwin heeft bevoegdheid voor dit gebruik bevestigd; zie [verklaring](docs/FMT-LOGO-BEVESTIGING.md) |
| GSAP 3.14.2 | Bytegelijk aan upstream; [Standard License](licenses/GSAP-Standard-License.txt), geen algemene open-sourcelicentie | Notices behouden. Huidige vaste kaartanimaties lijken toegestaan; opnieuw beoordelen bij algemene visuele animatiebouwer. Vervanging is advies, geen bewezen huidige verplichting |
| HyperFrames 0.8.171 | Apache-2.0 plus afzonderlijke gebundelde onderdelen | [Pakketaudit](EXTERNE-PAKKETTEN.md) en verzamelde volledige teksten; native/bundelvrijgave blijft onvolledig |
| Desert Ant SDK en modellen | Source-Available License; actuele verwijzing bevestigd via leveranciersreactie | [Modelvoorwaarden](MODELVOORWAARDEN.md); licentienetwerk standaard geblokkeerd, actuele licentie gelinkt in broncode en scherm; zie docs/DESERT-ANT-REACTIE.md |
| Python-, Swift-, npm- en overige modelonderdelen | Afzonderlijke voorwaarden | [Pakketten](EXTERNE-PAKKETTEN.md), [modellen](MODELVOORWAARDEN.md), [volledige verzamelde teksten](licenses/DEPENDENCY-NOTICES.txt); geen complete binaryvrijgave |

Vormgevingsassets worden in deze lokale kopie behouden om regressies te kunnen testen. Een toekomstig publiek pakket mag pas na afhandeling van deze inventaris worden samengesteld.

## Kandidaat FMT Video Editor — CH-195
Eigen code en documentatie vallen onder MIT; FMT-merkmateriaal onder MERKVOORWAARDEN.md. De eerdere 80-BPM-beat is herstelbaar gearchiveerd buiten de bronuitgave en wordt niet gebruikt. De standaardkaarten en het videokader bevatten geen FMT-merk; het app-logo blijft FMT-merkmateriaal. Externe software en fonts behouden hun bestaande voorwaarden hierboven.

## Aanvulling CH-390

De bijgewerkte bron gebruikt naast HyperFrames ook sharp 0.35.5 en puppeteer-core 25.15.0. Eye 4.1.0 van Desert Ant Labs is optioneel en valt onder zijn eigen voorwaarden. Zie de exacte dependency-lock en licenses/NPM-NOTICES-CH390.txt voor de uit de geïnstalleerde pakketroots overgenomen licentie-/noticeteksten. Native code, modelgewichten en node_modules zitten niet in het bronpakket; npm haalt dependencies bij installatie op. Dit is geen verklaring dat ieder extern onderdeel MIT is.
