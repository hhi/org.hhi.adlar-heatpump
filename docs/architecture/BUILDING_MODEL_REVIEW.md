# Evaluatie Gebouwleermodule (Building Model Learner & Services)

- **Project:** `org.hhi.adlar-heatpump` (v3.3.1, nog niet uitgebracht)
- **Datum:** 2026-10-23
- **Niet meegenomen in de beoordeling:** de COP-poort voor een stilstaande compressor (port van bron 2.15.3); zie de aanvullingen in §1.2 en §2.4.
- **Addendum (diepgaande code-inspectie):** [BUILDING_MODEL_REVIEW_ADDENDUM.md](BUILDING_MODEL_REVIEW_ADDENDUM.md)
- **Betrokken componenten:**
  - Core algoritme: `lib/shared/adaptive/building-model-learner.ts`
  - Driver-services: `lib/tuya/services/building-model-service.ts`, `lib/modbus/services/building-model-service.ts`, `lib/aurora3/services/building-model-service.ts`
  - Inzichten & adviezen: `lib/*/services/building-insights-service.ts`, `lib/shared/utils/preheat-calculator.ts`
  - Gerelateerde documentatie: [RLS-TELEMETRY.md](RLS-TELEMETRY.md), [RLS_RESEARCH_REPORT.md](RLS_RESEARCH_REPORT.md), [building-model-sample-gating.md](../Dev%20support/Architectural%20overview/building-model-sample-gating.md), [adr-061-building-model-persistence.md](../Dev%20support/modbus/adr-061-building-model-persistence.md)

---

## Samenvatting

De gebouwleermodule combineert een fysisch **1R1C-gebouwmodel** met online **Recursive Least Squares (RLS)**, sample-gating, persistentie en diagnostiek. De gedeelde learner vormt een bruikbare basis, maar de huidige beveiligingen garanderen nog geen stabiele, fysisch correct begrensde schatting.

Gerichte rekenproeven tonen twee belangrijke problemen aan: de covariantiecorrecties garanderen geen positief-semidefiniete P-matrix en de ratio-check begrenst UA in plaats van de bedoelde tijdconstante τ. Daarnaast is VFF bij de standaardinstelling feitelijk constant. De observaties over rate-limiting en codeduplicatie kloppen; smoothing en compensatie van afgiftevertraging zijn onderzoekshypothesen waarvan de modelwinst nog moet worden gemeten.

Simulaties met een 1R1C-woning (§6) laten zien dat de afgeleide over 5 minuten bij een sensor met 0,1 °C de grootste foutbron is. Met een venster van 60 minuten, de PSD-fix en de bounds-fix daalt de RMSE van een voorspelling 6 uur vooruit in alle vier de scenario's tot 0,01–0,03 °C. De algoritmefixes zonder venster verbeteren de schatting niet.

Deze beoordeling betreft de huidige werkboom van v3.3.1, inclusief lokale wijzigingen. Code-inspectie en rekenproeven onderbouwen de gemarkeerde bevindingen; er zijn voor deze beoordeling geen Homey-runtimeproeven of metingen aan woningen uitgevoerd. Voor aanvullende codebevindingen in de omliggende regellus, services en tests, zie [BUILDING_MODEL_REVIEW_ADDENDUM.md](BUILDING_MODEL_REVIEW_ADDENDUM.md).

---

## 1. Sterke punten

### 1.1 Solide fysische & wiskundige basis, lichtgewicht uitgevoerd

De thermische energiebalans van de woning:

```text
dT_in/dt = (1/C) × [ P_heating + UA × (T_out − T_in) + g × I_solar + P_int × m(t) ]
```

is lineair geparametriseerd als `y = X^T × θ` met:

- `y = dT_in/dt` (°C/uur)
- `X = [P_heating, (T_out − T_in), Solar_kW, P_int_multiplier]`
- `θ = [1/C, UA/C, g/C, P_int/C]`
- `m(t) = P_int_multiplier`; bij uitgeschakelde dynamische interne warmtewinst is deze multiplier 1.
- De zonne-invoer is instraling in kW/m² (`solarRadiation / 1000`).

Dit draait als een 4×4 RLS-filter in `BuildingModelLearner`, zonder externe matrix-dependencies. De vaste matrixomvang maakt een lichte implementatie mogelijk; de daadwerkelijke CPU- en geheugenbelasting op Homey Pro is in deze beoordeling niet gemeten.

### 1.2 Doordachte verdedigingslinie tegen "echte-wereld" data (ADR-056 / ADR-057)

Collineariteit, gebrek aan excitatie en vervuilde samples kunnen identificatie bemoeilijken. De implementatie bevat hiervoor meerdere beveiligingen, met de volgende beperkingen:

1. **Sample-gating in `collectAndLearn()`:** Modus-, defrost-, vermogens- en COP-checks blokkeren ongeschikte meetmomenten. Sinds de port van bron 2.15.3 geldt de COP-check alleen als de compressor draait of de status onbekend is. Bij een stilstaande compressor wordt het sample geleerd met thermisch vermogen 0, of overgeslagen als het elektrisch vermogen boven 300 W ligt (aangenomen bijverwarming). Bij Aurora III wordt daarnaast actief tapwaterbedrijf (`adlar_dhw_active`, input register 3-9 bit 2) afzonderlijk geblokkeerd. Bij Tuya en Aurora II blijven tapwatercycli binnen combimodi een beperking van de moduscheck.
2. **Measurement Validation & `dt`-gap guard (`MEASUREMENT_BOUNDS`):** De learner verwerpt `dT/dt` buiten ±10 °C/uur en leert niet over intervallen > 15 minuten (`dt_max_hours = 0.25`). Bij zo’n gat wordt de meting als nieuw referentiepunt opgeslagen. Kortere gaten worden nog wel gekoppeld aan de actuele invoervariabelen.
3. **Parameter-bounds (`THETA_BOUNDS`):** Runtime en `restoreState()` controleren componenten van θ en de ratio `θ[1]/θ[0]`. Deze ratio is UA, niet τ; de bedoelde τ-grens wordt hiermee niet afgedwongen (§2.7). Bounds op `g/C` en `P_int/C` zijn evenmin zelfstandige bounds op g en P_int.
4. **VFF-RLS & Parameter Rate Limiting:** De code bevat een foutafhankelijke sigmoid en begrenst geaccepteerde stappen tot 5% per θ-component. Door de combinatie met de geconfigureerde ondergrens blijft de effectieve λ bij de standaardinstelling 0,999 echter constant (§2.8).
5. **Covariantiecorrecties in `updateRLS()`:** Diagonalen worden begrensd, symmetrie wordt afgedwongen en off-diagonalen worden geclipt op `|P[i][j]| ≤ √(P[i][i] × P[j][j])`. Dit begrenst matrixelementen, maar garandeert geen positief-semidefiniete P-matrix (§2.6).

### 1.3 Zonne-instraling cascade & Observability

- **4-traps prioriteitscascade (`getSolarRadiationWithPriority()`):** Schakelt automatisch terug van eigen zonnepanelen (1u TTL) → KNMI/flow-kaart (1u TTL) → Open-Meteo `shortwave_radiation` → astronomische declinatie-schatting op basis van breedtegraad en dag van het jaar.
- **Beschikbare diagnostiek:** Het statusmodel (`BLOCKED` → `LEARNING` → `Learned`) en de counters `consecutiveReverts`, `totalReverts` en `rateLimitActivations` tonen blokkades en begrenzingen. Zij bewijzen geen convergentie. Ook `confidence`, gebaseerd op sample-aantal en de trace van P, is geen gemeten voorspellingsnauwkeurigheid. Het sample-aantal stijgt bovendien ook wanneer `updateRLS()` een θ-update terugdraait.

---

## 2. Kritische kanttekeningen & verbeterpotentieel

### 2.1 Volgorde van Bounds-check vs. 5% Rate-Limiting in `updateRLS()`

In `updateRLS()` van `lib/shared/adaptive/building-model-learner.ts` wordt direct na de θ-update **eerst** gecontroleerd of de *ongeclipte* nieuwe `θ` binnen `THETA_BOUNDS` valt, en **daarna pas** wordt de stapgrootte begrensd op maximaal 5% per sample.

> [!IMPORTANT]
> In [RLS_RESEARCH_REPORT.md](RLS_RESEARCH_REPORT.md) (sectie "Prioriteit 2: Parameter Rate Limiting") was het oorspronkelijke ontwerp: *"Na theta update, voor bounds check"*. In de code staat deze volgorde nu omgedraaid.

**Gevolgen van de huidige volgorde:**

- Als een grote Kalman-stap één parameter buiten `THETA_BOUNDS` duwt, terwijl de 5%-rate-limited stap nog prima *binnen* de grenzen zou zijn gebleven, doet de code nu een volledige revert van alle 4 de parameters én slaat hij de `P`-update over (zie ook [sectie A2 in het addendum](BUILDING_MODEL_REVIEW_ADDENDUM.md#a2-oorzaak-van-de-1500-samples-bound-pinning-fase-in-updaterls)).
- Daarnaast verandert het onafhankelijk clippen per component (`±5%` per `θ[i]`) de **richting** van de updatevector `Δθ = K × error`.

**Mogelijke verbetering:**

- Onderzoek rate-limiting vóór de bounds-check, met uniforme schaling van `Δθ` zodat de grootste relatieve verandering ≤ 5% is en de oorspronkelijke staprichting behouden blijft. Controleer daarna alle fysische grenzen op de uiteindelijke θ. Beoordeel de P-update samen met correct PSD-behoud (§2.6); P bij een afgewezen sample altijd laten krimpen kan ten onrechte meer zekerheid suggereren. Minder reverts alleen bewijst geen betere schatting.

---

### 2.2 Onderzoek — Kwantiseringsruis op `dT/dt`

De learner berekent `dT/dt` rechtstreeks uit opeenvolgende metingen. De service verzamelt elke 5 minuten; `dt` volgt uit de werkelijke timestamps en kan door gemiste samples afwijken:

```typescript
const dT = data.tIndoor - this.lastMeasurement!.tIndoor;
const dtDt = dT / dt; // °C/hour
```

**Analyse:**

- Bij een sensor die in stappen van `0.1 °C` rapporteert, kunnen nulverschillen worden afgewisseld met sprongen. De resolutie en het rapportagegedrag van de werkelijk gebruikte sensoren zijn hier niet onderzocht.
- Een sprong van één tiende graad over exact 5 minuten geeft `dT/dt = 0.1 / (1/12) = +1.2 °C/u`.
- Dit trappetjes-effect kan differentiatieruis op y veroorzaken en beïnvloedt direct de θ-update via de voorspellingsfout. Een extra versterking via een dalende VFF-λ treedt bij de standaardinstelling niet op (§2.8).

**Te onderzoeken verbetering:**

Vergelijk de huidige berekening met een EMA of een venster van bijvoorbeeld 15–30 minuten. Stem alle invoervariabelen af op dezelfde filtering of hetzelfde meetinterval. Een temperatuurverschil over 30 minuten combineren met alleen het actuele vermogen behoudt de tijdsmismatch. Test ook onregelmatige meetintervallen, overlappende vensters en het opnieuw opbouwen van filterhistorie na blokkades of een herstart.

**Simulatie (§6.2–6.3):** in de gemiddelde woning stijgt de fout in UA door kwantisatie van 1% naar 27%. Een venster van 60 minuten brengt de RMSE terug van 0,70 naar 0,07 °C; samen met de PSD-fix naar 0,02 °C.

---

### 2.3 Onderzoek — Afgiftevertraging bij vloerverwarming

Het 1R1C-model gebruikt het actuele `pHeating` als invoer voor de temperatuurverandering over het voorafgaande meetinterval. Een afzonderlijke toestand voor warmteopslag in het afgiftesysteem ontbreekt.

**Analyse:**

- Warmteopslag in een vloer kan de respons van de luchttemperatuur vertragen. Een vertraging van 1–2,5 uur is hier niet met bronnen of woningmetingen onderbouwd en is geen vastgestelde eigenschap van de ondersteunde installaties.
- Een mogelijke situatie is dat tijdens opstoken al warmte wordt toegevoerd terwijl de luchttemperatuur nog nauwelijks stijgt, gevolgd door na-ijling wanneer het vermogen afneemt.
- Dit kan identificatie met één toestand vertekenen. De hypothese dat C daardoor structureel richting 40 kWh/°C wordt geschat, of dat g en P_int de vertraagde respons overnemen, is nog niet aangetoond. De werkelijke bias hangt ook af van regelgedrag, meetdata en sample-gates.

**Te onderzoeken verbetering:**

Vergelijk het huidige model met een experimenteel afgiftefilter `P_eff(t) = α × pHeating(t) + (1 − α) × P_eff(t − 1)`, met `α = 1 − exp(−Δt/τ_afgifte)`. Kalibreer `τ_afgifte` op data van het afgiftesysteem; het gebouwprofiel alleen bepaalt deze waarde niet. Een eerste-ordefilter is bovendien geen zuivere dode tijd. Definieer filtergedrag tijdens DHW, defrost, ontbrekende metingen en herstarts en controleer gevolgen voor voorspellingen en adviezen.

---

### 2.4 Interactie tussen reset-covariantie en `P_CEILING = 1.0`

In `updateRLS()` worden na de eerste uitgevoerde P-update alle diagonaalelementen begrensd op het interval `[0.0001, 1.0]`. Dit is geen gelijkstelling van alle diagonalen aan 1.

**Aangetoond:**

- De initiële waarden 100 en 50 beïnvloeden eerst de gain en de volledige P-update. De daaropvolgende begrenzing wist die verschillen niet noodzakelijk uit.
- Voor dezelfde gemiddelde profielparameters, `X = [0, −15, 0, 1]`, `y = −0,28` en λ = 0,999 geeft één geldige update bijvoorbeeld `P[1][1] ≈ 0,447326` bij startwaarde 100 en `≈ 0,225865` bij startwaarde 50.
- Bij een echte zachte reset blijven bovendien de helft van het sample-aantal en de vorige meting behouden. Een harde reset begint zonder die meetcontinuïteit. De uitspraak dat beide resets na 5 minuten equivalent zijn, is daarom onjuist.
- `P_CEILING = 1.0` is een bewuste ontwerpkeuze waarop ook `calculateConfidence()` is afgestemd. Dit bewijst op zichzelf geen numerieke stabiliteit (§2.6).

**Relevantie sinds 2.15.3:** de invoer van de proef hierboven, `X = [0, −15, 0, 1]`, is precies een stilstandsmonster. Zulke monsters werden voorheen door de COP-poort overgeslagen en worden nu geleerd. Bij `X[0] = 0` levert een sample geen informatie over θ[0] = 1/C. Hoeveel vaker de effecten uit §2.4 en §2.6 daardoor optreden, is niet gemeten.

**Te onderzoeken verbetering:**

Meet de gevolgen van harde en zachte reset voor herleertijd, overshoot, P en confidence. Een wijziging naar bijvoorbeeld startwaarden 1 en 0,5 is een ontwerpoptie, geen noodzakelijke correctie die uit de huidige clipping volgt. Herbeoordeel deze instellingen na het oplossen van PSD-behoud.

---

### 2.5 Code-duplicatie en kleine divergenties tussen de drie drivers

Terwijl `BuildingModelLearner` en `preheat-calculator` netjes in `lib/shared/` staan, zijn `BuildingModelService` (~1.200 regels × 3) en `BuildingInsightsService` (~1.370 regels × 3) voor circa 95% gedupliceerd over `lib/tuya/`, `lib/modbus/` en `lib/aurora3/`.

Hierdoor ontstaan onderlinge verschillen (drift):

| Onderdeel | Tuya (`lib/tuya/`) | Aurora II (`lib/modbus/`) | Aurora III (`lib/aurora3/`) |
|---|---|---|---|
| **ADR-061 restore-reject logging** (`initialize()`) | Vergelijkt `restored.sampleCount === sampleCountBefore` en logt expliciet `⚠️ State REJECTED on restore` | Logt altijd `Restored state from storage (samples=0...)`, ook als `restoreState()` de state afwees | Logt altijd `Restored state from storage (samples=0...)`, ook als `restoreState()` de state afwees |
| **`getPIntMultiplier` in `updateModelCapabilities()`** | Inline uitgerekend, met dezelfde vensters en multipliers (0,4 / 1,0 / 1,8); geen gedragsverschil, wel een tweede bron | Gebruikt `getPIntMultiplier(hour)` uit `building-model-learner.ts` | Gebruikt `getPIntMultiplier(hour)` uit `building-model-learner.ts` |
| **DHW-gate tijdens combimodus** | Alleen modus-check (`adlar_enum_mode`) | Alleen modus-check (`adlar_mode`) | Modus-check (`adlar_mode_aurora3`) + actieve DHW-status (`adlar_dhw_active`) |
| **Doeltemperatuur in `BuildingInsightsService`** | `desired_indoor_temp` | `target_temperature.indoor` | `target_temperature.indoor` |

**Mogelijke verbetering:**

- Breng gemeenschappelijk gedrag onder in `lib/shared/` met expliciete adapters voor modus-, defrost- en DHW-gates én capabilitynamen zoals de doeltemperatuur. Alleen adapters voor sample-gates zijn onvoldoende. Harmoniseer restore-logging en `getPIntMultiplier()`. De Tuya-vergelijking van sample-aantallen detecteert een afwijzing van een state met nul samples niet betrouwbaar; een expliciet restore-resultaat verdient de voorkeur.
- De zes bestanden omvatten samen 7.707 regels. Consolidatie naar één paar services kan ruwweg 5.000 regels duplicatie wegnemen, vóór toevoeging van adapters en verificatie. De werkelijke besparing en complexiteit volgen uit de gekozen interface en integratie met de drie service-coördinatoren.

---

### 2.6 P1 — Covariantiecorrecties behouden positief-semidefinietheid niet

**Aangetoond:** Symmetrie en de paarsgewijze grenzen `|P[i][j]| ≤ √(P[i][i] × P[j][j])` zijn noodzakelijk, maar niet voldoende voor een positief-semidefiniete 4×4-matrix. Het afzonderlijk begrenzen van diagonalen kan de matrixstructuur verstoren; de daaropvolgende correcties herstellen die niet gegarandeerd.

Een rekenproef met de huidige `updateRLS()` geeft:

- Start met profiel `average`, `P = 100 × I` en geconfigureerde λ = 0,999.
- Gebruik `X = [5, −15, 0.2, 1]` en `y = Xᵀθ = 0,06 °C/uur`.
- De voorspellingsfout is nul, dus θ blijft geldig en de P-update wordt uitgevoerd.
- Na de correcties geldt voor `v = [1, −1, 1, 1]`: `vᵀPv ≈ −4,95694`.

De negatieve kwadratische vorm bewijst dat P niet positief-semidefiniet is. Dit kan dus al na één geldige update optreden, terwijl de trace en paarsgewijze grenzen wel voldoen. Daarmee vervalt ook de garantie dat de gain-noemer `λ + XᵀPX` positief blijft voor alle invoervectoren.

**Mogelijke verbetering:** Kies een matrixupdate en begrenzing die de volledige matrixstructuur behouden, bijvoorbeeld spectrale begrenzing van eigenwaarden of een factorisatie met expliciet positief-definiete begrenzing. Toets numerieke stabiliteit en uitvoeringskosten; extra elementgewijze clipping alleen is onvoldoende.

### 2.7 P1 — De ratio-check begrenst UA, niet τ

**Aangetoond:** Uit de parameterdefinitie volgt:

```text
θ[0] = 1/C
θ[1] = UA/C
θ[1]/θ[0] = UA
τ = C/UA = 1/θ[1]
```

De controles op `theta1_theta0_ratio_min = 0.002` en `theta1_theta0_ratio_max = 0.8` begrenzen daarom UA, ondanks de comments die een τ-bereik van 1,25–500 uur beschrijven.

Een restore-proef met `theta = [0.025, 0.00125, 0.01, 0.0075]`, `P = I`, `sampleCount = 100` en `lastMeasurement = null` wordt geaccepteerd. Het resulterende model heeft `C = 40`, `UA = 0,05` en **τ = 800 uur**.

**Dezelfde verwarring in de diagnose:** bij een revert logt `updateRLS()` een "τ estimate" als `θ[0]/θ[1]`. Dat is 1/UA, niet τ. De logregel toont dus een verkeerde waarde naast het bereik "[valid: 1.25 - 500]".

**Het UA-plafond:** omdat de ratiocontrole UA begrenst, wordt elke θ met UA ≥ 0,8 kW/°C afgewezen. Het commentaar bij `theta1_max` noemt juist "UA=1.0 kW/°C poor insulation" als plausibel. Voor een slecht geïsoleerd huis met een werkelijke UA boven 0,8 leidt elke stap in die richting tot een revert (§6.2). Leg ook de gewenste bovengrens voor UA expliciet vast.

**Mogelijke verbetering:** Leg de bedoelde fysische grenzen expliciet vast. Als τ binnen 1,25–500 uur moet blijven, toets dan `1/θ[1]` of de equivalente θ-grenzen. Beoordeel afzonderlijk de gewenste grenzen voor UA, g en P_int en gebruik dezelfde validatie bij runtime en restore, inclusief dezelfde behandeling van grenswaarden.

### 2.8 P2 — VFF is bij de standaardinstelling constant

**Aangetoond:** `updateRLS()` berekent:

```text
e = min(|y − Xᵀθ| / 2, 1)
s = 1 / (1 + exp(−5 × (e − 0.25)))
vffLambda = 0.9999 − s × (0.9999 − 0.995)
adaptiveLambda = max(vffLambda, configuredLambda)
```

Omdat `e ∈ [0, 1]`, ligt `vffLambda` ongeveer tussen 0,995113 en 0,998809. Bij `configuredLambda = 0,999`, de standaardwaarde van de services, is `adaptiveLambda` daardoor voor elke eindige voorspellingsfout exact 0,999. De beoogde variatie tussen een stabiele en een snel volgende stand treedt daar niet op. Bij lagere instellingen kan VFF wel actief zijn.

**Mogelijke verbetering:** Bepaal eerst of de geconfigureerde λ een ondergrens, bovengrens of nominale waarde moet zijn. Stem de sigmoid en instellingen daarop af. Vergelijk het resulterende leergedrag met de huidige standaard onder meetruis en modelveranderingen.

---

## 3. Overzicht Prioritering

| Volgorde | Bevinding | Onderbouwing / impact | Geschatte complexiteit |
|---|---|---|---|
| **1 — P1** | dT/dt-venster en uitlijning van de invoer (§2.2) | Grootste foutbron in de simulatie; voorwaarde voor 2 en 4 (§6) | Middel; tijdsafstemming en filtertoestand nodig |
| **2 — P1** | PSD-behoud van P (§2.6), samen met 1 | Niet-PSD bij de meeste updates in S1 en S3; negatieve `XᵀPX` bij betere invoer (§6.2) | Middel; matrixmethode en herijking vereisen verificatie |
| **3 — P1** | Fysische grenzen, inclusief τ en UA (§2.7) | UA ≥ 0,8 onbereikbaar; restore accepteert τ = 800 uur (§6.2) | Laag–middel; grenzen en bestaande states beoordelen |
| **4 — P2** | Rate-limiting vóór de bounds-check (§2.1), alleen met 2 | Kleine winst; zonder 2 schadelijk (§6.3) | Middel inclusief regressieverificatie |
| **5** | Restore-logging en `getPIntMultiplier()` harmoniseren (§2.5) | Aangetoonde diagnostische verschillen | Laag |
| **6 — Onderzoek** | Afgiftevertraging (§2.3) | Niet gesimuleerd; effect onbekend | Middel |
| **7 — Onderzoek** | Reset-instellingen evalueren (§2.4) | Verschil tussen resetvormen blijft bestaan; optimale waarden onbekend | Middel |
| **8 — P3** | VFF opruimen of documenteren; confidence verifiëren (§1.3, §2.8) | VFF constant bij de standaardinstelling, geen meetbaar effect (§6.4); confidence bewijst geen nauwkeurigheid | Laag |
| **9** | Services consolideren met driver-adapters (§2.5) | Veel duplicatie; driverafhankelijke capabilities blijven nodig | Middel; drie integratiepaden controleren |

Deze tabel prioriteert de bevindingen uit dit document. De aanvullende integratiebevindingen behouden hun eigen prioritering in het addendum.

---

## 4. Addendum — Diepgaande Code-inspectie

Voor de aanvullende code-bevindingen (de capability-mismatch van `pre_heat_recommendation` in Tuya (A1), de revert-volgorde in `updateRLS()` (A2), de heuristische opwarmtijd in `calculateThermalAdjustment()` (A3), de doorwerking van modelparameters zonder confidence-gate (A4), de afhandeling van leerinstellingen bij runtime en restore (A5), de herhalende mijlpaaltrigger (A6) en de timer-cleanup (A7)), zie [BUILDING_MODEL_REVIEW_ADDENDUM.md](BUILDING_MODEL_REVIEW_ADDENDUM.md).

---

## 5. Verificatie en acceptatiecriteria

De rekenproeven voor P, τ, VFF en reset zijn uitgevoerd tegen de huidige TypeScript-implementatie, voor de learner in het geheugen naar JavaScript getranspileerd. De geïsoleerde RLS-proeven testen één update; zij bewijzen een tegenvoorbeeld of numeriek effect, geen frequentie of impact in woningen. De bestaande unit-tests bevatten onder meer trace-, restore-, convergentie- en resetchecks; een trace-check alleen toetst geen PSD-behoud. De volledige test-suite, lint en Homey-validatie zijn voor deze documentbeoordeling niet uitgevoerd. De simulaties in §6 geven een eerste onderbouwing voor de criteria 1, 2, 4 en 5. Ze vervangen de daar genoemde metingen op echte woningen niet.

Voor implementatie van de aanbevelingen gelden de volgende criteria:

1. **Matrixstabiliteit:** Het tegenvoorbeeld uit §2.6 en reeksen met weinig excitatie, wisselend vermogen en meetruis moeten eindige, symmetrische P-matrices opleveren met niet-negatieve eigenwaarden binnen een vastgelegde numerieke tolerantie. Controleer daarnaast een strikt positieve gain-noemer en het gedrag bij ongeldige opgeslagen matrices.
2. **Fysische grenzen:** Leg grenzen voor C, UA, g, P_int en τ vast en toets dezelfde grensgevallen bij runtime en restore. Als τ ≤ 500 uur de gekozen eis blijft, moet de state uit §2.7 worden afgewezen of expliciet gemigreerd.
3. **VFF en confidence:** Test de effectieve λ bij nul, kleine en grote fouten voor de standaardinstelling en de toegestane instellingsgrenzen. Vergelijk sample-aantallen, uitgevoerde updates, reverts en confidence met daadwerkelijke parameter- en voorspellingsfouten.
4. **Rate-limiting:** Toon een geval waarin de ruwe stap buiten de grenzen valt maar een begrensde stap geldig is. Verifieer maximaal 5% verandering per θ-component, behoud van staprichting bij uniforme schaling en fysische geldigheid van het eindresultaat. Minder reverts mag niet samengaan met slechtere voorspellingen.
5. **Modelkwaliteit:** Vergelijk de huidige methode en kandidaten op dezelfde scenario’s: ideale 1R1C-data, temperatuurkwantisatie van 0,1 °C, onregelmatige timestamps, meetgaten en een afzonderlijk gesimuleerde afgiftevertraging. Meet parameterfout waar de waarheid bekend is en temperatuur-MAE/RMSE over vooraf gekozen horizons op data die niet voor afstemming is gebruikt.
6. **Filters en reset:** Test opbouw en herstel van filtertoestand, DHW/defrost-blokkades, na-ijling, harde en zachte reset en herstarts. Beoordeel herleertijd en gevolgen voor voorspellingen en voorverwarmadviezen. Kies filter- of resetparameters pas na die vergelijking.
7. **Drivertrouw:** Controleer voor alle drie de drivers modus-, DHW- en defrost-gates, doeltemperatuur-capabilities, persist/restore-uitkomsten en timeropruiming. Na codewijzigingen zijn de relevante unit-tests, lint, build en Homey-validatie nodig; runtime-scenario’s moeten afzonderlijk op Homey worden gecontroleerd.

Leg voor modelvergelijkingen vooraf de datasets, horizons en toegestane foutmarges vast. De classificatie van een hypothese als verbetering vereist gemeten winst zonder regressie in de gekozen controlescenario’s.

---

## 6. Simulatie-onderbouwing

### 6.1 Opzet

- **Woning (waarheid):** 1R1C, per minuut geïntegreerd. Aan/uit-warmtepomp met
  hysterese ±0,3 °C rond 21 °C (7–22 u) en 19 °C ('s nachts), thermisch vermogen
  ≈ 22 × UA kW. Buitentemperatuur gemiddeld 4 °C met dagritme ±4 °C en weersdrift,
  zon tot 450 W/m² met bewolking per dag, binnensensor met 0,1 °C-resolutie,
  meting elke 5 minuten.
- **Learner:** de gecompileerde `BuildingModelLearner` uit de werkboom, λ = 0,999,
  P₀ = 100·I. De learner krijgt alle samples, ook bij stilstand (`pHeating = 0`),
  zoals na de port van 2.15.3. Varianten overschrijven alleen `updateRLS()`,
  `restoreState()` en, voor het venster, `addMeasurement()`. Een herimplementatie
  van de huidige semantiek geeft bit-voor-bit dezelfde θ en P als de echte code.
- **Varianten:**
  - *psd* (§2.6): na de covariantie-update symmetriseren en de eigenwaarden
    begrenzen op [`P_FLOOR`, `P_CEILING`], in plaats van diagonaal-clamping en
    off-diagonaal-clip.
  - *bounds* (§2.7): τ = 1/θ[1] ∈ [1,25; 500] u en UA = θ[1]/θ[0] ∈ [0,03; 1,5]
    kW/°C; overige componentgrenzen ongewijzigd; dezelfde controle bij restore.
  - *order* (§2.1): Δθ uniform schalen tot maximaal 5% per component, daarna de
    bounds-check.
  - *venster N* (§2.2): dT/dt over N samples; P, (Tout − Tin) en zon gemiddeld
    over de samples aan het begin van elk deelinterval.
  - *VFF* (§2.8): de geconfigureerde λ als nominale waarde; VFF verlaagt naar
    0,995 bij een grote voorspellingsfout.
- **Datavormen:** *realistisch* (zoals de service: vermogen op het meetmoment,
  sensor 0,1 °C), *ideaal* (intervalgemiddelden, exacte Tin), *kwantisatie*
  (ideaal uitgelijnd, sensor 0,1 °C) en *mismatch* (exacte Tin, vermogen op het
  meetmoment).
- **Maat:** RMSE van een open-lus-voorspelling 6 uur vooruit, elke 6 uur gestart
  vanaf de werkelijke Tin, op 5 dagen data die niet voor het leren zijn gebruikt.
  Met de ware parameters is die RMSE 0,001 °C. Daarnaast: fout in C en UA,
  reverts en het aantal updates met een niet-PSD P. Telkens 30 dagen leren,
  gemiddeld over 5 seeds.
- **Woningen:**

| Scenario | C (kWh/°C) | UA (kW/°C) | τ (u) | Startprofiel |
|---|---:|---:|---:|---|
| S1 | 15 | 0,30 | 50 | average |
| S1b | 15 | 0,30 | 50 | light |
| S2 | 10 | 1,00 | 10 | light |
| S3 | 24 | 0,15 | 160 | heavy |

- **Reproductie:** `test/simulation/building-model-review/` (zie §6.7).

### 6.2 Waar de huidige implementatie misgaat

**De afgeleide over 5 minuten is de grootste foutbron (§2.2).** Bij een
sensorresolutie van 0,1 °C is één stap al een sprong van 1,2 °C/u in dT/dt.
Huidige code, scenario S1b:

| Data | Fout C | Fout UA | RMSE 6 u |
|---|---:|---:|---:|
| ideaal | 2% | 1% | 0,01 °C |
| alleen mismatch | 8% | 7% | 0,09 °C |
| alleen kwantisatie | 22% | 27% | 0,40 °C |
| realistisch | 23% | 51% | 0,70 °C |

De confidence is in alle vier de gevallen 100% (§1.3).

**P is in twee van de vier scenario's bij de meeste updates niet
positief-semidefiniet (§2.6).** In S1 gold dat voor 4.818 van de 7.980 updates,
in S3 voor alle 6.208; de kleinste eigenwaarde was daar −1,0. In S1b en S2
kwam het bij 0 en 13 updates voor; daar overheersen de reverts. Met betere invoer wordt het gevolg zichtbaar: in S2 met
een venster van 60 minuten was `XᵀPX` 101 keer negatief (huidig) en 252 keer
(met alleen de bounds-fix). Voor een positief-semidefiniete P kan dat niet.

**UA ≥ 0,8 is onbereikbaar (§2.7).** In S2 (UA = 1,0) blijft de huidige code
steken op UA = 0,796, met een RMSE van 1,11 °C. Met een venster van 60 minuten
wordt het erger: 8.562 reverts tegen 67 updates, RMSE 1,20 °C.

**Restore accepteert τ = 800 u (§2.7).** De state uit §2.7 wordt hersteld met
sampleCount 100, C = 40 en UA = 0,05. Met de bounds-fix wordt hij afgewezen. Onder
ADR-062 B4 (τ ≤ 800 u) wordt deze state bewust geaccepteerd; de huidige code doet
dat ook.

### 6.3 Effect van de voorgestelde wijzigingen

RMSE 6 u op realistische data; tussen haakjes de fout in C / UA:

| Variant | S1 | S1b | S2 | S3 |
|---|---|---|---|---|
| huidig | 0,20 (15/12%) | 0,70 (23/51%) | 1,11 (7/20%) | 0,12 (43/38%) |
| psd + bounds + order, zonder venster | 0,53 | 0,39 | 0,45 | 0,14 |
| huidig + venster 60 min | 0,01 | 0,07 | 1,20 | 0,06 |
| psd + venster 60 min | 0,02 | 0,02 | 0,80 | 0,03 |
| psd + bounds + venster 60 min | 0,02 (1/3%) | 0,02 (0/2%) | 0,03 (1/1%) | 0,03 (7/6%) |
| psd + bounds + order + venster 60 min | 0,01 (1/3%) | 0,01 (1/3%) | 0,03 (2/2%) | 0,02 (5/13%) |

- **Venster (§2.2):** de grootste verbetering; S1 van 0,20 naar 0,01, S1b van
  0,70 naar 0,07. Een venster van 30 minuten gaf in S1b 0,04 en in S3 0,04.
- **PSD (§2.6):** voegt er duidelijk iets aan toe (S1b van 0,07 naar 0,02, S3
  van 0,06 naar 0,03) en voorkomt elke negatieve `XᵀPX`.
- **Bounds (§2.7):** nodig voor woningen met UA > 0,8 (S2 van 0,80 naar 0,03).
- **Volgorde (§2.1):** kleine winst (0,02 naar 0,01), maar alleen samen met de
  PSD-fix. Zonder PSD-fix verslechtert de volgorde zelfs op ideale data: de fout
  in C stijgt van 2% naar 21%, met 7.981 reverts.
- **De algoritmefixes zonder venster** maken S1 slechter (0,20 naar 0,53). De
  huidige numerieke gebreken dempen toevallig de ruis op dT/dt; wie ze
  repareert zonder de invoer te verbeteren, laat die ruis vol doorkomen.
- **Ideale data:** de huidige learner haalt al 2%/1%; met PSD-fix wordt dat 0%/0%.
  De RLS-wiskunde is dus niet het hoofdprobleem; de invoer wel.

### 6.4 VFF bij een verandering van de woning (§2.8)

Na-isolatie op dag 20: UA van 0,30 naar 0,20 (S1, realistische data).

| Variant | UA dag 19 | UA dag 25 | UA dag 50 | Dagen tot ≤ 10% fout |
|---|---:|---:|---:|---|
| huidig | 0,273 | 0,219 | 0,303 | 8 / 9 / 4 / 3 / 1 |
| fixes + venster 60 min | 0,291 | 0,192 | 0,198 | 2 / 1 / 2 / 1 / 3 |
| fixes + venster 60 min + VFF-voorstel | 0,291 | 0,191 | 0,198 | 2 / 1 / 2 / 1 / 3 |
| fixes + venster 60 min, λ-instelling 0,995 | 0,289 | 0,189 | 0,198 | 2 / 1 / 2 / 1 / 3 |

De huidige code bereikt de nieuwe waarde tijdelijk, maar dwaalt daarna weer af
(0,303 op dag 50). Met de fixes en het venster wordt de verandering binnen 1–3
dagen gevolgd en blijft de schatting stabiel. VFF maakt geen meetbaar
verschil: `P_CEILING` en de rate-limiter bepalen de volgsnelheid, niet λ.

### 6.5 Thermische correctie (A3 in het addendum)

De echte `calculateThermalAdjustment()` van Aurora II, met een model gelijk aan
de waarheid (S1), confidence 100%, geen zon, 12:00. Opwarmen van 19,8 naar
21 °C, tot binnen 0,3 °C van het doel:

| Tout | Werkelijk bij 6,6 kW | Werkelijk bij 3 kW | Huidige formule | Advies |
|---|---|---|---|---|
| −10 °C | nooit | nooit | 37,8 u | +0,5 °C |
| 0 °C | 16,5 u | nooit | 37,8 u | +0,5 °C |
| 10 °C | 3,5 u | 69,3 u | 37,8 u | +0,5 °C |
| 15 °C | 2,5 u | 7,8 u | 37,8 u | +0,5 °C |

De formule `t = τ × ln((T_eq − T_start)/(T_eq − T_doel))` met
`T_eq = T_out + (P + G)/UA` uit A3 reproduceert de simulatie. Bij 0 °C en
6,6 kW: T_eq = 23 °C en t = 50 × ln(3,2/2,3) = 16,5 u.

### 6.6 Gevolgen voor de prioritering

- **§2.2 is een voorwaarde, geen onderzoeksonderwerp.** Zonder venster of
  vergelijkbare filtering leveren de algoritmefixes niets op of verslechteren
  ze de schatting.
- **§2.6 en §2.2 horen samen.** De PSD-fix levert zijn winst pas met betere
  invoer.
- **§2.7 staat los van de rest** en is nodig voor slecht geïsoleerde woningen.
- **§2.1 alleen samen met §2.6.**
- **§2.8: opruimen of documenteren.** Herontwerp van VFF levert in deze
  scenario's niets op.

### 6.7 Grenzen

- Het model is correct gespecificeerd: de waarheid is zelf 1R1C, dus zonder
  afgiftevertraging (§2.3).
- Het thermisch vermogen is exact bekend. In de praktijk is het elektrisch
  vermogen × COP, met de fout van die COP.
- 5 seeds en 30 dagen per scenario; het venster is een prototype met
  overlappende vensters en niet geoptimaliseerd.
- Geen Homey-runtimeproef. De scripts staan in
  `test/simulation/building-model-review/`; uitvoeren met
  `npm run build && TAU_MAX=500 node test/simulation/building-model-review/scenarios.js all ideaal,realistisch`,
  of `npm run simulate:building-model` voor deze sectie en ADR-062 samen.
  De rijen "huidig" gebruiken de learner uit `.homeybuild/`; sinds ADR-062 fase 1b is
  dat de learner met het tijdvenster. De getallen in deze sectie zijn reproduceerbaar
  op commit `f56a73a` of eerder.
