# Addendum: Code-inspectie gebouwleermodule en regellus

- **Hoofddocument:** [BUILDING_MODEL_REVIEW.md](BUILDING_MODEL_REVIEW.md)
- **Project:** `org.hhi.adlar-heatpump` (v3.3.1)
- **Datum:** 2026-10-23
- **Onderzochte versie:** huidige werkboom, inclusief lokale wijzigingen.
- **Bronnen:** learner, model- en insights-services, adaptive-control-services,
  service-coördinatoren, driver-manifesten, flowkaartdefinities en gerichte tests.
- **Driverconventie:** Aurora III importeert de PI-controller, prijsoptimizer en
  beslislogica uit `lib/modbus/adaptive/`; die bestanden bestaan niet als drie
  afzonderlijke implementaties.

---

## Overzicht

Dit addendum beoordeelt de doorwerking van het gebouwmodel in regeling,
instellingen, flow-triggers en diagnostiek. De zeven onderdelen hieronder
onderscheiden aangetoonde codeproblemen, gevolgen onder expliciete voorwaarden
en ontwerpkeuzes die verdere verificatie vereisen.

Gerichte proeven met de huidige TypeScript-broncode laten zien dat de
revert-volgorde in `updateRLS()` geen initiële blokkade van circa 1.500 samples
veroorzaakt. In het testscenario vindt de eerste P-update al bij sample 2 plaats
(A2). Niet aangetoond zijn ook: een permanente PI-deadband van 0,48 °C (A4.1),
het overschrijven van beide leerinstellingen bij restore (A5), en een
SDK3-schending door globale `clearInterval()` (A7).

De problemen met PSD-behoud, τ-bounds en VFF staan in §2.6–2.8 van het
[hoofddocument](BUILDING_MODEL_REVIEW.md). Zij blijven leidend bij wijzigingen aan
de learner; de aanbevelingen hieronder veronderstellen geen reeds betrouwbare
P-matrix of gekalibreerde confidence.

---

## A1. Bug: `pre_heat_recommendation` mist doeltemperatuur in Tuya

**Bron:** `checkPreHeatThreshold()` en `triggerPreHeatRecommendation()` in
[Tuya BuildingInsightsService](../../lib/tuya/services/building-insights-service.ts);
[Tuya driver-manifest](../../drivers/intelligent-heat-pump/driver.compose.json).

Beide methoden lezen:

```typescript
const targetTemp = await this.device.getCapabilityValue('desired_indoor_temp');
```

De driver declareert `target_temperature.indoor`. De Tuya adaptive-control-service
en de insights-services van Aurora II en III gebruiken die capability wel.
`desired_indoor_temp` komt niet voor in het huidige driver-manifest.

**Aangetoond gevolg:** Dit pad leest de ingestelde doeltemperatuur niet uit de
juiste capability. Bij `null` of `undefined` breken de methoden expliciet af;
het precieze gedrag van een lookup van een ontbrekende capability is niet in een
live Homey-runtime getest. Om de mismatch vast te stellen, is niet nodig te
weten wat de lookup precies retourneert.

**Aanbevolen actie:** Gebruik de gedeclareerde capability in beide methoden.
Test een situatie met ingeschakelde insights, voldoende confidence, ΔT > 1,5 °C,
geen recente aanbeveling en een geldige τ. Alleen deze naam aanpassen bewijst
nog niet dat de volledige triggerketen werkt: `triggerPreHeatRecommendation()`
blokkeert daarnaast τ buiten 0,5–100 uur. Dat is een aparte consumentenlimiet,
die bijvoorbeeld het passieve profiel met τ = 600 uur uitsluit en moet worden
afstemd op de gekozen modelgrenzen.

**Twee verschillende τ-limieten:** in alle drie de insights-services gebruikt
`detectPreHeatingInsights()` het bereik 0,5–250 uur en
`triggerPreHeatRecommendation()` het bereik 0,5–100 uur. Een model met τ tussen
100 en 250 uur krijgt dus wel een voorverwarmingsinzicht, maar geen trigger. Het
passieve profiel (τ = 600 uur) valt buiten beide. Stem beide limieten af op de
gekozen modelgrenzen uit §2.7 van het hoofddocument.

---

## A2. Oorzaak van de ~1.500 samples "bound-pinning" fase in `updateRLS()`

**Bron:** `updateRLS()` in de
[gedeelde learner](../../lib/shared/adaptive/building-model-learner.ts);
`simulate()` en de convergentietest in
[building-model-learner.test.js](../../test/unit/building-model-learner.test.js).

**Aangetoond mechanisme:** De ongeclipte θ-stap wordt vóór de 5%-rate-limiter
gecontroleerd. Bij een bounds-overtreding herstelt de code de vorige θ en keert
terug voordat P wordt bijgewerkt of begrensd. Dat kan een stap afwijzen die na
begrenzing geldig zou zijn geweest. Componentgewijs clippen verandert bovendien
de richting van de updatevector.

Het commentaar in de convergentietest noemt een fase van circa 1.500 samples
bound-pinning met `P = 100 × I`. Dat volgt niet uit die test. Een herhaling van
precies diens invoerreeks met de huidige learner geeft:

| Grootheid | Resultaat |
|---|---|
| Startprofiel | `light`, λ = 0,999, dynamische P_int uit |
| Gesimuleerde waarheid | C = 15, UA = 0,3, P_int = 0,3 |
| Lengte | 8.000 samples met dezelfde excitatie als de unit-test |
| Eerste wijziging van P | **Sample 2** |
| Totaal aantal reverts | **1.552** over de volledige reeks |
| Eindmodel | C ≈ 15,027; UA ≈ 0,461; P_int ≈ 1,794 |
| Confidence aan het einde | 100% |

Het testcommentaar noemt circa 1.500 samples pinning. De gemeten 1.552 reverts
zijn een totaal over 8.000 samples, geen bewijs van één initiële blokkade van
die duur. Een hoge initiële P maakt de gain ook niet voor elke X automatisch
zeer groot, omdat `XᵀPX` eveneens in de noemer staat. Pas het testcommentaar
aan.

**Te toetsen verbetering:** Onderzoek uniforme schaling van `Δθ = K × error`
vóór de bounds-check, gevolgd door controle van de uiteindelijke θ. Vergelijk
reverts, parameterfouten en onafhankelijke voorspellingen. Het eindresultaat
hierboven laat zien dat een geschikte C en 100% confidence nog geen nauwkeurige
UA en P_int bewijzen. Neem PSD-behoud mee in de P-update; P bij elke afgewezen
stap laten krimpen is geen onderbouwde algemene oplossing.

---

## A3. Thermische correctie gebruikt een heuristische opwarmtijd

**Bron:** `calculateThermalAdjustment()` in de modelservices van
[Tuya](../../lib/tuya/services/building-model-service.ts),
[Aurora II](../../lib/modbus/services/building-model-service.ts) en
[Aurora III](../../lib/aurora3/services/building-model-service.ts).

**Aangetoond:** De methode ontvangt `outdoorTemp`, maar leest die niet. Zij
gebruikt ook geen verwarmingsvermogen voor de opwarmtijd. De relevante stappen
zijn, met `d = targetIndoorTemp − indoorTemp` en `G = totalGains`:

```text
gainCorrection = d > 0.1 ? G / (UA × d) : 0
effectiveTau = (C / UA) / max(1, 1 + gainCorrection)
predictedHours = d > 0.3 ? effectiveTau × ln(d / 0.3) : 0
```

`UA × d` is geen transmissieverlies naar buiten. Dat verlies is
`UA × (T_in − T_out)`. De bestaande correctie kan als heuristiek worden gelezen,
maar vormt geen afleiding van een actieve opwarmtijd. Alleen de temperatuurdelta
in de noemer vervangen herstelt de volledige formule niet. Rond `d = 0,1`
wordt de gain-correctie bovendien uitgeschakeld; zij divergeert niet onbeperkt
bij `d → 0`.

De tijdconstante `τ = C/UA` geldt voor het lineaire 1R1C-model ook bij constant
verwarmingsvermogen. Verwarming en andere constante warmtewinsten verschuiven
het evenwicht, niet deze tijdconstante. Onder constante omstandigheden volgt:

```text
T_eq = T_out + (P_heat + G) / UA
t = τ × ln((T_eq − T_start) / (T_eq − T_doel))
```

Deze eindige opwarmtijd geldt voor `T_eq > T_doel > T_start`. Als het evenwicht
op of onder het doel ligt, wordt dat doel niet in eindige tijd bereikt. Bij
wisselende omstandigheden is een dynamische voorspelling nodig.

**Rekenproef:** Voor C = 15, UA = 0,3, P_int = 0,3, g = 0,5, confidence = 72%,
geen zon en `d = 1,2 °C` leveren alle drie de services dezelfde waarden:

| Tijdvak | Interne warmtewinst | `predictedHours` | Thermische actie |
|---|---|---|---|
| Nacht | 0,12 kW | ≈ 52,0 uur | +0,5 °C |
| Dag | 0,30 kW | ≈ 37,8 uur | +0,5 °C |
| Avond | 0,54 kW | ≈ 27,7 uur | +0,5 °C |

Een wijziging van alleen `outdoorTemp` van −10 naar +15 °C verandert het
resultaat niet. Zonder gain-correctie zou de uitkomst `50 × ln(1,2/0,3) ≈ 69`
uur zijn.

**Waarom de boost-test nauwelijks onderscheid maakt:** Voor `d > 1`,
niet-negatieve gains en de huidige geldige runtime-bounds kan de formule worden
herschreven als:

```text
H = ln(d / 0.3) / (θ[1] + (θ[2] × I_solar + θ[3] × m) / d)
```

Met `I_solar ≤ 1,2 kW/m²`, `m ≤ 1,8`, `θ[2] ≤ 0,16`, `θ[3] ≤ 0,12` en
`θ[1] < 0,16` volgt voor `d > 1` een ondergrens van ongeveer
`ln(1/0,3) / (0,16 + 0,408) ≈ 2,120 uur`. De conditie `predictedHours > 2`
is onder die voorwaarden dus steeds waar. Bij voldoende confidence selecteert
de methode dan +0,5 °C zodra `d > 1 °C`.

Deze conclusie is voorwaardelijk: het adviespad valideert actuele instraling
niet identiek aan de learner, en ongeldige modelwaarden vallen buiten de
afleiding. De +0,5 °C is bovendien een component vóór weging, windcorrectie,
coast en setpointbegrenzing, geen gegarandeerde uiteindelijke aanpassing.

**Aanbevolen actie:** Kies expliciet tussen een benoemde regelheuristiek en een
fysische voorspelling met vermogen en buitentemperatuur. Test bereikbaarheid,
warmtewinsten, doeltemperatuurtolerantie en voorspellingsfout. Stem dit ook af op
de afzonderlijke empirische `preheat-calculator`; een fix hier valideert die
andere voorverwarmtijdschatting niet automatisch.

---

## A4. Modelparameters werken zonder confidence-gate door in PI en prijs

**Bron:** `executeControlCycle()` in de adaptive-control-services van
[Tuya](../../lib/tuya/services/adaptive-control-service.ts),
[Aurora II](../../lib/modbus/services/adaptive-control-service.ts) en
[Aurora III](../../lib/aurora3/services/adaptive-control-service.ts);
`calculateAction()` en setters in de PI-controllers van
[Tuya](../../lib/tuya/adaptive/heating-controller.ts) en
[Modbus](../../lib/modbus/adaptive/heating-controller.ts).

**Aangetoond:** Wanneer de cyclus het modelintegratieblok bereikt, worden
`setThermalInertia(tau)`, `setDynamicDeadbandUA(UA)` en
`setThermalCapacity(C)` zonder confidence- of leerinstellingscheck aangeroepen.
Dit kan dus met profielwaarden bij sample 0 en bij uitgeschakeld leren.
De afzonderlijke thermal-component heeft wel een confidence-gate.

Dit is een ontwerpbeslissing die expliciet moet worden gemaakt. De huidige
setting heet **Enable building model learning**: uitgeschakeld leren hoeft niet
te betekenen dat profielwaarden of een eerder geleerd model nergens meer
gebruikt mogen worden. Een verplichte gate op
`building_model_enabled && confidence >= 50` volgt daarom niet vanzelf uit de
betekenis van de instelling. Ook bewijst 50% confidence geen modelnauwkeurigheid.

### A4.1 Twee afzonderlijke grenzen bij de PI-actie

De effectieve deadband is bij positieve UA:

```text
D = max(0.3, min(0.8, UA × 0.5 + 0.25))
```

Daarnaast wordt bij positief temperatuurtekort en `τ > 0` een overshoot-marge
gebruikt:

```text
M = min(τ, 8) × 0.3 × 0.2
```

Bij `τ ≥ 8 uur` is M = 0,48 °C. Voor de standaardprofielen geldt dat, maar
geleerde modellen kunnen een kleinere τ hebben. Voor `0 < error < 2` blokkeren
beide controles samen een nieuwe PI-actie bij `error < max(D, M)`.

Gerichte proeven met beide controllerimplementaties bevestigen:

| τ | UA | Temperatuurtekort | PI-resultaat |
|---|---|---|---|
| 50 uur | 0,3 | 0,45 °C | Geen actie: overshoot-marge 0,48 °C |
| 50 uur | 1,1 | 0,60 °C | Geen actie: dynamische deadband 0,80 °C |
| 5 uur | 0,05 | 0,35 °C | Wel actie: beide grenzen zijn 0,30 °C |

De laatste twee gevallen testen de controllerinterface, geen door de learner
gevalideerde combinatie van gebouwparameters. Zij weerleggen wel een universele,
permanente deadband van 0,48 °C. Een positieve UA vervangt bovendien de
geconfigureerde deadband door D, ook als de gebruiker een grotere deadband koos.

`return null` betekent dat de PI-component geen nieuwe aanpassing aanbeveelt.
Dit schakelt de warmtepomp niet uit en sluit acties van andere componenten niet
uit. Een blijvende kamertemperatuurafwijking is hiermee niet aangetoond.

### A4.2 Timing en prijsoptimizer

PI en prijsoptimizer berekenen hun actie vóór het doorzetten van modelwaarden
in stap 5B. Daardoor gebruiken zij normaal de waarden van de vorige succesvolle
integratiestap; bij de eerste cyclus hun initiële waarden. Dit betreft meer dan
alleen de PI-overshootcontrole.

De C-afhankelijke prijsboost geldt in `EnergyPriceOptimizer.calculateAction()`
voor de categorie `VERY_LOW` wanneer C > 15. Die doorwerking verandert dus niet
elke prijsactie. Ook daarvoor moet de keuze tussen profiel-, geleerde en
fallbackwaarden worden vastgelegd.

**Aanbevolen actie:** Definieer wanneer welk model mag doorwerken en hoe de
controller terugvalt bij lage confidence, ongeldige state of uitgeschakeld
leren. Bij gating moeten eerder gezette waarden ook expliciet worden hersteld;
alleen setters overslaan laat de oude waarden actief. Test gekozen deadband,
overshoot-marge en cyclusvolgorde met alle componenten samen.

---

## A5. Leerinstellingen worden niet direct toegepast; restore verschilt per veld

**Bron:** constructors, `onSettings()` en `reset()` in de adaptive-control- en
modelservices; `restoreState()` in de
[gedeelde learner](../../lib/shared/adaptive/building-model-learner.ts).

**Aangetoond:** Er zijn geen gerichte `changedKeys`-handlers voor
`building_model_forgetting_factor` en `enable_dynamic_pint` in de onderzochte
instellingenketen. De learner heeft ook geen setters voor λ of dynamische
P_int. De actuele instellingen worden bij constructie en harde modelreset
gelezen, maar bij restore worden zij verschillend behandeld:

| Instelling | Wijziging tijdens bestaande sessie | Na constructie en geldige restore |
|---|---|---|
| `building_model_forgetting_factor` | Geen directe update van bestaande learner | Nieuwe instelling blijft staan; λ wordt niet uit state hersteld |
| `enable_dynamic_pint` | Geen directe update van bestaande learner | Wordt overschreven door `state.enableDynamicPInt ?? false` |

Een gerichte restore-proef bevestigt dit: een nieuwe learner met λ = 0,9995 en
dynamische P_int aan behoudt λ = 0,9995 bij restore van een oudere state, maar
neemt de daarin opgeslagen waarde dynamische P_int uit over. Zonder opgeslagen
state of bij afwijzing van de state geldt dit specifieke overschrijven niet.
Een harde reset leest beide actuele instellingen opnieuw.

Het terugzetten van `enableDynamicPInt` verandert de Homey-setting zelf niet;
het verandert de interne configuratie van de learner. Bij λ moet
ook de in het hoofddocument beschreven VFF-ondergrens worden meegewogen om het
werkelijke effect van een gewijzigde instelling te testen.

**Aanbevolen actie:** Maak actuele instellingen leidend en scheid configuratie
van geleerde state. Gebruik `newSettings` bij runtime-afhandeling. Bepaal of
wijziging van de P_int-multiplier een herijking van θ en P vereist; alleen een
boolean omschakelen kan de betekenis van de geleerde interne warmtewinst
veranderen. Test runtime, geldige/afgewezen restore, ontbrekende legacyvelden
en reset afzonderlijk.

---

## A6. Mijlpaaltrigger herhaalt; diagnostische bijdragen ontbreken

**Bron:** `updateModelCapabilities()` in de drie modelservices,
`triggerSimulationUpdate()` en `updateDiagnosticsCapability()` in de drie
adaptive-control-services, en
[adaptive_simulation_update.json](../../.homeycompose/flow/triggers/adaptive_simulation_update.json).

### A6.1 Mijlpaal is een venstertest, geen drempelpassage

De trigger wordt bij elke capability-update aangeroepen wanneer
`70 ≤ confidence < 75`, zonder registratie van een eerdere passage.
Capability-updates vinden onder meer plaats bij initialisatie, elke tien
samples en iedere geblokkeerde collectieronde. Tijdens een blokkade kan de
confidence gelijk blijven en dezelfde trigger iedere vijf minuten terugkeren.

Een proef met confidence vast op 72% en twee opeenvolgende calls naar
`updateModelCapabilities()` veroorzaakt in elk van de drie services **twee
trigger-aanroepen**. Daarmee is de herhaalbaarheid aangetoond; de gevolgen
hangen af van aangesloten gebruikersflows.

De venstertest kan de mijlpaal ook missen als updates direct van minder dan 70%
naar 75% of hoger gaan. Een eenmalige vlag binnen hetzelfde 70–75%-venster lost
dat niet op.

**Aanbevolen actie:** Detecteer een drempelpassage en definieer herhaling na een
profielwijziging of reset. Leg vast of een reeds bereikte mijlpaal na restore
opnieuw mag vuren en persisteer de gekozen state. Test blokkades, overslaan van
het venster en herstarts.

### A6.2 Thermal en wind ontbreken in twee uitvoerpaden

De beslislogica levert een thermal-bijdrage; wind wordt daarna in
`AdaptiveControlService` toegevoegd. Zij ontbreken vervolgens als afzonderlijke
velden in de diagnostische `breakdown` en als componenttokens in de
simulatie-flowkaart. De oorspronkelijke toeschrijving van alle zes componenten
aan `WeightedDecisionMaker` was daarom niet precies.

**Aanbevolen actie:** Neem beide bijdragen op in de diagnostische JSON. Voor de
flowkaart moeten zowel de trigger-payload als de token-definities worden
uitgebreid; alleen velden aan de TypeScript-payload toevoegen biedt gebruikers
nog geen nieuwe tokens. Valideer de weergave met de uiteindelijke begrenzing,
coast en weging; een beperkte eindaanpassing hoeft niet gelijk te zijn aan de
som van alle ongeclipte bijdragen.

---

## A7. Timer-cleanup en verschillen tussen drivers

**Bron:** `destroy()` in de model- en insights-services;
de Homey-typen (`@types/homey`, `lib/Homey.d.ts`).

**Aangetoond verschil:**

- De Tuya-modelservice wist `updateInterval` via globale `clearInterval()`;
  Aurora II en III gebruiken `this.device.homey.clearInterval()`.
- De drie insights-services gebruiken globale `clearInterval()` voor
  `evaluationTimer` en de optionele `preHeatRecommendationTimer`.
- `evaluationTimer` wordt via `homey.setInterval()` gestart. Voor
  `preHeatRecommendationTimer` is in de huidige insights-service geen actieve
  toewijzing aangetroffen.

De lokale SDK-typen beschrijven `Homey.clearInterval()` als alias van
`clearInterval`. Alleen het gebruik van globale clear bewijst daarom geen
SDK3-schending of timerlek. De repositoryregels eisen Homey-timers bij het
**aanmaken** en cleanup bij vernietiging; aanmaken en wissen moeten afzonderlijk
worden beoordeeld.

**Aanbevolen actie:** Harmoniseer cleanup waar dit de consistentie verbetert en
test dat actieve timers na `destroy()` geen callbacks meer uitvoeren. Test ook
herhaalde initialisatie en fouten tijdens persistentie. De modelservice bewaart
state vóór zij de interval wist; of dit tijdens trage opslag of overlappende
collectie een probleem oplevert, is niet in een live runtime onderzocht.

De doeltemperatuur-mismatch uit A1 is een afzonderlijk functioneel verschil.
Consolidatie vereist daarom adapters voor capabilitynamen én sample-gates,
zoals beschreven in het hoofddocument.

---

## Samenvattende actietabel

De P1-bevindingen voor PSD-behoud en τ-bounds uit het hoofddocument blijven
voorafgaan aan wijzigingen van het leeralgoritme. Onderstaande volgorde betreft
de integratiebevindingen van dit addendum.

| ID | Beoordeling | Aanbevolen actie | Vereiste verificatie |
|---|---|---|---|
| **A1** | Aangetoonde capability-mismatch | Lees `target_temperature.indoor` op beide plekken; trek de τ-limieten (250 en 100 uur) gelijk | Volledige triggerketen met geldige invoer |
| **A5** | Aangetoond verschil tussen actuele configuratie en learner | Runtime-afhandeling en configuratie bij restore expliciet maken | Beide instellingen, legacy-state, restart en reset |
| **A3** | Aangetoond heuristisch opwarmtijdpad | Kies heuristiek of fysische voorspelling met bereikbaarheid | Buitencondities, vermogen, gains en eindweging |
| **A4** | Aangetoonde doorwerking; gewenste gating is ontwerpkeuze | Definieer modelbron, fallback en timing | Deadbands en volledige regellus bij lage confidence en uitgeschakeld leren |
| **A2** | Revert-volgorde bevestigd; geen initiële blokkade van 1.500 samples | Vergelijk uniforme rate-limiting met correcte P-update | Reverts, PSD, parameterfout en onafhankelijke voorspellingen |
| **A6** | Herhaling en ontbrekende uitvoervelden bevestigd | Drempelpassage met gekozen persistentie; JSON én flowtokens aanvullen | Twee calls, blokkades, venstersprong en herstart |
| **A7** | Cleanupconventie verschilt; geen lek aangetoond | Harmoniseer en test levenscyclus | Geen callbacks na destroy en geen dubbele intervallen |

## Verificatiebasis en grenzen

De gerichte proeven zijn uitgevoerd door de huidige TypeScript-bestanden in
het geheugen naar JavaScript te transpileren. Voor services zijn Homey/device,
het model en de zonne-invoer als testdoubles aangeboden. Bij de thermische
berekening zijn de uurvensters afzonderlijk ingesteld. Er is geen appcode
gewijzigd en er zijn geen echte timers of gebruikersflows gestart.

Getoetst zijn de drie thermische correcties en mijlpaalpaden, beide
PI-controllerimplementaties, de bestaande learner-invoerreeks van 8.000 samples
en een restore met afwijkende actuele instellingen. Statische inspectie
onderbouwt capabilitynamen, settings-afhandeling, uitvoervelden en timers.
Deze beoordeling is geen volledige unit-test-, simulatie- of Homey-validatierun.

Voor uitvoering van verbeteringen gelden daarnaast de acceptatiecriteria in
§5 van het [hoofddocument](BUILDING_MODEL_REVIEW.md). Een wijziging moet ook de
hier genoemde driverafhankelijke integratiepaden behouden.
