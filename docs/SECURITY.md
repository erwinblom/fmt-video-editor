# Beveiliging van de lokale kandidaat

Deze map is niet openbaar en heeft geen externe meldroute. Deel een vermoedelijke kwetsbaarheid alleen met de beheerder via een reeds afgesproken privéroute. Neem geen opname, transcript of sleutel op in een publiek issue. Voor publicatie moet een concrete particuliere meldroute worden ingevuld.

Voeg geen app/data, credentials, lokale instellingen of modelcache toe aan Git. De kandidaat is alleen voor lokaal gebruik. Bind de server niet op een publiek adres en installeer geen service zonder expliciete opdracht.

Gebruik `npm run candidate:check` voor een basiscontrole en `npm run release:check` voor de vrijgaveblokkade. Deze controles vervangen geen volledige beveiligingsbeoordeling.
