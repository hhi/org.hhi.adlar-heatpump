# ADR-064: Gemeten vensterwarmte als invoer voor het gebouwmodel

**Status:** Concept (voorgesteld, 2026-10-25; aangevuld 2026-10-25)
**Datum:** 2026-10-25
**Beslissers:** -
**Gerelateerd:** [ADR-062](ADR-062-BUILDING-MODEL-REVIEW-IMPLEMENTATION.md) (B1 venster
van 60 minuten, B2 herstart bij blokkades);
[BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md) §2.3 (afgiftevertraging);
ADR-057 W2b (modus- en ontdooipoort); ADR-060 (COP-poort)
**Simulatie:** `test/simulation/building-model-review/adr064-*.js` (warmte-invoer,
identificatie, negatieve ΔT, gemeten buitentemperatuur, herstel en reset); gemeten
buitentemperatuur in `adr064-buitentemp-2026-10-18.json`

---

## Samenvatting voor de eigenaar

- **Wat:** het gebouwmodel krijgt niet langer één momentopname van de warmte per
  5 minuten (vermogen × momentane COP), maar de **gemeten warmte-energie over het
  venster van 60 minuten**, opgebouwd uit elke Modbus-poll (debiet × temperatuurverschil).
  Per poll en per interval bepaalt een vaste set regels (§2, D6) of de warmte
  bekend, nul of onbekend is.
- **Waarom:** de momentopname is een slechte schatting van de warmte over een interval.
  Ook zonder afrondfouten geeft die in de simulatie een twee keer zo grote
  voorspelfout (0,013 tegen 0,006 °C). Met hele graden en afkappen loopt dat op tot
  0,021 °C. De vensterintegratie blijft in alle drie de gevallen op 0,006 °C.
- **Wat het niet oplost:**
  - een **afgiftevertraging** (vloerverwarming);
  - een **vaste meetafwijking**;
  - het **uit elkaar houden van UA en P_int** bij weinig variatie in het
    temperatuurverschil binnen–buiten (§3.3).
- **Testinstallatie (Aurora I/II via Modbus, radiatoren):** geen van de getoetste
  oorzaken brengt afzonderlijk C 26 / UA 0,40 / P_int 1,24 voort (§3.5). Het
  temperatuurverschil varieerde genoeg (σ 1,89 °C), en een radiatorvertraging van 15–60
  minuten verhoogt alleen C.
- **Wat het patroon wel verklaart:** waarom het blijft staan. Langs de lijn waarop UA en
  P_int samen bewegen, krijgt de learner weinig informatie. Een eerder ontstane afwijking
  herstelt daar pas na 10–28 dagen schone data; C herstelt al na 2–6 dagen. De huidige
  UA en P_int zijn daarom waarschijnlijk een restant van de geschiedenis van het model.
  Waardoor die afwijking ooit is ontstaan, blijft open.
- **Eigen besluiten:** de afgiftevertraging (O6) en de koppeling UA–P_int met het
  trage herstel (O9).

---

## 1. Context

### 1.1 Huidige warmte-invoer

Het gebouwmodel rekent nu per sample van 5 minuten:

```text
warmte = vermogen kWh-meter × adlar_cop   (compressor aan; anders 0)
adlar_cop = debiet × (aanvoer − retour) × 4,186 / 60 / vermogen   (directe methode)
```

Het vermogen valt daarbij weg: de warmte is in feite **debiet × temperatuurverschil van
één poll**. De learner middelt de invoer sinds ADR-062 B1 wel over 60 minuten, maar
krijgt per 5 minuten één momentopname.

### 1.2 Hoe de learner C, UA, g en P_int afleidt

De parameters worden niet gemeten, maar teruggerekend uit vier geschatte
coëfficiënten (`building-model-learner.ts`, `getModel()`):

```text
energiebalans:  C × ΔT_binnen/Δt = P_warmte − UA × (T_binnen − T_buiten) + g × zon + P_int
regressie:      y = θ1 × P_warmte + θ2 × (T_buiten − T_binnen) + θ3 × zon + θ4

C = 1/θ1    UA = θ2 × C    g = θ3 × C    P_int = θ4 × C    τ = C/UA = 1/θ2
```

Gevolgen voor dit besluit:

- C, UA, g en P_int schalen via θ1 mee met de warmtemeting. Een factor k te weinig
  warmte maakt ze alle vier k keer te klein. τ hangt niet aan de warmte.
- P_int is de restpost. Warmte die het huis krijgt maar niet gemeten wordt, komt in
  P_int terecht. Gemeten warmte die niet in het huis komt (tapwater), verlaagt θ1 en
  verhoogt dus C.

### 1.3 Waarnemingen

Testinstallatie (Homey Self-Hosted Server, 25 oktober 2026):

| | Aurora I/II via Modbus | Aurora I/II via Tuya | Aurora III |
|---|---|---|---|
| COP rollend | 2,59 (direct) | 4,39 | 2,7 (direct) |
| Temperaturen | hele graden (40 / 37) | — | hele graden (31 / 29) |
| C / UA / P_int | 26,4 / 0,385 / **1,24 kW** | **40** / 0,304 / 0,12 | — |

Nagegaan in de code (Aurora II):

- De poll `superfast` (elke 5 s, `POLL_GROUP_SUPERFAST`) leest in één keer
  Status 1+2 (0x0000, met bit 8 `SYSTEM_DEFROST`), T6/T7 (0x004F), pomp-PWM en
  debiet (0x0057) en het ingangsvermogen (0x005C).
- Relay Output Status 1 (0x0019) bevat de 3-wegkleppen (`AC_SOLENOID_3WAY`,
  `FLOOR_SOLENOID_3WAY`), de circulatiepomp en de elektrische elementen
  (`HOT_WATER_EHEATING`, `FLOOR_EHEATING`, `AC_EHEATING`). Het register wordt elke 30 s
  gelezen (`POLL_GROUP_MEDIUM`, optioneel), maar alleen het dashboard gebruikt het.
- `building-model-service.ts` weert tapwater nu alleen via de **ingestelde** modus
  (0x0304), en ontdooien alleen als het bit **op het samplemoment** aan staat.
  Tapwatercycli binnen de gecombineerde modi 5 en 7 worden niet herkend (regel 201).
- Bij compressor aan en COP ≤ 0 wordt het sample overgeslagen en begint het venster
  opnieuw. Bij compressor uit leert het model met warmte 0, tenzij het vermogen op
  elektrische bijverwarming wijst (ADR-060).

## 2. Besluiten (voorstel)

### D1 — Warmtevermogen per poll

`P_th = debiet (l/min) × (aanvoer − retour) × 4,186 / 60` voor elke poll waarin
debiet en beide temperaturen uit dezelfde leesactie komen.

- **Debiet 0 geeft 0 kW, ook bij draaiende compressor.** Zonder stroming gaat er geen
  warmte door het meetpunt, ook als aanvoer en retour verschillen.
- **Geen afkappen op 0.** Een kleine negatieve ΔT wordt gewoon meegeteld (§3.4). Alleen
  D7 behandelt een negatieve ΔT apart.

### D2 — Integreren naar kWh over het venster

Een gedeelde `HeatEnergyAccumulator` (`lib/shared/adaptive/`) telt per poll
`P_th × tijd sinds de vorige poll` op en houdt de **meetdekking** bij.

- Een tijdgat groter dan 3 × het pollinterval telt niet als gedekt.
- Of een meting **verouderd** is, volgt uit de tijd van de poll, niet uit een waarde die
  niet verandert. Een constant debiet is normaal.

### D3 — Gemiddeld vermogen aan de learner

Bij elk sample (5 min) levert de service de energie sinds het vorige sample
(`heatEnergyKwh`, nieuw optioneel veld in `MeasurementData`). Hebben alle samples in het
venster dat veld, dan rekent de learner `X[0] = Σ energie / vensterduur`. Zonder het veld
blijft het huidige gedrag (Tuya, oude states).

### D4 — Vensters met te weinig dekking afkeuren

Een interval van 5 minuten met minder dan **80%** dekking wordt niet geleerd. Ook een
interval dat door D6 wordt uitgesloten, wordt niet geleerd. In beide gevallen begint het
venster opnieuw (zoals B2).

### D5 — Venster-COP als rendementsinformatie

`COP_venster = warmte-energie / elektrische energie` (kWh-meter) over hetzelfde venster,
als diagnostisch veld. Het stuurt het gebouwmodel niet. Een venster-COP buiten
1,5–7 geeft een waarschuwing in de diagnostiek, omdat het op een vaste meetafwijking
kan wijzen (§4).

### D6 — Beslisregels per situatie

Een interval wordt **uitgesloten** zodra er één poll in valt die op "uitsluiten" staat.
Het filter kijkt nooit naar de gemeten warmte zelf (§3.4).

| Situatie | Herkend aan | Warmte | Leren |
|---|---|---|---|
| Debiet 0, compressor uit | debiet 0, compressorbit uit | 0 kW | Doorgaan; de afkoeling bevat informatie |
| Debiet 0, compressor draait, kort | debiet 0 ≤ 120 s na de start van de compressor | 0 kW (fysiek juist) | Doorgaan |
| Debiet 0, compressor draait, langer | debiet 0 > 120 s, of pomp-PWM > 0 bij debiet 0 | onbekend | Uitsluiten; tegenstrijdige of defecte meting |
| Debiet > 0, ΔT positief | — | gemeten, geïntegreerd | Doorgaan, ook zonder geldige COP |
| Debiet > 0, ΔT ongeveer 0 of licht negatief | \|ΔT\| < 2 K | gemeten, ook negatief (D1) | Doorgaan |
| Debiet ontbreekt, verouderd of onbetrouwbaar | gat > 3 × pollinterval | onbekend, **niet 0** | Uitsluiten als de dekking < 80% (D4) |
| Ontdooien | bit `SYSTEM_DEFROST` in die poll (D7) | warmte onttrokken | Uitsluiten |
| Duidelijk negatieve ΔT zonder ontdooibit | ΔT ≤ −2 K | onbekend | Uitsluiten; teller in de diagnostiek |
| Tapwaterproductie | stand van de 3-wegklep (D8, te verifiëren) | gemeten, maar niet naar het huis | Uitsluiten |
| Elektrisch element actief | relaybits van 0x0019 (D9) | deels ongemeten | Uitsluiten |
| Ongemeten bijstook (CV-ketel) | geen signaal in de warmtepomp (D9) | ongemeten | Uitsluiten zodra herkenbaar; nu open (O8) |

### D7 — Ontdooien per poll

Het ontdooibit staat in Status 1 (0x0000, bit 8) en komt elke 5 s mee in de poll
`superfast`. De accumulator markeert het interval zodra één poll het bit heeft. Dat
vervangt de controle op het samplemoment. Een ontdooicyclus van een paar minuten tussen
twee samples valt er dan niet meer doorheen.

Ontdooien wordt voorlopig uitgesloten, niet als negatieve energie gemodelleerd. Het
modelleren van de onttrokken warmte is een latere stap. Daarvoor moet eerst duidelijk zijn
waar de onttrokken warmte vandaan komt: het water, de buffer of de vloer.

### D8 — Tapwater via de 3-wegklep (te verifiëren)

Tijdens tapwaterproductie meet het meetpunt warmte die naar de boiler gaat. Telt die
mee, dan ziet het model warmte zonder temperatuurstijging: θ1 daalt en C stijgt.

- **Kandidaatsignaal:** een 3-wegklepbit in Relay Output Status 1 (0x0019).
- **Eerst op hardware nagaan:**
  - welk bit bij een tapwatercyclus schakelt (`AC_SOLENOID_3WAY` of
    `FLOOR_SOLENOID_3WAY`);
  - of dat per installatie verschilt.
- **Resolutie:** het register wordt elke 30 s gelezen, tegenover 5 s voor de warmte. Een
  interval wordt daarom ook uitgesloten als de klep in de **vorige of volgende** lezing
  op tapwater stond.
- **Tot het bit is bevestigd** blijft de huidige modusafhankelijke poort (0x0304) gelden.
  De bekende beperking voor de modi 5 en 7 staat dan in de diagnostiek.

### D9 — Ongemeten bijstook

Warmte die het huis krijgt zonder door het meetpunt te gaan, ziet het model als
"warmte uit het niets": P_int stijgt.

- **Elektrische elementen:** relaybits `FLOOR_EHEATING`, `AC_EHEATING` en
  `HOT_WATER_EHEATING` (0x0019). Zolang niet vaststaat of een element vóór of ná de
  aanvoersensor zit, wordt een interval met een actief element uitgesloten.
- **Externe CV-ketel:** de warmtepomp kent die niet. Mogelijke signalen zijn een
  instelling, een flowkaart ("bijstook actief") of een externe temperatuursensor. Dat
  blijft een open punt (O8).
- De bestaande poort voor bijverwarming bij compressor uit (`BUILDING_MODEL_AUX_HEATING_THRESHOLD_W`) blijft.

## 3. Onderbouwing: simulatie

### 3.1 Opzet

Woning C 20 / UA 0,30 / P_int 0,30, 30 dagen, 5 seeds, thermostaatcyclus, debiet 20 l/min
(hele l/min), temperaturen met natuurlijke variatie, polls elke 5 s. Varianten op dezelfde
gecompileerde learner (3.4.x):

- **ideaal**: werkelijke warmte, gemiddeld per interval (bovengrens);
- **huidig**: één afgeronde momentopname per sample (incl. overslaan bij COP ≤ 0 of buiten 1–8);
- **venster**: warmte per poll uit afgeronde waarden, geïntegreerd per interval (D1–D3).

RMSE 6 u voorspelling met de werkelijke warmte; P_int waar 0,30.

### 3.2 Warmtemeting

| Scenario | ideaal | huidig | venster |
|---|---|---|---|
| Mild 12 °C, hele graden (afronden) | 0,006 (P_int 0,27) | 0,011 (0,22) | **0,006 (0,27)** |
| Koud 3 °C, hele graden (afronden) | 0,013 (0,30) | 0,019 (0,40) | **0,016 (0,30)** |
| Mild, hele graden **afkappen** | 0,006 (0,27) | 0,021 (0,11) | **0,006 (0,28)** |
| Mild, **geen** afronding | 0,006 (0,27) | 0,013 (0,19) | **0,006 (0,28)** |
| Mild, hele graden, sensorruis 0,4 K, 45 l/min | 0,006 (0,27) | 0,022 (0,16) | **0,006 (0,28)** |
| Mild, hele graden, **zeer stabiele** temperaturen | 0,006 (0,27) | 0,017 (0,07) | 0,017 (0,08) |
| Mild, warmte **systematisch 40% te laag** | 0,006 | 0,442 (C 11,9, UA 0,18) | 0,441 (C 11,9, UA 0,17) |
| Mild, hele graden, **afgiftevertraging 3 u** | 0,275 (C 39,5, P_int 4,63) | 0,278 | 0,276 |

**Conclusies:**

1. De momentopname is zelf een foutbron, ook zonder afronding: de warmte schommelt
   binnen 5 minuten (modulatie, start en stop). Integreren per poll haalt dat weg.
2. Met natuurlijke variatie middelen afronden en afkappen uit; de vensterintegratie is
   dan gelijk aan ideaal.
3. Bij **zeer stabiele** temperaturen middelt de afronding niet uit: venster en huidig
   zijn dan even goed (of slecht).
4. Een **vaste** onderschatting verhoogt P_int niet: het model schaalt C en UA mee (τ blijft
   gelijk). De regeling, die met dezelfde metingen werkt, merkt dat nauwelijks; de absolute
   waarden (inzichten) wel. Integratie lost een vaste afwijking niet op; D5 maakt hem
   zichtbaar.
5. Een **afgiftevertraging** van 3 uur domineert in deze opzet alles: C naar de grens,
   P_int ×15, voor alle varianten.
   - **Gecorrigeerd na §3.5:** alleen het effect op C is robuust.
   - Het effect op UA en P_int hangt af van de opzet. Met de echte buitentemperatuur
     en een strakkere thermostaat geeft dezelfde vertraging C 38,4, UA 0,24 en P_int 0,24.
   - De eerdere conclusie dat dit patroon de testinstallatie verklaart, is vervallen.

### 3.3 Identificeerbaarheid van UA en P_int

Prototype `adr064-ident.js`: zelfde woning, **werkelijke** warmte als invoer, zodat alleen het
identificeren getoetst wordt. D̄ is het gemiddelde van T_binnen − T_buiten (10,2 °C). De
correlatie komt uit de covariantiematrix P aan het eind van de run.

| Scenario | σ(T_binnen − T_buiten) | UA (0,30) | P_int (0,30) | τ (67 u) | P_int − UA·D̄ (waar) | corr θ2–θ4 |
|---|---|---|---|---|---|---|
| Buiten ±4 °C per dag | 2,76 °C | 0,290 | 0,15 | 68 | −2,81 (−2,77) | 0,82 |
| Buiten ±2 °C | 1,18 °C | 0,312 | 0,44 | 64 | −2,73 (−2,75) | 0,96 |
| Buiten ±1 °C | 0,49 °C | **0,370** | **1,14** | 54 | −2,62 (−2,75) | **0,99** |
| Buiten ±0,3 °C | 0,29 °C | 0,355 | 0,87 | 57 | −2,74 (−2,75) | 0,995 |
| Buiten ±1 °C + nachtverlaging 2 °C | 0,49 °C | 0,366 | 1,10 | 55 | −2,62 (−2,75) | 0,99 |
| Binnensensor +1 °C, buiten ±4 °C | 2,76 °C | 0,299 | 0,57 | 66 | −2,48 (−2,77) | 0,83 |
| Binnensensor −1 °C, buiten ±4 °C | 2,76 °C | 0,311 | 0,06 | 64 | −3,12 (−2,77) | 0,81 |
| Binnensensor +1 °C, buiten ±1 °C | 0,49 °C | 0,357 | **1,32** | 56 | −2,31 (−2,75) | 0,99 |

Over de seeds lag de uitkomst dicht bij elkaar (bij buiten ±1 °C: UA 0,360–0,379,
P_int 1,06–1,22). De afwijking is dus systematisch.

**Conclusies:**

1. Het model bepaalt het **netto verlies** bij het huidige temperatuurverschil goed
   (P_int − UA·D̄ binnen ongeveer 0,1 kW), maar UA en P_int los alleen bij voldoende
   variatie in T_binnen − T_buiten.
2. Bij een spreiding van ongeveer 0,5 °C verschuiven UA en P_int samen naar waarden die
   dicht bij de testinstallatie liggen (UA 0,385, P_int 1,24). **Gemeten:** de
   installatie had een spreiding van 1,89 °C (§3.5). Daarmee valt deze verklaring voor
   het ontstaan van de afwijking af.
3. De fout wordt pas zichtbaar bij een ander temperatuurverschil: bij D = 20 °C rekent het
   model op ongeveer 6,3 kW verlies tegen 5,7 kW werkelijk (+10%). τ zakt van 67 naar 54 u.
4. Een afwijking δ van de binnensensor verschuift P_int met ongeveer UA × δ, en stapelt
   bij weinig variatie. Bij −1 °C bleef P_int hoger dan verwacht (0,06 tegen ongeveer
   −0,15); de oorzaak is niet onderzocht.
5. Nachtverlaging voegt in een zwaar huis weinig variatie toe: bij τ ≈ 67 u koelt het
   huis in 7 uur maar ongeveer 1 °C af.
6. Ook bij goede variatie is P_int niet zuiver (0,15 tegen 0,30). Een vermoeden is de
   gesloten lus: de thermostaat koppelt de warmte aan de binnentemperatuur. Dat is niet
   getoetst.

ADR-064 verandert hier niets aan: in dit prototype is de warmte al ideaal.

### 3.4 Negatieve ΔT: afkappen of meetellen

Prototype `adr064-clamp.js`: fout in de gemeten warmte per poll, met onafhankelijke ruis op
beide sensoren en afronden op hele graden.

| Debiet | Ruis per sensor | Vermogen (ΔT) | Polls met ΔT < 0 | Fout bij meetellen | Fout bij afkappen |
|---|---|---|---|---|---|
| 20 l/min | 0,05 K | 2 kW (1,43 K) | 0,0% | 0,0% | 0,0% |
| 20 l/min | 0,4 K | 2 kW (1,43 K) | 0,0% | +0,1% | +0,1% |
| 45 l/min | 0,4 K | 2 kW (0,64 K) | 0,9% | +0,2% | +1,7% |
| 60 l/min | 0,4 K | 2 kW (0,48 K) | 2,2% | +0,2% | +4,9% |
| 60 l/min | 0,7 K | 2 kW (0,48 K) | 9,9% | +0,5% | **+22%** |
| 60 l/min | 0,7 K | 4 kW (0,96 K) | 2,6% | +0,2% | +3,0% |

**Conclusies:**

1. Afkappen op 0 telt de warmte stelselmatig te hoog. Dat speelt pas bij een ΔT onder
   ongeveer 1 K met merkbare sensorruis: lage modulatie of een hoog debiet.
2. Meetellen houdt de fout onder 0,5%.
3. Bij de huidige ΔT op de testinstallatie (2–3 K) is het verschil verwaarloosbaar. In het
   simulatiemodel van §3.2 komt geen negatieve ΔT voor, omdat afronden de volgorde van
   aanvoer en retour bewaart.
4. Daarom is O5 vervangen door D1 (meetellen) en D6 (alleen ΔT ≤ −2 K uitsluiten). Het
   filter kijkt nooit naar de gemeten warmte zelf: polls met ΔT = 0 weggooien laat alleen
   de naar boven afgeronde waarden over.

### 3.5 Testinstallatie: echte buitentemperatuur, radiatorvertraging en herstel

**Gemeten spreiding (O11).** Insights van `Aurora I/II Modbus` op de Self-Hosted Server,
uurwaarden van 18 oktober 13:00 tot 25 oktober 13:00 UTC (169 uur), externe binnen- en
buitentemperatuur zoals het model ze gebruikt.

| Grootheid | Waarde |
|---|---|
| D̄ = T_binnen − T_buiten | 11,4 °C |
| σ(D) | **1,89 °C** (min 7,5, max 17,0) |
| σ binnen de dag / tussen dagen | 1,52 / 0,98 °C |
| σ(T_binnen) / σ(T_buiten) | 0,26 / 2,06 °C |

De periode beslaat het leergeheugen: 1670 samples (ongeveer 5,8 dagen), en met λ 0,999
weegt het model vooral de laatste paar dagen. Opvallend: de externe buitentemperatuur
stond op 21 oktober zes uur op precies 14,0 °C (12:00–17:00 UTC). Dat wijst op een
vastgelopen of afgekapte bron.

**Identificatie met de echte reeks.** Prototype `adr064-ident-real.js`: de gemeten
buitentemperatuur, herhaald tot 28 dagen. Woning C 20 / UA 0,30 / P_int 0,30, werkelijke
warmte, thermostaat 21,8 / 21,4 °C met band ±0,2 °C, 5 seeds. Voor de radiatoren staat
een eerste-orde vertraging tussen geproduceerde en afgegeven warmte.

| Binnensensor | Vertraging | Warmte | C | UA | P_int | τ (u) | corr θ2–θ4 |
|---|---|---|---|---|---|---|---|
| juist | 0 min | ×1 | 19,5 | 0,310 | 0,40 | 63 | 0,93 |
| +1 °C | 0 min | ×1 | 19,5 | 0,310 | 0,71 | 63 | 0,93 |
| +2 °C | 0 min | ×1 | 19,5 | 0,311 | 1,03 | 63 | 0,94 |
| juist | 15 min | ×1 | 21,4 | 0,272 | 0,13 | 79 | 0,93 |
| juist | 30 min | ×1 | 22,8 | 0,275 | 0,15 | 83 | 0,92 |
| juist | 45 min | ×1 | 24,2 | 0,265 | 0,08 | 92 | 0,92 |
| juist | 60 min | ×1 | 26,9 | 0,299 | 0,10 | 92 | 0,93 |
| juist | 180 min | ×1 | 38,4 | 0,242 | 0,24 | 161 | 0,92 |
| juist | 0 min | ×0,6 | 11,7 | 0,186 | 0,24 | 63 | 0,92 |
| juist | 60 min | ×0,6 | 17,2 | 0,184 | 0,07 | 94 | 0,92 |
| *Installatie* | | | *26,4* | *0,396* | *1,24* | *67* | *niet uit te lezen* |

**Herstel vanuit de huidige stand.** Prototype `adr064-restart.js`: dezelfde woning en
reeks, maar de learner start met θ van de installatie
(`[0.037858, 0.014989, 0.013145, 0.046989]`). De installatie exporteert alleen `P_diag`,
afgerond op 3 decimalen. Daarom zijn drie startwaarden van P geprobeerd. Gemiddelde over
3 seeds.

| Start | Na 2 dagen | Na 6 dagen | Na 14 dagen | Na 28 dagen |
|---|---|---|---|---|
| Vers (profiel) | C 19,4 · UA 0,304 · P_int 0,15 | 19,4 · 0,308 · 0,40 | 19,5 · 0,308 · 0,39 | 19,5 · 0,311 · 0,41 |
| Installatie, P_diag 0,01 | 19,5 · 0,338 · 0,85 | 19,4 · 0,332 · 0,68 | 19,5 · 0,313 · 0,45 | 19,5 · 0,311 · 0,41 |
| Installatie, P_diag 0,001 | 20,1 · 0,345 · 0,93 | 19,5 · 0,349 · 0,87 | 19,5 · 0,335 · 0,68 | 19,5 · 0,312 · 0,42 |
| Installatie, P_diag 0,0001 | 22,9 · 0,361 · 1,07 | 20,2 · 0,356 · 0,94 | 19,5 · 0,353 · 0,87 | 19,5 · 0,320 · 0,50 |

**Conclusies:**

1. Met de gemeten spreiding kan het model UA goed bepalen (0,31). Alleen de koppeling
   UA–P_int verklaart de waarden van de installatie niet.
2. Een afwijking van de binnensensor verhoogt alleen P_int; UA blijft 0,31. Ook dat
   verklaart het patroon niet.
3. Een radiatorvertraging van 15–60 minuten verhoogt C (tot +38% bij 60 minuten), maar
   verlaagt UA licht en P_int sterk. Een vertraging verklaart C 26 mogelijk, maar niet
   UA 0,40 en P_int 1,24.
4. Een te lage warmtemeting (×0,6) verlaagt C, UA en P_int samen. Bij een vertraging van
   60 minuten heffen de effecten op C elkaar deels op (C 17,2).
5. **Langs de kam herstelt het model traag.**
   - Vanuit de huidige stand is C na 2–6 dagen schone data terug op ongeveer 20.
   - UA en P_int hebben 10–28 dagen nodig, afhankelijk van de onbekende P.
   - De huidige UA en P_int zijn daarom waarschijnlijk een restant van eerdere
     leerperioden (onder andere oudere code, 600 reverts en 679 keer rate limiting),
     niet een eigenschap van de woning.
6. Hoe de afwijking is ontstaan, blijft open. Kandidaten:
   - de oudere code;
   - de afgekapte buitentemperatuur;
   - tapwatercycli in een gecombineerde modus;
   - de momentane COP.
7. Een volledige reset (§3.6) geeft de schoonste vergelijking. Bij een verse start is UA
   na ongeveer 2 dagen en P_int na ongeveer 4 dagen stabiel.

### 3.6 Volledige reset als proef

**Welke reset.** De code kent twee resets. Bedoeld is de **volledige reset** via de
instelling **"Reset gebouwmodel leren"** (`reset_building_model`,
`BuildingModelService.reset()`).

| | Volledige reset (bedoeld) | Soft reset (niet bedoeld) |
|---|---|---|
| Hoe | Instelling "Reset gebouwmodel leren"; zet zichzelf daarna weer uit | Alleen automatisch bij een wissel van gebouwprofiel (`BuildingModelLearner.softReset()`) |
| θ | Waarden van het ingestelde profiel | Waarden van het nieuwe profiel |
| P | 100 (nieuwe learner) | 50 |
| Samples en zekerheid | 0; zekerheid begint opnieuw | Gehalveerd; zekerheid ongeveer 25–35% |

De start "vers (profiel)" in §3.5 komt overeen met de volledige reset: een nieuwe learner,
P = 100, profiel `average`. Een soft reset leert ongeveer even snel, maar is alleen te
starten door het profiel te wisselen.

**Waarom.** Een reset vervangt θ en maakt P weer groot. Daarna bepaalt de data van de
komende dagen de waarden, niet de afwijking langs de kam uit eerdere leerperioden.

**Een proef die geschiedenis en huidige invoer scheidt.** Zonder reset ziet een stand die
langzaam herstelt er hetzelfde uit als een stand die door de huidige invoer steeds
opnieuw wordt vervuild. Vanaf een schone start is dat te onderscheiden:

| Na de reset gaan UA en P_int… | Dan zit de oorzaak in… | Vervolg |
|---|---|---|
| binnen enkele dagen naar redelijke waarden (bijvoorbeeld UA ≈ 0,3, P_int ≈ 0,3–0,5) en blijven daar | de **geschiedenis**: oudere code of eerdere invoerfouten | ADR-064 verbetert de invoer; geen verdere jacht op een oorzaak in de huidige invoer |
| eerst naar redelijke waarden, daarna langzaam weer naar UA 0,40 en P_int 1,24 | de **huidige invoer**: momentane COP, tapwater in een gecombineerde modus, de bron van de buitentemperatuur | Per kandidaat nagaan, bijvoorbeeld door intervallen met tapwater of een vastgelopen buitentemperatuur te markeren |
| direct weer naar dezelfde waarden | een **structurele** oorzaak in de huidige invoer of in het model | Invoer en modelstructuur opnieuw bekijken |

**Het moment bepaalt wat de proef meet.**

- **Nu resetten** (met de huidige invoer) toetst de geschiedenis tegen de huidige invoer.
- **Resetten bij de invoering van ADR-064** meet het effect van de nieuwe invoer, maar
  niet meer wat de oude invoer deed.

Beide resets hebben zin; ze beantwoorden een andere vraag.

**Wat de reset kost.**

- De oude waarden zijn weg. Ze staan alleen nog in het log: noteer C, UA, τ, g, P_int en
  de confidence vooraf.
- De zekerheid begint opnieuw. De adaptieve regeling werkt ongeveer een dag (288 samples)
  met profielwaarden.
- De inzichten verdwijnen tijdelijk.

**Kanttekening.** De volledige reset leest `enable_dynamic_pint` uit de instellingen
(standaard aan). In de simulaties stond die uit. Een dagafhankelijke P_int kan de
getoonde waarden iets laten afwijken van §3.5.

## 4. Wat het oplost en wat niet

| | |
|---|---|
| ✔ Bemonsteringsfout van de momentopname | Opgelost (§3.2, 1) |
| ✔ Ruis door hele graden en hele l/min | Opgelost bij natuurlijke variatie (§3.2, 2) |
| ✔ Opstart- en stopmomenten | Worden meegeteld in plaats van overgeslagen |
| ✔ Korte ontdooicycli tussen samples | Uitgesloten per poll (D7) |
| ✔ Afrondfout bij kleine ΔT | Opgelost door meetellen (§3.4) |
| ◐ Tapwater binnen gecombineerde modi | Opgelost zodra het klepbit is bevestigd (D8) |
| ◐ Bijstook | Elektrisch via relaybits (D9); CV-ketel open (O8) |
| ✖ Zeer stabiele temperaturen | Afrondafwijking blijft (§3.2, 3) |
| ✖ Vaste meetafwijking (debiet of sensor) | Blijft; zichtbaar via D5 |
| ✖ Afgiftevertraging | Blijft; eigen besluit nodig (O6) |
| ✖ Koppeling UA–P_int bij weinig variatie | Blijft; eigen besluit nodig (O9) |
| ✖ Traag herstel van een vervuilde stand langs de kam | Blijft; volledige reset (§3.6) of eigen besluit (O9) |

## 5. Gevolgen

- Een nieuw optioneel veld in `MeasurementData` en een kleine uitbreiding van het
  venster in de learner; gedrag zonder het veld ongewijzigd.
- Nieuwe gedeelde klasse `HeatEnergyAccumulator`; de Aurora II-driver voedt die vanuit de
  `superfast`-poll, met het ontdooibit en de pomp-PWM uit dezelfde poll.
- De accumulator heeft ook de relaybits uit de poll `medium` nodig (D8, D9).
- De bestaande poorten in `building-model-service.ts` (modus, ontdooien op het
  samplemoment, COP ≤ 0) vervallen voor samples met `heatEnergyKwh`. De poort voor
  bijverwarming bij compressor uit blijft.
- Nieuwe tellers in de diagnostiek: uitgesloten intervallen per reden (dekking,
  ontdooien, negatieve ΔT, tapwater, element, debiet 0 bij draaiende compressor).
- Geen nieuwe capability (D5 als diagnostiek), dus geen migratie.
- Na invoering verschuiven geleerde waarden. Een volledige reset via "Reset gebouwmodel
  leren" geeft de schoonste vergelijking (§3.6). Zonder reset hebben UA en P_int volgens §3.5 10–28 dagen nodig
  om een oude afwijking langs de kam kwijt te raken.

## 6. Open punten

| # | Vraag | Voorstel |
|---|---|---|
| O1 | Versie | 3.5.0 |
| O2 | Drivers | Eerst Aurora II. Aurora III: eerst nagaan of debiet, temperaturen, ontdooi- en klepstatus snel genoeg gepold worden. Tuya (DPS-pushes): later, eigen aanpak. |
| O3 | Venster-COP | Diagnostiek; capability later |
| O4 | Dekkingsdrempel | 80% per interval van 5 min |
| O5 | ~~Negatieve ΔT als 0 tellen~~ | **Vervallen:** meetellen (D1), ΔT ≤ −2 K uitsluiten (D6); zie §3.4 |
| O6 | Afgiftevertraging | Eigen besluit: afgiftefilter (review §2.3). Het effect op C is robuust; het effect op UA en P_int hangt af van de opzet (§3.2, §3.5). Testinstallatie: radiatoren, 15–60 min verhoogt C tot +38% |
| O7 | Tapwaterbit | Op hardware nagaan welk bit van 0x0019 bij tapwater schakelt, en of dat per installatie verschilt (D8) |
| O8 | CV-ketel als bijstook | Signaal kiezen: instelling, flowkaart of externe sensor (D9) |
| O9 | Koppeling UA–P_int en traag herstel | Eigen besluit. De correlatie bepaalt niet alleen of UA en P_int te scheiden zijn, maar ook hoe lang een fout langs de kam blijft staan (§3.5: 10–28 dagen). Opties: (a) corr θ2–θ4 en de volledige P in de diagnostiek (nu alleen `P_diag`, afgerond); (b) inzichten over UA en P_int markeren als "nog niet te scheiden" boven ongeveer 0,98; (c) P_int bij hoge correlatie naar de profielwaarde trekken; (d) P langs de kam vergroten, zodat de learner in die richting sneller bijstuurt; (e) een volledige reset aanbevelen na een wijziging van de invoer, zoals de invoering van ADR-064 (§3.6) |
| O10 | Grens debiet 0 bij draaiende compressor | 120 s na de start van de compressor (D6) |
| O11 | Spreiding op de testinstallatie | **Beantwoord (§3.5):** σ 1,89 °C. Te groot om het ontstaan van P_int 1,24 met de koppeling te verklaren. Nieuw: buitentemperatuur 21 oktober zes uur vast op 14,0 °C, bron na te gaan |

## 7. Testaanpak

- Unit-tests accumulator:
  - integratie, dekking en gaten;
  - compressor uit, en debiet 0 bij draaiende compressor (kort en lang);
  - negatieve ΔT meetellen en ΔT ≤ −2 K uitsluiten;
  - ontdooibit in één poll sluit het interval uit;
  - klep- en elementbit sluiten het interval uit, ook in de lezing ervoor en erna.
- Unit-tests learner: `heatEnergyKwh` (venstergemiddelde = energie / duur), afkeuren bij te
  weinig dekking of bij uitsluiting.
- Simulatie: de prototypes staan in het harnas (`adr064-*.js`); regressie op §3 en op de
  bestaande grenzen van ADR-062 §4a.
- Hardware:
  - venster-COP naast de rollende COP van Tuya en Modbus;
  - het klepbit tijdens een tapwatercyclus (O7);
  - na een volledige reset de ontwikkeling van C, UA en P_int volgen, naast de
    verwachting uit §3.5 (UA na ongeveer 2 dagen, P_int na ongeveer 4 dagen stabiel), en
    de uitkomst indelen volgens de proeftabel in §3.6.

## 8. Niet doen

- De rollende dag-COP als invoer: mist de schommelingen binnen de dag.
- Warmte uit vermogen × geschatte COP waar debiet en temperaturen beschikbaar zijn.
- Polls afkeuren op hun eigen warmtewaarde (ΔT = 0, kleine negatieve ΔT): dat geeft een
  systematisch te hoge warmte.
- Een ontbrekend of verouderd debiet als 0 kW tellen.
- Ontdooien nu al als negatieve energie modelleren.
- De afgiftevertraging en de koppeling UA–P_int met dit besluit proberen op te lossen.
