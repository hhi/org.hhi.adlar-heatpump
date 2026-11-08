# ADR-066: Afgiftevertraging in het gebouwmodel

**Status:** Voorstel (2026-11-08)
**Datum:** 2026-11-08
**Beslissers:** -
**Gerelateerd:** [ADR-062](ADR-062-BUILDING-MODEL-REVIEW-IMPLEMENTATION.md)
(gebouwmodel, venster van 60 minuten);
[ADR-064](ADR-064-MEASURED-WINDOW-HEAT.md) O6 (afgiftevertraging, eigen besluit)
en O9 (koppeling UA–P_int); [ADR-065](ADR-065-POSITIONAL-PI-HEATING-CURVE.md)
(regelmodus met afgiftesysteem); open punten G1, G6, G7
**Simulatie:** `test/simulation/building-model-review/emitter-delay.js`

---

## Samenvatting voor de eigenaar

- **Probleem:** de learner koppelt de gemeten warmte aan de temperatuurstijging
  in hetzelfde uur. Bij een buffervat of vloerverwarming komt die warmte uren
  later in de kamer aan.
  - De learner ziet "warmte erin, kamer stijgt nauwelijks" en maakt de
    warmtecapaciteit C groot. Op de testinstallatie zit C tegen de grens van 40.
  - Uren later komt de warmte vrij. Die wordt verklaard met interne warmte
    (P_int 1,47 kW) en een hoger warmteverlies (UA).
  - τ = C/UA springt daardoor binnen een dag tussen 104 en 716 uur.
- **Besluit:**
  - De learner krijgt het gemeten vermogen **vertraagd** (een afgiftefilter).
  - De vertraging begint bij een **startwaarde** uit twee instellingen: het
    afgiftesysteem en het volume van het buffervat.
  - Daarna **leert** de app de vertraging uit de eigen metingen, en toont hij
    haar als inzicht.
  - Bij een grote sprong in de vertraging (60 min of meer), of een oud model dat
    tegen de grenzen vastzit, begint het model opnieuw vanaf het gebouwprofiel
    (D7).
- **Effect:**
  - In de simulatie kiest de app de juiste vertraging binnen één stap van het
    rooster.
  - Met die vertraging kloppen C en UA weer: C ~20 en UA ~0,135, tegen werkelijk
    20 en 0,14.
  - Op de echte data van de testinstallatie worden UA en P_int plausibel:
    0,12–0,15 en 0,3–0,6 kW, in plaats van 0,23 en 1,45.
- **Niet:** P_int vastzetten (G7 optie A). In de simulatie wordt UA iets beter,
  maar C en τ blijven fout en de voorspelling wordt slechter.

## 1. Context

### 1.1 Waarneming (G1, 25 okt–5 nov)

Hoofdapp op de Aurora II van de testinstallatie, uurwaarden uit Insights:

- C raakt sinds 29 okt elke dag de grens van 40 kWh/°C.
- τ slingert binnen één dag tussen 104 en 716 uur.
- P_int loopt mee met de kou op van 0,1 naar 1,47 kW.
- UA is als daggemiddelde plausibel (0,11–0,20), per uur niet (0,05–0,55).

Zie `todo/g1-eindoordeel.md` (lokaal).

### 1.2 Oorzaak

De testinstallatie heeft radiatoren met een buffervat van 120 liter (Bosch BH
120-5). De warmtepomp staat in modus 1 (Verwarming). De vertraging volgt uit
opslag gedeeld door afgifte:

- opslag: 120 L × 4,186/3600 ≈ 0,14 kWh/°C. Met de radiatoren en leidingen
  erbij: 0,20–0,26 kWh/°C;
- afgifte: gemiddeld 1,01 kW bij 41,6 °C water en 21,6 °C binnen, dus ~0,05
  kW/°C;
- vertraging: **~165 min** voor het vat alleen, **230–300 min** met de
  radiatoren erbij.

ADR-064 §3.2 zag in de simulatie al dat een afgiftevertraging van 3 uur C naar
de grens drijft. De waarde voor de testinstallatie in ADR-064 O6 ("15–60 min")
hield geen rekening met het buffervat.

### 1.3 Beschikbare metingen

- De buffersensor van de Aurora II (T10, register 0x0074) zit op de
  testinstallatie niet in het vat. Hij gaf 17–28 °C bij een aanvoer van 34–50
  °C.
- De totale wateruitlaat (T9, 0x0075) is gelijk aan de aanvoer.
- Aanvoer en retour (T7/T6) meten stilstaand water in de unit zodra de pomp
  stilstaat. Een correctie met hun temperatuurverandering verandert niets (C
  41–50).

Een directe meting van de opslag is er dus niet. De vertraging moet uit het
gedrag van de kamer blijken.

## 2. Besluiten

### D1 — Afgiftefilter in de learner

- `BuildingModelLearner` krijgt `emitterDelayMinutes` (config en
  `setEmitterDelay()`).
- Elk geaccepteerd sample gaat door een eerste-orde filter vóór het venster van
  60 minuten: `p_f ← p_f + (1 − e^(−Δt/τ)) · (p − p_f)`.
- Na een gat van meer dan 60 minuten, en bij het eerste sample, begint het
  filter bij het gemeten vermogen.
- De filterstand wordt met de learner-staat bewaard (optioneel veld; oude staat
  blijft geldig).
- Vertraging 0 is het huidige gedrag.

### D2 — Startwaarde uit twee instellingen

| Instelling | Waarden | Standaard |
| --- | --- | --- |
| Afgiftesysteem (`building_model_emitter_type`) | Automatisch, Radiatoren, Vloerverwarming | Automatisch |
| Buffervat (`building_model_buffer_volume`) | 0–2000 liter | 0 |

- Startwaarde = basis + 1 minuut per liter buffervat, begrensd op 0–360 min.
  - De basis is 30 min voor radiatoren, 180 min voor vloerverwarming en 60 min
    als het afgiftesysteem onbekend is.
- **Automatisch** neemt het afgiftesysteem uit:
  1. de regelmodus (ADR-065): Positioneel – Radiatoren of – Vloerverwarming;
  2. anders de modus van de warmtepomp:
     - Tuya: `floor_heating` of `floor_heatign_and_hot_water` geeft vloer,
       `heating` of `heating_and_hot_water` geeft radiatoren;
     - Aurora II: modus 3 of 7 geeft vloer, 1 of 5 geeft radiatoren;
  3. anders onbekend. Aurora III kent geen vloermodus.
- Een modus zonder verwarmingscircuit (alleen tapwater, koeling) of een ontbrekende
  waarde laat het eerder gevonden afgiftesysteem staan. Anders zou een tijdelijke
  tapwatermodus de geleerde vertraging laten vervallen.
- De regel van 1 min/L hoort bij een afgifte van ~0,07 kW/°C. Hij is grof: de
  afgifte per graad verschilt per huis ongeveer een factor 4. Het leren (D3)
  corrigeert dat.

### D3 — De vertraging leren

- Een nieuwe klasse `EmitterDelayEstimator` (`lib/shared/adaptive/`) krijgt
  dezelfde geaccepteerde samples als de learner, met het **ongefilterde**
  vermogen.
- Per kandidaat-vertraging {0, 15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360}
  min houdt hij een eigen filter bij. Per volle klokuur bewaart hij een uurrij:
  het gemiddelde gefilterde vermogen per kandidaat, het temperatuurverschil
  buiten–binnen, de zon, het dagritme van P_int (dezelfde factor als de learner:
  nacht ×0,4, dag ×1, avond ×1,8, of 1 zonder dynamische P_int) en de
  binnentemperatuur aan begin en eind.
- Een uur telt mee als er ten minste 10 van de 12 samples zijn, zonder gat.
- Bewaard worden de laatste 7 dagen (168 uurrijen).
- Elke 6 uur rekent hij per kandidaat de kleinste kwadraten uit van
  `ΔT_binnen per uur = a·P_f + b·(T_buiten − T_binnen) + c·zon + e·ritme + d`.
  Zon en ritme doen alleen mee als ze variëren; anders is de fit singulier.
- Voorwaarden:
  - minstens 72 bruikbare uren;
  - gemiddeld vermogen ≥ 0,3 kW (stookseizoen);
  - a > 0, anders is de uitkomst niet fysisch.
- **Keuze:** kandidaten met een restfout binnen 0,2% van de beste verklaren de
  metingen even goed. Daarvan neemt hij de **kortste**. De actieve vertraging
  wisselt pas als hij buiten die groep valt.
  - Bij korte vertragingen (0–90 min) zijn de restfouten bijna gelijk. Een
    hysterese van 1% hield daar de eerste keuze vast, ook als die 120 min was.
  - De kortste uit de groep is de voorzichtige keuze: een te kort filter wijkt
    het minst af van het oude gedrag.
- **Dagritme van P_int:** zonder die kolom kiest de schatter in de simulatie
  één stap te lang (150 → 180, 240 → 300). Het werkelijke ritme volgt het
  profiel niet precies, maar de kolom vangt het grootste deel.

### D4 — Wisselen zonder reset

Een kleine wijziging van de vertraging (minder dan 60 min, meestal één stap op
het rooster) gaat zonder reset naar de learner. θ past zich aan met de
vergeetfactor (geheugen ~3,5 dagen bij 0,999). Bij een grote sprong geldt D7.

### D5 — Instelling wijzigen

- Wijzigt de gebruiker het afgiftesysteem of het buffervat, dan geldt meteen de
  nieuwe startwaarde.
- De geleerde keuze vervalt, maar de uurrijen blijven. Bij de volgende ronde
  (binnen 6 uur) volgt een nieuw oordeel.

### D6 — Inzicht

- Een nieuwe capability `adlar_building_emitter_delay` (minuten, met Insights)
  in de drie drivers, met migratie.
- De diagnose (`building_model_diagnostics`) toont:
  - de bron (startwaarde of geleerd);
  - de startwaarde;
  - het aantal bruikbare uren;
  - de restfout van de beste kandidaat en van vertraging 0.

### D7 — Herstart vanaf het gebouwprofiel bij een grote sprong

- De learner bewaart met welke vertraging θ is geleerd (`emitterDelayMinutes` in
  de staat). Een staat van vóór 3.7.0 telt als 0.
- **Sprong:** verandert de vertraging 60 minuten of meer, dan volgt een softReset
  naar het gekozen gebouwprofiel. Dat gebeurt bijvoorbeeld bij de upgrade met een
  ingevuld buffervat (0 → 150), bij het later invullen van het buffervat
  (30 → 150), of als de schatter een grote stap maakt.
- **Vastgelopen model:** bij de eerste start van 3.7.0 volgt ook een softReset
  als het oude model vastzit: C ≥ 39,5 kWh/°C (de grens is 40), τ > 500 uur of
  P_int > 1 kW. Die waarden zijn een opgestapelde fout van leren zonder filter.
- De softReset zet θ op het profiel, de covariantie op 50 en houdt de helft van
  de samples. De mijlpaal van 70% kan opnieuw afgaan.
- **Niet:** waarden rechtstreeks zetten. Met een goede schatting is dat het
  snelst, met een slechte even traag als doorleren (§3.4). Voor de
  testinstallatie ligt C volgens de uurdata tussen 10 en 19; dat is te onzeker.

## 3. Onderbouwing

### 3.1 Schatter in de simulatie

Opzet: 1R1C-huis (C 20, UA 0,14), een modulerende warmtepomp met een eerste-orde
afgifte, en buiten van 13 naar 7 °C. 6 seeds.

Gekozen vertraging (min) per seed; P_int heeft een ander dagritme dan het
profiel (nacht ×0,5, avond ×1,6):

| Werkelijk, scenario | 3 dagen | 7 dagen | 14 dagen |
| --- | --- | --- | --- |
| 30, constant kamerdoel | 0–45 | 0–90 | 0–60 |
| 90, constant | 45–90 | 60–90 | 60–90 |
| 150, constant | 90–180 | 120–180 | 150 (alle) |
| 240, constant | 180–240 | 240 (alle) | 240 (alle) |
| 150, nachtverlaging | 120–150 | 150 (alle) | 120–180 |
| 150, 40% ruis op het vermogen | 90–180 | 120–150 | 150–180 |

Een eenvoudiger huis met constante P_int (`test/unit/emitter-delay.test.js`)
geeft hetzelfde beeld.

### 3.2 Learner met en zonder filter (echte learner uit `.homeybuild`)

Constant kamerdoel, 12 dagen, 4 seeds:

| Werkelijke afgifte | Filter | C | UA | P_int | τ (u) |
| --- | --- | --- | --- | --- | --- |
| 120 min | geen | 24,4 | 0,179 | 0,76 | 137 |
| 120 min | 60 min | 21,9 | 0,155 | 0,50 | 141 |
| 120 min | 120 min | 19,1 | 0,136 | 0,26 | 140 |
| 30 min | geen | 19,4 | 0,134 | 0,26 | 145 |
| 30 min | 120 min (te lang) | 18,3 | 0,123 | 0,10 | 150 |

Werkelijk: C 20, UA 0,14, P_int ~0,34. Een te lang filter kost UA ~8% en maakt
P_int te klein; daarom kiest D3 bij gelijke restfout de kortste vertraging.

### 3.3 Echte uurdata van de testinstallatie

Kleinste kwadraten met hetzelfde model als D3, 26 okt–5 nov:

| Filter | C | UA | P_int | R² |
| --- | --- | --- | --- | --- |
| geen | 40,2 | 0,230 | 1,45 | 0,05 |
| 120 min | 11,8 | 0,151 | 0,60 | 0,09 |
| 180 min | 10,0 | 0,135 | 0,43 | 0,09 |
| 240 min | 9,6 | 0,123 | 0,32 | 0,09 |

Zonder filter geeft deze regressie het beeld van het testapparaat. Met 120–240
min past UA bij de dagbalans (0,10–0,18).

### 3.4 Overstap: doorleren, herstart of waarden zetten (D7)

Werkelijke afgifte 150 min. Eerst 19 dagen zonder filter, daarna 14 dagen met
filter 150 min. Gemiddelde van 4 seeds; werkelijk C 20, UA 0,14, P_int ~0,34.

| Aanpak | Dag 1: C / UA / P_int | Dag 3 | Dag 7 | Dag 14 |
| --- | --- | --- | --- | --- |
| Doorleren | 27,4 / 0,212 / 0,91 | 25,8 / 0,190 / 0,73 | 21,8 / 0,154 / 0,43 | 19,8 / 0,140 / 0,30 |
| SoftReset naar profiel | 21,8 / 0,173 / 0,60 | 21,5 / 0,153 / 0,43 | 19,8 / 0,138 / 0,30 | 19,5 / 0,138 / 0,28 |
| Waarden zetten, goede schatting | 17,1 / 0,148 / 0,39 | 18,9 / 0,148 / 0,37 | 19,7 / 0,142 / 0,32 | 19,5 / 0,139 / 0,29 |
| Waarden zetten, slechte schatting | 12,3 / 0,163 / 0,57 | 14,0 / 0,165 / 0,52 | 17,3 / 0,151 / 0,42 | 19,2 / 0,140 / 0,30 |

Startpunt in de simulatie: C 28,4. Op de testinstallatie staat C tegen de grens
van 40, met vastgelopen stappen; doorleren duurt daar naar verwachting langer.

## 4. Zwaktes

1. **Eerste-orde benadering.** Een buffervat met radiatoren of een dekvloer is
   eerder tweede orde. Het filter benadert dat met één tijdconstante.
2. **Vlakke keuze op echte data.** R² is laag (0,09) en gelijk voor 120–240 min.
   Binnen dat gebied wisselt C van 12 naar 10 en UA van 0,15 naar 0,12. De
   keuzeregel neemt dan de kortste (120 min) en houdt die vast, maar de absolute
   waarden blijven ±10–20% onzeker.
3. **C blijft zwak bepaald bij een constant kamerdoel.** Het filter haalt C van
   de grens af, maar bij weinig temperatuurwisselingen blijft C onzeker. Optie C
   uit het G1-eindoordeel (τ en C tonen als "nog niet bepaald") blijft een apart
   punt.
4. **Wisselen zonder reset (D4).** Na een kleine wissel duurt het enkele dagen
   voordat θ bij het nieuwe filter past. Na een grote sprong (D7) begint het model
   opnieuw vanaf het profiel; een gebruiker die eerst upgradet en daarna het
   buffervat invult, krijgt twee resets kort na elkaar.
5. **De voorspellingen gebruiken de vertraging nog niet.**
   `predictTemperature()`, coast en de voorverwarmduur (G14) rekenen nog met
   direct geleverde warmte. Dat is een vervolgstap.
6. **Opslag.** 168 uurrijen × 12 kandidaten, ongeveer 15 kB in de store van het
   apparaat.
7. **De startregel van 1 min/L is grof** (D2). Hij bepaalt alleen de eerste
   dagen.
8. **Het dagritme van P_int is dat van het profiel.** Wijkt het werkelijke ritme
   sterk af (bijvoorbeeld thuiswerken overdag), dan kan de schatter een stap te
   lang kiezen; de keuze voor de kortste in de groep beperkt dat.

## 5. Alternatieven

| Alternatief | Waarom niet (nu) |
| --- | --- |
| Alleen een vaste vertraging uit de instellingen | Eenvoudiger, maar blijft een aanname. Bij een onbekend buffervolume of afgifte per graad zit hij er een factor 2–4 naast |
| Een bank van volledige learners, één per vertraging | Raakt de interface die drie services en andere onderdelen direct gebruiken. Zes keer de staat |
| De buffersensor in het vat laten plaatsen | Exact, maar hardware. Of de warmtepomp T10 voor zijn regeling gebruikt, is onbekend |
| Tweede opslag in het model (2R2C) | Zes parameters bij nog minder informatie. Slechter te identificeren dan nu |
| P_int vastzetten (G7 optie A) | Getoetst: lost C en τ niet op, voorspelling slechter |

## 6. Testaanpak

- Unit tests:
  - het filter: stapresponsie, gat, eerste sample, en vertraging 0 is gelijk aan
    het oude gedrag;
  - de startwaarde, per driver en per modus;
  - de schatter: kiest de juiste kandidaat op gesimuleerde uurrijen,
    voorwaarden, hysterese, en bewaren en herstellen.
- Simulatie: `test/simulation/building-model-review/emitter-delay.js` (§3.1 en
  §3.2).
- Live: op de self-hosted Homey (Aurora II), na Z1. Verwacht binnen 3–7 dagen
  een vertraging van 120–240 min, met C onder de grens en P_int onder 1 kW.

## 7. Open punten

- Optie C uit het G1-eindoordeel: τ en C tonen als "nog niet bepaald" bij C op
  de grens of τ > 500 u.
- Voorspellingen (coast, G14) met de vertraging.
- G17: tapwater-poort voor Aurora I/II in combimodus.
