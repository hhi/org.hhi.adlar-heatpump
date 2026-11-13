# ADR-067: Verbeteringen aan de adaptieve regeling

**Status:** Voorstel (2026-11-09). D1 is gebouwd op 2026-11-10 (in 3.8.0), D3
en D10 op 2026-11-13 (voor 3.9.0, nog niet uitgebracht); de rest niet. Per besluit
staat erbij of het getoetst is.
**Datum:** 2026-11-09
**Beslissers:** -
**Gerelateerd:** [ADR-065](ADR-065-POSITIONAL-PI-HEATING-CURVE.md) (positionele
PI, presets, optimizers via het kamerdoel, open punten O10, O11, O12, O21);
[ADR-066](ADR-066-EMITTER-DELAY.md) (afgiftevertraging, live toets);
[ADR-062](ADR-062-BUILDING-MODEL-REVIEW-IMPLEMENTATION.md) (gebouwmodel);
[BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md)
**Simulatie:** `test/simulation/coast-closed-loop.js`. D3 staat in de repo als
`O22=1`. D4 is getoetst in een kopie met een extra variant (§6.2); die zit niet
in de repo.
**Stand van de code:** `main` op `d2311cb` (v3.7.1)

---

## Samenvatting voor de eigenaar

- **Aanleiding:** een beoordeling van de adaptieve regeling op 9 november 2026.
  De positionele regeling is goed ontworpen; de zwakke plekken zitten in de
  klassieke regeling (de standaard), in de optimizers en in een paar randen van
  de positionele regeling.
- **Twee fouten** (klein, los van de rest):
  - Instellingen van de COP-optimizer en het voorverwarmen doen niet wat het
    scherm belooft (D1). Bij Tuya hebben drie instellingen geen effect; bij
    Aurora I/II en III vervallen ze na een herstart van de app; één instelling
    wordt door geen enkele driver gelezen.
  - Een stilgevallen binnensensor wordt niet herkend (D2). De regeling rekent
    door met de laatste waarde.
- **Eén kleine verbetering die getoetst is:** het advies wisselt nu 27–34 keer
  per dag tussen twee hele graden. Een afrondhysterese halveert dat bij
  radiatoren en brengt het bij vloerverwarming terug tot een derde, met
  0,004–0,011 °C meer afwijking van de kamer (D3).
- **Eén verbetering die getoetst is met een gemengde uitkomst:** de integraal
  stilzetten als de compressor uit staat. Bij vloerverwarming met nachtverlaging
  veel minder koude ochtenden, maar 3–10% meer verbruik (D4). Niet nu.
- **Twee verbeteringen aan de optimizers, niet getoetst:** de COP-optimizer
  verlaagt het kamerdoel juist als het koud is (D5); de prijs-optimizer kijkt
  alleen naar vaste drempels en niet naar de komende uren (D6).
- **Verder:** positioneel de standaard maken (D7, bestaand punt), zon vooruit
  meenemen bij vloerverwarming (D8, idee), en klassiek niet verder verbeteren
  (D9).

| # | Besluit | Soort | Getoetst | Omvang | Voorstel |
| --- | --- | --- | --- | --- | --- |
| D1 | Instellingen van de optimizers laten werken | Fout | Code gelezen | Klein | 3.8.0 |
| D2 | Stilgevallen binnensensor herkennen (R27) | Fout | Code gelezen | Klein | 3.8.0 |
| D3 | Afrondhysterese op het advies | Verbetering | Simulatie | Klein | 3.8.0 |
| D4 | Integraal stil bij negatieve fout en compressor uit | Verbetering | Simulatie, gemengd | Klein | Niet nu; bij O21 |
| D5 | COP-optimizer vergelijkt met de verwachte COP | Verbetering | Nee | Middel | Eerst simuleren |
| D6 | Prijs-optimizer vergelijkt met de komende uren | Verbetering | Nee | Middel | Later; eerst simuleren |
| D7 | Positioneel de standaard voor nieuwe apparaten | Bestaand (O10, O11) | ADR-065 | Klein | Na de live toets |
| D8 | Zon vooruit meenemen bij vloerverwarming | Idee | Nee | Groot | Eerst simuleren |
| D9 | Klassiek niet verder verbeteren | Besluit | — | — | Vastleggen |
| D10 | Verschuiving van het kamerdoel begrensd per uur | Verbetering | Simulatie | Klein | 3.9.0 (gebouwd) |

---

## 1. Context

### 1.1 De regeling in het kort

Elke vijf minuten berekent de app een advies voor het aanvoersetpoint. De app
schrijft dat niet zelf: de flowkaart `temperature_adjustment_recommended` gaat
af als het advies verandert, en de flow van de gebruiker voert het uit.

```text
klassiek:     advies = setpoint_huidig + round(accumulator)
              accumulator += 0,6·(Kp·e + Ki·gem(e)) + optimizers
              per cyclus, begrensd op ±2
positioneel:  advies = round( begrens( basis + u + voorsturing ) )
              u = begrens( Kp·e + I, ±8 )        I = begrens( I + Ki·e, ±6 )
              e = kamerdoel + verschuiving(prijs, COP) − kamertemperatuur
```

De basis is de stooklijn (app-stooklijn, of die van de warmtepomp). Prijs en COP
verschuiven in de positionele stand het kamerdoel (ADR-065 D10), hoogstens 1,5
°C.

### 1.2 Waar de code staat

| Onderdeel | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| Regelcyclus | `lib/tuya/services/adaptive-control-service.ts` | `lib/modbus/services/adaptive-control-service.ts` | `lib/aurora3/services/adaptive-control-service.ts` |
| Klassieke PI, weging, COP- en prijs-optimizer | `lib/tuya/adaptive/` | `lib/modbus/adaptive/` | gebruikt `lib/modbus/adaptive/` |
| Positionele PI, presets, stooklijn | `lib/shared/adaptive/positional-pi-controller.ts` | idem | idem |
| Binnentemperatuur | `lib/tuya/services/external-temperature-service.ts` | `lib/modbus/services/external-temperature-service.ts` | roept dezelfde functie aan |

Een wijziging in de regelcyclus moet dus op drie plekken, een wijziging in de
optimizers op twee, en alles nog eens in de zuster-app (alleen Aurora I/II).

### 1.3 Wat goed is en zo blijft

- Positioneel: advies = stooklijn + PI met echte integraal, met drie regels
  tegen het oplopen van de integraal (kleine fout, flow loopt achter,
  setpointgrens) en een pauze bij coast, ontdooien en tapwater.
- Het vaste comfortanker: de lusversterking hangt niet af van welke optimizers
  gegevens hebben.
- Prijs en COP via het kamerdoel, zodat de integraal ze niet wegwerkt.
- De onderbouwing met een gesloten-lus-simulatie op de gecompileerde app-code.

---

## 2. Fouten

### D1 — Instellingen van de optimizers laten werken

**Nu.** Vier instellingen staan in het instellingenscherm van alle drie de
drivers (`driver.settings.compose.json`):

| Instelling | Tuya | Aurora I/II | Aurora III |
| --- | --- | --- | --- |
| `cop_min_acceptable` (ondergrens COP) | Wordt nergens gelezen | Alleen bij wijzigen toegepast | Alleen bij wijzigen toegepast |
| `cop_target` (doel-COP) | Wordt nergens gelezen | Alleen bij wijzigen toegepast | Alleen bij wijzigen toegepast |
| `cop_strategy` (voorzichtig, gebalanceerd, agressief) | Wordt nergens gelezen | Alleen bij wijzigen toegepast | Alleen bij wijzigen toegepast |
| `price_max_preheat_offset` (hoogste voorverwarming) | Wordt nergens gelezen | Wordt nergens gelezen | Wordt nergens gelezen |

- De COP-optimizer wordt in alle drie de drivers aangemaakt met vaste waarden
  2,5, 3,5 en `balanced` (`lib/tuya/services/adaptive-control-service.ts:226`,
  `lib/modbus/services/adaptive-control-service.ts:265`,
  `lib/aurora3/services/adaptive-control-service.ts:258`).
- Aurora I/II en III passen een nieuwe waarde toe als de gebruiker haar wijzigt
  (`lib/modbus/services/adaptive-control-service.ts:2122`,
  `lib/aurora3/services/adaptive-control-service.ts:2108`). Na een herstart van
  de app geldt weer 2,5, 3,5 en `balanced`, terwijl het scherm de ingestelde
  waarde toont.
- Tuya heeft die afhandeling niet, en de Tuya-kopie van `cop-optimizer.ts` mist
  de functies `updateMinAcceptableCOP`, `updateTargetCOP` en `updateStrategy`.
- De prijs-optimizer wordt aangemaakt met `maxPreHeatOffset: 1.5`
  (`lib/tuya/services/adaptive-control-service.ts:219`); geen code leest
  `price_max_preheat_offset`.

**Voorstel.**

1. Bij het aanmaken van de COP-optimizer de drie instellingen lezen (met de
   huidige waarden als terugval), in alle drie de drivers.
2. Tuya: de drie functies toevoegen aan `lib/tuya/adaptive/cop-optimizer.ts` en
   de afhandeling in de instellingenfunctie, zoals Aurora I/II. Waarden uit
   `newSettings` (regel in `CLAUDE.md`).
3. `price_max_preheat_offset` lezen bij het aanmaken en bij wijzigen, in alle
   drie de drivers.

**Gevolg voor gebruikers.** Wie een van deze instellingen heeft aangepast, ziet
na de update het gedrag dat hij had ingesteld. Dat kan een verandering zijn: een
agressieve strategie die nu niet werkte, werkt dan wel. Het hoort in de
changelog.

**Zwakte.** `price_max_preheat_offset` werkt ook na de wijziging alleen zolang
de geleerde warmtecapaciteit 15 kWh/°C of lager is; daarboven rekent de
optimizer met `C / 20` (zie D6).

**Toets.** Unit-test per driver: de optimizer krijgt bij het aanmaken de
opgeslagen waarden, en bij wijzigen de nieuwe.

**Gebouwd (2026-11-10).** De waarden komen uit
`lib/shared/adaptive/optimizer-settings.ts`; de toets staat in
`test/unit/optimizer-settings.test.js`. Geen flowkaart gewijzigd.

### D2 — Stilgevallen binnensensor herkennen (R27)

**Nu.** `getIndoorTemperature()` geeft de laatst ontvangen waarde terug, hoe oud
ook (`lib/tuya/services/external-temperature-service.ts:62`,
`lib/modbus/services/external-temperature-service.ts:95`). De controle op
ouderdom bestaat (`getTemperatureHealth`, grens 10 minuten), maar wordt nergens
aangeroepen.

**Gevolg bij een lege batterij of een gestopte flow.**

| Onderdeel | Wat er gebeurt |
| --- | --- |
| Klassiek | Een vaste fout buiten de dode zone duwt het setpoint elke cyclus verder, tot de grens |
| Positioneel | De integraal loopt naar ±6 K en blijft daar |
| Gebouwmodel | Leert door met een kamer die niet verandert |

Voor de buitentemperatuur is dit in 3.6.0 opgelost (vervalt na 1 uur zonder
flow, R10).

**Voorstel.**

1. Een tijdgrens op de binnentemperatuur. Daarboven geeft
   `getIndoorTemperature()` geen waarde; de regelcyclus slaat dan over met een
   eigen reden (zoals R24 in 3.7.1, `reportSkippedCycle`), en het gebouwmodel
   blokkeert met "geen binnentemperatuur".
2. De reden in `adaptive_control_diagnostics` en in het gebouwinzicht.
3. In de handleiding: de binnentemperatuur minstens elk uur met een tijdtrigger
   sturen, zoals voor de buitentemperatuur (R13).

**Zwakte.** Een sensor die alleen bij verandering meldt, is bij een stabiele
kamer terecht lang stil. Een korte grens geeft dan valse meldingen en stilstand
van de regeling. Daarom een ruime grens; de waarde is een besluit.

| Grens | Voordeel | Nadeel |
| --- | --- | --- |
| 1 uur (zoals buiten) | Snel gemerkt | Valse meldingen bij sensoren die alleen bij verandering melden |
| 3 uur | Zelden vals | De regeling rekent tot 3 uur door met een oude waarde |
| 6 uur | Vrijwel nooit vals | Klassiek kan in die tijd de setpointgrens al bereiken |

**Alternatief.** Niet stoppen maar alleen de integraal en het leren stilzetten,
en het advies laten staan. Zachter, maar de klassieke regeling loopt dan nog
steeds door.

**Flowkaarten.** `temperature_adjustment_recommended` gaat niet meer af zolang
de waarde te oud is. Geen nieuwe kaart nodig; een trigger "binnentemperatuur
valt weg" kan later.

**Toets.** Unit-test op de tijdgrens; de bestaande tests voor overgeslagen cycli
en voor blokkades in het gebouwmodel uitbreiden met deze reden.

---

## 3. Verbeteringen, getoetst

### D3 — Afrondhysterese op het advies

**Nu.** Het positionele advies is `round(basis + correctie)`
(`_positionalRecommendation`,
`lib/tuya/services/adaptive-control-service.ts:713`, `lib/modbus/…:787`,
`lib/aurora3/…:773`). De binnensensor meet in stappen van 0,1 °C; met Kp 3 is
dat 0,3 °C in het advies. Ligt de ongeronde waarde rond een halve graad, dan
wisselt het advies bij elke sensorstap tussen twee hele graden.

**Gemeten.** In de simulatie 27–34 wijzigingen van het advies per dag, zonder
nachtverlaging. Elke wijziging is een flowtrigger en een schrijfactie naar de
warmtepomp. In de live toets (Aurora I/II, Positioneel – Radiatoren): 34
wijzigingen in 24 uur op 11 november en 51 op 12 november, waarvan ongeveer 40
heen-en-weer tussen twee hele graden.

**Correctie (2026-11-13).** De eerste versie van deze tabel gaf het dubbele
aantal wijzigingen (54–67 zonder hysterese). De teller in de kopie van het
script telde elke wijziging twee keer. De getallen hieronder komen uit het
script in de repo (`O22=1`); de RMSE en de verhoudingen zijn ongewijzigd.

**Voorstel.** Het advies alleen wijzigen als de ongeronde waarde 0,75 °C of meer
van het vorige advies af ligt; anders blijft het vorige advies staan.

**Simulatie** (geen nachtverlaging, 14 dagen, 5 seeds, directe flow, presets):

| Drempel (°C) | Radiator mild | Radiator koud | Vloer mild | Vloer koud |
| --- | --- | --- | --- | --- |
| Afronden (was) | 33,3 / 0,167 | 33,6 / 0,168 | 27,9 / 0,179 | 27,0 / 0,157 |
| 0,6 | 20,0 / 0,168 | 19,9 / 0,169 | 13,3 / 0,181 | 13,1 / 0,159 |
| **0,75** | **15,9 / 0,171** | **15,6 / 0,172** | **8,1 / 0,186** | **7,8 / 0,168** |
| 0,9 | 15,0 / 0,173 | 14,9 / 0,175 | 7,4 / 0,192 | 7,1 / 0,176 |
| 1,0 | 14,6 / 0,175 | 14,4 / 0,176 | 6,8 / 0,197 | 6,6 / 0,184 |

Per cel: wijzigingen per dag / RMSE van de kamertemperatuur (°C). Boven 0,75
neemt het aantal wijzigingen nauwelijks meer af en loopt de afwijking op.

Bij 0,75 verder: compressorstarts 3,0 → 2,8 per dag (radiator mild) en 1,0 → 0,8
(vloer mild); verbruik binnen 0,2% gelijk; uren meer dan 0,5 °C te warm 0,36 →
0,40 per dag (radiator mild).

**Wisselwerking met de bestaande regels.**

- "Flow loopt achter" vergelijkt het setpoint met het vorige advies (meer dan 1
  °C). Het advies blijft een hele graad, dus die regel verandert niet.
- "Aan de setpointgrens" gebruikt de ongeronde waarde; ook ongewijzigd.
- Bij de start en bij een wissel van regelmodus is er nog geen vorig advies. Het
  eerste advies wordt dan gewoon afgerond; de hysterese werkt vanaf het tweede.

**Zwakte.**

- 0,004–0,011 °C meer afwijking van de kamer.
- Het advies kan tot 0,75 °C van de berekende waarde af staan in plaats van 0,5
  °C.
- Eén gesimuleerde woning; de drempel is op deze vier scenario's gekozen.
- In de praktijk twee etmalen geteld op één installatie, vóór de wijziging; het
  effect van de hysterese zelf is nog niet in de praktijk gemeten.

**Alternatief.** Een minimale tijd tussen twee wijzigingen (bijvoorbeeld 15
minuten). Eenvoudiger uit te leggen, maar vertraagt ook een echte stap, en haalt
het wisselen niet weg: het wordt alleen trager.

**Onbekend.** Of de warmtepomp elk geschreven setpoint in vast geheugen bewaart.
Als dat zo is, weegt het aantal schrijfacties zwaarder dan hier aangenomen.

**Flowkaarten.** `temperature_adjustment_recommended` gaat minder vaak af.
`adaptive_simulation_update` gaat elke cyclus af en verandert niet.

**Toets.** Unit-test op de drempel (binnen de band blijft het advies, erbuiten
volgt het) en op het eerste advies zonder voorganger; de simulatievariant staat
in de repo (`O22=1`).

**Gebouwd (2026-11-13).** `roundRecommendation` in
`lib/shared/adaptive/positional-pi-controller.ts`, aangeroepen door
`_positionalRecommendation` in de drie services. Toetsen in
`test/unit/positional-pi-controller.test.js` en
`test/unit/optimizer-settings.test.js`.

### D4 — Integraal stil bij negatieve fout en compressor uit

**Nu.** Bij nachtverlaging staat de kamer de hele nacht boven het verlaagde
doel. De warmtepomp kan niet koelen, maar de integraal loopt door naar −6 K en
remt 's ochtends het opwarmen (ADR-065 §3.8). De regel "aan de setpointgrens"
grijpt hier niet in: het advies staat niet op het laagste setpoint, de
compressor staat gewoon uit.

**Voorstel.** Een extra reden om de integraal stil te zetten: de fout is
negatief en de compressor staat uit. Via het bestaande doorgeefluik
`resolvePauseReason` (Aurora I/II levert daar nu het ontdooibit,
`lib/modbus/services/service-coordinator.ts:187`).

**Simulatie** (nachtverlaging naar 19 °C van 23 tot 7 uur; nu → met de regel):

| Scenario | Uren > 0,5 °C te koud /dag | Verbruik (kWh/dag) | Starts/dag | Integraal min–max (K) |
| --- | --- | --- | --- | --- |
| Radiator mild | 4,89 → 3,60 | 13,21 → 13,21 | 5,5 → 6,6 | −6,0–1,1 → −6,0–1,0 |
| Radiator koud | 5,35 → 5,30 | 38,97 → 38,97 | 1,1 → 1,1 | −6,0–1,9 → −6,0–1,9 |
| Vloer mild | 5,20 → 0,71 | 10,49 → 11,49 | 1,1 → 1,3 | −6,0–0,7 → −0,7–2,8 |
| Vloer koud | 10,74 → 6,52 | 29,45 → 30,41 | 0,8 → 1,0 | −6,0–5,7 → −2,6–4,7 |

Zonder nachtverlaging verandert er vrijwel niets (vloer mild: uren boven +0,5 °C
0,36 → 0,57 per dag; de andere scenario's gelijk).

**Zwakte.**

- Bij vloerverwarming 3–10% meer verbruik: de woning koelt 's nachts minder ver
  af.
- Bij radiatoren in mild weer meer compressorstarts, en bij kou geen effect (de
  compressor staat daar zelden uit).
- Tuya meldt de compressor niet betrouwbaar (R22); daar werkt de regel niet.
- De eerder getoetste variant "integraal pauzeren zolang het doel afwijkt"
  (ADR-065 §3.8) gaf ook een gemengd beeld.

**Advies.** Niet nu. Het is een keuze tussen warmere ochtenden en verbruik, en
hoort bij het open punt "eerder opwarmen bij een weekprogramma" (O21). Opnieuw
bekijken met praktijkgegevens van vloerverwarming met nachtverlaging.

### D10 — Verschuiving van het kamerdoel begrensd per uur

Toegevoegd op 2026-11-13, na een terugmelding van een tester met
vloerverwarming (positioneel, prijsoptimalisatie aan): het advies schakelt te
fors en de compressor valt uit.

**Oorzaak.** Prijs en COP verschuiven het kamerdoel (ADR-065 O14). Het advies
volgt die verschuiving met Kp + 1 + de helling van de stooklijn, ongeveer 4,3
keer. Een prijswissel verzet de verschuiving in één cyclus; in de simulatie
springt het advies daardoor tot 5 °C (wegingen 50/15/15).

**Besluit.** De verschuiving beweegt hooguit 0,24 °C per uur
(`limitTargetShift`, 0,02 °C per cyclus van vijf minuten), in de drie drivers.
Geen instelling.

**Getoetst** (`O23=1 O23_RATE=0.01,0.02,0.05,0.1`, vloerverwarming, mild, 14
dagen, 5 seeds, hysterese van D3 aan):

| Grens per cyclus | Grootste sprong | Stroom in dure uren | Uren > +0,5 °C per dag | Starts per dag |
| --- | --- | --- | --- | --- |
| Geen optimizers | 1 °C | 32% | 0,37 | 0,8 |
| Onbegrensd (was) | 5 °C | 15% | 1,02 | 1,1 |
| 0,01 °C | 1 °C | 23% | 0,25 | 1,1 |
| 0,02 °C (gebouwd) | 1 °C | 17% | 0,59 | 1,1 |
| 0,05 °C | 2 °C | 16% | 0,80 | 1,1 |
| 0,1 °C | 2 °C | 16% | 0,93 | 1,1 |

Radiatoren met 0,02 °C: starts 4,4 → 3,3 per dag (mild) en 0,7 → 0,1 (koud),
wijzigingen van het advies 55 → 21 per dag (koud).

**Zwaktes.**

- De volle verschuiving duurt ruim drie uur; een prijspiek van één uur telt
  voor ongeveer een derde mee.
- Eén gesimuleerde woning met uurprijzen; kwartierprijzen zijn niet getoetst.
- De simulatie laat de sprong zien, niet het uitvallen van de compressor dat
  de tester meldt. De starts bij vloerverwarming veranderen niet.
- Na een herstart begint de verschuiving bij nul.

---

## 4. Verbeteringen aan de optimizers, niet getoetst

### D5 — COP-optimizer vergelijkt met de verwachte COP

**Nu** (`calculateAction`, `lib/tuya/adaptive/cop-optimizer.ts:177`, de
Aurora-kopie gelijk).

1. Ligt de gemeten COP onder de ondergrens (`cop_min_acceptable`, standaard 2,5;
   zie D1), dan adviseert de optimizer 2 °C lager, of 3 °C bij de agressieve
   strategie, met hoge prioriteit. De COP hangt vooral af van de
   buitentemperatuur. Welke ondergrens ook is ingesteld: de regel grijpt vooral
   in als het koud is.
2. In de positionele stand wordt dat een lager kamerdoel: het advies maal het
   gewicht van de optimizer. Staat alleen de COP-optimizer aan, dan is dat
   gewicht bij de standaardprioriteiten 0,4, dus 0,8 tot 1,2 °C. Met andere
   prioriteiten verschuift dat; de grens is 1,5 °C.
3. Het "optimale" aanvoersetpoint per buitentemperatuur is het setpoint met de
   hoogste gemiddelde COP uit de geschiedenis (`updateOptimalSettings`, regel
   132). Een lagere aanvoer geeft altijd een hogere COP. Het is dus het laagste
   setpoint dat bij die buitentemperatuur voorkwam, los van of de woning toen
   warm bleef.
4. Als "aanvoertemperatuur" wordt het setpoint opgeslagen, niet de gemeten
   aanvoer (`lib/tuya/services/adaptive-control-service.ts:1145`).

**Aanwijzing uit de bestaande simulatie** (ADR-065 §3.8, radiator, koud,
nachtverlaging): met prijs en COP 10,6 uur per dag meer dan 0,5 °C te koud,
zonder 5,4. Hoeveel daarvan van de COP-optimizer komt, is niet uitgesplitst.

**Voorstel.**

1. De gemeten COP vergelijken met de verwachte COP bij deze buitentemperatuur.
   De optimizer houdt die al bij per 2 °C (`getEstimatedCopAtTemp`, regel 323).
   Alleen ingrijpen als de COP een vast deel onder die verwachting ligt.
2. De vaste ondergrens houden als melding (diagnose, inzicht), niet als sturing.
3. Het "optimale" setpoint laten vervallen, of alleen setpoints meetellen
   waarbij de kamer binnen 0,3 °C van het doel bleef.

**Zwakte.**

- Zonder genoeg metingen bij een buitentemperatuur doet de optimizer niets. In
  het begin van een koudeperiode is dat juist het geval.
- Een warmtepomp die structureel slecht presteert, valt met alleen de relatieve
  regel niet meer op. Daarom punt 2.
- De verwachte COP is een gemiddelde uit de eigen geschiedenis. Was de regeling
  toen slecht afgesteld, dan is de verwachting te laag.
- Niet gesimuleerd. De simulatie kan het: de optimizers draaien er al in mee
  (`O4=1`, `O14=1`).

**Alternatief.** De COP-optimizer in de positionele stand uitzetten. De
stooklijn plus integraal kiest al de laagste aanvoer waarbij de kamer op
temperatuur blijft; lager kan alleen ten koste van de kamer. Eenvoudig, maar de
instelling verliest dan haar betekenis in die stand.

**Instellingen.** `cop_min_acceptable` krijgt een andere betekenis (melding in
plaats van sturing); de hint moet mee veranderen, in vier talen.

### D6 — Prijs-optimizer vergelijkt met de komende uren

**Nu** (`calculateAction`, `lib/tuya/adaptive/energy-price-optimizer.ts:192`).

1. De beslissing gebruikt alleen de prijscategorie van dit uur, met vier vaste
   drempels in €/kWh uit de instellingen (`price_threshold_very_low` …
   `price_threshold_high`). In een dure week is elk uur "hoog", in een goedkope
   week elk uur "laag".
2. De gemiddelde prijs van de komende vier uur wordt berekend
   (`getAveragePrice`) en in het resultaat meegegeven, maar speelt geen rol in
   de beslissing.
3. De sterkte van het voorverwarmen is `min(2, C / 20)` zodra de geleerde
   warmtecapaciteit boven 15 kWh/°C ligt (regel 212), anders 1,5 °C. De
   warmtecapaciteit is de slechtst bepaalde parameter van het gebouwmodel; tegen
   de grens van 40 geeft ze altijd het maximum van 2 °C.
4. Of opslaan in de woning loont, wordt niet berekend: het extra warmteverlies
   van een warmere woning tegenover het prijsverschil.

**Voorstel.**

1. De prijs van dit uur vergelijken met het gemiddelde van de komende 12–24 uur.
   De functies daarvoor bestaan al voor de flowkaarten
   (`getDeviationFromAverage`, `findCheapestBlock`).
2. De sterkte niet aan de warmtecapaciteit koppelen, maar aan de instelling
   `price_max_preheat_offset` (zie D1).
3. Zonder prijzen voor de komende uren: terugvallen op de vaste drempels.

**Zwakte.**

- Op een dag met vlakke prijzen is elk klein verschil "laag" of "hoog". Er is
  een ondergrens voor het verschil nodig.
- Wie de drempels bewust heeft ingesteld, krijgt ander gedrag. Een keuze "vaste
  drempels" of "ten opzichte van de dag" voorkomt dat, maar is een instelling
  erbij, tegen de richting van "minder keuzes" (I1 fase 2).
- Niet gesimuleerd. Het prijsprofiel in de simulatie is zelf gemaakt; voor een
  oordeel zijn echte dagprijzen nodig.

**Flowkaarten.** De prijskaarten (`price_threshold_crossed`,
`cheapest_block_started`, `expensive_block_approaching`, `price_trend_changed`)
veranderen niet; alleen de bijdrage aan het advies.

---

## 5. Richting

### D7 — Positioneel de standaard voor nieuwe apparaten (O10, O11)

Ongewijzigd ten opzichte van ADR-065. Klassiek slingert in gesloten lus (ADR-065
§1.1, §3.2): het setpoint is de optelsom van de PI-uitvoer, ongeveer 3 °C per
cyclus per °C fout. Positioneel doet dat niet.

**Zwakte.** Positioneel vraagt een stooklijn die bij de woning past; een nieuwe
gebruiker begint dan mogelijk met een verkeerde. Daarom eerst praktijkgegevens
uit de live toets.

### D8 — Zon vooruit meenemen bij vloerverwarming (idee)

**Nu.** Zon is in de simulatie de grootste verstoring. Coast was daarvoor
bedoeld, maar staat sinds 3.5.2 in beide presets uit (`EMITTER_PRESETS`,
`lib/shared/adaptive/positional-pi-controller.ts:148`). Bij vloerverwarming
reageert de PI pas als de kamer al te warm is, en de vloer geeft dan nog uren
warmte af.

**Idee.** De basis verlagen op de verwachte instraling van de komende uren.
Open-Meteo wordt al opgehaald en levert de straling.

**Zwakte.**

- Het vraagt hoeveel zon de woning binnenkrijgt. De geleerde zonfactor is
  daarvoor niet betrouwbaar genoeg; een vaste, instelbare sterkte is een
  instelling erbij.
- Een verkeerde voorspelling geeft een koude ochtend.
- Groot, en zonder simulatie niet te beoordelen.

### D9 — Klassiek niet verder verbeteren

Bekende zwaktes van klassiek, naast het slingeren:

- een dode zone van ongeveer 0,9 °C, scheef rond het doel (0,48 °C eronder,
  0,3–0,45 °C erboven);
- de tijdconstante uit het gebouwmodel wordt op 8 uur afgetopt
  (`lib/tuya/adaptive/heating-controller.ts:111`), dus elke woning krijgt
  dezelfde marge;
- de thermische bijdrage is een vuistregel (+0,5 of −0,3 °C op een geschatte
  opwarmtijd zonder het verwarmingsvermogen, `calculateThermalAdjustment`).

**Voorstel.** Daar geen werk meer in steken. D1 en D2 gelden wel voor klassiek;
D3 niet (klassiek rondt de accumulator af, niet een positie).

**Zwakte.** Wie geen stooklijn wil instellen, blijft op klassiek en houdt deze
zwaktes.

---

## 6. Simulatie

### 6.1 Opzet

`test/simulation/coast-closed-loop.js`, onderdeel `O16=1`: 14 dagen, 5 seeds,
directe flow, de presets van de app (radiator Kp 3, Ti 3 uur; vloer Kp 3, Ti 6
uur; coast uit), variant `pos. app O14` (de gecompileerde
`PositionalPIController` en `WeightedDecisionMaker`). Woning, afgifte en
warmtepomp als in ADR-065 §3.1. De rij "nu" in de kopie geeft dezelfde getallen
als het ongewijzigde script.

### 6.2 Wijziging aan het script

D3 staat in de repo: `O22=1 node test/simulation/coast-closed-loop.js all`
(optie `roundHyst`, drempels via `O22_HYST`). D4 is getoetst in een kopie buiten
de repo, met deze wijziging:

```js
// D4: extra pauzereden (regel 580)
pause: (v.coast && coastActive) ? 'coast'
  : (o16Pause ? 'target_step'
    : ((opts.satHold && ePos < 0 && !on) ? 'target_step' : null)),
```

Plus de rij `{ satHold: true }` in de tabel van `O16`.

### 6.3 Grenzen

- Eén gesimuleerde woning (C 20 kWh/K, UA 0,30 kW/K) met twee afgiftesystemen en
  twee weersituaties. Lichte en zware woningen, een beperkte flow en de
  optimizers zijn voor D3 en D4 niet getoetst.
- De interne thermostaat van de warmtepomp is vereenvoudigd (ADR-065 §5).
- De binnensensor meet zonder vertraging, in stappen van 0,1 °C. Een sensor met
  grovere stappen (0,5 °C) wisselt minder vaak maar met grotere sprongen; dat is
  niet getoetst.
- D1, D2, D5, D6 en D8 komen uit de code, niet uit een meting.

---

## 7. Volgorde en versies

| Stap | Besluit | Bestanden | Hangt af van |
| --- | --- | --- | --- |
| 1 | D1 | Drie `adaptive-control-service.ts`, `lib/tuya/adaptive/cop-optimizer.ts`, tests | — |
| 2 | D2 | Twee `external-temperature-service.ts`, drie regelservices, drie `building-model-service.ts`, locales, handleiding | Besluit over de tijdgrens |
| 3 | D3 | Drie `_positionalRecommendation`, of één gedeelde functie in `positional-pi-controller.ts`; simulatie; test | — |
| 4 | D5 | Twee `cop-optimizer.ts`, simulatie, hints in vier talen | Simulatie eerst |
| 5 | D7 | Standaardwaarde `adaptive_control_mode` | Live toets 3.7.0 |
| Later | D4, D6, D8 | — | Praktijkgegevens, simulatie |

Stap 1 tot en met 3 passen in 3.8.0. Voor D3 is één gedeelde functie
(`positionalRecommendation(raw, last, range)`) in `lib/shared/` de kleinste
wijziging: de drie services roepen haar aan in plaats van elk zelf af te ronden.

Elke stap moet ook naar de zuster-app (alleen Aurora I/II).

---

## 8. Open punten

| # | Punt | Wie beslist |
| --- | --- | --- |
| 1 | Tijdgrens voor de binnentemperatuur (D2): 1, 3 of 6 uur | Eigenaar |
| 2 | Drempel van de afrondhysterese (D3): 0,75 °C of een andere waarde | Eigenaar, na de tabel in §3 |
| 3 | COP-optimizer in de positionele stand: relatieve regel (D5) of uitzetten | Na simulatie |
| 4 | Bewaart de warmtepomp elk geschreven setpoint in vast geheugen? | Uitzoeken (handleiding, leverancier) |
| 5 | Aantal wijzigingen van het advies per dag in de praktijk | Live toets: Insights van `adlar_simulated_target` |
| 6 | Hoe vaak de integraal op ±6 K staat in de praktijk | Live toets: `adaptive_control_diagnostics` |

---

## 9. Niet doen

- **Een andere regressievorm voor het gebouwmodel** (het vermogen verklaren in
  plaats van de temperatuurverandering). Getoetst op 9 november: slechter (C 6
  in plaats van 20, UA 0,08 in plaats van 0,14). Hoort bij het gebouwmodel, hier
  alleen genoemd omdat het uit dezelfde beoordeling komt.
- **Gedeelde services voor de drie drivers** (ADR-005). Geen winst voor
  gebruikers; de prijs is driemaal wijzigen. Wel waar het vanzelf kan, zoals de
  gedeelde functie in D3.
- **De integraalgrens van 6 K verruimen.** In de simulatie komt de integraal tot
  −5,8 K bij een stooklijn die 2 K te hoog staat. Verruimen verbergt een slecht
  passende stooklijn; beter is een melding als de integraal lang tegen de grens
  staat (open punt 6).
