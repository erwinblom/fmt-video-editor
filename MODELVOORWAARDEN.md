# Modellen en optionele spraakvoorzieningen

Controle: 21 oktober 2026. Gewichten worden niet meegeleverd. De fictieve demo, montage bewaren en handmatig gecontroleerde lokale video-export vragen geen spraakmodel, API-sleutel of account. De schone basisinstallatie is getest; onderstaande optionele modelinstallaties en nieuwe echte opnameverwerking niet.

## Desert Ant: afzonderlijke voorwaarden en netwerkkeuze

De Swift-SDK is vastgezet op commit `9ac125cc4b10696a7ae1d18723fb585b8c025ee1`. De optionele Node-lock zet Voz op 4.0.0, core op 4.1.0 en Mediabunny op 1.62.0 vast. De SDK en Voz/Who/Ear zijn **source-available**, geen OSI-open source en geen MIT. Zie de [volledige huidige voorwaarden](licenses/models/DAL-Source-Available-1.0.txt), [SDK-notices](licenses/models/dal-THIRD_PARTY_NOTICES.md) en de [officiële licentie](https://license.desertant.com/1.0).

De huidige licentie van 3 juli 2026 noemt gratis gebruik onder 100.000 maandelijks actieve apparaten per platform per model; daarboven is een commerciële overeenkomst nodig. Zij verlangt zichtbare attributie, beperkt zelfstandige SDK/modelverspreiding en verbiedt gebruik van gewichten, outputs of logs voor training van concurrerende modellen. Dit is geen garantie dat ieder gebruik is toegestaan.

**Opgevolgd op 22 oktober 2026:** Desert Ant heeft via de door Erwin aangeleverde reactie aangegeven dat alle modellen en de SDK naar hun actuele licentie op https://license.desertant.com zouden moeten verwijzen; een bronvermelding en licentiescherm volstaan voor de vermelding. De kandidaat heeft beide toegevoegd. Zie [reactie en verwerking](docs/DESERT-ANT-REACTIE.md). Het eerdere verwijzingsverschil bij Who is hiermee opgevolgd op basis van die reactie; dit is geen afzonderlijke onbeperkte licentievrijgave. De [oudere Who-tekst](licenses/models/who-LICENSE.md) blijft als historische oorspronkelijke notice bewaard en is niet onze actuele gebruiksinstructie.

De SDK-code bevat licentie-/activatieverkeer naar events.desertant.com met onder meer installatie-/app-ID, modelrevisie, SDK en platform. Volgens de broncode gaan daarin geen audio of transcripties mee; feitelijk netwerkverkeer is niet gemeten. `FMT_ALLOW_CLOUD=0` blokkeert dit verkeer niet. Daarom blokkeert deze kandidaat beide Desert Ant-ingangen vóór SDK-start, tenzij je bewust `FMT_ALLOW_LICENSE_NETWORK=1` instelt. De standaard is 0. Dit is geen firewall voor willekeurige handmatig gestarte externe software. Modeldownloads vragen eveneens internet. De demo gebruikt geen Desert Ant en heeft dit akkoord niet nodig.

| Model | Exact gecontroleerde verwijzing | Rechten |
|---|---|---|
| Voz v0.4.0 | 55b31a7ef412394c787a2766ea4fbe8dcc97c77d | DAL source-available plus NVIDIA Parakeet 0.6B v3 CC-BY-4.0: bron, credits en wijzigingen vermelden; zie Voz-notices. |
| Who v0.3.1 | debaf57feb8da21d1283e13aa6a7b1fda1178b7c | Actuele DAL-verwijzing volgens leveranciersreactie; oudere meegeleverde tekst historisch behouden. |
| Ear v0.2.0 | 2d0b5ab1bad1ce4e2de86268623e285cc646d763 | DAL plus OpenAI Whisper tiny MIT; zie Ear-notices. |
| Swift Numerics 1.1.1 | 0c0290ff6b24942dadb83a929ffaaa1481df04a2 | Apache-2.0 met Swift-runtime-uitzondering, volledige tekst in licenses/models. |

De SDK kan tags opvragen; bovenstaande auditresoluties zijn geen claim dat zijn volledige downloadgedrag onveranderlijk is vastgezet.

## Afzonderlijke lokale modellen

| Model / bestand | Voorwaarden | Optionele voorbereiding |
|---|---|---|
| Gemma 4 E4B-it, Unsloth Q4_K_M | Deze exacte Gemma 4-uitgave is Apache-2.0 en publiek, geen oude Gemma-gebruikslicentie toepassen. Quantisatiebron Unsloth; Google als modelbron vermelden. | `zsh scripts/setup-analysis-model.sh`; circa 5 GB; losse llama-server nodig. |
| Qwen 3.5 9B, Unsloth Q4_K_M | Apache-2.0; oorspronkelijke Qwen-license bewaard. | `zsh scripts/setup-subtitle-model.sh`; circa 5,7 GB; losse llama-server nodig. |
| Whisper ggml-small | OpenAI MIT plus whisper.cpp MIT. | `zsh scripts/setup-whisper-model.sh`; circa 488 MB; losse whisper-cli nodig. |
| Sherpa/pyannote/3D-Speaker | Sherpa Apache-2.0, exacte pyannote-conversie MIT met CNRS/medea notice, 3D-Speaker Apache-2.0. Niet gelijkstellen aan andere gated pyannote-uitgaven. | Afzonderlijke sprekerinstallatie; native subcomponenten nog geen complete herverpakkingsvrijgave. |

De drie downloadscripts gebruiken onveranderlijke bestandscommits plus SHA-256 en projectlokale opslag: Gemma/Whisper onder .runtime-models en Qwen onder .runtime-desert-ant/subtitle-model. Bestandsnamen, hashes en auditresoluties staan in [models-manifest.json](scripts/models-manifest.json). Geen van deze grote modellen is tijdens deze audit gedownload of uitgevoerd. Stel een eigen model zo nodig in met FMT_ANALYSIS_MODEL of FMT_WHISPER_MODEL; een privé-cache van de maker is niet nodig. Voorwaarden en notices blijven bij iedere doorgifte van modellen gelden.

Primaire bronnen: [Google Gemma 4 Apache 2](https://ai.google.dev/gemma/apache_2), [Unsloth Gemma 4](https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF), [Unsloth Qwen](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF), [OpenAI Whisper](https://github.com/openai/whisper/blob/main/LICENSE), [Desert Ant SDK](https://github.com/Desert-Ant-Labs/desert-ant-core). Gedownloade volledige licentieteksten en oorspronkelijke modelnotices staan in licenses/models; het complete interne auditbewijs blijft buiten de bronuitgave.

## Eye als optionele aanvulling — CH-390

Eye Node 4.1.0 is een optionele dependency. De kandidaat importeert de native SDK alleen in de aparte worker, na de controle op `FMT_ALLOW_LICENSE_NETWORK=1`. De basiseditor, handmatige thumbnail en lokale export starten Eye niet. Modellen worden niet in het bronpakket opgenomen. De voorwaarden van Desert Ant blijven gelden; wij herlicentiëren de SDK of modellen niet. Attributie staat in het thumbnailpaneel, README en Over en licenties. Exacte meegeleverde pakketroot-notices staan in licenses/NPM-NOTICES-CH390.txt. Dit bestand vervangt geen afzonderlijke rechtenbeoordeling van modelgewichten of runtimebundels.

De Whisper-route gebruikt een eigen lokale whisper.cpp-installatie en het model uit het bestaande manifest. Een modelbestand alleen installeert de CLI niet. Zonder Whisper blijft Zelf monteren bruikbaar.
