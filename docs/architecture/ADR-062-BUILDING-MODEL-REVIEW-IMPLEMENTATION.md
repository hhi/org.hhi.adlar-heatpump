# ADR-062: Implementatie van de review-fixes voor de gebouwleermodule

**Status:** Voorgesteld
**Datum:** 2026-10-23
**Beslissers:** -
**Gerelateerd:** [BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md)
en het [addendum](BUILDING_MODEL_REVIEW_ADDENDUM.md);
ADR-056, ADR-057, ADR-060, ADR-061 (learner, gates, persistence; lokaal in `plans/decisions/`, niet in git);
[ADR-005](ADR-005-MODBUS-CONVERGENCE.md) (gedeelde rekenservices)
**Simulaties:** `test/simulation/building-model-review/` — `scenarios.js` (review §6) en
`adr062.js` (B1, B2, B4, B5, B3/B6 in dit ADR)

---

## Samenvatting voor de eigenaar

- **Wat:** de bevindingen uit de review uitvoeren, in drie releases.
- **Kern van de learner-wijziging (3.4.0):** dT/dt over een tijdvenster van 60 minuten,
  een P-matrix die positief-semidefiniet blijft, en fysische grenzen op τ en UA. De
  service laat het venster opnieuw beginnen bij elk geblokkeerd sample.
- **Waarom deze combinatie:** zonder venster maken de algoritmefixes de schatting
  slechter (review §6.3). Zonder herstart bij blokkades blijft de winst bij koud weer
  beperkt: in de gemiddelde woning bij 0 °C daalt de RMSE dan van 0,27 naar 0,15 °C,
  met herstart naar 0,05 °C (B2).
- **Bestaande modellen blijven behouden** als ze binnen de nieuwe grenzen vallen (B5).
- **Nieuw ten opzichte van de review:** de τ-bovengrens wordt 800 uur, niet 500. Het
  profiel `passive` heeft τ = 600 uur; met 500 uur zou een learner die daarop start nooit
  meer leren (B4).
- **Versies (voorstel):** A1 mee in 3.3.1; learner in 3.4.0; regelkoppeling (A3–A6) in
  3.5.0.
- **Te beslissen:** B1–B10.

---

## 1. Context

De review stelt vast dat de learner numerieke en semantische gebreken heeft (P niet
PSD, ratio-check begrenst UA in plaats van τ, VFF inert) en dat de regelkoppeling op
een paar plekken niet doet wat de naam suggereert (A1, A3–A6). §6 van de review laat
met simulaties zien dat de grootste foutbron de afgeleide over 5 minuten bij een
sensor met 0,1 °C is, en dat de algoritmefixes alleen werken samen met een venster.

De review laat de ontwerpkeuzes bewust open. Dit ADR maakt ze, onderbouwd met
aanvullende simulaties (`adr062.js`). Alle getallen zijn RMSE van een voorspelling
6 uur vooruit, gemiddeld over 5 seeds en 30 dagen leren, tenzij anders vermeld.
"Fixes" betekent PSD-projectie, nieuwe grenzen en uniforme rate-limiting samen.

| Scenario | C (kWh/°C) | UA (kW/°C) | τ (u) | Startprofiel |
|---|---:|---:|---:|---|
| S1b | 15 | 0,30 | 50 | light |
| S2 | 10 | 1,00 | 10 | light |
| S3 | 24 | 0,15 | 160 | heavy |
| S5 | 30 | 0,07 | 430 | passive |

## 2. Besluiten

### B1 — Venster op dT/dt

**Voorstel:** tijdgebaseerd venster van **60 minuten, overlappend**, in
`BuildingModelLearner.addMeasurement()`.

- dT/dt = (T_nu − T_begin) / venster; de invoer (vermogen, Tout − Tin, zon) is
  tijdgewogen over de deelintervallen, met de waarde aan het **begin** van elk
  deelinterval.
- Een update bij elke sample zodra het venster vol is.
- De buffer is niet persistent; na een herstart duurt het 60 minuten voor de eerste
  update.
- In de learner, zodat alle drie de drivers het in één wijziging krijgen.

| Variant | S1b | S2 | S3 | Updates S1b |
|---|---:|---:|---:|---:|
| huidig | 0,70 | 1,11 | 0,12 | 3.765 |
| fixes + 30 min overlappend | 0,04 | 0,04 | 0,04 | 6.558 |
| **fixes + 60 min overlappend** | **0,01** | **0,03** | **0,02** | 8.173 |
| fixes + 60 min in blokken | 0,24 | 0,43 | 0,03 | 692 |
| fixes + 90 min overlappend | 0,01 | 0,04 | 0,01 | 8.300 |

- **Niet in blokken:** tien keer minder updates, duidelijk slechter in S1b en S2.
- **Niet 90 minuten:** bij koud weer met blokkades slechter in S2 (1,18 tegen 0,51,
  zie B2) en langere opbouwtijd.
- **Gevolg:** de convergentietest en de gap-guard-test in
  `building-model-learner.test.js` moeten worden aangepast. Overlappende vensters
  geven gecorreleerde residuen; P krimpt daardoor sneller dan de informatie
  rechtvaardigt (zie B6).

### B2 — Het venster bij blokkades

**Voorstel:** elk geblokkeerd sample start het venster opnieuw.

- De service roept bij elke vroege return na een sample-poort (modus, defrost,
  tapwater, vermogen, COP) een nieuwe learner-methode aan, bijvoorbeeld
  `interruptWindow()`. De learner start het venster dan opnieuw bij de volgende sample.
- Als vangnet herstart de learner zelf bij een gat groter dan 7,5 minuten (één
  ontbrekende sample); de huidige gap-guard van 15 minuten blijft voor de oude paden.
- **Dit speelt nu al:** de huidige learner berekent dT/dt over een interval waarin een
  geblokkeerde sample (bijvoorbeeld ontdooien) valt, zolang het gat ≤ 15 minuten is.

Koud weer (gemiddeld 0 °C), ontdooien 8 minuten per 50 minuten compressorlooptijd,
dagelijks 40 minuten tapwater:

| Variant | S1b | S2 | S3 | Updates S1b |
|---|---:|---:|---:|---:|
| *Poorten zoals Aurora III (defrost en tapwater geblokkeerd)* | | | | |
| huidig | 0,27 | 0,96 | 0,09 | 5.008 |
| fixes + 60 min, herstart pas bij gat > 15 min | 0,15 | 0,49 | 0,04 | 6.693 |
| **fixes + 60 min, herstart bij elk ontbrekend sample** | **0,05** | **0,51** | **0,03** | 1.648 |
| *Poorten zoals Aurora II (tapwater niet herkend)* | | | | |
| huidig | 0,22 | 0,95 | 0,11 | 5.080 |
| fixes + 60 min, herstart pas bij gat > 15 min | 0,17 | 0,70 | 0,06 | 6.815 |
| **fixes + 60 min, herstart bij elk ontbrekend sample** | **0,06** | **0,57** | **0,04** | 1.807 |

- **Prijs:** drie tot vier keer minder updates bij koud weer. Leren gaat langzamer,
  maar met schonere data.
- **Bekende grens 1:** in S2 bij 0 °C draait de warmtepomp continu (vermogen aan het
  plafond). Het vermogen bevat dan geen informatie, en geen enkele variant leert goed
  (0,51–0,96). Dit ADR lost dat niet op; het is een excitatieprobleem.
- **Bekende grens 2:** bij Aurora II en Tuya wordt tapwater in combimodus niet
  herkend; het vermogen naar de boiler telt mee. Het verschil met Aurora III is klein
  (S1b 0,06 tegen 0,05), maar niet nul. Geen fix in dit ADR.

### B3 — PSD-methode

**Voorstel:** na de covariantie-update symmetriseren, eigen-decompositie (Jacobi 4×4,
vast maximum aantal sweeps) en de eigenwaarden begrenzen op [`P_FLOOR`, `P_CEILING`].
Dit vervangt de diagonaal-clamp en de off-diagonaal-clip.

- **Bewijs:** in alle scenario's 0 updates met een niet-PSD P en 0 keer `XᵀPX < 0`.
- **Kosten:** ongeveer 4 µs per projectie op een Mac; één projectie per sample (5 min).
  Op een Homey Pro niet gemeten (V1).
- **Verworpen:** UD- of Cholesky-factorisatie. Meer code voor hetzelfde resultaat bij
  een 4×4-matrix.

### B4 — Grenzen

**Voorstel:**

| Grootheid | Grens | Nu |
|---|---|---|
| C = 1/θ[0] | 5–40 kWh/°C | ongewijzigd |
| τ = 1/θ[1] | **1,25–800 u** | effectief 5–800 u via `theta1_min`/`theta1_max`; commentaar zegt 1,25–500 |
| UA = θ[1]/θ[0] | **0,03–1,5 kW/°C** | effectief 0,002–0,8 via de ratio-check |
| g/C, P_int/C | ongewijzigd | — |

- De componentgrenzen `theta1_min`/`theta1_max` vervallen; de τ-grens dekt ze.
- Dezelfde controle bij runtime en restore. De logregel "τ estimate" rekent `1/θ[1]`.
- **Waarom 800 en niet 500:** het profiel `passive` heeft τ = 600 u. Met 500 u als grens
  ligt de startwaarde van zo'n learner buiten de grenzen en wordt elke stap
  teruggedraaid: in S5 0 updates in 30 dagen. Met 800 u: 7.821 updates, RMSE 0,03 °C.
  De huidige code staat effectief ook 800 u toe.
- **Alternatief:** 500 u aanhouden en het profiel `passive` aanpassen (UA 0,06 in plaats
  van 0,05). Dat verandert de startwaarde voor bestaande gebruikers met dat profiel.

### B5 — Migratie van opgeslagen states

**Voorstel:**

1. Restore valideert met de nieuwe grenzen (B4).
2. Geldig: θ en sampleCount blijven behouden; P wordt eenmalig geprojecteerd (B3).
3. Ongeldig: afwijzen zoals nu (profielwaarden, sampleCount 0), met een logregel die de
   overschreden grens noemt. Geen automatische clamp naar de grens.
4. De vensterbuffer begint leeg (B1).

States die met de huidige code 30 dagen zijn geleerd, daarna 10 dagen verder leren met
de nieuwe code:

| Woning | Geldig met nieuwe grenzen | Zonder restore | Met restore |
|---|---|---:|---:|
| S1b | 4/5 | 0,141 | 0,153 |
| S2 | 5/5 | 0,157 | 0,062 |
| S3 | 5/5 | 0,022 | 0,018 |
| S5 | 5/5 | 0,034 | 0,018 |

- De afgewezen state in S1b had UA = 0,018 en τ = 800 u bij een werkelijke UA van 0,30:
  een fysisch onjuiste state die de huidige code zelf had opgebouwd.
- De P-projectie maakt in deze proef geen meetbaar verschil (0,018 met en zonder), maar
  garandeert het PSD-invariant vanaf de eerste update.

### B6 — Confidence

**Voorstel:** de formule in dit ADR **niet** wijzigen.

- Met de fixes ligt de trace van P hoger (0,3–0,5 tegen 0,15–0,28). Het
  covariantiedeel van de confidence daalt daardoor van ongeveer 0,97 naar 0,95; de
  totale confidence blijft 100% door het sampledeel.
- Confidence bleef in alle scenario's 96–100%, ook bij een fout van 50% in UA (review
  §6.2). Ze is dus geen maat voor nauwkeurigheid, maar vooral een teller.
- **Wel:** een diagnostisch veld met de lopende voorspelfout (RMSE van het residu over
  de laatste 24 uur) in `getDiagnosticStatus()`. Geen capability, geen gating. Basis
  voor een latere herijking.

### B7 — Thermische correctie (A3)

**Voorstel:** een fysische voorspelling in plaats van de heuristiek.

- `T_eq = T_out + (P + G)/UA` en `t = τ × ln((T_eq − T_in)/(T_eq − T_doel))`.
- P = het **waargenomen** thermisch vermogen bij draaiende compressor: het 90e
  percentiel over de laatste 7 dagen, uit de samples die de service al verzamelt. Er
  bestaat geen instelling voor het nominale vermogen, en die komt er niet.
- `T_eq ≤ T_doel`: doel niet bereikbaar; geen boost, reden "doel niet bereikbaar".
- Boost +0,5 °C alleen bij t > 2 uur, zoals nu.
- Zonder waargenomen vermogen (eerste dagen, of geen sample met draaiende compressor):
  thermische component 0.
- **Onderbouwing:** review §6.5. De formule reproduceert de simulatie; de huidige
  methode geeft 37,8 uur ongeacht buitentemperatuur (werkelijk: 2,5 uur tot nooit).

### B8 — Regelkoppeling (A4, A5, A6, A7, §2.5, §2.8)

| Punt | Voorstel |
|---|---|
| **A4** modelparameters naar PI en prijs | Alleen bij confidence ≥ 50%, zoals de thermische component. Daaronder expliciet de profielwaarden terugzetten. Uitgeschakeld leren betekent niet "model uit": een geleerd model boven 50% blijft in gebruik. De setters gaan vóór de berekening van PI en prijs |
| **A5** leerinstellingen | Actuele instellingen zijn leidend. `restoreState()` neemt `enableDynamicPInt` niet meer uit de state. Wijziging van `building_model_forgetting_factor` zet λ direct (nieuwe setter, waarde uit `newSettings`). Wijziging van `enable_dynamic_pint` geeft een soft reset, omdat de betekenis van θ[3] verandert |
| **A6** mijlpaaltrigger | Drempelpassage (vorige confidence < 70 ≤ huidige), met een vlag in de device store. De vlag vervalt bij een reset en bij een profielwissel |
| **A7** timers | Overal `this.device.homey.clearInterval()` |
| **§2.5** restore-logging | Gelijktrekken naar de Tuya-vorm, met een expliciet restore-resultaat uit de learner in plaats van een vergelijking van sample-aantallen |
| **§2.8** VFF | Verwijderen; λ = de geconfigureerde waarde. Gedrag ongewijzigd, want VFF was bij de standaardinstelling al inert (review §6.4) |
| **A1** doeltemperatuur Tuya | `target_temperature.indoor` op beide plekken. De τ-limieten van de twee voorverwarmingsmethoden gelijktrekken op één constante (voorstel: 0,5–250 u; passieve woningen krijgen dan, zoals nu, geen voorverwarmingsadvies) |

### B9 — Volgorde ten opzichte van ADR-005

**Voorstel:**

- **Learner (B1–B6, §2.8)** zit in `lib/shared/` en staat los van ADR-005: eerst.
- **A1** is Tuya-only en klein: direct (3.3.1).
- **De service-hook van B2** moet in alle drie de `building-model-service.ts`-kopieën;
  klein genoeg om drie keer te doen, en nodig voor 3.4.0.
- **B7 en B8** raken de gekopieerde services in drie varianten. Na ADR-005 fase 3
  (gedeelde rekenservices) zijn dat er twee: Tuya en Modbus. Voorstel: B7/B8 na
  ADR-005 fase 3. Wordt ADR-005 niet aangenomen, dan drie keer.
- De consolidatie inclusief Tuya uit review §2.5 valt buiten dit ADR.

### B10 — Versies en releases

| Versie | Inhoud | Gedrag voor gebruikers |
|---|---|---|
| **3.3.1** (nog niet uitgebracht) | Port 2.15.2/2.15.3 (al op `main`), plus A1, de changelog-regel voor de drempeltriggers (ADR-005 C7) en het testcommentaar | Tuya: de voorverwarmingsaanbeveling leest de juiste doeltemperatuur |
| **3.4.0** | B1–B6, §2.8, B2-hook in drie drivers, A7, §2.5 | Het gebouwmodel leert anders; parameters verschuiven |
| ADR-005 | Eigen gedragsneutrale versie tussen 3.4.0 en 3.5.0 | Geen |
| **3.5.0** | B7, B8 (A4, A5, A6) | Thermisch advies volgt buitentemperatuur en vermogen; mijlpaaltrigger vuurt één keer |

Elke release eerst via het testkanaal, met hardware-acceptatie op de eigen units.

## 3. Fasering

| Fase | Inhoud | Bewijs |
|---|---|---|
| **0** (3.3.1) | A1, changelog-regel, testcommentaar | Unit-test A1; bestaande tests groen |
| **1a** | Vangnet: karakteriseringstests van de huidige learner (venster-, gap- en restoregedrag) | Groen op de huidige code |
| **1b** | B1 venster + B2 `interruptWindow()` + service-hook in drie drivers | Simulatie (§4); unit-tests venster en hook |
| **1c** | B3 PSD-projectie | PSD-eigenschapstest; simulatie |
| **1d** | B4 grenzen + B5 restore-migratie + τ-logregel | Restore-tests (geldig, ongeldig, passief profiel) |
| **1e** | §2.8 VFF weg, A7, §2.5, B6 diagnostisch veld | Bestaande tests; λ-test |
| **1f** | Release 3.4.0: lint, `homey app validate`, testkanaal, hardware | Handmatig |
| **2** | ADR-005 fase 1–3 (eigen ADR) | Zie ADR-005 |
| **3** (3.5.0) | B7, B8 | Unit-tests per punt; thermische simulatie |

## 4. Testaanpak

### 4a. De simulatie als regressietest

De varianten in `learners.js` zijn de referentie voor de TypeScript-implementatie.
Na fase 1b–1d draait de **huidige** code (de rij "huidig" in de scripts) met de nieuwe
learner. Die rij moet dan binnen de onderstaande grenzen vallen en vergelijkbaar zijn
met de prototype-rij "fixes + 60 min".

| Scenario | Script | Grens na fase 1 |
|---|---|---|
| S1, S1b, S3 realistisch | `scenarios.js`, `adr062.js b1` | RMSE ≤ 0,03 °C |
| S2 realistisch | idem | RMSE ≤ 0,05 °C |
| S1b koud, poorten Aurora III | `adr062.js b2` | RMSE ≤ 0,08 °C |
| S5 passief | `adr062.js b4` | > 0 updates; RMSE ≤ 0,05 °C |
| Alle scenario's | alle | 0 niet-PSD-updates; 0 keer `XᵀPX < 0` |
| Restore oude states | `adr062.js b5` | Geldige states behouden; RMSE na 10 dagen niet slechter dan zonder restore + 0,02 |

Een nieuw npm-script `simulate:building-model` draait deze scripts na `npm run build`.
Ze gaan niet in `npm test`, omdat ze samen ruim 10 seconden duren; ze staan wel in de
checklist van fase 1f. De resultaten zijn reproduceerbaar (vaste seeds).

### 4b. Unit-tests (nieuw)

- **Learner:** opbouw van het venster (geen update vóór 60 min), tijdweging,
  `interruptWindow()`, herstart bij een gat > 7,5 min, PSD-invariant over een reeks
  willekeurige X (kleinste eigenwaarde ≥ 0), grenzen voor τ en UA inclusief start op
  `passive`, restore geldig/ongeldig met projectie, λ constant zonder VFF.
- **Service, per driver:** een geblokkeerde sample roept `interruptWindow()` aan.
- **Fase 3:** A1 leest `target_temperature.indoor`; B7 bij een onbereikbaar doel geen
  boost; A6 vuurt één keer bij drempelpassage, ook na herstart.

### 4c. Aan te passen

- `building-model-learner.test.js`: de convergentietest en de gap-guard-test (andere
  semantiek van `addMeasurement()`), en het commentaar over 1.500 samples.

## 5. Acceptatiecriteria

1. De grenzen uit §4a worden gehaald met de TypeScript-implementatie.
2. Geen enkele update met een niet-PSD P of negatieve `XᵀPX` in de simulaties.
3. Een learner op profiel `passive` leert.
4. Bestaande states binnen de nieuwe grenzen blijven behouden na de update.
5. `npm test`, lint op de gewijzigde bestanden en `homey app validate` groen.
6. Hardware-acceptatie op de eigen units, via het testkanaal.

## 6. Consequenties

### Voor gebruikers

- Na de update en na elke herstart duurt het 60 minuten voor het model weer leert.
- Bij koud weer leert het model minder vaak, maar met schonere data.
- Geleerde parameters verschuiven na 3.4.0; bij gebruikers met UA boven 0,8 sterk
  (het oude plafond verdwijnt).
- Een fysisch onmogelijke opgeslagen state (bijvoorbeeld UA < 0,03) wordt afgewezen;
  het model begint dan opnieuw vanaf het profiel.
- Confidence blijft zich gedragen zoals nu.

### Voor onderhoud

- De learner-wijziging is één bestand voor alle drie de drivers.
- De simulatiescripts worden een vast onderdeel van wijzigingen aan de learner.

## 7. Niet doen

- Het venster in blokken: tien keer minder updates, slechter resultaat (B1).
- De algoritmefixes zonder venster (review §6.3).
- VFF herontwerpen (review §6.4).
- Een state automatisch naar de grens clampen bij restore (B5).
- Een nieuwe capability voor de voorspelfout (B6).
- De consolidatie inclusief Tuya (review §2.5).

## 8. Te verifiëren

1. **V1** — Rekentijd van de PSD-projectie op een Homey Pro.
2. **V2** — Werkelijke frequentie en duur van ontdooicycli en tapwaterruns in de logs;
   de simulatie gebruikt 8 min per 50 min looptijd en 40 min per dag.
3. **V3** — Sensorresolutie per driver en per externe binnentemperatuurbron (0,1 °C
   aangenomen).
4. **V4** — Verdeling van τ en UA in bestaande states (diagnostiek), om te schatten
   hoeveel states bij B5 worden afgewezen.
5. **V5** — Afgiftevertraging bij vloerverwarming (review §2.3); niet gesimuleerd.

## 9. Actiepunten

| # | Actie | Fase |
|---|---|---|
| 1 | A1, changelog-regel drempeltriggers, testcommentaar | 0 |
| 2 | Karakteriseringstests learner | 1a |
| 3 | Venster, `interruptWindow()`, service-hook (3×) | 1b |
| 4 | PSD-projectie | 1c |
| 5 | Grenzen, restore-migratie, τ-logregel | 1d |
| 6 | VFF weg, timers, restore-logging, diagnostisch veld | 1e |
| 7 | npm-script `simulate:building-model` | 1a |
| 8 | Release 3.4.0 via testkanaal | 1f |
| 9 | B7, B8 na ADR-005 fase 3 | 3 |
