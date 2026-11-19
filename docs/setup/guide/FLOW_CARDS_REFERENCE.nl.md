# Flow-kaarten: naslag

Deze naslag beschrijft elke Flow-kaart van de app: wat de kaart doet, voor welke
drivers hij bestaat, welke velden hij heeft en een voorbeeld.

Hij wordt gemaakt uit de kaarten in de app zelf; niet met de hand bewerken.

Kaarten met boven of onder en een drempel gaan af bij elke meting die genoeg
verandert terwijl de waarde aan de voorwaarde voldoet, dus niet één keer bij het
overschrijden. Stuurt zo'n kaart een melding, gebruik dan een Ja/Nee-variabele
om herhaling te voorkomen (zie het voorbeeld bij Water doorstroom alarm).

Een uitgewerkte inleiding met scenario's staat in
[FLOW_CARDS_GUIDE.nl.md](FLOW_CARDS_GUIDE.nl.md).

## Inhoud

- [Triggers](#triggers)
- [Voorwaarden](#voorwaarden)
- [Acties](#acties)

## Triggers

### Triggers: Bediening en modi

#### Bedrijfsmodus gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer de bedrijfsmodus wijzigt (ECO, Normaal, Boost)

Tokens: Bedrijfsmodus, Vorige bedrijfsmodus

**Voorbeeld:** houd bij wanneer Boost aan gaat.

```text
WANNEER Bedrijfsmodus gewijzigd
EN Bedrijfsmodus is Boost
DAN Stuur een pushmelding "Boost staat aan"
```

#### Verwarmingsmodus gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer de verwarmingsmodus wijzigt

Tokens: Verwarmingsmodus, Vorige verwarmingsmodus

**Voorbeeld:** krijg een melding als iemand de modus op het bedieningspaneel
verandert.

```text
WANNEER Verwarmingsmodus gewijzigd
DAN Stuur een pushmelding "Modus is nu [Verwarmingsmodus]"
```

#### Watermodus gewijzigd

**Trigger** · Aurora I/II via Tuya

Wordt geactiveerd wanneer de watermodus wijzigt

Tokens: Watermodus, Vorige watermodus

**Voorbeeld:** dit is een installatie-instelling die normaal niet verandert;
maak bij een wijziging een notificatie.

```text
WANNEER Watermodus gewijzigd
DAN Maak een notificatie "Watermodus gewijzigd naar [Watermodus]"
```

### Triggers: Temperaturen, storingen en alarmen

#### Alarm condensortemperatuur

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer condensortemperatuur boven of onder een bepaald niveau
gaat

- Conditie: boven, onder
- Temperatuur : getal, -20 tot 80 °C

Tokens: Huidige condensortemperatuur, Drempel temperatuur

**Voorbeeld:** leg vast wanneer de condensor erg warm wordt.

```text
WANNEER Condensortemperatuur boven 60°C
DAN Maak een notificatie "Condensor [Huidige condensortemperatuur] °C"
```

#### Alarm persgastemperatuur

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer persgastemperatuur boven of onder een bepaald niveau
gaat

- Conditie: boven, onder
- Temperatuur : getal, 0 tot 120 °C

Tokens: Huidige persgastemperatuur, Drempel temperatuur

**Voorbeeld:** stuur een melding als de compressor te heet wordt.

```text
WANNEER Persgastemperatuur boven 105°C
DAN Stuur een pushmelding "Persgas boven 105 °C, controleer de warmtepomp"
```

#### Alarm persgastemperatuur EVI-warmtewisselaar

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer de persgastemperatuur van de EVI-warmtewisselaar boven
of onder een bepaald niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -30 tot 80 °C

Tokens: Huidige persgastemperatuur EVI-warmtewisselaar, Drempel temperatuur

**Voorbeeld:** volg de EVI-warmtewisselaar bij het zoeken naar een storing.

```text
WANNEER Persgastemperatuur EVI-warmtewisselaar boven 60°C
DAN Maak een notificatie "[Huidige persgastemperatuur EVI-warmtewisselaar] °C"
```

#### Alarm tapwatertemperatuur

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer tapwatertemperatuur boven of onder een bepaald niveau
gaat

- Conditie: boven, onder
- Temperatuur : getal, 0 tot 90 °C

Tokens: Huidige tapwatertemperatuur, Drempel temperatuur

**Voorbeeld:** toon met een virtuele schakelaar of de boiler warm is.

```text
WANNEER Tapwatertemperatuur boven 50°C
DAN Zet Boiler warm aan (virtuele schakelaar)

WANNEER Tapwatertemperatuur onder 40°C
DAN Zet Boiler warm uit
```

#### Alarm verdampingscondensatortemperatuur

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer verdampingscondensatortemperatuur boven of onder een
bepaald niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -20 tot 80 °C

Tokens: Huidige verdampingscondensatortemperatuur, Drempel temperatuur

**Voorbeeld:** leg vast wanneer de buitenbatterij erg koud wordt, als hulp bij
het zoeken naar ijsvorming.

```text
WANNEER Verdampingscondensatortemperatuur onder -15°C
DAN Maak een notificatie "[Huidige verdampingscondensatortemperatuur] °C"
```

#### Alarm zuiggastemperatuur

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer zuiggastemperatuur boven of onder een bepaald niveau
gaat

- Conditie: boven, onder
- Temperatuur : getal, -30 tot 50 °C

Tokens: Huidige zuiggastemperatuur, Drempel temperatuur

**Voorbeeld:** leg vast wanneer het zuiggas erg koud wordt.

```text
WANNEER Zuiggastemperatuur onder -20°C
DAN Maak een notificatie "Zuiggas [Huidige zuiggastemperatuur] °C"
```

#### Alarm zuiggastemperatuur EVI-warmtewisselaar

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer de zuiggastemperatuur van de EVI-warmtewisselaar boven
of onder een bepaald niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -30 tot 80 °C

Tokens: Huidige zuiggastemperatuur EVI-warmtewisselaar, Drempel temperatuur

**Voorbeeld:** volg de EVI-warmtewisselaar bij het zoeken naar een storing.

```text
WANNEER Zuiggastemperatuur EVI-warmtewisselaar onder -10°C
DAN Maak een notificatie "[Huidige zuiggastemperatuur EVI-warmtewisselaar] °C"
```

#### Buitentemperatuur gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer buitentemperatuur is gewijzigd boven of onder een
bepaald niveau - nuttig voor weercompensatie

- Conditie: boven, onder
- Temperatuur : getal, -30 tot 50 °C

Tokens: Huidige buitentemperatuur

**Voorbeeld:** zet een virtuele schakelaar Stookseizoen uit als het buiten warm
wordt. Een schakelaar die al uit staat, blijft uit, dus herhaling is geen
probleem.

```text
WANNEER Buitentemperatuur gewijzigd boven 18°C
DAN Zet Stookseizoen uit (virtuele schakelaar)
```

#### Compressor efficiëntie alarm (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Wordt geactiveerd wanneer
compressor frequentie boven of onder een bepaald niveau gaat. Vereist 'Expert
functie kaarten inschakelen' in apparaat instellingen.

Aurora I/II via Modbus: Wordt geactiveerd wanneer compressor frequentie boven of
onder een bepaald niveau gaat.

- Conditie: boven, onder
- Frequentie : getal, 10 tot 200 Hz

Tokens: Huidige frequentie, Drempel frequentie

**Voorbeeld:** leg vast wanneer de compressor hoog toeren draait. Bij de
Tuya-versie moet de instelling voor Expert-kaarten aan staan.

```text
WANNEER Compressor frequentie boven 90 Hz
DAN Maak een notificatie "Compressor op [Huidige frequentie] Hz"
```

#### EEV-openingsstap puls-stappen alarm

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer elektronische expansieklep (EEV) puls-stappen boven of
onder een bepaald niveau gaan

- Conditie: boven, onder
- Puls-stappen: getal, 0 tot 500 Pulse-steps

Tokens: Huidige EEV-openingsstap puls-stappen, Drempel puls-stappen

**Voorbeeld:** leg vast wanneer de expansieklep ver dichtgaat, als hulp bij het
zoeken naar een storing.

```text
WANNEER EEV puls-stappen onder 50
DAN Maak een notificatie "EEV [Huidige EEV-openingsstap puls-stappen]"
```

#### EVI-openingsstap puls-stappen alarm

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer Enhanced Vapor Injection (EVI) puls-stappen boven of
onder een bepaald niveau gaan

- Conditie: boven, onder
- Puls-stappen: getal, 0 tot 500 Pulse-steps

Tokens: Huidige EVI-openingsstap puls-stappen, Drempel puls-stappen

**Voorbeeld:** leg vast hoe ver de EVI-klep opengaat, als hulp bij het zoeken
naar een storing.

```text
WANNEER EVI-openingsstap puls-stappen boven 300
DAN Maak een notificatie "EVI [Huidige EVI-openingsstap puls-stappen]"
```

#### Hogedruk verzadigingstemperatuur alarm

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer hogedruk verzadigingstemperatuur boven of onder een
bepaald niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -20 tot 100 °C

Tokens: Huidige Hogedruk verzadigingstemperatuur, Drempel temperatuur

**Voorbeeld:** leg vast wanneer de hogedrukzijde erg warm wordt.

```text
WANNEER Hogedruk verzadigingstemperatuur boven 55°C
DAN Maak een notificatie "[Huidige Hogedruk verzadigingstemperatuur] °C"
```

#### Lagedruk verzadigingstemperatuur alarm

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus

Wordt geactiveerd wanneer lagedruk verzadigingstemperatuur boven of onder een
bepaald niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -30 tot 50 °C

Tokens: Huidige Lagedruk verzadigingstemperatuur, Drempel temperatuur

**Voorbeeld:** leg vast wanneer de lagedrukzijde erg koud wordt.

```text
WANNEER Lagedruk verzadigingstemperatuur onder -20°C
DAN Maak een notificatie "[Huidige Lagedruk verzadigingstemperatuur] °C"
```

#### Storing gedetecteerd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer een systeem storing wordt gedetecteerd

- code (Aurora I/II via Tuya): getal, 1 tot 100
- code (Aurora I/II via Modbus, Aurora III via Modbus): tekst

Tokens: Storing code, Storing beschrijving

**Voorbeeld:** krijg een melding bij een bepaalde storing. Bij de Modbus-drivers
is de code tekst zoals in het display (bijvoorbeeld F1.1 of E03), bij Tuya een
getal. Voor elke storing samen: gebruik de voorwaarde Fout is actief.

```text
WANNEER Storing F1.1 gedetecteerd
DAN Stuur een pushmelding "Storing [Storing code]: [Storing beschrijving]"
```

#### Ventilator motor efficiëntie alarm (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Wordt geactiveerd wanneer
ventilator motor frequentie boven of onder een bepaald niveau gaat. Vereist
'Expert functie kaarten inschakelen' in apparaat instellingen.

Aurora I/II via Modbus: Wordt geactiveerd wanneer ventilator motor frequentie
boven of onder een bepaald niveau gaat.

- Conditie: boven, onder
- Frequentie : getal, 10 tot 100 Hz

Tokens: Huidige ventilator frequentie, Drempel frequentie

**Voorbeeld:** leg vast wanneer de ventilator hoog toeren draait. Bij de
Tuya-versie moet de instelling voor Expert-kaarten aan staan.

```text
WANNEER Ventilator motor frequentie boven 60 Hz
DAN Maak een notificatie "Ventilator op [Huidige ventilator frequentie] Hz"
```

#### Water doorstroom alarm (Expert)

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Aurora I/II via Tuya, Aurora III via Modbus: Wordt geactiveerd wanneer water
doorstroom boven of onder een bepaald niveau gaat. Vereist 'Expert functie
kaarten inschakelen' in apparaat instellingen.

Aurora I/II via Modbus: Wordt geactiveerd wanneer water doorstroom boven of
onder een bepaald niveau gaat.

- Conditie: boven, onder
- Doorstroom (L/min): getal, 0 tot 100 L/min

Tokens: Huidige doorstroom, Drempel doorstroom

**Voorbeeld:** één melding bij te weinig doorstroming, met een Ja/Nee-variabele
Doorstroommelding tegen herhaling. Bij de Tuya-versie moet de instelling voor
Expert-kaarten aan staan.

```text
WANNEER Water doorstroom onder 10 L/min
EN Compressor is draaiend
EN Doorstroommelding is gelijk aan nee
DAN Stuur een pushmelding "Weinig doorstroming: [Huidige doorstroom] L/min"
EN Zet een Ja/Nee variabele: Doorstroommelding op ja

WANNEER Water doorstroom boven 15 L/min
DAN Zet een Ja/Nee variabele: Doorstroommelding op nee
```

#### Waterintredetemperatuur gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer waterintredetemperatuur boven of onder een bepaald
niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -20 tot 80 °C

Tokens: Huidige waterintredetemperatuur

**Voorbeeld:** zet een virtuele schakelaar Retour warm aan zodra het retourwater
warm genoeg is.

```text
WANNEER Waterintredetemperatuur gewijzigd boven 30°C
DAN Zet Retour warm aan (virtuele schakelaar)
```

#### Waterintredetemperatuur is veranderd

**Trigger** · Aurora I/II via Modbus · Aurora III via Modbus

Wordt geactiveerd wanneer de waterintredetemperatuur minimaal 0,5°C wijzigt

Tokens: Huidige waterintredetemperatuur, Vorige waterintredetemperatuur,
Temperatuurverschil

**Voorbeeld:** houd de retourtemperatuur bij in een numerieke variabele,
bijvoorbeeld voor een andere flow. De kaart gaat af bij elke verandering van
minstens 0,5 °C.

```text
WANNEER Waterintredetemperatuur is veranderd
DAN Zet een numerieke variabele: Retour op [Huidige waterintredetemperatuur]
```

#### Wateruittredetemperatuur gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer wateruittredetemperatuur boven of onder een bepaald
niveau gaat

- Conditie: boven, onder
- Temperatuur : getal, -20 tot 80 °C

Tokens: Huidige wateruittredetemperatuur

**Voorbeeld:** waarschuw als de aanvoer te warm wordt voor vloerverwarming. De
kaart gaat opnieuw af bij elke verdere stijging van 0,5 °C.

```text
WANNEER Wateruittredetemperatuur gewijzigd boven 45°C
EN Verwarmingsmodus is Vloerverwarming
DAN Stuur een pushmelding "Aanvoer [Huidige wateruittredetemperatuur] °C"
```

#### Wateruittredetemperatuur is veranderd

**Trigger** · Aurora I/II via Modbus · Aurora III via Modbus

Wordt geactiveerd wanneer de wateruittredetemperatuur minimaal 0,5°C wijzigt

Tokens: Huidige wateruittredetemperatuur, Vorige wateruittredetemperatuur,
Temperatuurverschil

**Voorbeeld:** houd de aanvoertemperatuur bij in een numerieke variabele. De
kaart gaat af bij elke verandering van minstens 0,5 °C.

```text
WANNEER Wateruittredetemperatuur is veranderd
DAN Zet een numerieke variabele: Aanvoer op [Huidige wateruittredetemperatuur]
```

### Triggers: Energie en rendement (COP)

#### COP efficiëntie gewijzigd

**Trigger** · Aurora I/II via Tuya

Wordt geactiveerd wanneer de prestatiecoëfficiënt (COP) boven of onder een
opgegeven drempel gaat

- Conditie: boven, onder
- COP drempel: getal, 1 tot 8 COP

Tokens: Huidige COP, Vorige COP, Verandering in COP, Gebruikte
berekeningsmethode, Betrouwbaarheidsniveau

**Voorbeeld:** leg een lage COP vast, met de gebruikte berekeningsmethode erbij.
De kaart kijkt bij elke verandering van minstens 0,3.

```text
WANNEER COP efficiëntie gewijzigd onder 2
EN Compressor is draaiend
DAN Maak een notificatie "COP [Huidige COP] ([Gebruikte berekeningsmethode])"
```

#### COP trend gedetecteerd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer COP een significante verbeterende of verslechterende
trend toont over de laatste 24 uur

- Trend type: verbeterend, verslechterend, elke trendverandering

Tokens: Trend richting, Trend sterkte, Trend beschrijving, Huidige dagelijkse
COP

**Voorbeeld:** krijg een melding als het rendement over de laatste 24 uur
duidelijk achteruitgaat.

```text
WANNEER COP trend gedetecteerd: verslechterend
DAN Stuur een pushmelding "[Trend beschrijving]"
```

#### COP uitschieter gedetecteerd

**Trigger** · Aurora I/II via Tuya

Wordt geactiveerd wanneer een ongeldige of verdachte COP waarde wordt
gedetecteerd, wat wijst op mogelijke sensor problemen

Tokens: Uitschieter COP waarde, Reden uitschieter, Gebruikte berekeningsmethode

**Voorbeeld:** een uitschieter wijst vaak op een sensor die niet klopt of een
ontbrekende vermogensmeting; leg hem vast in de tijdlijn.

```text
WANNEER COP uitschieter gedetecteerd
DAN Maak een notificatie "COP [Uitschieter COP waarde]: [Reden uitschieter]"
```

#### Dagelijkse COP efficiëntie gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer de 24-uur gemiddelde COP boven of onder een opgegeven
drempel gaat

- Conditie: boven, onder
- Dagelijkse COP drempel: getal, 1 tot 8 COP

Tokens: Huidige dagelijkse COP, Vorige dagelijkse COP, Verandering in COP

**Voorbeeld:** leg vast wanneer de dag-COP onder een grens zakt. De kaart kijkt
bij elke verandering van minstens 0,2.

```text
WANNEER Dagelijkse COP efficiëntie gewijzigd onder 3
DAN Maak een notificatie "Dag-COP [Huidige dagelijkse COP]"
```

#### Dagelijkse energiekosten drempel overschreden

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer de totale energiekosten van vandaag het opgegeven
bedrag overschrijden (vereist prijsoptimalisatie)

- Kosten drempel (€): getal, 1 tot 50

Tokens: Totale Kosten Vandaag (€), Verbruik Vandaag (kWh), Gemiddelde Prijs
Vandaag (€/kWh)

**Voorbeeld:** krijg één melding per dag als de energiekosten een bedrag
overschrijden. Werkt alleen met prijsoptimalisatie en een externe energiemeting.

```text
WANNEER Dagelijkse kosten overschreden €5
DAN Stuur een pushmelding "Kosten vandaag € [Totale Kosten Vandaag (€)]"
```

#### Dagverbruik drempel bereikt

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer het dagelijkse stroomverbruik een drempel bereikt

- Dagelijkse drempel (kWh): getal, 1 tot 100 kWh

Tokens: Dagverbruik, Drempel waarde

**Voorbeeld:** krijg één melding per dag zodra het verbruik een grens bereikt.

```text
WANNEER Dagverbruik bereikte 30 kWh
DAN Stuur een pushmelding "Vandaag al [Dagverbruik] kWh"
```

#### Maandelijkse COP efficiëntie gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer de 30-dagen gemiddelde COP boven of onder een
opgegeven drempel gaat

- Conditie: boven, onder
- Maandelijkse COP drempel: getal, 1 tot 8 COP

Tokens: Huidige maandelijkse COP, Vorige maandelijkse COP, Verandering in COP

**Voorbeeld:** volg het rendement over 30 dagen. De kaart kijkt bij elke
verandering van minstens 0,2.

```text
WANNEER Maandelijkse COP efficiëntie gewijzigd onder 3
DAN Stuur een pushmelding "Maand-COP [Huidige maandelijkse COP]"
```

#### Prestatierapport is beschikbaar

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt dagelijks om 23:00 afgevuurd met een uitgebreid prestatierapport. Gebruik
in combinatie met een melding-actie om dagelijkse prestatieoverzichten te
ontvangen.

Tokens: Totaalscore (0-100), Beoordeling, Samenvatting, Aanbevelingen, Volledig
rapport (JSON)

**Voorbeeld:** ontvang elke avond om 23:00 een korte samenvatting.

```text
WANNEER Prestatierapport is beschikbaar
DAN Stuur een pushmelding "[Beoordeling]: [Samenvatting]"
```

#### Totaalverbruik mijlpaal bereikt

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer het totale stroomverbruik bepaalde mijlpalen bereikt

- Verbruik mijlpaal (kWh): getal, 100 tot 50000 kWh

Tokens: Totaalverbruik, Mijlpaal waarde

**Voorbeeld:** een herinnering bij een verbruiksmijlpaal, bijvoorbeeld voor
onderhoud.

```text
WANNEER Totaalverbruik bereikte 10000 kWh
DAN Stuur een pushmelding "[Totaalverbruik] kWh: plan onderhoud"
```

#### Vermogen drempel overschreden

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer stroomverbruik een drempel overschrijdt (vereist
vermogen monitoring ondersteuning)

- Vermogen drempel (W): getal, 100 tot 10000 W

Tokens: Huidig stroomverbruik, Drempel vermogen

**Voorbeeld:** leg vast wanneer de warmtepomp veel vermogen vraagt. De kaart
gaat één keer af bij het overschrijden en pas weer als het vermogen eerst is
gezakt. Vereist een vermogensmeting.

```text
WANNEER Stroomverbruik overschreed 3000 W
DAN Maak een notificatie "Vermogen [Huidig stroomverbruik] W"
```

### Triggers: Energieprijzen

#### Dure periode nadert

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt N uur vóór het duurste elektriciteitsprijs blok geactiveerd. Gebruik dit
om voor te verwarmen of voor te bereiden voor dure periodes.

Tokens: Blok Starttijd, Gemiddelde Prijs (€/kWh), Blok Duur (uren)

**Voorbeeld:** zet de warmtepomp op ECO voordat de dure periode begint. Hoeveel
uur vooraf de kaart afgaat, stel je in bij de prijsinstellingen (standaard 2
uur). De Aurora III kent geen ECO. Werkt alleen als de adaptieve regeling draait
(met een binnentemperatuur) en de prijsoptimalisatie aan staat, en er prijzen
binnenkomen via Stuur externe energieprijzen.

```text
WANNEER Dure periode nadert
DAN Bedrijfsmodus instellen op ECO
EN Stuur een pushmelding "Duur vanaf [Blok Starttijd]"
```

#### Energieprijs drempel overschreden

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer energieprijs categorie verandert (very_low, low,
normal, high, very_high)

Tokens: Prijs Categorie, Huidige Prijs (€/kWh), Volgende Uur Prijs (€/kWh)

**Voorbeeld:** ECO bij een zeer hoge prijs en terug naar Normaal bij elke andere
categorie. De categorie is een code: very_low, low, normal, high of very_high.
Werkt alleen als de adaptieve regeling draait (met een binnentemperatuur) en de
prijsoptimalisatie aan staat, en er prijzen binnenkomen via Stuur externe
energieprijzen.

```text
WANNEER Energieprijs drempel overschreden
EN [Prijs Categorie] is precies very_high
DAN Bedrijfsmodus instellen op ECO
ANDERS Bedrijfsmodus instellen op Normaal
```

#### Goedkoopste blok gestart

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer het goedkoopste elektriciteitsprijs blok van de dag
begint. Gebruik dit om energieverbruik te maximaliseren tijdens goedkope
periodes.

Tokens: Blok Starttijd, Blok Eindtijd, Gemiddelde Prijs (€/kWh), Blok Duur
(uren)

**Voorbeeld:** verwarm het tapwater extra in het goedkoopste blok en zet het
daarna terug, met een vertraging op de tweede actiekaart. De lengte van het blok
stel je in bij Prijsblok Grootte (uren), standaard 4. Werkt alleen als de
adaptieve regeling draait (met een binnentemperatuur) en de prijsoptimalisatie
aan staat, en er prijzen binnenkomen via Stuur externe energieprijzen.

```text
WANNEER Goedkoopste blok gestart
DAN Warmwatertemperatuur instellen op 55
EN Warmwatertemperatuur instellen op 48 (vertraging 4 uur)
```

#### Prijstrend veranderd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer de prijstrendrichting van elektriciteit verandert
(stijgend, dalend, stabiel). Gebaseerd op lineaire regressie analyse met
betrouwbaarheidsdrempel.

Tokens: Vorige Trend, Nieuwe Trend, Uren Geanalyseerd

**Voorbeeld:** maak een notificatie als de prijzen gaan stijgen of dalen. Werkt
alleen als de adaptieve regeling draait (met een binnentemperatuur) en de
prijsoptimalisatie aan staat, en er prijzen binnenkomen via Stuur externe
energieprijzen.

```text
WANNEER Prijstrend veranderd
DAN Maak een notificatie "Prijstrend [Vorige Trend] naar [Nieuwe Trend]"
```

### Triggers: Adaptieve regeling en gebouwmodel

#### Adaptieve regeling beveelt temperatuur aanpassing aan

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer adaptieve regeling een aanbevolen temperatuur berekent
(alleen bij significante actie nodig). Gebruik building_model_confidence om te
filteren op modelbetrouwbaarheid. Gebruik de actie 'Doel (setpoint) temperatuur
instellen' om toe te passen. Aurora I/II via Modbus: de aanbeveling volgt de
modus van de warmtepomp (verwarmings-setpoint in verwarmingsmodi,
vloerverwarmings-setpoint in vloerverwarmingsmodi); pas toe met 'Setpoint
temperatuur instellen (per modus)' op Auto.

Tokens: Huidige doeltemperatuur, Aanbevolen doeltemperatuur, Temperatuur
aanpassing, Reden voor aanpassing, Controller, Gebouwmodel Betrouwbaarheid (%),
Regelmodus

**Voorbeeld:** dit is de kern van de adaptieve regeling: de regeling stelt het
setpoint niet zelf in, deze flow voert de aanbeveling uit. Bij de Aurora I/II
via Modbus volgt de aanbeveling de modus; gebruik daar Setpoint temperatuur
instellen (per modus) op Auto. Bij de Aurora I/II blijft het setpoint alleen
staan als de stooklijn op UIT staat.

```text
WANNEER Adaptieve regeling beveelt temperatuur aanpassing aan
DAN Doel (setpoint) temperatuur instellen op [Aanbevolen doeltemperatuur]
    Automatisch afronden (aanbevolen)
```

#### Adaptieve regeling status gewijzigd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer adaptieve temperatuurregeling wordt in- of
uitgeschakeld

Tokens: Status, Reden

**Voorbeeld:** krijg een melding als de adaptieve regeling aan of uit gaat.

```text
WANNEER Adaptieve regeling status gewijzigd
DAN Stuur een pushmelding "Adaptieve regeling [Status]: [Reden]"
```

#### Forecast verwarmingsadvies beschikbaar

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Activeert wanneer nieuw COP-geoptimaliseerd verwarmingsadvies beschikbaar is op
basis van temperatuurprognose

Tokens: Wacht uren, Verwachte COP, Huidige COP, Advies

**Voorbeeld:** ontvang het advies op basis van de verwachte buitentemperatuur:
wachten omdat het later warmer en dus zuiniger is, of juist nu verwarmen. De
kaart gaat af als het advies verandert. Vereist de weerprognose in de
instellingen.

```text
WANNEER Forecast verwarmingsadvies beschikbaar
DAN Maak een notificatie "[Advies]"
```

#### Gebouwmodel leer mijlpaal

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Wordt geactiveerd wanneer het thermisch gebouwmodel een leermijlpaal bereikt
(bijv. 70% vertrouwen)

Tokens: Mijlpaal, Vertrouwen, Thermische Massa (kWh/°C), Tijdsconstante (uren)

**Voorbeeld:** krijg één melding als het gebouwmodel 70% vertrouwen bereikt. Na
het opnieuw beginnen met leren gaat de kaart opnieuw af.

```text
WANNEER Gebouwmodel leer mijlpaal
DAN Stuur een pushmelding "Gebouwmodel: [Mijlpaal]"
```

#### Gebouwprofiel mismatch gedetecteerd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggert wanneer geleerd gebouwgedrag significant afwijkt van geselecteerd
profiel (>30% afwijking). Stelt optimaal profiel voor sneller leren voor.

Tokens: Huidig Profiel, Voorgesteld Profiel, Geleerde τ (uren), Profiel τ
(uren), Afwijking (%), Betrouwbaarheid (%)

**Voorbeeld:** het geleerde gedrag past niet bij het gekozen gebouwtype. Kies
het voorgestelde type in de instellingen (Gebouwtype) om sneller te leren.

```text
WANNEER Gebouwprofiel mismatch gedetecteerd
DAN Stuur een pushmelding "Gebouwtype [Voorgesteld Profiel] past beter"
```

#### Gesimuleerde temperatuur bijgewerkt

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggert elke regelcyclus (5 min) met volledige breakdown van wat adaptieve
regeling berekent. Gebruik voor monitoring, logging en filteren op
betrouwbaarheid. Filter op building_model_confidence om alleen te acteren op
aanbevelingen met hoge betrouwbaarheid.

Tokens: Gesimuleerd Doel (°C), Werkelijk Doel (°C), Verschil (°C), Aanpassing
(°C), Comfort Component (°C), Efficiëntie Component (°C), Kosten Component (°C),
Gebouwmodel Betrouwbaarheid (%), COP Betrouwbaarheid (%), Coast-component (°C),
Redenering

**Voorbeeld:** de kaart gaat elke regelronde af (ongeveer elke 5 minuten).
Gebruik hem om waarden bij te houden, niet voor meldingen.

```text
WANNEER Gesimuleerde doeltemperatuur bijgewerkt
DAN Zet een numerieke variabele: Advies op [Gesimuleerd Doel (°C)]
```

#### Nieuw gebouw inzicht gedetecteerd

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggert wanneer gebouwmodel uitvoerbaar prestatie-inzicht detecteert (≥70%
betrouwbaarheid). Gebruik tokens om te filteren op categorie en
besparingspotentieel.

Tokens: Categorie, Inzicht, Aanbeveling, Prioriteit (0-100), Betrouwbaarheid
(%), Geschatte Besparing (€/maand, niet meer berekend)

**Voorbeeld:** ontvang een nieuw inzicht over de woning zodra het gebouwmodel
betrouwbaar genoeg is (instelling Minimale Betrouwbaarheid (%), standaard 70%).

```text
WANNEER Nieuw gebouw inzicht gedetecteerd
DAN Stuur een pushmelding "[Inzicht] [Aanbeveling]"
```

#### Voorverwarm tijd aanbeveling

**Trigger** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Triggert wanneer ΔT (doel - binnen) 1.5°C overschrijdt. Geeft voorverwarm duur
gebaseerd op thermische respons van gebouw (τ). Vereist ≥70% model
betrouwbaarheid. Max 1x per 4 uur.

Tokens: Duur (uren), Temperatuurstijging (°C), Huidige Temperatuur (°C),
Doeltemperatuur (°C), Betrouwbaarheid (%)

**Voorbeeld:** de kaart gaat af als het meer dan 1,5 °C kouder is dan gewenst en
het gebouwmodel betrouwbaar genoeg is (instelling Minimale Betrouwbaarheid (%),
standaard 70%), hooguit eens per 4 uur.

```text
WANNEER Voorverwarm tijd aanbeveling
DAN Stuur een pushmelding "Opwarmen duurt [Duur (uren)] uur"
```

## Voorwaarden

### Voorwaarden: Bediening en modi

#### Apparaat vermogen is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de apparaat vermogen status overeenkomt met de geselecteerde
status

- Vermogen status: Aan, Uit

**Voorbeeld:** zet het setpoint alleen omlaag als de warmtepomp aan staat.

```text
WANNEER De laatste persoon weggaat
EN Apparaat vermogen is Aan
DAN Doel (setpoint) temperatuur instellen op 30
```

#### Bedrijfsmodus is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus

Controleer of de bedrijfsmodus overeenkomt met de geselecteerde modus

- Werkmodus: ECO, Normaal, Boost

**Voorbeeld:** zet de warmtepomp 's ochtends terug op Normaal als hij nog op ECO
staat.

```text
WANNEER De tijd is 07:00
EN Bedrijfsmodus is ECO
DAN Bedrijfsmodus instellen op Normaal
```

#### Compressor draait

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de compressor momenteel draait

**Voorbeeld:** krijg een melding als de compressor nog draait wanneer een dure
periode begint.

```text
WANNEER Dure periode nadert
EN Compressor is draaiend
DAN Stuur een pushmelding "De warmtepomp draait in de dure periode"
```

#### Doel (setpoint) temperatuur is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de doel (setpoint) temperatuur voldoet aan de opgegeven voorwaarde

- Vergelijking: Gelijk aan, Groter dan, Kleiner dan
- Temperatuur (Aurora I/II via Tuya): getal, 5 tot 60 °C
- Temperatuur (Aurora I/II via Modbus, Aurora III via Modbus): getal, 15 tot 60
  °C

**Voorbeeld:** verlaag het setpoint 's nachts alleen als het hoger staat dan de
nachtwaarde.

```text
WANNEER De tijd is 23:00
EN Doel (setpoint) temperatuur is Groter dan 35°C
DAN Doel (setpoint) temperatuur instellen op 32
```

#### Stille modus is

**Voorwaarde** · Aurora III via Modbus

Controleer het niveau van de stille modus van de warmtepomp

- Stille modus: Uit, Niveau 1, Niveau 2

**Voorbeeld:** zet 's ochtends de stille modus uit als hij nog aan staat.

```text
WANNEER De tijd is 07:00
EN Stille modus is niet Uit
DAN Stille modus instellen op Uit
```

#### Stroomverbruik controleren is

**Voorwaarde** · Aurora I/II via Tuya

Controleer of het stroomverbruik controle niveau voldoet aan de opgegeven
voorwaarde

- Vergelijking: Gelijk aan, Groter dan, Kleiner dan
- Stroomverbruik controleren: getal, 0 tot 2

**Voorbeeld:** deze instelling geeft aan welke stroommodule in de warmtepomp zit
(0 = geen, 1 = eenfase, 2 = driefase). Gebruik de kaart om te controleren of die
waarde nog klopt, bijvoorbeeld na een storing.

```text
WANNEER De tijd is 08:00
EN Stroomverbruik controleren is niet Gelijk aan 1
DAN Stuur een pushmelding "Instelling stroommodule is gewijzigd"
```

#### Tapwater wordt verwarmd

**Voorwaarde** · Aurora III via Modbus

Controleer of de warmtepomp op dit moment tapwater verwarmt

**Voorbeeld:** zet de stille modus pas aan als de warmtepomp geen tapwater meer
verwarmt.

```text
WANNEER De tijd is 22:00
EN Tapwater wordt niet verwarmd
DAN Stille modus instellen op Niveau 2
```

#### Verwarmingscurve (stooklijn) instelling is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus

Controleer of de verwarmingscurve (stooklijn) instelling overeenkomt met de
geselecteerde curve

- Stooklijn (verwarmingscurve): UIT, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3,
  L4, L5, L6, L7, L8 - custom curve

**Voorbeeld:** pas het setpoint alleen aan als de stooklijn op UIT staat; met
een stooklijn bepaalt de warmtepomp de aanvoertemperatuur zelf en houdt hij een
ingesteld setpoint niet vast.

```text
WANNEER De tijd is 06:00
EN Verwarmingscurve (stooklijn) instelling is UIT
DAN Doel (setpoint) temperatuur instellen op 40
```

#### Verwarmingsmodus is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de verwarmingsmodus overeenkomt met de geselecteerde modus

- Verwarmingsmodus (Aurora I/II via Tuya, Aurora I/II via Modbus): Koud,
  Verwarmen, Vloerverwarming, Warm water, Koud en warm water, Verwarmen en warm
  water, Vloerverwarming en warm water
- Verwarmingsmodus (Aurora III via Modbus): Uit, Koeling, Verwarmen, Auto

**Voorbeeld:** schakel in mei over op alleen warm water, maar alleen als de
warmtepomp nog op verwarmen en warm water staat. De Aurora III kent andere modi
(Koeling, Verwarmen, Auto) en geen aparte warmwatermodus.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 mei
EN Verwarmingsmodus is Verwarmen en warm water
DAN Verwarmingsmodus instellen op Warm water
```

#### Warmwater curve instelling is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus

Controleer of de warmwater curve instelling overeenkomt met de geselecteerde
instelling

- Instelling warmwater curve: UIT, H1, H2, H3, H4

**Voorbeeld:** zet de warmwatercurve 's avonds weer aan als hij uit staat.

```text
WANNEER De tijd is 22:00
EN Warmwater curve instelling is UIT
DAN Warmwater curve instellen op H2
```

#### Warmwatertemperatuur is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de warmwatertemperatuur voldoet aan de opgegeven voorwaarde

- Vergelijking: Gelijk aan, Groter dan, Kleiner dan
- Warmwatertemperatuur : getal, 20 tot 75 °C

**Voorbeeld:** de kaart vergelijkt het ingestelde warmwatersetpoint, niet de
gemeten boilertemperatuur. Zet het setpoint terug als het na een verhoging te
hoog is blijven staan.

```text
WANNEER De tijd is 23:00
EN Warmwatertemperatuur is Groter dan 50°C
DAN Warmwatertemperatuur instellen op 48
```

#### Water controle modus is

**Voorwaarde** · Aurora I/II via Tuya

Controleer of de water controle modus voldoet aan de opgegeven voorwaarde

- Vergelijking: Gelijk aan, Groter dan, Kleiner dan
- Water controle modus: getal, 0 tot 1

**Voorbeeld:** dit is een installatie-instelling; gebruik de kaart om een
onverwachte waarde te melden.

```text
WANNEER De tijd is 08:00
EN Water controle modus is niet Gelijk aan 0
DAN Stuur een pushmelding "Water controle modus staat op 1"
```

### Voorwaarden: Temperaturen, storingen en alarmen

#### Buitentemperatuur boven

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de buitentemperatuur boven of onder een specifieke waarde is

- Temperatuur: getal, -30 tot 50 °C

**Voorbeeld:** verwarm het tapwater extra in het goedkoopste blok, maar alleen
als het buiten koud is.

```text
WANNEER Goedkoopste blok gestart
EN Buitentemperatuur is onder 5°C
DAN Warmwatertemperatuur instellen op 55
EN Warmwatertemperatuur instellen op 48 (vertraging 4 uur)
```

#### Elektrische balans controle

**Voorwaarde** · Aurora I/II via Tuya

Controleer of de 3-fase elektrische stromen gebalanceerd zijn binnen de
tolerantie

- Balans tolerantie : getal, 1 tot 20 %

**Voorbeeld:** controleer dagelijks of de drie fasen ongeveer even zwaar belast
worden.

```text
WANNEER De tijd is 12:00
EN Compressor is draaiend
EN 3-fase elektrische balans is buiten 10% tolerantie
DAN Stuur een pushmelding "Fasen ongelijk belast"
```

#### Fout is actief

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of er momenteel een fout actief is (foutcode > 0)

**Voorbeeld:** krijg elke ochtend een herinnering zolang er nog een storing
actief is.

```text
WANNEER De tijd is 08:00
EN Fout is actief
DAN Stuur een pushmelding "De warmtepomp meldt nog een storing"
```

#### Systeem puls-stappen verschil controle

**Voorwaarde** · Aurora I/II via Tuya

Controleer of het puls-stappen verschil tussen EEV en EVI boven of onder een
drempel is

- Puls-stappen verschil: getal, 0 tot 1000 Pulse-steps

**Voorbeeld:** leg het verschil tussen de EEV- en EVI-klep vast als hulp bij het
zoeken naar een storing.

```text
WANNEER De tijd is 14:00
EN Systeem puls-stappen verschil is boven 300
DAN Maak een notificatie "Groot verschil EEV en EVI"
```

#### Temperatuur verschil controle

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of het temperatuurverschil tussen inlaat en uitlaat boven of onder
een drempel is

- Temperatuur verschil : getal, 1 tot 50 °C

**Voorbeeld:** een groot verschil tussen aanvoer en retour kan op te weinig
doorstroming wijzen.

```text
WANNEER De tijd is 14:00
EN Compressor is draaiend
EN Temperatuur verschil is boven 8°C
DAN Stuur een pushmelding "Groot verschil aanvoer en retour"
```

#### Water doorstroming controle

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of water doorstroming boven of onder een drempel is

- Doorstroming (L/min): getal, 1 tot 100 L/min

**Voorbeeld:** controleer de doorstroming op een vast moment terwijl de
compressor draait.

```text
WANNEER De tijd is 10:00
EN Compressor is draaiend
EN Water doorstroming is onder 15 L/min
DAN Stuur een pushmelding "Weinig doorstroming, controleer het filter"
```

### Voorwaarden: Energie en rendement (COP)

#### COP berekeningsmethode is

**Voorwaarde** · Aurora I/II via Tuya

Controleer welke berekeningsmethode werd gebruikt voor de huidige COP waarde -
nuttig voor automatisering op basis van data beschikbaarheid

- Berekeningsmethode: Directe thermische (meest nauwkeurig), Carnot schatting
  (gemiddelde nauwkeurigheid), Temperatuurverschil (basis), Onvoldoende data

**Voorbeeld:** reageer alleen op een lage COP als die is berekend uit gemeten
doorstroming, temperaturen en stroomverbruik.

```text
WANNEER COP efficiëntie gewijzigd onder 2
EN COP berekeningsmethode is Directe thermische (meest nauwkeurig)
DAN Stuur een pushmelding "Lage COP: [Huidige COP]"
```

#### COP efficiëntie is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de huidige prestatiecoëfficiënt (COP) boven of onder een drempel
is

- COP drempel: getal, 1 tot 8 COP

**Voorbeeld:** warm het tapwater 's middags extra op als de warmtepomp op dat
moment efficiënt draait, en zet het setpoint 's avonds terug.

```text
WANNEER De tijd is 14:00
EN COP efficiëntie is boven 4
DAN Warmwatertemperatuur instellen op 55

WANNEER De tijd is 18:00
DAN Warmwatertemperatuur instellen op 48
```

#### COP trend analyse

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer de COP prestatie trend over een opgegeven tijdsperiode

- Tijdsperiode : getal, 1 tot 168 h

**Voorbeeld:** een wekelijkse controle van het rendement.

```text
WANNEER De tijd is 10:00
EN Vandaag is een zondag
EN COP trend is verslechterend over 168 uur
DAN Stuur een pushmelding "Het rendement loopt deze week terug"
```

#### Dagelijkse COP boven drempel

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de 24-uur gemiddelde COP boven of onder een drempel is

- Dagelijkse COP drempel: getal, 1 tot 8 COP

**Voorbeeld:** voeg een waarschuwing toe aan het avondrapport als de dag-COP
laag was.

```text
WANNEER Prestatierapport is beschikbaar
EN Dagelijkse COP is onder 2,5
DAN Stuur een pushmelding "Lage dag-COP: [Samenvatting]"
```

#### Maandelijkse COP boven drempel

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de 30-dagen gemiddelde COP boven of onder een drempel is

- Maandelijkse COP drempel: getal, 1 tot 8 COP

**Voorbeeld:** leg vast als de maand-COP onder een grens ligt.

```text
WANNEER Prestatierapport is beschikbaar
EN Maandelijkse COP is onder 3
DAN Maak een notificatie "Maand-COP onder 3"
```

#### Stroomverbruik boven

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of het huidige stroomverbruik boven of onder een drempel is (vereist
vermogen monitoring ondersteuning)

- Vermogen drempel (W): getal, 100 tot 10000 W

**Voorbeeld:** zet de warmtepomp op ECO als hij in de dure periode veel vermogen
vraagt. Vereist een vermogensmeting; de Aurora III kent geen ECO-modus.

```text
WANNEER Dure periode nadert
EN Stroomverbruik is boven 1500 watt
DAN Bedrijfsmodus instellen op ECO
```

#### Totaalverbruik boven drempel

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of het totale stroomverbruik boven of onder een drempel is

- Verbruiksdrempel (kWh): getal, 100 tot 50000 kWh

**Voorbeeld:** een jaarlijkse herinnering zodra het totaalverbruik een grens
voorbij is.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 september
EN Totaalverbruik is boven 20000 kWh
DAN Stuur een pushmelding "Tijd voor onderhoud"
```

### Voorwaarden: Energieprijzen

#### Inzicht besparing is boven drempel

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

**Vervallen: niet meer te kiezen in nieuwe flows.**

Controleer of geschatte maandelijkse besparing voor een inzicht categorie een
drempel overschrijdt (in EUR/maand). Gebruik voor ROI-gebaseerde filtering
(bijv. alleen actie bij besparing >€100/maand).

- Categorie: Isolatieprestaties, Voorverwarm strategie, Thermische opslag
- Drempel (EUR/maand): getal, 0 tot 500

**Voorbeeld:** sinds versie 3.4.2 schat de app geen besparing in euro's meer,
omdat die met dynamische prijzen niet te onderbouwen is. De kaart geeft altijd
onwaar. Gebruik in plaats daarvan Inzicht is actief.

#### Prijs in goedkoopste uren

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of het huidige uur binnen het goedkoopste N-uurs blok van vandaag
valt. Nuttig voor het uitvoeren van energievretende taken tijdens goedkope
periodes.

- Blokgrootte (uren): getal, 1 tot 12 h

**Voorbeeld:** verwarm het tapwater alleen in de drie goedkoopste uren van de
dag. Vereist prijzen via Stuur externe energieprijzen.

```text
WANNEER Elke 1 uur
EN Huidig uur is in goedkoopste 3 uren van vandaag
DAN Warmwatertemperatuur instellen op 55
ANDERS Warmwatertemperatuur instellen op 48
```

#### Prijs vs daggemiddelde

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of de huidige elektriciteitsprijs afwijkt van het daggemiddelde met
minimaal het opgegeven margepercentage. Nuttig voor het detecteren van
aanzienlijk lage of hoge prijzen.

- Marge (%): getal, 0 tot 50 %

**Voorbeeld:** Boost als de prijs ruim onder het daggemiddelde ligt, anders
Normaal. Vereist prijzen via Stuur externe energieprijzen; de Aurora III kent
geen Boost.

```text
WANNEER Elke 1 uur
EN Huidige prijs is onder daggemiddelde met 20%
DAN Bedrijfsmodus instellen op Boost
ANDERS Bedrijfsmodus instellen op Normaal
```

#### Prijstrend is

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of elektriciteitsprijzen stijgen, dalen of stabiel zijn in de komende
N uur. Gebaseerd op lineaire regressie met betrouwbaarheidsmeting.

- Analysevenster (uren): getal, 1 tot 24 h
- Trend: Stijgend, Dalend, Stabiel

**Voorbeeld:** warm het tapwater 's ochtends op als de prijzen de komende uren
stijgen, en zet het later terug. Vereist prijzen via Stuur externe
energieprijzen.

```text
WANNEER De tijd is 06:00
EN Prijstrend voor komende 6 uur is Stijgend
DAN Warmwatertemperatuur instellen op 55
EN Warmwatertemperatuur instellen op 48 (vertraging 3 uur)
```

### Voorwaarden: Adaptieve regeling en gebouwmodel

#### Inzicht is actief

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of een specifieke inzicht categorie momenteel actief is (zichtbaar in
capabilities). Retourneert onwaar als genegeerd of niet gedetecteerd.

- Categorie: Isolatieprestaties, Voorverwarm strategie, Thermische opslag,
  Gebouwprofiel mismatch

**Voorbeeld:** herinner wekelijks aan een openstaand inzicht.

```text
WANNEER De tijd is 09:00
EN Vandaag is een maandag
EN Isolatieprestaties inzicht is actief
DAN Stuur een pushmelding "Er is een inzicht over de isolatie"
```

#### Model betrouwbaarheid is boven drempel

**Voorwaarde** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Controleer of gebouwmodel betrouwbaarheid een drempel overschrijdt (0-100%).
Gebruik als kwaliteitspoort voor flows (bijv. alleen notificaties versturen
wanneer betrouwbaarheid >80%).

- Drempel (%): getal, 0 tot 100

**Voorbeeld:** voer de aanbeveling pas uit als het gebouwmodel betrouwbaar
genoeg is.

```text
WANNEER Adaptieve regeling beveelt temperatuur aanpassing aan
EN Model betrouwbaarheid is boven 70%
DAN Doel (setpoint) temperatuur instellen op [Aanbevolen doeltemperatuur]
    Automatisch afronden (aanbevolen)
```

## Acties

### Acties: Bediening en modi

#### Apparaat vermogen instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus

Stel de apparaat vermogen status in

- Vermogen status: Aan, Uit

**Voorbeeld:** zet de warmtepomp aan en uit met een virtuele knop.

```text
WANNEER Virtuele knop Warmtepomp is uitgezet
DAN Apparaat vermogen instellen op Uit
```

#### Bedrijfsmodus instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus

Stel de systeem werkmodus in

- Werkmodus: ECO, Normaal, Boost

**Voorbeeld:** Boost in het goedkoopste blok, ECO in de dure periode.

```text
WANNEER Goedkoopste blok gestart
DAN Bedrijfsmodus instellen op Boost

WANNEER Dure periode nadert
DAN Bedrijfsmodus instellen op ECO
```

#### Curve instellen (per modus)

**Actie** · Aurora I/II via Modbus

Stel de curve-instelling in, gericht op verwarmen, koelen, vloerverwarming of
warm water. Auto volgt de huidige modus van de warmtepomp.

- Toepassen op: Auto (volg huidige modus), Verwarmen, Koelen, Vloerverwarming,
  Warm water
- Curve instelling: UIT, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3, L4, L5, L6,
  L7, L8 - custom curve

**Voorbeeld:** zet bij de start van het stookseizoen de stooklijn voor
vloerverwarming.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 oktober
DAN Curve instellen op L3 voor Vloerverwarming
```

#### Doel (setpoint) temperatuur instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stel de doel (setpoint) temperatuur voor de warmtepomp in

- Temperatuur (°C) (Aurora I/II via Tuya): getal, 5 tot 75 °C
- Temperatuur (°C) (Aurora I/II via Modbus, Aurora III via Modbus): getal, 15
  tot 60 °C
- Bij decimale waarde: Automatisch afronden (aanbevolen), Foutmelding tonen

**Voorbeeld:** zo pas je de aanbeveling van de adaptieve regeling toe: de
regeling stelt het setpoint niet zelf in, maar geeft een aanbeveling die je flow
uitvoert. Bij de Aurora I/II blijft het setpoint alleen staan als de stooklijn
op UIT staat. Zet het setpoint niet ook nog met een andere flow, anders werken
de twee elkaar tegen.

```text
WANNEER Adaptieve regeling beveelt temperatuur aanpassing aan
DAN Doel (setpoint) temperatuur instellen op [Aanbevolen doeltemperatuur]
    Automatisch afronden (aanbevolen)
```

#### Geforceerde bijverwarming schakelen

**Actie** · Aurora III via Modbus

Forceert de elektrische bijverwarming of geeft deze weer vrij

- Stand: aan, uit

**Voorbeeld:** forceer bij strenge vorst de elektrische bijverwarming en geef
hem weer vrij als het minder koud is.

```text
WANNEER Buitentemperatuur gewijzigd onder -10°C
DAN Geforceerde bijverwarming aan schakelen

WANNEER Buitentemperatuur gewijzigd boven -5°C
DAN Geforceerde bijverwarming uit schakelen
```

#### Setpoint temperatuur instellen (per modus)

**Actie** · Aurora I/II via Modbus

Stel de setpoint temperatuur in, gericht op verwarmen, koelen of
vloerverwarming. Auto volgt de huidige modus van de warmtepomp.

- Temperatuur (°C): getal, 7 tot 60 °C
- Toepassen op: Auto (volg huidige modus), Verwarmen, Koelen, Vloerverwarming
- Bij decimale waarde: Automatisch afronden (aanbevolen), Foutmelding tonen

**Voorbeeld:** een lager setpoint voor vloerverwarming 's nachts. Het setpoint
blijft alleen staan als de stooklijn op UIT staat.

```text
WANNEER De tijd is 23:00
DAN Setpoint instellen op 30 voor Vloerverwarming
    Automatisch afronden (aanbevolen)
```

#### Stel Custom stooklijn in (L28/L29)

**Actie** · Aurora I/II via Modbus

Schrijft de DIY stooklijn direct naar Modbus-registers L27, L28 en L29. slope is
de hellingscoëfficiënt k (bijv. -0.5), intercept is de aanvoertemperatuur bij
-15°C buiten (L29, bijv. 55). Geldig bereik: slope -5,0..0,0, intercept 30..80.
Capabilities heating_curve_slope en heating_curve_intercept worden binnen 30
seconden bijgewerkt via polling.

- Helling (k, bijv. -0.5): getal
- Intercept (aanvoertemp bij -15°C, bijv. 55): getal

**Voorbeeld:** stel bij de start van het stookseizoen een eigen stooklijn in. De
kaart zet de eigen stooklijn ook aan; een helling van -0,5 en 50 °C bij -15 °C
buiten geeft bij 5 °C buiten 40 °C aanvoer.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 oktober
DAN Stel Custom stooklijn in: helling -0.5, intercept 50°C
```

#### Stille modus instellen

**Actie** · Aurora III via Modbus

Stelt het niveau van de stille modus van de warmtepomp in

- Stille modus: Uit, Niveau 1, Niveau 2

**Voorbeeld:** 's nachts stiller draaien.

```text
WANNEER De tijd is 22:00
DAN Stille modus instellen op Niveau 2

WANNEER De tijd is 07:00
DAN Stille modus instellen op Uit
```

#### Stroomverbruik controleren instellen

**Actie** · Aurora I/II via Tuya

Stel de stroomverbruik controle niveau in

- Stroomverbruik controleren: getal, 0 tot 2

**Voorbeeld:** deze instelling geeft aan welke stroommodule in de warmtepomp zit
(0 = geen, 1 = eenfase, 2 = driefase). Wijzig hem alleen als de installateur dat
aangeeft; gebruik de kaart niet in een automatische flow.

#### Tapwaterfunctie schakelen

**Actie** · Aurora III via Modbus

Schakelt de tapwaterverwarming aan of uit

- Stand: aan, uit

**Voorbeeld:** zet de tapwaterverwarming uit tijdens de vakantie, met een
Ja/Nee-variabele Vakantie.

```text
WANNEER Een variabele is veranderd (Vakantie)
EN Vakantie is gelijk aan ja
DAN Tapwaterfunctie uit schakelen
```

#### Verwarmingscurve (stooklijn) instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus

Stel de stooklijn instelling in

- Verwarmingscurve instelling: UIT, H1, H2, H3, H4, H5, H6, H7, H8, L1, L2, L3,
  L4, L5, L6, L7, L8 - custom curve

**Voorbeeld:** vanaf het stookseizoen een hogere stooklijn.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 oktober
DAN Verwarmingscurve (stooklijn) instellen op H4
```

#### Verwarmingsmodus instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stel de verwarming bedrijfsmodus in

- Verwarmingsmodus (Aurora I/II via Tuya, Aurora I/II via Modbus): Koud,
  Verwarmen, Vloerverwarming, Warm water, Koud en warm water, Verwarmen en warm
  water, Vloerverwarming en warm water
- Verwarmingsmodus (Aurora III via Modbus): Koeling, Verwarmen, Auto

**Voorbeeld:** schakel bij de start van het stookseizoen terug naar verwarmen en
warm water. Bij de Aurora III kies je hier Verwarmen.

```text
WANNEER De tijd is 08:00
EN De dag en maand zijn 1 oktober
DAN Verwarmingsmodus instellen op Verwarmen en warm water
```

#### Warmwater curve instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus

Stel de warmwater curve instelling voor optimale efficiëntie in

- Warmwater curve instelling: UIT, H1, H2, H3, H4

**Voorbeeld:** 's ochtends een hogere warmwatercurve voor de douchepiek.

```text
WANNEER De tijd is 05:30
DAN Warmwater curve instellen op H3

WANNEER De tijd is 09:00
DAN Warmwater curve instellen op H1
```

#### Warmwatertemperatuur instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stel de warmwatertemperatuur in

- Warmwatertemperatuur (°C): getal, 20 tot 75 °C

**Voorbeeld:** verwarm het tapwater extra in het goedkoopste blok.

```text
WANNEER Goedkoopste blok gestart
DAN Warmwatertemperatuur instellen op 55

WANNEER Dure periode nadert
DAN Warmwatertemperatuur instellen op 48
```

#### Water controle modus instellen

**Actie** · Aurora I/II via Tuya

Stel de water controle modus instelling in

- Water controle modus: getal, 0 tot 1

**Voorbeeld:** dit is een installatie-instelling. Wijzig hem alleen als de
installateur dat aangeeft; gebruik de kaart niet in een automatische flow.

### Acties: Energie en rendement (COP)

#### Genereer prestatierapport

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Genereer een uitgebreid warmtepomp prestatierapport met scores over 7 domeinen
(efficiëntie, gebouw, ontdooiing, energie, prijzen, telemetrie, gezondheid).
Retourneert totaalscore, beoordeling en bruikbare aanbevelingen.

Tokens: Totaalscore (0-100), Beoordeling, Samenvatting, Aanbevelingen, Volledig
rapport (JSON)

**Voorbeeld:** maak het rapport op een ander moment dan 23:00 en stuur de
uitkomst door.

```text
WANNEER De tijd is 18:00
EN Vandaag is een zondag
DAN Genereer prestatierapport
EN Stuur een pushmelding "[Beoordeling]: [Samenvatting]"
```

### Acties: Energieprijzen

#### Stuur energieprijzen naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt uurlijkse energieprijzen (€/kWh) van externe bron om prijsgebaseerde
optimalisatie mogelijk te maken. Accepteert twee formaten: Array [0.11,0.10,...]
waarbij index=uur offset (0=huidig uur), of Object {"0":0.11,"1":0.10,...} met
uur-keys.

- Energieprijzen (JSON): tekst

**Voorbeeld:** de app haalt zelf geen prijzen op. Stuur ze als tekst vanuit een
andere app, een variabele of een HTTP-verzoek, bijvoorbeeld [0.21,0.19,0.18,...]
in €/kWh, waarbij het eerste getal het huidige uur is. De prijzen gelden vanaf
het moment van ontvangen; stuur nieuwe zodra die er zijn, bijvoorbeeld elke
middag na de publicatie van de prijzen voor morgen.

```text
WANNEER De tijd is 14:30
DAN Stuur externe energieprijzen [Prijzen] voor prijsoptimalisatie
```

### Acties: Adaptieve regeling en gebouwmodel

#### Bereken voorverwarm starttijd

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Bereken wanneer te beginnen met verwarmen om de gewenste binnentemperatuur op
een specifiek tijdstip te bereiken. Gebruikt de thermische tijdsconstante (τ)
van het gebouwmodel voor nauwkeurige voorspelling.

- Gewenste binnentemperatuur (°C): getal, 16 tot 28
- Klaar om (UU:MM): tekst

Tokens: Starttijd, Duur (uren), Voorgestelde setpoint verhoging (°C), Model
betrouwbaarheid (%)

**Voorbeeld:** bereken 's nachts wanneer de verwarming moet beginnen om om 07:00
21 °C te halen. De tijd vul je in als UU:MM.

```text
WANNEER De tijd is 04:00
DAN Bereken wanneer te beginnen met verwarmen om 21°C te bereiken
    om 07:00
EN Stuur een pushmelding "Start om [Starttijd]"
```

#### Forceer inzicht analyse

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Evalueer direct gebouw inzichten (zonder te wachten op 50-minuten interval).
Retourneert aantal gedetecteerde inzichten en huidige model betrouwbaarheid.

Tokens: Inzichten gedetecteerd, Model betrouwbaarheid (%)

**Voorbeeld:** laat de inzichten direct bijwerken in plaats van te wachten op de
volgende analyse (elke 50 minuten).

```text
WANNEER De tijd is 08:00
DAN Forceer inzicht analyse
EN Maak een notificatie "[Inzichten gedetecteerd] inzichten"
```

#### Gewenste binnentemperatuur instellen

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stel de gewenste kamertemperatuur in voor adaptieve regeling. Het adaptieve
systeem past het warmtepomp setpoint aan om deze temperatuur te bereiken.

- Binnentemperatuur : getal, 15 tot 25 °C

**Voorbeeld:** een lagere gewenste binnentemperatuur 's nachts. De adaptieve
regeling past haar aanbeveling daarop aan.

```text
WANNEER De tijd is 22:30
DAN Gewenste binnentemperatuur instellen op 19°C

WANNEER De tijd is 06:30
DAN Gewenste binnentemperatuur instellen op 21°C
```

### Acties: Externe gegevens

#### Stuur binnentemperatuur naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt huidige binnen-/kamertemperatuur van een externe sensor om adaptieve
temperatuurregeling mogelijk te maken

- Binnentemperatuur (°C): tekst

**Voorbeeld:** de adaptieve regeling werkt alleen met een binnentemperatuur.
Stuur die bij elke verandering van een kamersensor, het liefst met het token van
de sensor. Blijft de waarde 12 uur gelijk, dan meldt de app dat; na 24 uur
corrigeert de regeling er niet meer op. Typ je zelf een waarde, gebruik dan een
punt (21.5).

```text
WANNEER De temperatuur is veranderd (kamersensor woonkamer)
DAN Stuur [Temperatuur] °C binnentemperatuur voor adaptieve regeling
```

#### Stuur buitentemperatuur naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt buitentemperatuur gegevens naar de warmtepomp voor verbeterde
COP/thermische massa berekeningen

- Buitentemperatuur (°C): getal, -50 tot 50

**Voorbeeld:** gebruik een eigen buitensensor in plaats van de sensor van de
warmtepomp. Een waarde geldt een uur; daarna valt de adaptieve regeling terug op
de weerprognose en de sensor van de warmtepomp.

```text
WANNEER De temperatuur is veranderd (buitensensor)
DAN Stuur [Temperatuur]°C naar warmtepomp voor COP/thermische massa
    berekening
```

#### Stuur doorstroom gegevens naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt water doorstroom gegevens naar de warmtepomp voor verbeterde
COP-berekeningen

- Water doorstroom (L/min): getal, 0 tot 200

**Voorbeeld:** stuur de doorstroming van een externe flowmeter, als de
warmtepomp die zelf niet meet. Een waarde geldt een uur.

```text
WANNEER (trigger van je flowmeter bij een nieuwe meting)
DAN Stuur [Doorstroming]L/min naar warmtepomp voor COP berekening
```

#### Stuur vermogensgegevens naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt stroomverbruikgegevens naar de warmtepomp voor verbeterde
COP-berekeningen

- Stroomverbruik (W): getal, 0 tot 50000

**Voorbeeld:** stuur het gemeten vermogen van een kWh-meter of slimme stekker,
ook als het naar 0 W zakt. Dit geeft de nauwkeurigste COP-berekening en vult het
dagverbruik en de dagkosten. Voor de COP telt een waarde een uur mee; het
dagverbruik rekent door met de laatst ontvangen waarde.

```text
WANNEER Het vermogen is veranderd (kWh-meter warmtepomp)
DAN Stuur [Vermogen]W naar warmtepomp voor COP berekening
```

#### Stuur windsnelheid naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt windsnelheid voor warmteverlies correctie. Gebruik met KNMI weer app.

- Windsnelheid (km/u): getal, 0 tot 200

**Voorbeeld:** stuur de windsnelheid voor de correctie van het warmteverlies. De
kaart verwacht km/u; een waarde in m/s maal 3,6 is km/u. Een waarde geldt een
uur; daarna valt de app terug op de weerprognose.

```text
WANNEER Elke 15 minuten
DAN Stuur windsnelheid [Windsnelheid van je weer-app] km/u naar warmtepomp
```

#### Stuur zonnepaneel vermogen naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt zonnepaneel opbrengst voor nauwkeurige zonnestraling berekening. Gebruik
met SolarEdge, Enphase, etc.

- Zonnepaneel vermogen (W): getal, 0 tot 50000

**Voorbeeld:** de app rekent het vermogen van de zonnepanelen om naar
zonnestraling voor het gebouwmodel. Vul daarvoor Zonnepaneel systeem grootte
(Wp) in bij de instellingen. Een waarde geldt een uur; daarna valt de app terug
op de weerprognose.

```text
WANNEER Het vermogen is veranderd (omvormer zonnepanelen)
DAN Stuur zonnepaneel vermogen [Vermogen]W naar warmtepomp
```

#### Stuur zonnestraling naar warmtepomp

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Stuurt zonnestraling voor gebouwmodel. Gebruik met KNMI weer app.

- Zonnestraling (W/m²): getal, 0 tot 1500

**Voorbeeld:** stuur de gemeten zonnestraling, bijvoorbeeld uit een weer-app.
Zonnepanelen gaan voor als die ook gegevens sturen. Een waarde geldt een uur.

```text
WANNEER Elke 15 minuten
DAN Stuur zonnestraling [Zonnestraling van je weer-app] W/m² naar
    warmtepomp
```

### Acties: Rekenhulpen

#### Bereken Custom stooklijn (L28/L29)

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus

Berekent aanvoertemperatuur met Adlar Custom stooklijn. Gebruikt L29 (set temp
bij -15°C) en L28 (hellingsgraad per 10°C). Voorbeeld: L29=55°C bij -15°C met
L28=-5 geeft helling -0.5/°C, formule y = -0.5x + 47.5. Voor buitentemp 5°C →
aanvoertemp 45°C.

- Buitentemperatuur: tekst
- L29: Set temp bij -15°C buiten (°C): getal
- L28: Hellingsgraad (per 10°C): getal

Tokens: Aanvoertemperatuur, Verwarmingscurve Formule

**Voorbeeld:** bereken de aanvoertemperatuur van een rechte stooklijn zoals de
eigen stooklijn van de warmtepomp: L29 is de aanvoer bij -15 °C buiten, L28 de
helling per 10 °C. Met 55 en -5 geeft 5 °C buiten 45 °C aanvoer. Handig om een
stooklijn eerst uit te proberen.

```text
WANNEER Elke 30 minuten
DAN Bereken stooklijn: L29=55°C bij -15°C, L28=-5/10°C
    met buitentemp [Buitentemperatuur van de warmtepomp]
EN Maak een notificatie "Stooklijn geeft [Aanvoertemperatuur] °C"
```

#### Bereken waarde uit curveregels

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Berekent output waarden op basis van input (bijv. buitentemperatuur →
verwarmingssetpoint). Formaat: '[operator] drempel : waarde'. Operatoren: >, >=,
<, <=, ==, !=. Evalueert van boven naar beneden, geeft eerste match terug.
Gebruik 'default : waarde' als vangnet. Voorbeeld verwarmingscurve: '< 0 : 55, <
5 : 50, < 10 : 45, default : 35'

- Invoer Waarde: tekst
- Curve Definitie: tekst

Tokens: Resultaat Waarde

**Voorbeeld:** maak een eigen stooklijn in stappen: de eerste regel die past,
bepaalt de uitkomst. Het setpoint blijft bij de Aurora I/II alleen staan als de
stooklijn van de warmtepomp op UIT staat; gebruik dit niet samen met de
adaptieve regeling.

```text
WANNEER Elke 30 minuten
DAN Bereken waarde via [Buitentemperatuur van de warmtepomp]
    met curveregels < 0 : 55, < 5 : 50, < 10 : 45, default : 35
EN Doel (setpoint) temperatuur instellen op [Resultaat Waarde]
    Automatisch afronden (aanbevolen)
```

#### Bereken waarde uit tijdschema

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Evalueert de huidige tijd tegen een dagschema om uitvoerwaarden te berekenen.
Perfect voor tijdgebaseerde temperatuurschema's, tijd-van-gebruik tarieven en
geautomatiseerde dagelijkse routines.

- Tijdschema: tekst

Tokens: Resultaat waarde

**Voorbeeld:** een dagschema voor de gewenste binnentemperatuur. Periodes over
middernacht mogen; met default : waarde vang je de rest op.

```text
WANNEER Elke 30 minuten
DAN Bereken waarde uit tijdsperioden
    06:00-22:00: 21, 22:00-06:00: 19
EN Gewenste binnentemperatuur instellen op [Resultaat waarde]°C
```

#### Haal huidig seizoensmodus op

**Actie** · Aurora I/II via Tuya · Aurora I/II via Modbus · Aurora III via
Modbus

Retourneert verwarmings/koelmodus op basis van huidige datum. Stookseizoen: 1
okt - 15 mei (conform EN 14825 SCOP standaard). Perfect voor automatisch
schakelen tussen winter- en zomerschema's.

Tokens: Modus, Is stookseizoen, Is koelseizoen, Dagen tot seizoenswissel

**Voorbeeld:** het stookseizoen loopt van 1 oktober tot 15 mei. Bewaar de
uitkomst in een Ja/Nee-variabele, zodat andere flows erop kunnen testen.

```text
WANNEER De tijd is 00:05
DAN Haal seizoensmodus op
EN Zet een Ja/Nee variabele: Stookseizoen op [Is stookseizoen]
```

### Acties: Modbus-registers

#### Lees Modbus register

**Actie** · Aurora I/II via Modbus · Aurora III via Modbus

Leest één Modbus holding register (FC03) en geeft de registerwaarde terug als
flow token. Adres in hex (0x0301) of decimaal (769). Temperatuurregisters zijn
×10 opgeslagen — deel het resultaat door 10 voor °C.

- Registeradres: tekst

Tokens: Registerwaarde

**Voorbeeld:** lees een register dat de app zelf niet toont. Bij de Aurora I/II
is het adres hex of decimaal (0x0301 = 769, het verwarmingssetpoint);
temperaturen zijn ×10 opgeslagen. Bij de Aurora III gebruik je het getal na 4-
(4-2100 wordt 2100); input-registers (3-) zijn met deze kaart niet te lezen.

```text
WANNEER De tijd is 12:00
DAN Lees Modbus register 0x0301
EN Maak een notificatie "Register 0x0301: [Registerwaarde]"
```

#### Schrijf Modbus register

**Actie** · Aurora I/II via Modbus · Aurora III via Modbus

Schrijft een registerwaarde naar één Modbus holding register (FC06). Adres in
hex (0x0301) of decimaal (769). Temperatuurregisters verwachten ×10 — geef 450
op voor 45 °C. Gebruik met zorg: ongeldige waarden kunnen het gedrag van de
warmtepomp beïnvloeden.

- Registeradres: tekst
- Registerwaarde: getal

**Voorbeeld:** schrijf alleen naar een register waarvan je weet wat het doet;
een verkeerde waarde kan de warmtepomp ontregelen. Temperaturen zijn ×10: 350 is
35 °C. Het verwarmingssetpoint (0x0301) blijft bij de Aurora I/II alleen staan
als de stooklijn op UIT staat.

```text
WANNEER De tijd is 06:00
DAN Schrijf 350 naar Modbus register 0x0301
```
