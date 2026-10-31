# ADR-065: Positionele PI met integraal naast de stooklijn

**Status:** Aangenomen (2026-10-30). Gebouwd in 3.5.0 als opt-in: de klassieke regeling
blijft de standaard (O11). Eerder: concept (2026-10-25), aangevuld met D8 (2026-10-30).
**Datum:** 2026-10-25
**Beslissers:** -
**Gerelateerd:** ADR-024, ADR-040A/B, ADR-047b, ADR-058 (coast); ADR-059 W1/W2
(accumulator, comfortanker); ADR-060 (geharmoniseerde regeling); lokaal in `plans/decisions/`,
niet in git; [ADR-062](ADR-062-BUILDING-MODEL-REVIEW-IMPLEMENTATION.md) A4 (modelparameters
zonder confidence-gate)
**Simulatie:** `test/simulation/coast-closed-loop.js` (closed loop: woning, watercircuit,
warmtepomp met interne thermostaat, regelcyclus van 5 minuten, flow, hele graden)

---

## Samenvatting voor de eigenaar

- **Wat:** het advies voor het setpoint wordt **stooklijn + PI-correctie**, met een
  echte integraal en anti-windup. Nu is het advies **huidig setpoint + opgetelde
  PI-uitvoer**: de PI-uitvoer wordt elke 5 minuten opnieuw bij het setpoint opgeteld.
- **Waarom:** als de flow het advies uitvoert, slingert het setpoint in de huidige opzet
  dagelijks tussen 20 en 60 °C. Dat kost comfort en energie. In de simulatie halveert
  de voorgestelde PI de comfortfout (RMSE 0,35 → 0,17 °C bij radiatoren), verdwijnt de
  onderkoeling bij kou, en daalt het verbruik met 0–24% (het minst bij vloerverwarming
  in de kou).
- **Coast:** blijft beschikbaar, maar als optie voor vloerverwarming. Bij radiatoren
  voegt coast naast deze PI niets toe en geeft het meer compressorstarts.
- **Afgiftesysteem:** een keuzelijst (radiatoren, vloerverwarming, handmatig) zet Kp, Ti
  en coast in één keer. Ti en coast hangen sterk van het afgiftesysteem af, Kp weinig
  (D8).
- **Wat het niet oplost:** een slechte stooklijn wordt opgevangen, maar een stooklijn
  met de verkeerde vorm (te steil of te vlak) laat een afwijking die met het weer
  meeloopt. Tapwater en ontdooien zijn niet gesimuleerd.
- **Stand (3.5.0):** gebouwd voor Tuya, Aurora II en Aurora III achter de instelling
  "Regelmodus" (klassiek standaard, positioneel opt-in). De simulatie draait op de echte
  implementatie; P4 (§3.5) bevestigt de verbetering voor lichte en zware woningen en
  voor een stooklijn met de verkeerde vorm. Een hardwareweek (§7.4) volgt.

---

## 1. Context

### 1.1 Huidige regeling

Per cyclus van 5 minuten (`adaptive-control-service.ts`, Aurora II; Tuya en Aurora III
gelijk):

```text
PI:          u = Kp·e + Ki·gem(e)            gem(e) = gemiddelde van ≤ 24 fouten buiten de deadband
weging:      Δ = 0,6·u  (comfortanker, ADR-059 W2)   of met coast: 0,2·0,6·u + 0,8·coast
accumulator: acc = begrens(acc + Δ, ±2)
advies:      setpoint_nieuw = setpoint_huidig + round(acc)
verrekening: na uitvoering door de flow: acc −= toegepaste stap (ADR-059 W1)
```

De PI berekent een **positie**-correctie, maar die wordt elke cyclus opnieuw bij het
setpoint opgeteld. Het setpoint wordt zo de integraal van de PI-uitvoer: ongeveer
0,6 × 5 = 3 °C per cyclus per °C fout, oftewel 36 °C per uur.

Daarnaast doet de PI in een zone van ongeveer 0,9 °C niets
(`heating-controller.ts`):

- **onder het doel:** overshoot-preventie bij 0 < fout < 0,48 °C (τ afgetopt op 8 uur);
- **boven het doel:** dynamische deadband `0,25 + 0,5·UA`, bij UA 0,40 dus 0,45 °C. Die
  hangt aan het gebouwmodel, zonder controle op de confidence (ADR-062 A4).

### 1.2 Coast

Coast (ADR-024, 040A/B, 047b, 058) is ingevoerd omdat de PI te laat reageerde bij
oververhitting. Bij kamer > doel + 0,3 (2 cycli, stijgende trend) trekt coast het
setpoint naar uitlaat − 1 °C, met 80% van het gewicht, zodat de compressor uit blijft.
Exits: hard (kamer < doel + 0,15), zacht (kamer daalt en kleine correctie), watchdog
(2 uur).

### 1.3 Waarneming op de testinstallatie

Insights van de Self-Hosted Server, Aurora I/II via Modbus, 18–25 oktober 2026:

- het setpoint (`target_temperature`) bleef tussen 40 en 45 °C en volgde de
  buitentemperatuur, zoals een stooklijn;
- het advies (`adlar_simulated_target`) week uren achtereen 2–3 °C af van het setpoint
  (25 oktober 03:00–14:00: advies 39–40, setpoint 42);
- de binnentemperatuur lag vrijwel steeds 0,5–1 °C boven het doel.

Het advies wordt daar dus niet (volledig) uitgevoerd; de lus is open. Daardoor is het
slingeren uit §3 op deze installatie niet te zien. Een gebruiker wiens flow elk advies
uitvoert, krijgt het wel.

## 2. Besluiten (voorstel)

### D1 — Advies = basis + PI-correctie

```text
advies = round( begrens( basis + u, setpointgrenzen ) )
```

De **basis** is de stooklijn: het setpoint dat de warmtepomp of de app bij de huidige
buitentemperatuur zou kiezen zonder adaptieve regeling (O2). De PI corrigeert alleen
de afwijking daarvan.

**Uitwerking (3.5.0).** Instelling `adaptive_curve_source`:

| Keuze | Basis |
|---|---|
| Automatisch (standaard) | Aurora II: DIY-stooklijn k·(T1 + 15) + b uit L28/L29, op de eigen buitensensor T1 (ook leesbaar als de stooklijn uit staat). Aurora III: klimaatcurve Reg 67 (schaal nog niet geverifieerd). Tuya: geen stooklijn beschikbaar |
| App-stooklijn | Een rechte lijn door de watertemperatuur bij −15 °C en bij +15 °C buiten (`adaptive_curve_at_minus15`, standaard 40; `adaptive_curve_at_plus15`, standaard 25), dezelfde vorm als de DIY-stooklijn |
| Terugval | Een waarde buiten 15–70 °C (niet ingesteld, verkeerde schaal) of geen buitentemperatuur: een vlakke lijn op het setpoint bij het inschakelen van de positionele modus |

Bij Tuya is de app-stooklijn het advies: een vlakke basis werkt, maar minder goed (§3.5).

### D2 — PI met echte integraal

```text
u = begrens( Kp·e + I, ±Umax )
I = begrens( I + Ki·e, ±Imax )          per cyclus, met Ki = Kp / (Ti in cycli)
```

Standaard: Kp 3 K/K (gelijk aan de huidige Kp 5 × comfortanker 0,6), Ti 3 uur,
Imax 6 K, Umax 8 K. Kp en Ti blijven instelbaar.

### D3 — Anti-windup

De integraal wordt **niet** bijgewerkt:

1. als |e| ≤ 0,1 °C;
2. als het setpoint meer dan 1 °C van het vorige advies af staat (de flow loopt achter of
   voert niet uit);
3. als het advies tegen een setpointgrens staat in de richting van de fout.

Punt 2 is nodig omdat de app het setpoint niet zelf schrijft, maar via de flow van de
gebruiker (flow-assisted). Zonder deze regel loopt de integraal door op een advies dat
niet wordt uitgevoerd. Dat is precies de situatie op de testinstallatie (§1.3).

**D3.4 — Pauze (aanvulling bij de bouw).** De integraal wordt ook niet bijgewerkt tijdens
coast (D6), ontdooien en tapwater. Tijdens ontdooien en tapwater daalt de kamer zonder dat
de PI dat kan verhelpen; doorintegreren zou na afloop een overshoot geven. Signalen:
Aurora II het ontdooibit van de status, Aurora III ontdooien en tapwater actief. Tuya: nog
geen pauze (O12).

De diagnostiek toont per cyclus waarom de integraal stilstaat (`integralHold`).

### D4 — Geen brede dode zone meer

De overshoot-preventie (0,48 °C onder het doel) en de dynamische deadband (UA-afhankelijk)
vervallen voor de PI. Alleen de integratiedrempel van D3.1 blijft. Daarmee verdwijnt
ook de afhankelijkheid van een onbetrouwbaar gebouwmodel (ADR-062 A4) uit de PI.

### D5 — De accumulator vervalt voor de PI

De optelling en verrekening van ADR-059 W1 zijn voor de PI niet meer nodig: het advies
is per cyclus een positie, geen stap. Bij een wissel tussen klassiek en positioneel gaan
accumulator en integraal naar 0 (O5). De kleine bijdragen van de optimizers (COP, prijs,
thermisch) worden onderdeel van de correctie op de basis, binnen hun eigen budget
(ADR-059 W2) (O4).

**Uitwerking (3.5.0).** De PI-uitvoer u gaat gedeeld door het comfortanker (0,6) naar de
bestaande `WeightedDecisionMaker`. Na weging is het comfortaandeel dan precies u; de
verdringing door coast en het budget van de optimizers werken ongewijzigd. Het advies is
`round(begrens(basis + gewogen correctie))`, binnen dezelfde setpointgrenzen als de
klassieke regeling (instellingen, grenzen van de warmtepomp, setpointregister).

### D6 — Coast als optie per afgiftesysteem

Coast blijft bestaan met de huidige activatie- en exitregels, en verdringt de PI zoals
nu, maar **alleen zolang de coast-correctie negatief is** (ADR-040A). Standaard, via het
afgiftesysteem (D8):

- **radiatoren:** coast uit;
- **vloerverwarming:** coast aan.

Tijdens coast wordt de integraal bevroren. Bij vloerverwarming, waar coast standaard aan
staat, is dat iets beter dan doorintegreren (RMSE 0,206 tegen 0,213 mild; 0,195 tegen
0,211 koud). Bij radiatoren is doorintegreren beter (0,184 tegen 0,222), maar daar staat
coast standaard uit (O6).

### D7 — Ti per afgiftesysteem

Een snelle integraal past bij radiatoren, een langzame bij vloerverwarming (§3.3). Ti
volgt daarom uit het afgiftesysteem (D8): radiatoren 3 uur, vloerverwarming 6 uur. Bij
"Handmatig" geldt de eigen instelling (standaard 3 uur) (O3).

### D8 — Keuzelijst "Afgiftesysteem"

Een nieuwe instelling `adaptive_emitter_type` (label "Afgiftesysteem") zet de waarden die
het sterkst van het afgiftesysteem afhangen in één keer:

| Keuze | Kp (K/K) | Ti | Coast |
|---|---|---|---|
| Radiatoren (`radiator`) | 3 | 3 uur | Uit |
| Vloerverwarming (`floor`) | 3 | 6 uur | Aan |
| Handmatig (`manual`) | eigen instelling | eigen instelling | eigen instelling |

**Waarom een set en niet alleen Kp.** In de simulatie (§3.3) verschilt Kp weinig per
afgiftesysteem (radiator 0,148–0,201, vloer 0,183–0,204). Ti en coast verschillen sterk:
Ti 1,5 uur is het best bij radiatoren en maakt vloerverwarming onrustig; coast helpt
alleen bij vloerverwarming. Een keuzelijst die alleen Kp zet, stuurt de minst gevoelige
waarde.

**Waarden.** Voorlopig, uit één gesimuleerde woning. Voor radiatoren was Ti 1,5 uur en
Kp 4 in §3.3 net iets beter; de preset houdt Ti 3 uur en Kp 3 aan tot P4 (aanvullende
simulatie met lichte en zware woningen) dat bevestigt of bijstelt. De presetwaarden
liggen pas vast na P4.

**Werking:**

1. **Preset intern, velden ongemoeid.** Bij "Radiatoren" of "Vloerverwarming" gebruikt de
   regeling de presetwaarden; de velden Kp, Ti en coast houden hun eigen waarde en gelden
   alleen bij "Handmatig". De app schrijft geen instellingen vanuit `onSettings()`
   (`setSettings` daar geeft race conditions, zie `docs/architecture/KEY_PATTERNS.md`).
2. **Velden blijven zichtbaar.** Het instellingenscherm van Homey kan velden niet
   verbergen op basis van een keuzelijst. De hint bij Kp, Ti en coast vermeldt: "Alleen
   gebruikt bij Afgiftesysteem = Handmatig" (4 talen).
3. **Werkelijke waarden zichtbaar.** `adaptive_control_diagnostics` toont het
   afgiftesysteem en de gebruikte Kp, Ti en coast, met hun bron (preset of handmatig)
   (O8).
4. **Coast uit.** Coast kent nu geen uit-stand: de sterkte loopt van 0,60 tot 0,95.
   Voor "Handmatig" komt er een schakelaar `adaptive_coast_enabled` (standaard aan, het
   huidige gedrag). De presets zetten coast intern aan of uit.

**Standaardkeuze:**

| Situatie | Standaard |
|---|---|
| Bestaand apparaat (migratie) | Handmatig: de afgestemde waarden blijven gelden |
| Nieuw apparaat, Aurora II | Uit de modus 0x0304: 3 (vloerverwarming) of 7 (tapwater + vloerverwarming) → Vloerverwarming; anders Radiatoren |
| Nieuw apparaat, Aurora III | Uit het afgiftetype van zone 1 bij verwarmen (3-0035): 2 (vloer) → Vloerverwarming; 1 (radiator) of 0 (FCU) → Radiatoren |
| Nieuw apparaat, Tuya | Uit `adlar_enum_mode`: `floor_heating` of `floor_heatign_and_hot_water` → Vloerverwarming; anders Radiatoren (O10) |

De hardware stelt alleen de standaard voor; de gebruiker kan altijd een andere keuze
maken. De app leest het register eenmalig bij het koppelen en stuurt de keuze daarna
niet meer bij.

**Gescheiden van het gebouwprofiel.** `building_profile` (licht, gemiddeld, zwaar,
passief) beschrijft de massa van het **huis**; het afgiftesysteem de traagheid van het
**water en de afgifte**. Een zwaar huis met radiatoren en een licht huis met
vloerverwarming komen allebei voor. Twee aparte keuzes voorkomen dat de ene wordt
gebruikt om de andere te corrigeren.

**Gemengde installaties** (beneden vloer, boven radiatoren) zijn niet gesimuleerd.
Advies voorlopig: "Vloerverwarming" als de vloer de grootste of traagste afgifte is
(lange Ti en coast zijn de voorzichtige kant). Een vierde keuze "Gemengd" alleen als P4
daar een eigen set waarden voor oplevert (O9).

**Eigen velden voor positioneel (3.5.0).** Kp en Ti van de positionele PI staan in eigen
velden (`adaptive_pos_kp`, `adaptive_pos_ti`, standaard 3 en 3 uur). De klassieke Kp
(standaard 5) betekent iets anders en kan niet worden gedeeld. De hint bij de klassieke
velden vermeldt "Alleen gebruikt in de klassieke regelmodus".

**Klassieke regeling.** De presets horen bij de positionele PI. In de klassieke
(incrementele) regeling betekenen Kp en Ki iets anders, omdat de uitvoer elke cyclus
wordt opgeteld (§1.1). Daar zet de keuzelijst alleen coast aan of uit; Kp en Ki blijven
de eigen instelling.

## 3. Onderbouwing: simulatie

### 3.1 Opzet

`test/simulation/coast-closed-loop.js`, 14 dagen, 5 seeds:

| Onderdeel | Model |
|---|---|
| Woning | C 20 kWh/K, UA 0,30 kW/K, P_int 0,30 kW; zon op ongeveer de helft van de dagen (piek 1,5–3 kW rond 13:00) |
| Afgifte | Radiatoren: He 0,25 kW/K, Cw 0,25 kWh/K. Vloer: He 0,6 kW/K, Cw 4 kWh/K |
| Warmtepomp | Inverter stuurt de uitlaat naar het setpoint, 2–7 kW; start bij uitlaat < setpoint − 2 (na ≥ 5 min uit), stopt bij Qmin en uitlaat > setpoint + 1 (na ≥ 10 min aan); COP als fractie van Carnot |
| Buiten | De gemeten reeks van de testinstallatie; "koud" = die reeks min 8 K |
| Stooklijn | Het setpoint waarbij de woning zonder zon op 21 °C blijft, plus een vaste afwijking: in §3.2 radiator +2 K en vloer +1 K; in §3.3 voor beide +2 K, en 0 en +4 K |
| Regeling | De gecompileerde `HeatingController` en `WeightedDecisionMaker`; coast, accumulator, afronding, begrenzing en verrekening zoals in de app. Binnen op 0,1 °C, uitlaat op hele graden |
| Flow | Direct (elk gewijzigd advies) of beperkt (hooguit 1 °C per 30 min) |

De varianten "incr." zijn de huidige code; "pos. PI-I" is het voorstel. De controle:
de incrementele rijen veranderen niet door de toegevoegde varianten.

### 3.2 Resultaten (per dag, directe flow, mild)

| Variant | Afgifte | RMSE (°C) | Uren > +0,5 | Uren < −0,5 | Starts | kWh el | Setpoint |
|---|---|---|---|---|---|---|---|
| incr. PI (huidig) | radiator | 0,353 | 2,72 | 1,25 | 2,0 | 17,8 | 20–60 |
| incr. PI + coast (huidig) | radiator | 0,322 | 1,88 | 0,45 | 2,5 | 17,0 | 20–60 |
| **pos. PI-I** | radiator | **0,167** | **0,36** | **0,00** | 3,0 | **13,5** | 23–43 |
| pos. PI-I + coast | radiator | 0,222 | 1,09 | 0,00 | 10,8 | 13,6 | 24–43 |
| alleen stooklijn | radiator | 1,180 | 22,5 | 0,00 | 0,3 | 16,7 | 30–44 |
| incr. PI (huidig) | vloer | 0,594 | 8,35 | 3,25 | 0,6 | 12,3 | 20–60 |
| incr. PI + coast (huidig) | vloer | 0,562 | 8,00 | 3,42 | 0,6 | 12,1 | 20–60 |
| pos. PI-I | vloer | 0,211 | 0,31 | 0,32 | 1,0 | 10,8 | 20–33 |
| **pos. PI-I + coast** | vloer | **0,184** | 0,40 | **0,00** | 1,7 | **10,7** | 21–32 |

Met een beperkte flow (1 °C per 30 min) is PI-I vrijwel gelijk (radiator 0,166). De
huidige regeling wordt dan slechter (radiator 0,463, onderkoeling 4,0 uur per dag).

**Conclusies:**

1. De huidige regeling slingert dagelijks tussen 20 en 60 °C. Dat kost comfort en
   energie: een setpoint van 60 °C heeft een lage COP.
2. PI-I houdt het setpoint rustig en dicht bij de stooklijn, en werkt de afwijking van
   de stooklijn weg. In het dagverloop (radiator, zonder zon) blijft de kamer tussen
   20,98 en 21,07 °C, en moduleert de warmtepomp zonder te stoppen.
3. Een positionele PI **zonder** echte integraal (alleen het venstergemiddelde) laat bij
   radiatoren een blijvende oververhitting (RMSE 0,53): de PI-uitvoer is begrensd op
   ±3 °C (na weging ±1,8 K), minder dan de afwijking van de stooklijn. De integraal is
   daarom noodzakelijk.

### 3.3 Gevoeligheid

Eén factor tegelijk rond Kp 3, Ti 3 uur, afwijking +2 K; RMSE in °C (directe flow).

| Instelling | Rad. mild | Rad. koud | Vloer mild | Vloer koud |
|---|---|---|---|---|
| *Huidig incr. + coast* | *0,322* | *0,343* | *0,562* | *0,598* |
| PI-I basis | 0,167 | 0,168 | 0,204 | 0,191 |
| Ti 1,5 u | **0,149** | **0,149** | 0,253 | 0,257 |
| Ti 6 u | 0,192 | 0,194 | **0,172** | **0,167** |
| Kp 2 | 0,201 | 0,203 | 0,199 | 0,194 |
| Kp 4 | **0,148** | **0,149** | 0,202 | 0,183 |
| Afwijking 0 K | 0,161 | 0,161 | 0,219 | 0,172 |
| Afwijking +4 K | 0,170 | 0,170 | 0,180 | 0,186 |
| PI-I + coast, basis | 0,222 | 0,212 | 0,206 | 0,195 |
| PI-I + coast, afwijking 0 K | 0,178 | 0,186 | **0,177** | **0,162** |

- **Onderkoeling bij kou** (uren < −0,5 °C per dag): huidig 2,8 (radiator) en 8,9 (vloer);
  PI-I 0.
- **Verbruik:** radiator −20% (mild) en −7% (koud); vloer −12% (mild) en gelijk (koud).
- **Starts:** bij kou 0,1–0,2 per dag (doorlopend moduleren); bij mild weer met zon
  1–3 per dag. Met coast bij radiatoren in mild weer 10,8 per dag.

**Conclusies:**

1. PI-I is bij alle getoetste instellingen beter dan de huidige regeling, en ongevoelig
   voor de afwijking van de stooklijn (0 tot +4 K).
2. Ti hangt af van het afgiftesysteem: Ti 1,5 uur is het best voor radiatoren, maar
   maakt vloerverwarming onrustig (setpoint tot 45 °C, meer onderkoeling); daar is Ti
   6 uur het best (D7).
3. Coast helpt alleen bij vloerverwarming, en het meest bij een juiste stooklijn.

### 3.4 Correctie tijdens de toets

In een eerdere versie van de simulatie gaf coast ook gewicht als de coast-correctie 0
was. Dat duwde het setpoint omhoog (PI-I + coast bij afwijking +4 K: RMSE 1,03). Na
correctie volgens ADR-040A: 0,26. D6 legt deze voorwaarde daarom expliciet vast.

### 3.5 P4: aanvullende scenario's op de app-implementatie (3.5.0)

De simulatie gebruikt nu de gecompileerde `PositionalPIController` van de app. Controle:
de app-code geeft exact dezelfde uitkomsten als het prototype (radiator 0,167; vloer +
coast 0,184), en de rijen van de huidige regeling zijn ongewijzigd. Per afgiftesysteem
geldt de preset (radiator Kp 3, Ti 3 u, coast uit; vloer Kp 3, Ti 6 u, coast aan);
directe flow, 14 dagen, 5 seeds. RMSE in °C, huidig → positioneel:

| Scenario | Radiator mild | Radiator koud | Vloer mild | Vloer koud |
|---|---|---|---|---|
| Referentiewoning (C 20) | 0,322 → 0,167 | 0,343 → 0,168 | 0,562 → 0,178 | 0,598 → 0,170 |
| Lichte woning (C 7, UA 0,35) | 0,553 → 0,276 | 0,493 → 0,347 | 0,750 → 0,302 | 0,910 → 0,395 |
| Zware woning (C 30, UA 0,25) | 0,269 → 0,147 | 0,301 → 0,150 | 0,513 → 0,157 | 0,430 → 0,128 |
| Stooklijn te steil (×1,3) | 0,322 → 0,191 | 0,343 → 0,183 | 0,562 → 0,195 | 0,598 → 0,202 |
| Stooklijn te vlak (×0,7) | 0,322 → 0,182 | 0,343 → 0,175 | 0,562 → 0,202 | 0,598 → 0,162 |
| Vlakke basis | 0,322 → 0,299 | 0,343 → 0,305 | 0,562 → 0,282 | 0,598 → 0,234 |
| Nachtverlaging 19 °C (23–7 u) | 1,083 → 1,036 | 1,292 → 1,031 | 1,346 → 1,179 | 1,222 → 1,202 |

De stooklijnvorm draait om 7 °C buiten; de huidige regeling gebruikt geen stooklijn en
verandert daar dus niet.

Onderkoeling bij kou (uren < −0,5 °C per dag), huidig → positioneel: referentie 2,8 → 0
(radiator) en 8,9 → 0 (vloer); lichte woning 6,4 → 0,8 en 12,6 → 2,5; nachtverlaging
12,2 → 5,4 en 13,0 → 4,9.

**Conclusies:**

1. Positioneel is in elk scenario beter dan de huidige regeling, ook bij een stooklijn
   met de verkeerde vorm (±30% helling). De presets houden stand bij lichte en zware
   woningen.
2. Een vlakke basis werkt, maar is het zwakst; bij radiatoren nauwelijks beter dan nu.
   Daarom de app-stooklijn voor Tuya (D1).
3. Nachtverlaging: minder onderkoeling, maar meer compressorstarts (radiator mild 1,2 →
   5,5 per dag, vloer koud 1,0 → 6,7). De RMSE blijft hoog doordat de woning de stap naar
   19 °C en terug niet kan volgen; dat geldt voor beide regelingen.
4. In de lichte woning bij kou loopt het setpoint bij radiatoren tot 60 °C (de grens).

Niet getoetst: de optimizers (COP, prijs, thermisch), gemengde installaties, tapwater en
ontdooien, en een beperkte flow voor de P4-scenario's.

## 4. Wat het oplost en wat niet

| | |
|---|---|
| ✔ Slingeren van het setpoint (20–60 °C) | Opgelost (§3.2) |
| ✔ Brede dode zone van de PI | Opgelost (D4) |
| ✔ Afhankelijkheid van een onbetrouwbaar gebouwmodel in de PI | Opgelost (D4) |
| ✔ Een vaste afwijking van de stooklijn | Opgelost door de integraal (§3.3) |
| ✔ Onderkoeling na coast en bij kou | Opgelost (§3.3) |
| ✔ Advies dat niet wordt uitgevoerd | Geen windup meer (D3.2) |
| ◐ Oververhitting door zon bij vloerverwarming | Verkleind met coast (D6) |
| ✖ Een stooklijn met de verkeerde vorm | Een afwijking die met het weer verloopt; de integraal volgt traag (Ti) |
| ✖ Tapwater, ontdooien, bijstook | Niet gesimuleerd |

## 5. Kanttekeningen

- **Woningen:** C 20, UA 0,30, en in P4 (§3.5) een lichte (C 7) en een zware (C 30).
  Passieve woningen en woningen met een groot zonaandeel zijn niet getoetst.
- **Vorm van de stooklijn:** de vaste afwijking (§3.3) en de helling ±30% (§3.5) zijn
  gevarieerd; een knik in de stooklijn niet.
- **Interne thermostaat van de warmtepomp:** vereenvoudigd (start −2 K, stop +1 K,
  minimale tijden). De werkelijke regeling van de Adlar kan anders zijn.
- **Zon als enige verstoring**, plus nachtverlaging in P4. Geen bewoners, open deuren of
  houtkachel.
- **De binnensensor** meet zonder vertraging. Een sensor met een eigen traagheid maakt de
  lus trager.
- **De optimizers** (COP, prijs, thermisch) staan uit, zoals bij een nieuw gebouwmodel.
  Hun werking op de basis + correctie (D5) is niet getoetst.
- **Overgang:** bestaande gebruikers houden de klassieke regeling. Wie overstapt, begint
  met accumulator en integraal op 0 (O5).
- **Presets van het afgiftesysteem** (D8) komen uit dezelfde ene woning. Gemengde
  installaties en ventilatorconvectoren (FCU) zijn niet gesimuleerd.

## 6. Open punten

| # | Vraag | Besluit of stand |
|---|---|---|
| O1 | Versie | **Besloten:** 3.5.0, eigen minor (ADR-062 fase 3 wordt na ADR-065 bekeken) |
| O2 | Bron van de basis | **Besloten:** automatisch uit de warmtepomp (Aurora II DIY L28/L29, Aurora III Reg 67), anders een vlakke lijn; of een app-stooklijn door twee punten (D1) |
| O3 | Ti per afgiftesysteem | **Gebouwd** via de presets (D8). P4 bevestigt radiatoren 3 uur en vloer 6 uur; radiatoren 1,5 uur en Kp 4 blijven een optie na de hardwareweek |
| O4 | Optimizers | **Gebouwd** binnen hun budget via de decision maker (D5); **nog niet getoetst** |
| O5 | Migratie | **Besloten:** bestaande apparaten blijven klassiek. Bij een wissel van modus gaan accumulator en integraal naar 0. Positioneel heeft eigen velden voor Kp en Ti; de klassieke velden blijven (D8) |
| O6 | Coast standaard | **Besloten:** radiatoren uit, vloer aan. "Handmatig" (standaard) met `adaptive_coast_enabled` aan houdt het huidige gedrag |
| O7 | Flow-assisted of direct schrijven | Ongewijzigd flow-assisted; D3.2 vangt een flow op die niet of beperkt uitvoert |
| O8 | Diagnostiek | **Gebouwd:** blok `control` in `adaptive_control_diagnostics` met modus, afgiftesysteem, bron, Kp, Ti, basis, P, I, u en `integralHold`. Het coast-aandeel staat al in `breakdown` |
| O9 | Gemengde installaties en FCU | Open. Voorlopig "Vloerverwarming" adviseren bij gemengd, "Radiatoren" bij FCU; een keuze "Gemengd" alleen als een toets er een eigen set voor oplevert. Aurora III kent een tweede zone (3-0037) waaruit gemengd is af te leiden |
| O10 | Standaard uit de hardware | Open; niet gebouwd. De standaard is "Handmatig" voor alle apparaten. Eerst nagaan of de modus het afgiftesysteem echt weergeeft (vloerverwarming kan ook in modus "verwarmen" draaien) |
| O11 | Standaard regelmodus | **Besloten:** klassiek voor iedereen, positioneel opt-in. Over de standaard wordt beslist na de hardwareweek en praktijkdata |
| O12 | Pauze bij ontdooien voor Tuya | Open: de Tuya-driver geeft de service nog geen ontdooisignaal (D3.4) |

## 7. Testaanpak

Stand 3.5.0: punt 1 en 2 zijn gedaan (P4 in §3.5; unit-tests in
`test/unit/positional-pi-controller.test.js` en de service-tests van Tuya en Aurora III);
punt 4 volgt.

1. **Simulatie** (`coast-closed-loop.js`, `P4=1` voor de scenario's van §3.5):
   - regressie op §3.2 en §3.3 (grenzen bijvoorbeeld: RMSE ≤ 0,20 radiator, ≤ 0,25 vloer;
     0 uur onderkoeling bij kou; setpoint nooit tegen 20 en 60 °C tegelijk op één dag);
   - aanvullen met een lichte (C 7) en een zware woning (C 30), nachtverlaging, en een
     te steile en te vlakke stooklijn;
   - de prototypevariant vervangen door de echte TypeScript-implementatie zodra die er
     is (zoals bij ADR-062).
2. **Unit-tests** voor de nieuwe PI:
   - integraal en begrenzing (Imax, Umax);
   - elk van de drie anti-windupregels (D3);
   - geen dode zone behalve de integratiedrempel (D4);
   - coast-gewicht alleen bij negatieve correctie (D6);
   - advies = basis + u, afgerond en begrensd (D1);
   - presets van het afgiftesysteem: radiatoren en vloer gebruiken de presetwaarden en
     negeren de velden; handmatig gebruikt de velden; de standaard voor nieuwe apparaten
     volgt de modus of het afgiftetype per driver; een bestaand apparaat krijgt
     "Handmatig" (D8).
3. **Bestaande tests:** `adaptive-control-service.test.js`, `weighted-decision-maker.test.js`
   (drivers Tuya, Aurora II, Aurora III) aanpassen waar de accumulator verdwijnt.
4. **Hardware:**
   - een week op de testinstallatie met een flow die het advies uitvoert, naast de huidige
     week (§1.3);
   - meten: binnentemperatuur, setpoint, compressorstarts, verbruik;
   - eerst radiatoren of vloer, afhankelijk van de installatie; Tuya apart.

## 8. Niet doen

- Coast verwijderen: bij vloerverwarming verbetert het de regeling nog (§3.3).
- De huidige incrementele opzet behouden met alleen een kleinere Kp: die blijft een
  integrator zonder anti-windup.
- Een positionele PI zonder echte integraal (§3.2, conclusie 3).
- De PI laten afhangen van UA en τ van het gebouwmodel zolang de confidence niet wordt
  meegewogen (ADR-062 A4).
