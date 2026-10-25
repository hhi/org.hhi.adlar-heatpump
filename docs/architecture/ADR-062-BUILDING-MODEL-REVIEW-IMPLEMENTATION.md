# ADR-062: Implementatie van de review-fixes voor de gebouwleermodule

**Status:** Gedeeltelijk aangenomen (2026-10-23, aangevuld 2026-10-24 en 2026-10-25): B1–B6, B10, B11 en B12 aangenomen, uit B8 ook A7, §2.5 en §2.8 (fase 1e); B7–B9 en B13 verder voorgesteld
**Datum:** 2026-10-23
**Beslissers:** -
**Gerelateerd:** [BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md)
en het [addendum](BUILDING_MODEL_REVIEW_ADDENDUM.md);
ADR-056, ADR-057, ADR-060, ADR-061 (learner, gates, persistence; lokaal in `plans/decisions/`, niet in git);
[ADR-005](ADR-005-MODBUS-CONVERGENCE.md) (gedeelde rekenservices)
**Simulaties:** `test/simulation/building-model-review/` — `scenarios.js` (review §6) en
`adr062.js` (B1, B2, B4, B5, B3/B6 in dit ADR) en `adr062-b13.js` (B13)

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
- **Uitgangspunt: precisie bij koud weer gaat voor.** Daarom vervalt de uniforme
  rate-limiting uit review §2.1; de huidige rate-limiting per component blijft, voor
  alle drivers (B11).
- **Aangenomen:** B1–B6, B10, B11 en B12, en uit B8 de punten A7, §2.5 en §2.8
  (fase 1e en 1g, 3.4.0). **Nog te beslissen:** B7, de rest van B8 (A4–A6) en B9
  (fase 3), en B13: P bijwerken met de werkelijk genomen stap (fase 1h).

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
"Fixes" betekent PSD-projectie en nieuwe grenzen; de rate-limiting per component blijft
zoals hij is (B11). De tabellen in B1, B2, B4 en B5 zijn gemeten toen de fixes nog de
uniforme rate-limiting uit review §2.1 bevatten; B11 geeft de waarden zonder.

**Uitgangspunt.** Waar een keuze bij mild en bij koud weer verschillend uitpakt, weegt
de nauwkeurigheid bij koud weer het zwaarst. Dan draait de warmtepomp het meest, en zijn
de bruikbare leermomenten het schaarst.

| Scenario | C (kWh/°C) | UA (kW/°C) | τ (u) | Startprofiel |
|---|---:|---:|---:|---|
| S1b | 15 | 0,30 | 50 | light |
| S2 | 10 | 1,00 | 10 | light |
| S3 | 24 | 0,15 | 160 | heavy |
| S5 | 30 | 0,07 | 430 | passive |

## 2. Besluiten

### B1 — Venster op dT/dt (aangenomen)

De cijfers in B1 en B2 zijn berekend vóór B12; met B12 wijken ze in de tweede
decimaal af.

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

### B2 — Het venster bij blokkades (aangenomen)

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

### B3 — PSD-methode (aangenomen)

**Voorstel:** na de covariantie-update symmetriseren, eigen-decompositie (Jacobi 4×4,
vast maximum aantal sweeps) en de eigenwaarden begrenzen op [`P_FLOOR`, `P_CEILING`].
Dit vervangt de diagonaal-clamp en de off-diagonaal-clip.

- **Bewijs:** in alle scenario's 0 updates met een niet-PSD P en 0 keer `XᵀPX < 0`.
- **Kosten:** ongeveer 4 µs per projectie op een Mac; één projectie per sample (5 min).
  Op een Homey Pro niet gemeten (V1).
- **Verworpen:** UD- of Cholesky-factorisatie. Meer code voor hetzelfde resultaat bij
  een 4×4-matrix.

### B4 — Grenzen (aangenomen)

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

### B5 — Migratie van opgeslagen states (aangenomen)

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

### B6 — Confidence (aangenomen)

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

A7, §2.5 en §2.8 zijn aangenomen en uitgevoerd in fase 1e (3.4.0); A4–A6
blijven voorgesteld voor fase 3.

| Punt | Voorstel |
|---|---|
| **A4** modelparameters naar PI en prijs | Alleen bij confidence ≥ 50%, zoals de thermische component. Daaronder expliciet de profielwaarden terugzetten. Uitgeschakeld leren betekent niet "model uit": een geleerd model boven 50% blijft in gebruik. De setters gaan vóór de berekening van PI en prijs |
| **A5** leerinstellingen | Actuele instellingen zijn leidend. `restoreState()` neemt `enableDynamicPInt` niet meer uit de state. Wijziging van `building_model_forgetting_factor` zet λ direct (nieuwe setter, waarde uit `newSettings`). Wijziging van `enable_dynamic_pint` geeft een soft reset, omdat de betekenis van θ[3] verandert |
| **A6** mijlpaaltrigger | Drempelpassage (vorige confidence < 70 ≤ huidige), met een vlag in de device store. De vlag vervalt bij een reset en bij een profielwissel |
| **A7** timers | Overal `this.device.homey.clearInterval()` |
| **§2.5** restore-logging | Gelijktrekken naar de Tuya-vorm, met een expliciet restore-resultaat uit de learner in plaats van een vergelijking van sample-aantallen |
| **§2.8** VFF | Verwijderen; λ = de geconfigureerde waarde, begrensd op 0,9985–0,9995 (ook het bereik van de instelling). VFF was alleen inert bij een instelling vanaf 0,9988, dus ook bij de standaard 0,999 (review §6.4). Daaronder hield VFF λ op 0,995–0,9988; zonder VFF leert het model bij 0,990 veel slechter (S1b 0,24 tegen 0,03 °C). Een constante λ van 0,9985 geeft hetzelfde resultaat als VFF bij een lage instelling. |
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

### B10 — Versies en releases (aangenomen)

| Versie | Inhoud | Gedrag voor gebruikers |
|---|---|---|
| **3.3.1** (nog niet uitgebracht) | Port 2.15.2/2.15.3 (al op `main`), plus A1, de changelog-regel voor de drempeltriggers (ADR-005 C7) en het testcommentaar | Tuya: de voorverwarmingsaanbeveling leest de juiste doeltemperatuur |
| **3.4.0** | B1–B6, §2.8, B2-hook in drie drivers, A7, §2.5 | Het gebouwmodel leert anders; parameters verschuiven |
| ADR-005 | Eigen gedragsneutrale versie tussen 3.4.0 en 3.5.0 | Geen |
| **3.5.0** | B7, B8 (A4, A5, A6) | Thermisch advies volgt buitentemperatuur en vermogen; mijlpaaltrigger vuurt één keer |

In fase 0 alleen de capability-naam (A1); het gelijktrekken van de τ-limieten van de
voorverwarming valt onder B8 (fase 3).

Elke release eerst via het testkanaal, met hardware-acceptatie op de eigen units.

### B11 — Rate-limiting (aangenomen)

**Besluit:** de rate-limiting per component blijft, voor alle drivers. De uniforme
schaling uit review §2.1 vervalt. De moduspoort blijft zoals hij is: in een combimodus
(verwarmen of vloerverwarming + tapwater) wordt gemeten; bij alleen tapwater en bij
koelen niet.

**Wat de twee varianten doen.** Per component: elke parameter mag per stap hooguit 5%
veranderen, los van de andere. Uniform: de hele stap wordt met één factor verkleind,
totdat de parameter die het hardst wil bewegen precies 5% haalt.

**Onderbouwing.** Venster van 60 minuten, herstart bij elk ontbrekend sample, PSD en
grenzen; RMSE 6 u (S1 | S1b | S2 | S3):

| Scenario | Per component | Uniform |
|---|---|---|
| Mild, geen tapwater | 0,02 / 0,02 / 0,03 / 0,03 | 0,01 / 0,01 / 0,03 / 0,02 |
| Koud, poorten Aurora III | **0,02 / 0,01 / 0,30 / 0,03** | 0,04 / 0,05 / 0,51 / 0,03 |
| Koud, tapwater in combimodus telt mee | 0,10 / 0,10 / 1,15 / 0,08 | 0,05 / 0,06 / 0,57 / 0,04 |

- Bij ongeveer de helft van de stappen remt de rate-limiter. In 76–88% daarvan bepaalt
  P_int/C de rem (S1b). Bij uniforme schaling remt die onrustige parameter dan ook UA
  en C af. Bij koud weer, met 4,6 keer minder updates door ontdooien en tapwater, kost
  dat het meest.
- Uniform wint alleen bij mild weer (klein) en in het scenario waarin de warmtepomp in
  een combimodus dagelijks 40 minuten een boiler verwarmt en die metingen meetellen. Hoe
  vaak dat in de praktijk speelt, is onbekend (V2). Waar de CV-ketel het tapwater maakt,
  speelt het niet. Speelt het wel, dan hoort de oplossing bij de bron: een tapwaterpoort
  (ADR-063, O2), niet een algemene rem.
- **Prijs:** bij Aurora II of Tuya met een warmtepomp die in een combimodus tapwater
  maakt, is de schatting bij kou volgens de simulatie minder precies (S1b 0,10 tegen
  0,06 °C).
- **Gevolg:** geen codewijziging; de huidige code werkt al per component. De
  doelwaarden uit §4a worden gehaald (zie daar). Dit wijkt af van review §3, rij 4.

### B12 — Uitweg bij vastlopen tegen de grenzen (aangenomen)

**Besluit:** een stap buiten de grenzen wordt teruggedraaid zoals nu. Na 12 reverts
op rij (±1 uur) wordt de volgende stap buiten de grenzen niet teruggedraaid, maar
ingekort tot de grens: θ = θ_vorig + α·Δθ, met α de grootste fractie waarvoor alle
grenzen gelden. Daarna volgen de rate-limiting per component en de P-update zoals
bij een gewone stap.

**Probleem.** Een revert gooit de hele stap weg, en P blijft dan ongewijzigd. Ligt
het startpunt ver van de werkelijke woning, dan schiet elke stap opnieuw over een
grens en komt het model niet los:

- ideale data, C 10 / UA 1,0, start `light`: C 6,1 en UA 0,39 na 8.000 samples
  (5.974 reverts);
- lekke woning (UA 1,0) vanaf `passive`: in 3 van 5 runs na 30 dagen UA 0,12–0,27,
  met C tegen de ondergrens.

**Waarom inkorten tot de grens werkt.** Het geldige gebied is convex: C, τ, g/C en
P_int/C zijn vakken, UA is de kegel 0,03·θ0 ≤ θ1 ≤ 1,5·θ0. Langs de stap is de
geldige fractie dus één interval [0, α*], dat met bisectie te vinden is.

**Onderbouwing.** Prototype op de gecompileerde learner (controlevariant exact gelijk
aan de echte learner), 5 seeds, RMSE 6 u op dag 30:

| Situatie | Revert | Altijd inkorten | Inkorten na 12 |
|---|---|---|---|
| Lek vanaf passive, warm | 4,42 (3/5 vast) | 0,033 | 0,032 |
| Lek vanaf passive, koud A3 | 5,50 (4/5 vast) | 0,54 | 0,51 |
| S1 / S1b / S2 koud A3 | 0,017 / 0,013 / 0,290 | 0,017 / 0,014 / 0,354 | 0,015 / 0,013 / 0,287 |
| S1 koud A2 | 0,102 | 0,106 | 0,086 |
| S3 warm | 0,033 | 0,024 | 0,037 |

- **Niet altijd inkorten:** bij kou slechter (S2 A3 +22%). Een revert gooit ook ruis
  weg; bij weinig en onrustige data is die bescherming nuttig.
- **Niet eerst rate-limiting en daarna de grenscontrole:** warm beter, maar koud
  S2 A3 0,47 en S1 A2 0,20.
- **Niet inkorten zonder P-update:** lost de vastloper niet op (5/5 vast).
- **Drempel 12 en niet 24 of 36:** bij een vastloper in de kou 0,51 tegen 1,89. De
  prijs is S3 warm 0,033 → 0,037; de grens in §4a wordt daarvoor ≤ 0,04 (precisie
  bij kou gaat voor, B11).

**Gevolg:** `BuildingModelLearner.BOUNDED_STEP` (12 reverts, 40 bisectiestappen) en
de teller `boundedSteps` (in de state, in `getExcitationDiagnostics()` en in het
diagnostiek-JSON). Een ingekorte stap telt niet als revert en zet de reeks op 0.

### B13 — P-update met de werkelijk genomen stap (voorgesteld)

**Voorstel:** de covariantie P wordt bijgewerkt met de stap die θ werkelijk heeft
genomen, per component. Na de grenscontrole, B12 en de rate-limiting per component
(B11) geldt voor elke component i:

```text
s_i   = (θ_nieuw,i − θ_vorig,i) / Δθ_i        met Δθ = K·e, begrensd op [0, 1]; s_i = 1 als Δθ_i = 0
K_eff = s ⊙ K
P⁺    = [(I − K_eff·Xᵀ) · P · (I − K_eff·Xᵀ)ᵀ + λ · K_eff·K_effᵀ] / λ      (Joseph-vorm)
```

daarna de PSD-projectie zoals nu (B3). De volgorde van de stappen en de stap van θ
zelf veranderen niet. Bij een stap die niet is afgeremd is K_eff = K, en dan is de
Joseph-vorm algebraïsch gelijk aan de huidige update `(P − K·Xᵀ·P) / λ`.

**Probleem.** De rate-limiter remt ongeveer de helft van de stappen af (B11), meestal
in de richting van P_int/C. θ beweegt dan hooguit 5% per component, maar P wordt
bijgewerkt alsof de volle stap is genomen. Het model wordt daardoor zekerder dan de
genomen stap rechtvaardigt, precies in de richting die werd afgeremd. Op de
testinstallatie gebeurde dat 679 keer (ADR-064 §3.5).

**Waarom de Joseph-vorm.** De standaardupdate is alleen juist voor de optimale gain.
Met een andere gain kan hij P asymmetrisch of indefiniet maken. De Joseph-vorm blijft
voor elke gain symmetrisch en PSD, en is gelijk aan de standaardupdate bij de optimale
gain.

**Waarom per component en niet met één factor.** Eén factor s voor de hele gain (de
projectie van de werkelijke stap op de volle stap) laat P in alle richtingen minder
krimpen, ook in die van C. Het model wordt dan te onzeker en loopt vaker vast. Dit
sluit aan bij B11: ook daar verloor de uniforme aanpak van de aanpak per component.

**Onderbouwing.** Prototype op de gecompileerde learner (3.4.2), alleen `updateRLS()`
vervangen. De controlevariant is in alle 15 combinaties van woning × weer exact gelijk
aan de echte learner (RMSE, reverts, bounded steps, spoor van P). 5 seeds, venster van
60 minuten, RMSE 6 u op dag 30 (tussen haakjes |UA-fout|):

| Scenario | Weer | Huidig | Per component (B13) | Eén factor |
|---|---|---|---|---|
| S1 | warm | 0,024 (3%) | **0,019** (2%) | 0,032 (2%) |
| S1b | warm | 0,024 (3%) | **0,019** (2%) | 0,032 (2%) |
| S2 | warm | 0,032 (1%) | 0,032 (1%) | 0,032 (1%) |
| S3 | warm | 0,037 (6%) | **0,025** (4%) | 0,040 (12%) |
| S5 | warm | 0,029 (22%) | **0,023** (22%) | 0,023 (20%) |
| S1 | koud A3 | 0,015 (3%) | **0,010** (3%) | 0,025 (3%) |
| S1b | koud A3 | 0,013 (3%) | **0,010** (2%) | 0,025 (3%) |
| S2 | koud A3 | 0,287 (7%) | **0,016** (1%) | 0,021 (1%) |
| S3 | koud A3 | 0,032 (14%) | **0,022** (14%) | 0,036 (13%) |
| S5 | koud A3 | 0,038 (21%) | ⚠ 0,045 (14%) | 0,042 (21%) |
| S1 | koud A2 | 0,086 (10%) | **0,033** (5%) | 0,129 (16%) |
| S1b | koud A2 | 0,104 (10%) | **0,034** (4%) | 0,074 (8%) |
| S2 | koud A2 | 0,837 (25%) | 0,792 (24%) | 0,754 (19%) |
| S3 | koud A2 | 0,079 (25%) | **0,048** (18%) | 0,088 (38%) |
| S5 | koud A2 | 0,043 (28%) | 0,043 (33%) | 0,046 (34%) |

- Minder reverts (S2 koud A3: 324 → 0; S1 koud A3: 135 → 57), en een spoor van P dat
  ongeveer 25% groter blijft.
- Bij een afgeremde stap is s gemiddeld 0,8–0,9: P krimpt daar 10–20% minder dan nu.

**Profiel × woning** (5 woningen × 4 startprofielen, RMSE dag 1 / dag 30):

- **Sneller op weg bij een verkeerd startprofiel.** Dag 1: licht vanaf `passive`
  0,602 → 0,075; gemiddeld vanaf `passive` 0,163 → 0,028; lek vanaf `passive` (warm)
  4,09 → 0,17.
- **Geen vastlopers meer bij het lekke huis in de kou.** Koud A3 vanaf `light`,
  `average` en `passive`: 0,287 / 0,289 / 0,512 (elk 1 van 5 vast) →
  0,016 / 0,015 / 0,017 (geen vast).
- **Zwaar huis beter:** dag 30 warm 0,031–0,037 → 0,013–0,025.

**Nadelen.**

- **Passieve woning in de kou.** Dag 30 bij koud A3: 0,038–0,043 → 0,037–0,048, in drie
  van de vier startprofielen iets slechter. S5 koud A3 0,038 → 0,045, binnen de grens
  van §4a (≤ 0,05), terwijl de UA-fout daalt (21% → 14%).
- **Passieve woning vanaf `light`, warm:** 3 van 5 runs met een UA-fout boven 25% op
  dag 30, tegen 2 van 5 nu. Bij de passieve woning blijft de UA-fout in alle varianten
  hoog (14–34%), omdat UA daar zo klein is (0,07 kW/°C).
- **S2 koud A2** (lek huis, tapwater in een combimodus telt mee) blijft slecht
  (0,84 → 0,79). Daar zit het probleem in de invoer (ADR-064 D8), niet in P.
- **Het trage herstel vanuit een vervuilde stand** (ADR-064 §3.5) verandert niet:
  vanuit de stand van de testinstallatie zijn UA en P_int na 14 dagen gelijk aan nu
  (0,313 / 0,45 bij P_diag 0,01). De stappen zijn daar klein en worden zelden
  afgeremd. B13 kan wel voorkomen dat P door afgeremde stappen té klein wordt; dat
  laat deze proef niet zien, omdat de start-P is opgelegd.

**Grenzen §4a met B13:** mild S1 0,019, S1b 0,019, S2 0,032, S3 0,025; koud (poorten
Aurora III) S1b 0,010; passief S5 0,023 (warm) en 0,045 (koud A3); lek huis vanaf
`passive` 0,031 (warm) en 0,017 (koud A3). Alle grenzen worden gehaald.

**Gevolg (bij aanname):**

- Alleen `updateRLS()` in `building-model-learner.ts`: K_eff na de rate-limiting, en de
  P-update in Joseph-vorm. Geen nieuwe instellingen, geen migratie van states.
- Rekenwerk: twee extra 4×4-matrixvermenigvuldigingen per update; verwaarloosbaar
  naast de PSD-projectie (V1).
- Geleerde waarden verschuiven na de update; bestaande states blijven geldig.
- Nieuwe teller in de diagnostiek: het gemiddelde van s over afgeremde stappen, zodat
  op hardware zichtbaar is hoeveel P minder krimpt.

**Testaanpak.**

1. **Unit-tests learner:**
   - zonder afremming is P na B13 gelijk aan de huidige update (verschil ≤ 1e-12);
   - met afremming van één component krimpt P alleen in die richting minder (vóór de
     PSD-projectie): de diagonaal van die component is groter dan nu, de elementen
     zonder die component zijn gelijk binnen 1e-9;
   - PSD-invariant over een reeks willekeurige X met afgeremde stappen (kleinste
     eigenwaarde ≥ 0);
   - na een B12-stap (α < 1) is s_i ≤ α voor elke component;
   - bij een revert blijven θ en P ongewijzigd (zoals nu).
2. **Bestaande tests:** karakterisering N11–N20 en de convergentietest blijven groen;
   N13 (ideale data, start `light`) binnen 10%.
3. **Simulatie:** de prototype-rij in `adr062-b13.js` wordt de referentie; bij aanname
   krijgt `learners.js` een optie `effGain`; regressie op §4a, de matrix profiel × woning en de vastlopers (`b12`).
   Extra rij in §4a: "passief S5 koud A3 ≤ 0,05".
4. **ADR-064:** `adr064-ident-real.js` en `adr064-restart.js` met B13, om te zien of
   de koppeling UA–P_int bij echte buitentemperatuur verandert.
5. **Hardware:** na invoering en een volledige reset het verloop van C, UA en P_int,
   en het gemiddelde van s, volgen naast de proef van ADR-064 §3.6.

**Open punten.**

- **Versie:** nog te kiezen (3.4.3 als losse patch, of samen met ADR-064 in 3.5.0).
- **Volgorde met de proef van ADR-064 §3.6:** B13 invoeren tijdens die proef maakt de
  uitkomst moeilijker te lezen. Voorstel: eerst de proef afronden (ongeveer 6 dagen).

## 3. Fasering

Stand bijgewerkt op 2026-10-24. De wijzigingen per fase staan in de git-geschiedenis.

| Fase | Inhoud | Bewijs | Stand |
|---|---|---|---|
| **0** (3.3.1) | A1, changelog-regel, testcommentaar | Unit-test A1; bestaande tests groen | Af |
| **1a** | Vangnet: karakteriseringstests van de huidige learner (venster-, gap- en restoregedrag) | Groen op de huidige code | Af |
| **1b** | B1 venster + B2 `interruptWindow()` + service-hook in drie drivers | Simulatie (§4); unit-tests venster en hook | Af |
| **1c** | B3 PSD-projectie | PSD-eigenschapstest; simulatie | Af |
| **1d** | B4 grenzen + B5 restore-migratie + τ-logregel | Restore-tests (geldig, ongeldig, passief profiel) | Af |
| **1e** | §2.8 VFF weg, A7, §2.5, B6 diagnostisch veld | Bestaande tests; λ-test | Af |
| **1f** | Release 3.4.0: lint, `homey app validate`, testkanaal, hardware (§10) | Handmatig | Af (voorbereid) |
| **1g** | B12 uitweg bij vastlopen | Unit-tests N13, N18–N20; simulatie `adr062.js b12` | Af |
| **1h** | B13 P-update met de werkelijk genomen stap | Unit-tests B13; simulatie `adr062-b13.js` | Open |
| **2** | ADR-005 fase 1–3 (eigen ADR) | Zie ADR-005 | Open |
| **3** (3.5.0) | B7, B8 | Unit-tests per punt; thermische simulatie | Open |

Fase 1a t/m 1g staan op `feature/adr-062-phase1`; fase 1 komt als geheel op
`main` voor 3.4.0. 1f is voorbereid: versie, changelog en checklist (§10).
Uitbrengen volgt na de hardwaretest van 3.3.1 en van 3.4.0.

## 4. Testaanpak

### 4a. De simulatie als regressietest

De varianten in `learners.js` zijn de referentie voor de TypeScript-implementatie.
Na fase 1b–1d draait de **huidige** code (de rij "huidig" in de scripts) met de nieuwe
learner. Die rij moet dan binnen de onderstaande grenzen vallen en vergelijkbaar zijn
met de prototype-rij "fixes + 60 min".

| Scenario | Script | Grens na fase 1 |
|---|---|---|
| S1, S1b realistisch | `scenarios.js`, `adr062.js b1` | RMSE ≤ 0,03 °C |
| S3 realistisch | idem | RMSE ≤ 0,04 °C (B12) |
| S2 realistisch | idem | RMSE ≤ 0,05 °C |
| S1b koud, poorten Aurora III | `adr062.js b2` | RMSE ≤ 0,08 °C |
| S5 passief | `adr062.js b4` | > 0 updates; RMSE ≤ 0,05 °C |
| Alle scenario's | alle | 0 niet-PSD-updates; 0 keer `XᵀPX < 0` |
| Restore oude states | `adr062.js b5` | Geldige states behouden; RMSE na 10 dagen niet slechter dan zonder restore + 0,02 |
| Vastlopers | `adr062.js b12` | Lek huis vanaf `passive`, warm: RMSE ≤ 0,05 °C; unit-test N13 (start `light`) binnen 10% |

Gecontroleerd zonder uniforme rate-limiting (B11): mild S1 0,02, S1b 0,02, S2 0,03, S3 0,03;
koud (poorten Aurora III) S1b 0,01; passief S5 0,04. Alle grenzen worden gehaald. De
prototype-rij "fixes" in `adr062.js` gebruikt vanaf fase 1c PSD en grenzen zonder uniforme
schaling.

Met B12 (fase 1g): mild S1 0,02, S1b 0,02, S2 0,03, S3 0,04; koud (poorten Aurora III)
S1b 0,01; passief S5 0,03; lek huis vanaf `passive` 0,03 (warm) en 0,52 (koud A3).
De prototype-rij "fixes" gebruikt dan ook `clipAfter: 12`.

Met B13 (prototype `adr062-b13.js`): mild S1 0,02, S1b 0,02, S2 0,03, S3 0,03; koud
(poorten Aurora III) S1b 0,01; passief S5 0,02 (warm) en 0,05 (koud A3); lek huis vanaf
`passive` 0,03 (warm) en 0,02 (koud A3).

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
- De uniforme rate-limiting uit review §2.1 (B11).
- Een stap altijd inkorten tot de grens, de rate-limiting vóór de grenscontrole zetten,
  of inkorten zonder P-update (B12).
- De consolidatie inclusief Tuya (review §2.5).
- Een P-update met één factor voor de hele gain (B13).

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

| # | Actie | Fase | Stand |
|---|---|---|---|
| 1 | A1, changelog-regel drempeltriggers, testcommentaar | 0 | Af |
| 2 | Karakteriseringstests learner | 1a | Af |
| 3 | Venster, `interruptWindow()`, service-hook (3×) | 1b | Af |
| 4 | PSD-projectie | 1c | Af |
| 5 | Grenzen, restore-migratie, τ-logregel | 1d | Af |
| 6 | VFF weg, timers, restore-logging, diagnostisch veld | 1e | Af |
| 7 | npm-script `simulate:building-model` | 1a | Af |
| 8 | Release 3.4.0 via testkanaal (§10) | 1f | Af (voorbereid) |
| 9 | B7, B8 na ADR-005 fase 3 | 3 | Open |
| 10 | Soft reset bij profielwissel Aurora II/III, voorspelfout leeg na soft reset, gidsen en dev-docs bijgewerkt | 1f | Af |
| 11 | B12 uitweg bij vastlopen tegen de grenzen | 1g | Af |
| 12 | B13 P-update met de werkelijk genomen stap | 1h | Open |

## 10. Releasechecklist 3.4.0

**Volgorde:** 3.3.1 wordt eerst apart uitgebracht, met een eigen hardwaretest
(B10). 3.4.0 volgt daarna, ook via het testkanaal. Zo blijft er een geteste
versie om op terug te vallen.

### A. Automatisch, op de branch vóór de PR

| # | Commando | Verwacht |
|---|---|---|
| A1 | `npm test` | Alles groen |
| A2 | `npm run lint` en ESLint op de gewijzigde TS-bestanden | Geen nieuwe fouten in de gewijzigde bestanden |
| A3 | `homey app validate` | OK op niveau `publish` |
| A4 | `npm run simulate:building-model` | De grenzen uit §4a: S1, S1b ≤ 0,03; S3 ≤ 0,04; S2 ≤ 0,05; S1b koud A3 ≤ 0,08; S5 > 0 updates en ≤ 0,05; lek vanaf `passive` warm ≤ 0,05; 0 niet-PSD-updates; B5-states 5/5 geldig |
| A5 | Versie in `.homeycompose/app.json`, `app.json`, `package.json` en twee keer in `package-lock.json` | Overal 3.4.0 |

### B. Testkanaal en hardware, per driver (Tuya, Aurora II, Aurora III)

| # | Controle |
|---|---|
| B1 | De eerste start na de update logt `State RESTORED` met C, UA en τ, of `State REJECTED` met de reden |
| B2 | Ongeveer 60 minuten na de start loopt `sampleCount` op en verschijnt de logregel `λ=0.9990` |
| B3 | Bij ontdooien, tapwater (Aurora III) of buiten de verwarmingsmodus verschijnt `Window filling`: het venster begint opnieuw |
| B4 | De instelling "Leren: Vergeetfactor" toont het bereik 0.9985–0.9995; een lagere waarde wordt niet geaccepteerd |
| B5 | Na een herstart van de app één keer `Initialized` en geen dubbele leercycli |
| B6 | Na 24 uur liggen C, UA en τ in een plausibel bereik; noteer ze per unit voor vergelijking met 3.3.1 |
| B7 | Aurora II en III: een gewijzigd gebouwtype logt `Soft reset complete` met het nieuwe profiel |
| B8 | Geen lange reeks `RLS DIVERGENCE DETECTED`: na 12 op rij volgt `Bounded step` |

`predictionRmse24h` (B6) is op hardware niet direct zichtbaar; het zit in
`getDiagnosticStatus()` en is door unit-tests gedekt. ADR-063 kan het tonen.

### C. Uitbrengen

- PR van `feature/adr-062-phase1` naar `main`, merge na groene CI.
- Tag en GitHub-release via `github-release-manager`, na de hardware-acceptatie.
