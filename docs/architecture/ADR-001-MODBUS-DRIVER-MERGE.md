# ADR-001 — Modbus-driver integreren in org.hhi.adlar-heatpump

- **Status**: Voorgesteld (wacht op goedkeuring)
- **Datum**: 2026-08-02
- **Doelversie**: 3.0.0
- **Bron-app**: `org.hhi.adlar-heatpump-modbus` v2.15.0
- **Doel-app**: `org.hhi.adlar-heatpump` v2.13.1 → v3.0.0

## Context

Homey vereist dat de Modbus-app opgaat in de bestaande heatpump-app. Beide apps zijn
zelfstandig ontstaan (geen gedeelde git-historie: 114 vs 352 commits) en overlappen sterk
in capabilities, flow cards en lib-code.

De gebruikersbasis is scheef: circa 90% Tuya, circa 10% Modbus. Modbus vereist externe
hardware (Elfin EW11A of vergelijkbare RS485-TCP-gateway) en heeft daardoor een hogere
drempel.

## Besluit

De Modbus-driver wordt toegevoegd aan `org.hhi.adlar-heatpump` als tweede driver. Het
app-ID `org.hhi.adlar-heatpump` blijft ongewijzigd.

Drie leidende principes:

1. **De 90% raakt niets.** Geen enkel bestaand Tuya-capability-ID, flow-card-ID of
   argumenttype wijzigt. Bestaande Tuya-flows blijven werken zonder tussenkomst.
2. **Conflicten worden gesplitst, niet geharmoniseerd.** Waar Modbus en Tuya structureel
   onverenigbaar zijn krijgt Modbus een `_modbus`-suffix.
3. **Services blijven voorlopig gescheiden.** Alleen de aantoonbaar identieke lib-bestanden
   worden gedeeld. Convergentie van de gedivergeerde services is een aparte, latere stap.

## Uitgangssituatie in cijfers

| | Modbus | Tuya | Gedeeld ID | Structureel conflict |
|---|---|---|---|---|
| Capabilities | 86 | 81 | 71 | **3** |
| Flow actions | 28 | 25 | 23 | 2 (alleen bereik) |
| Flow conditions | 24 | 29 | 24 | 2 (alleen bereik) |
| Flow triggers | 44 | 43 | 42 | **1** |
| Driver settings | 72 | 81 | 48 | 0 (driver-scoped) |
| Gedeelde lib-bestanden | — | — | 31 | 20 gedivergeerd |

Van de 89 gedeelde flow cards zijn er **84 volledig compatibel** — het verschil zit
uitsluitend in de `driver_id`-filter en vertaalteksten. Slechts **5** hebben afwijkende
argumenten, waarvan er **4** met een simpele bereikverbreding op te lossen zijn.

## Ontwerp

### 1. Flow cards — driver_id-filter vervangen

Alle 89 gedeelde cards hebben nu een device-argument met
`"filter": "driver_id=intelligent-heat-pump"`. Twee groepen:

**65 cards met alleen een driver_id-filter** → filter volledig verwijderen.

Een device-argument in een app-flow-card toont per definitie alleen devices van de eigen
app. Met precies twee drivers is "geen filter" functioneel gelijk aan "beide drivers".
Dit vermijdt afhankelijkheid van de pipe-OR-syntax (`driver_id=a|b`), die volgens de
Homey-docs voor `$filter`-waarden werkt maar die we niet in deze omgeving konden valideren.

> **Zwakke plek in dit voorstel.** Van de ruim 200 kaarten in beide apps heeft er
> **geen enkele** een device-argument zonder filter. Er is dus geen precedent in de eigen
> codebase; de app-scoping volgt uit de documentatie, niet uit waarneming. Dit moet vóór
> fase 3 worden getest met één kaart en `homey app validate` plus een visuele controle in
> de Flow-editor. Faalt het, dan is `driver_id=a|b` de terugvaloptie, en pas daarna
> verdergaande maatregelen.

**24 cards met `driver_id=…&capabilities=…`** → alleen het `driver_id`-deel schrappen,
capability-filter behouden:

```diff
- "filter": "driver_id=intelligent-heat-pump&capabilities=adlar_cop"
+ "filter": "capabilities=adlar_cop"
```

Dit is architectonisch de betere scoping: de card verschijnt automatisch bij die driver
die de capability daadwerkelijk heeft. Geen onderhoud bij toekomstige driverwijzigingen.

**4 cards met afwijkend bereik** → unie nemen, runtime-clamp per driver:

| Card | Modbus | Tuya | Wordt |
|---|---|---|---|
| `set_target_temperature` | 15–60, step 1 | 5–75, step 1 | 5–75, step 1 |
| `target_temperature_is` | 15–60, step 1 | 5–60, step 0.5 | 5–60, step 0.5 |
| `set_hotwater_temperature` | 20–75, step 1 | 30–75, step 1 | 20–75, step 1 |
| `hotwater_temperature_is` | 20–75, step 1 | 30–75, step 1 | 20–75, step 1 |

Bereik verbreden is niet-brekend: bestaande opgeslagen argumentwaarden blijven geldig. De
werkelijke grenzen worden per device afgedwongen in de run-listener, tegen de veilige
ranges uit `adlar-modbus-registers.ts` respectievelijk de Tuya-DPS-definities.

> **Let op**: `set_hotwater_temperature` verbreedt de Tuya-ondergrens van 30 naar 20 °C.
> De run-listener moet voor Tuya-devices op 30 blijven clampen, anders schuift een
> gebruiker per ongeluk buiten het DPS-bereik.

**5 nieuwe Modbus-only cards** (geen Tuya-tegenhanger, ongewijzigd overnemen):
`modbus_read_register`, `modbus_write_register`, `set_curve_for_mode`,
`set_diy_heating_curve`, `set_setpoint_for_mode` — allemaal met
`"filter": "driver_id=intelligent-heatpump-modbus"`.

Plus 2 Modbus-only triggers: `inlet_temperature_value_changed`,
`outlet_temperature_value_changed`.

### 2. De vier harde splitsingen

| Conflict | Modbus | Tuya | Nieuw Modbus-ID |
|---|---|---|---|
| `adlar_state_backwater` | `enum` (disable/continuous/cycle/temp_diff) | `boolean` | `adlar_state_backwater_modbus` |
| `adlar_enum_work_mode` | `uiComponent: sensor` | `uiComponent: picker`, `preventInsights` | `adlar_enum_work_mode_modbus` |
| `adlar_enum_capacity_set` | `uiComponent: sensor` | `uiComponent: picker`, `preventInsights` | `adlar_enum_capacity_set_modbus` |
| `fault_detected` (trigger) | token `string` (`"F1.1"`) | token `number` | `fault_detected_modbus` |

`fault_detected` is de enige waar harmonisatie echt uitgesloten was: een flow-token kan
niet tegelijk `string` en `number` zijn, en Tuya-gebruikers die numeriek op de token
vergelijken zouden stilzwijgend breken.

De overige 11 gedivergeerde capabilities verschillen uitsluitend in tekst of in
`insights: true` (4× `heating_curve_*`). Die worden geharmoniseerd:

- Beschrijvingen worden transport-neutraal (nu: "Modbus device connection state" vs
  "Tuya device connection state" → "Heat pump connection state").
- `heating_curve_slope`, `_intercept`, `_ref_temp`, `_ref_outdoor` krijgen
  `insights: true` (niet-brekend, voegt alleen historie toe).

### 2b. Driver-exclusieve flow cards

Vijftien kaarten hebben geen tegenhanger: 8 alleen Tuya, 7 alleen Modbus. Plus
`fault_detected_modbus` uit §2.

**Besluit: die houden hun bestaande `"filter": "driver_id=…"` en veranderen niet.**

```javascript
// blijft precies zoals het is
{ "type": "device", "name": "device",
  "filter": "driver_id=intelligent-heatpump-modbus" }
```

Dit is geen compromis maar de beste optie. Voor een kaart die exclusief is bij één driver
is `driver_id` kort, direct leesbaar, kost nul migratiewerk, en heeft geen randgevallen.
De 15 kaarten hebben dit filter vandaag al — er is niets te doen.

| | Kaarten | Actie |
|---|---|---|
| Tuya-exclusief | 8 | `driver_id=intelligent-heat-pump` — ongewijzigd |
| Modbus-exclusief | 7 | `driver_id=intelligent-heatpump-modbus` — ongewijzigd overnemen |
| `fault_detected_modbus` | 1 | Nieuw, krijgt `driver_id=intelligent-heatpump-modbus` |

> **Correctie op een eerdere versie van deze ADR.** Daarin stond een beslisregel die deze
> kaarten wilde omzetten naar `capabilities=`-filters of verplaatsen naar
> `driver.flow.compose.json`. Dat was overengineering: het verving werkende, leesbare
> configuratie door een constructie die méér uitleg vereist en een extra faalmodus
> introduceert (zie de `addCapability`-waarschuwing hieronder). Voor exclusieve kaarten
> wint `driver_id` op vrijwel elke as.

#### Waar `driver_id` wél tekortschiet

Uitsluitend bij de **88 gedeelde kaarten** uit §1. Daar zijn twee waarden nodig, en dat
vraagt ofwel `driver_id=a|b` (pipe-syntax, niet gevalideerd in deze analyse) ofwel het
filter weglaten. Dat is een ander probleem dan de exclusieve kaarten, en de oplossing ervan
mag niet naar deze paragraaf worden doorgetrokken.

De 24 gedeelde kaarten die al een `capabilities=`-filter hebben behouden dat; daar wordt
alleen het `driver_id`-deel geschrapt. Voor die groep geldt de volgende waarschuwing.

> **Verificatie uitgevoerd — relevant voor de 24 gedeelde kaarten met capability-filter.**
> De Homey-docs waarschuwen: *"note that calls to `addCapability` and `removeCapability`
> don't update this filter"*. De Tuya-driver voegt 15 capabilities runtime toe via
> `addCapability()`. Daarvan staan er **14 ook in `driver.compose.json`** (de aanroepen zijn
> migratiecode voor bestaande devices, geen conditionele functionaliteit). De enige
> uitzondering, `adlar_daily_disconnect_count`, wordt door **geen enkele** flow card als
> filter gebruikt. Veilig — maar te herhalen zodra een capability conditioneel wordt.

#### Eén exclusieve kaart die aandacht vraagt

`cop_calculation_method_is` heeft nu `driver_id=intelligent-heat-pump&capabilities=adlar_cop_method`.
Modbus **heeft** `adlar_cop_method` ook. Zou je hier het `driver_id`-deel schrappen — zoals
bij de gedeelde kaarten gebeurt — dan verschijnt deze Tuya-only conditie ongetest bij
Modbus-devices.

**Actie**: bij het opschonen van filters in fase 3 deze kaart expliciet overslaan. Het
`driver_id`-deel blijft staan. Wil je hem later alsnog voor Modbus openstellen, dan is dat
een aparte, geteste wijziging.

#### Optioneel later: `driver.flow.compose.json`

Homey biedt `drivers/<driver_id>/driver.flow.compose.json` voor device-kaarten die per
definitie alleen bij die driver horen — dan is geen filter nodig. Voordeel is
zelfstandigheid van de driver: verwijder je de driver, dan verdwijnen zijn kaarten mee.

Bewust **niet** in v3.0.0: het verplaatst werkende bestanden zonder functioneel verschil,
en dat botst met het uitgangspunt om fase 1 gedragsneutraal te houden. Kandidaat voor latere
opruiming, samen met de servicesconvergentie.

> Als het ooit gebeurt: kaarten in dat bestand behouden hun letterlijke ID — er is geen
> automatische namespacing. Dat blijkt uit de Homey-conventie voor
> `<capability_id>_changed`-triggers, die exact die ID moeten houden om automatisch te
> vuren. ID's moeten dus app-breed uniek blijven.

#### Twee Modbus-kaarten die technisch ook Tuya zouden kunnen bedienen

`inlet_temperature_value_changed` en `outlet_temperature_value_changed` hebben tokens
`current`/`previous`/`delta` die puur zijn afgeleid van capabilitywaarden — transport-
agnostisch dus, en Tuya heeft de onderliggende temperatuurcapabilities ook.

**Blijven exclusief in v3.0.0.** Promoveren vraagt delta-tracking in de Tuya-device: nieuwe
functionaliteit, geen merge.

Merk op dat Modbus zowel `inlet_temperature_changed` (gedeeld, met drempelargument) als
`inlet_temperature_value_changed` (exclusief, met delta-tokens) heeft. Geen duplicaten maar
twee verschillende kaarten; beide blijven bestaan.

### 3. Eindtotalen na merge

- **99 capabilities** (86 + 81 − 68 gedeeld, incl. 3 splitsingen)
- **105 flow cards** — 30 actions, 29 conditions, 46 triggers
- **2 drivers**: `intelligent-heat-pump`, `intelligent-heatpump-modbus`

### 4. Lib-structuur

Van de 31 gedeelde lib-bestanden zijn er 11 byte-identiek en 20 gedivergeerd — sommige
fors: `service-coordinator.ts` 1022 diff-regels, `flow-card-manager-service.ts` 858,
`adaptive-control-service.ts` 374.

Conform het besluit "voorlopig naast elkaar":

```
lib/
├─ shared/                     ← 11 byte-identieke bestanden, één kopie
│  ├─ curve-calculator.ts
│  ├─ error-types.ts
│  ├─ flow-handler-wrapper.ts
│  ├─ logger.ts
│  ├─ seasonal-mode-calculator.ts
│  ├─ self-healing-registry.ts
│  ├─ time-schedule-calculator.ts
│  ├─ utils/preheat-calculator.ts
│  ├─ adaptive/building-model-learner.ts
│  ├─ adaptive/defrost-learner.ts
│  └─ services/
│     ├─ cop-calculator.ts
│     ├─ rolling-cop-calculator.ts
│     ├─ settings-manager-service.ts
│     └─ weather-forecast-service.ts
├─ tuya/                       ← bestaande lib/, ongewijzigd verplaatst
│  ├─ definitions/adlar-mapping.ts
│  ├─ services/…                (incl. tuya-connection-service.ts)
│  └─ adaptive/…
└─ modbus/                     ← uit de Modbus-app, ongewijzigd overgenomen
   ├─ adlar-modbus-registers.ts
   ├─ adlar-enum-mappers.ts
   ├─ adlar-fault-descriptions.ts
   ├─ modbus-tcp-service.ts
   ├─ modbus-runtime-service.ts
   ├─ adlar2-modbus-service.ts
   ├─ services/…                (incl. modbus-connection-service.ts, dashboard-service.ts)
   └─ adaptive/…
```

`constants.ts` en `types/shared-interfaces.ts` zijn licht gedivergeerd (13 resp. 10 regels)
en zijn de eerste realistische kandidaten om alsnog te convergeren — klein genoeg om in
deze release mee te nemen.

**Bewuste consequentie**: de zes `lib/adaptive/`-bestanden en circa tien services bestaan
tijdelijk dubbel. Dat is de prijs voor een laag regressierisico op de 90%-basis. Zie
"Vervolgstappen".

### 5. app.ts — geen routing nodig

> **Correctie op een eerdere versie van deze ADR.** Daarin stond dat de 19 app-level flow
> cards moesten gaan dispatchen op `device.driver.id` via een `AppFlowCardRouter`. Dat is
> onjuist: `app.ts` is nu al volledig transport-agnostisch.

Meetbaar bewijs: `app.ts` bevat **0** verwijzingen naar `tuya`, `dps` of `adlar-mapping`,
en **0** verwijzingen naar `ServiceCoordinator`. Alle handlers werken uitsluitend via de
Homey Device-API.

De 1366 regels verdelen zich als volgt:

| Regels | Blok | Merge-impact |
|---|---|---|
| 175 | Logging-infrastructuur (`debugLog`, `log`, `error`, `safeStringify`, `getCircularReplacer`) | Geen |
| 78 | `onInit` / `onUninit` | Klein |
| 47 | `initFlowCards` + patroongebaseerde registratie | Geen |
| 262 | `registerComplexConditions` — 4 condities | Filter aanpassen |
| 284 | 4 calculator-actiekaarten | Geen |
| **520** | `registerChangedTriggerRunListeners` — 11 device-triggers | Filter aanpassen |

De omvang komt niet van transportlogica maar van **defensieve boilerplate per handler**:
self-healing-check, argumentvalidatie, debug-logging en een fail-safe `try/catch`. In
`water_flow_rate_check` is van de circa 50 regels er één de eigenlijke logica
(`currentFlowRate > args.flowRate`).

De patroongebaseerde kaarten (`registerPatternBasedCards`, 15 regels) zijn al wél
gefactoriseerd naar `lib/flow-helpers.ts` met `FLOW_PATTERNS`-tabellen. Dezelfde behandeling
toepassen op de 4 complexe condities en 11 triggers zou `app.ts` naar schatting tot onder
de 400 regels terugbrengen — maar dat is opruiming, **geen voorwaarde voor de merge**.

**Wel te doen aan app-zijde**: vijf van de app-level kaarten lezen capabilities die de
Modbus-driver niet heeft. Die moeten een capability-filter krijgen zodat ze niet bij
Modbus-devices verschijnen:

| Card | Leest | Modbus |
|---|---|---|
| `electrical_balance_check` | `measure_current.cur_current` / `.b_cur` / `.c_cur` | afwezig |
| `system_pulse_steps_differential` | `adlar_measure_pulse_steps_*` | afwezig |
| `temperature_differential` | `measure_temperature.temp_top` / `.temp_bottom` | afwezig |
| `water_flow_rate_check` | `measure_water` | **aanwezig** → gedeeld |

### 5a. Risico's van een gedeelde `app.ts`

`app.ts` bevat geen transportlogica (§5), maar deelt wél twee app-brede voorzieningen
tussen beide drivers. Beide vragen een aanpassing.

#### Risico 1 — SelfHealingRegistry is app-breed, niet device-scoped (blokkerend)

`app.ts` roept 41× `selfHealing.trackError(featureName, …)` aan. De registry telt fouten
**per kaartnaam**, niet per device:

```typescript
isFeatureEnabled(featureName: string): boolean {
  return !this.disabledFeatures.has(featureName);   // globale Map
}
```

Drempel: 50 fouten per uur, waarna de feature een uur wordt uitgeschakeld.

Gevolg na de merge: een Modbus-device dat herhaaldelijk faalt op bijvoorbeeld
`water_flow_rate_check` — een gebroken RS485-gateway, een `null`-capability tijdens
reconnect — telt door naar dezelfde teller. Bij 50 fouten wordt de kaart uitgeschakeld
**voor alle devices, inclusief Tuya**. Tien procent van de gebruikers kan daarmee een
functie degraderen voor de andere negentig.

Vandaag bestaat dit risico niet, omdat elke app zijn eigen registry heeft.

**Oplossing** — sleutel uitbreiden met de driver:

```typescript
// nu
this.selfHealing.trackError(featureName, { error });

// wordt
const scope = `${featureName}:${args.device.driver.id}`;
this.selfHealing.trackError(scope, { error });
```

Kleine wijziging, maar op 41 plaatsen, en `isFeatureEnabled()` moet dezelfde sleutel
gebruiken. Alternatief is scopen op device-ID; dat isoleert scherper maar laat de
Map groeien met het aantal devices.

Dit is **geen optionele verbetering**: zonder deze wijziging introduceert de merge een pad
waarlangs Modbus-storingen de Tuya-basis raken. Opgenomen als fase 5.

#### Risico 2 — gedeelde procesbrede error handlers (te accepteren)

`app.ts` registreert `process.on('unhandledRejection')` en `process.on('uncaughtException')`.
Beide apps doen dit vandaag al, dus het mechanisme verandert niet — wel de blast radius: een
onafgevangen `jsmodbus`-socketfout draait nu in hetzelfde proces als de Tuya-devices.

Geen structurele oplossing binnen één Homey-app; wel te beperken door de foutafhandeling in
`modbus-tcp-service.ts` te controleren op paden die een rejection kunnen laten ontsnappen.
Te verifiëren in fase 7 met een moedwillig afgebroken gateway-verbinding.

#### Risico 3 — app-level kaarten evalueren door tijdens een disconnect (bestaand, verbreedt)

Dit bestaat **vandaag al** en wordt door de merge niet veroorzaakt — wel verbreed.

`app.ts` bevat **nul** guards op verbindingsstatus. Geen enkele handler raadpleegt
`getAvailable()`, `adlar_connection_active` of `adlar_connection_status` voordat hij
evalueert. Twee faalmodi volgen:

**Modus A — stale waarden.** Bij een disconnect roept de Tuya-service `setUnavailable()`
aan, maar capabilities worden niet genulld: ze houden hun laatst bekende waarde. Condities
evalueren dus stellig op bevroren data, zonder waarschuwing.

**Modus B — `null` wordt `0`.** Waar een capability wél `null` is:

```typescript
const flowRateIsNull = rawFlowRate === null || rawFlowRate === undefined;
const currentFlowRate = rawFlowRate || 0;      // null -> 0
…
if (flowRateIsNull) { this.debugLog(…); }      // alleen loggen
return currentFlowRate > args.flowRate;         // en tóch evalueren
```

De code *detecteert* de `null`, logt hem, en rekent er vervolgens mee. `trackError()` wordt
hierbij **niet** aangeroepen — de SelfHealingRegistry is blind voor deze klasse.

**De faalrichting is bovendien inconsistent:**

| Kaart | Bij `null` → `0` | Uitkomst |
|---|---|---|
| `water_flow_rate_check` | `0 > drempel` | `false` — fail-closed. De geïnverteerde variant vuurt juist wél |
| `temperature_differential` | `0 − 0 = 0` | Elke conditie "verschil onder X" wordt `true` |
| `electrical_balance_check` | gemiddelde van drie nullen | `Math.abs(0−0) <= tolerantie` × 3 → **`true` = "in balans"** |

Dat laatste is het scherpst: een volledig dood device rapporteert een **gezonde
elektrische balans**. Een diagnostische kaart die fail-open gaat.

Daarbij slikt `|| 0` ook een legitieme nul: "0 A" en "geen data" zijn niet te onderscheiden.

**Waarom de merge dit verbreedt.** De Modbus-driver hangt aan externe hardware (EW11A-gateway)
en heeft daarmee een eigen, waarschijnlijk frequenter disconnect-profiel. Bovendien
verschillen de beschikbaarheidssemantiek: Tuya roept 7× `setUnavailable()` aan, Modbus 3×,
en Modbus hanteert een grace period (ADR-042) vóórdat het device op onbeschikbaar gaat.
Twee verschillende beschikbaarheidsmodellen voeden straks dezelfde guard-loze handlers.

**Voorstel** — kies bewust tussen stil verkeerd antwoord en zichtbaar falen:

```typescript
// nu: stil verkeerd antwoord
const currentFlowRate = rawFlowRate || 0;

// voorstel: zichtbaar falen, flow stopt
if (rawFlowRate === null || rawFlowRate === undefined) {
  throw new Error(`${featureName}: geen meetwaarde beschikbaar (device offline?)`);
}
```

Een afgewezen conditie stopt de flow in plaats van stilzwijgend de `false`-tak te nemen.
Voor een warmtepompdiagnose is dat de juiste keuze. Alternatief is een expliciete guard
`if (!device.getAvailable()) throw …` aan het begin van elke handler.

> **Te verifiëren**: of Homey conditiekaarten op een `setUnavailable()`-device überhaupt nog
> laat evalueren. De documentatie gaf hier geen uitsluitsel. Blokkeert Homey dit al, dan is
> Modus A minder ernstig — Modus B blijft hoe dan ook staan voor devices die wél beschikbaar
> zijn maar een enkele `null`-capability hebben.

Omvang: 8 `getCapabilityValue`-aanroepen in `app.ts`, verdeeld over 4 complexe condities.
Beperkt werk, maar het raakt gedrag dat gebruikers in bestaande flows merken — daarom een
expliciet besluit waard en niet stilzwijgend meenemen.

#### Risico 4 — run-listeners sluiten over `this.device` op app-brede kaart-singletons (bestaand, ernstig)

De zwaarste vondst van deze analyse. Bestaat vandaag al; de merge maakt hem
transport-overschrijdend.

**De constructie.** `FlowCardManagerService` wordt **per device** geïnstantieerd
(`this.device = options.device`), via `ServiceCoordinator`, die op zijn beurt per device in
`device.ts` wordt aangemaakt. Die service registreert vervolgens run-listeners op
**app-brede kaart-singletons**:

```typescript
const targetTempListener = targetTempCard.registerRunListener(async (args) => {
  const currentValue = this.device.getCapabilityValue('target_temperature') || 0;
  //                   ^^^^^^^^^^^ het device uit de closure, niet args.device
  const targetValue = args.temperature || 0;
  …
});
```

De handler leest `this.device` — het device dat toevallig registreerde — en negeert
`args.device`, het device dat de gebruiker in de kaart heeft gekozen.

**Meting:**

| | Tuya | Modbus |
|---|---|---|
| `registerRunListener`-sites | 30 | 45 |
| Handlers die `args.device` gebruiken | **0** | 4 |
| Registratie-guard aanwezig | **nee** | **nee** |

De Homey SDK-documentatie beschrijft `registerRunListener(listener)` als *"Register a
listener"* — enkelvoud, één per kaart. Opnieuw registreren vervangt dus.

**Gevolg vandaag, bij twee warmtepompen van dezelfde driver:** het tweede device dat
initialiseert overschrijft alle 30 listeners. Vanaf dat moment werken álle kaarten op device
B, ook wanneer de gebruiker device A heeft geselecteerd. Vermoedelijk onzichtbaar gebleven
omdat de meeste gebruikers één warmtepomp hebben.

**Gevolg na de merge:** de fout wordt transport-overschrijdend. Initialiseert een
Modbus-device ná een Tuya-device, dan kapen de Modbus-listeners de 88 gedeelde kaarten. Een
Tuya-gebruiker krijgt dan condities die de Modbus-waarden lezen — en acties die naar de
verkeerde warmtepomp schrijven.

**Waar het probleem níét zit** — twee registratiepaden doen het wel goed:

- `app.ts` (19 kaarten): `const { device } = args;` ✓
- `lib/flow-helpers.ts` `registerSimpleActions` (11 kaarten):
  `device.triggerCapabilityListener(…)` op `args.device` ✓

Uitsluitend `flow-card-manager-service.ts` is aangetast — 75 handlers over beide apps.

**Oplossing.** De handlers moeten `args.device` gebruiken in plaats van `this.device`, en de
registratie moet eenmalig gebeuren (driver- of app-niveau) in plaats van per device.

Gunstige omstandigheid: **alle** flow cards in beide apps hebben een device-argument in het
manifest — er is geen enkele kaart waarvoor het doeldevice moet worden geraden. Bij twee
kaarten (`force_insight_analysis`, `generate_performance_report`) negeert de handler dat
argument nu volledig (`registerRunListener(async () => …)`); ook daar is `args.device`
gewoon beschikbaar. Fase 0 is daarmee een mechanische vertaling, geen ontwerpvraagstuk.

**Sequencing.** Dit hoort **vóór** de merge, in de huidige Tuya-app, als aparte release. Dan
is de correctie in isolatie te valideren tegen de 90%-basis, zonder vermenging met
merge-effecten. Opgenomen als fase 0.

> Merk op dat dit ook de aanname onder §5b nuanceert. Polymorfisme via
> `device.triggerCapabilityListener()` dispatcht correct — maar alléén wanneer het device uit
> `args` komt. Doet een handler dat niet, dan is er geen dispatch maar een vaste binding aan
> het device dat het laatst registreerde.

#### Wat géén probleem is

De 19 kaartregistraties in `app.ts` zelf, de logging-infrastructuur en de vier
rekenkaarten zijn transport-neutraal en vragen geen wijziging. Zie §5 en §5b.

Notificatie-throttling (`NOTIFICATION_THROTTLE_MS`, 30 minuten) loopt via
`this.lastNotificationTime` op de per-device connectieservice en is dus al device-scoped —
geen verstrengeling.

### 5c. Volledige inventaris van gedeelde app-oppervlakken

De risico's in §5a zijn stuk voor stuk gevonden door gerichte vragen. Deze paragraaf loopt
in plaats daarvan **alle** app-scoped oppervlakken van een Homey-app systematisch af, zodat
de lijst aantoonbaar volledig is in plaats van incrementeel gegroeid.

Alles wat niet per device of per driver is, wordt na de merge gedeeld tussen beide drivers.

#### Homey SDK — app-scoped managers

| Oppervlak | Gebruik (Tuya / Modbus) | Status |
|---|---|---|
| `homey.flow` — kaart-singletons | 30 / 45 listeners | 🔴 **Risico 4** + ID-naamruimte §1/§2b |
| `homey.drivers.getDriver(ID)` | 1 / 2 | 🔴 **Nieuw — zie hieronder** |
| `homey.i18n` / `homey.__()` | 22 / 9 | 🟡 Gedeelde locale-sleutelruimte; sleutels moeten uniek of bewust gedeeld zijn |
| `homey.images.createImage()` | 1 / 0 | 🟡 Alleen `heating-curve-visualization-service` (Tuya-only). Per device aangemaakt — image-ID-uniciteit verifiëren |
| `homey.notifications` | 4 / 2 | 🟢 Throttle via per-device `lastNotificationTime` |
| `homey.settings` (app-brede sleutels) | **0 / 0** | 🟢 Niet gebruikt — geen sleutelbotsing mogelijk |
| `homey.insights` | 0 / 0 | 🟢 Niet direct gebruikt; Insights lopen via capability-ID's → gedekt door §2 |
| `homey.clock` | 2 / 0 | 🟢 Alleen lezen |
| `homey.cloud`, `homey.discovery`, `homey.ledring`, `homey.api` | 0 / 0 | 🟢 Ongebruikt |

#### Proces- en moduleniveau

| Oppervlak | Bevinding | Status |
|---|---|---|
| `process.on('unhandledRejection' \| 'uncaughtException')` | Eén set handlers voor beide transports | 🟡 **Risico 2** |
| `let flowLoggingEnabled` in `flow-handler-wrapper.ts` | Module-brede vlag. Bestand is byte-identiek en gaat naar `lib/shared/` → **één vlag voor beide drivers** | 🔴 **Nieuw — zie hieronder** |
| `static` velden op `AdlarMapping` | Read-only lookup-tabellen, geen mutatie | 🟢 |
| `const SCOP_SUPPORTED_METHODS = new Set(…)` | Read-only | 🟢 |
| Dubbel geladen transportbibliotheken | `tuyapi` + `jsmodbus` altijd in geheugen | 🟡 §7 lazy require |

#### Eigen app-singletons

| Oppervlak | Status |
|---|---|
| `SelfHealingRegistry` | 🔴 **Risico 1** — feature-naam zonder driver-scope |
| `DashboardService` (HTTP-poort) | 🟡 §6 — conditioneel starten |
| Widget `adlar-live-operation` | 🔴 **Nieuw — zie hieronder** |
| `Logger` | 🟢 App-niveau + per-device log level |

#### Manifest-naamruimten

| Oppervlak | Status |
|---|---|
| Capability-ID's | 🟡 §2 — 3 splitsingen |
| Flow-card-ID's | 🟡 §1, §2b |
| Driver settings-sleutels | 🟢 Driver-scoped; 48 overlappend zonder conflict |
| `/assets` | 🟢 55 gelijknamige bestanden, **0 inhoudelijk verschillend** |
| `energy`-object op driverniveau | 🔴 **Nieuw — zie hieronder** |

---

#### Nieuw risico 5 — widget is hard gekoppeld aan één driver

`widgets/adlar-live-operation/api.js` roept `homey.app.getAdlarLiveOperationWidgetState()`
aan, en die resolvet als volgt:

```typescript
private _getAdlarDevices(): LiveOperationWidgetDevice[] {
  return this.homey.drivers
    .getDriver(ADLAR_DRIVER_ID)        // hardcoded op één driver
    .getDevices() as LiveOperationWidgetDevice[];
}
```

Widgets zijn app-scoped, drivers niet. Na de merge toont deze widget uitsluitend devices van
de driver in `ADLAR_DRIVER_ID`. Voor een Tuya-only gebruiker — 90% — betekent dat "Geen
Adlar warmtepomp gekoppeld", terwijl er wel degelijk een pomp is.

**Oplossing**: over beide drivers itereren, of de driver afleiden uit het meegegeven
`deviceId`. `_findAdlarDevice()` matcht al op device-ID, dus de resolver hoeft alleen zijn
kandidatenlijst te verbreden.

#### Nieuw risico 6 — `flowLoggingEnabled` is een module-brede vlag

```typescript
// lib/flow-handler-wrapper.ts — byte-identiek in beide apps
let flowLoggingEnabled = false;
```

Ingeschakeld via `enableFlowCardLogging(this.homey, …)` in `app.ts` (regel 197). Zolang de
apps gescheiden zijn heeft elke app zijn eigen module-instantie. Na de merge — en juist
omdat dit bestand byte-identiek is en dus naar `lib/shared/` gaat — is er nog één vlag voor
beide drivers.

Impact is beperkt (alleen logging), maar het is precies het patroon dat schuilgaat achter
"dit bestand is identiek, dus veilig te delen". Byte-gelijkheid zegt niets over de vraag of
gedeelde *state* correct is.

**Actie**: bij het samenvoegen van `lib/shared/` elk bestand niet alleen op gelijkheid maar
ook op module-level mutable state controleren. Dit is het enige geval in de 11 identieke
bestanden, maar de controle hoort in het proces.

#### Nieuw risico 7 — asymmetrisch `energy`-object

| Driver | `energy` |
|---|---|
| `intelligent-heat-pump` | `{ "approximation": { "usageConstant": 2500 } }` |
| `intelligent-heatpump-modbus` | *afwezig* |

Beide drivers hebben `class: "heatpump"`. Homey Energy gebruikt `approximation` om verbruik
te schatten wanneer er geen `measure_power` is. Na de merge staan twee drivers met dezelfde
klasse maar verschillend energiegedrag naast elkaar in één app — Modbus-devices verschijnen
dan niet of anders in het Energy-overzicht.

Dit is geen merge-fout maar een bestaande inconsistentie die door de merge zichtbaar en
vergelijkbaar wordt. **Actie**: bepalen of de Modbus-driver hetzelfde `approximation`-object
moet krijgen, of dat hij `measure_power` levert en de benadering juist niet nodig heeft.

---

#### Reflectie op de methode

De risico's 1 t/m 4 zijn gevonden door achtereenvolgende gerichte vragen, niet door één
systematische sweep. Dat is een tekortkoming in de aanpak geweest: bij een merge van twee
apps is "wat is app-scoped en dus straks gedeeld?" de eerste vraag die uitputtend beantwoord
moet worden, niet de laatste.

Deze paragraaf is de correctie. Bij toekomstige driver-toevoegingen is deze tabel het
startpunt.

### 5b. Waarom een gedeelde flow card werkt bij twee transports

De centrale vraag: als één card één run-listener heeft, hoe kan die dan zowel een
Modbus- als een Tuya-device bedienen?

Antwoord: **de handler raakt het transport niet aan.** Er zijn precies drie soorten
app-level kaarten, en geen ervan heeft dispatch nodig.

**1. Leeskaarten** — condities en triggers lezen een capability:

```typescript
const rawFlowRate = device.getCapabilityValue('measure_water');
return (rawFlowRate ?? 0) > args.flowRate;
```

Het transportspecifieke werk is dan al gebeurd: `applyModbusSnapshot()` heeft register
`0x00xx` gedecodeerd, respectievelijk de DPS-mapping heeft datapoint 39 geschaald. Wat in
`measure_water` staat is een getal in l/min — identiek van herkomst-onafhankelijke vorm.

**2. Schrijfkaarten** — `registerSimpleActions` in `lib/flow-helpers.ts` roept de
capability-listener van het device aan:

```typescript
await device.triggerCapabilityListener(pattern.capabilityName, value, {});
```

Hier zit de dispatch, en wel via polymorfisme: `intelligent-heat-pump/device.ts` heeft een
listener op `target_temperature` die een Tuya-DPS-write doet;
`intelligent-heatpump-modbus/device.ts` heeft een listener op dezelfde capability die een
Modbus FC06-write doet. De flow-card-handler kiest niet — het device weet het zelf.

**3. Rekenkaarten** — `calculate_curve_value`, `calculate_linear_heating_curve`,
`calculate_time_based_value`, `get_seasonal_mode`: pure functies zonder device-argument.
Niets te dispatchen.

De capability is dus de abstractielaag, en `"filter": "capabilities=adlar_cop"` betekent
letterlijk: *toon deze kaart bij elk device dat een COP-waarde publiceert, ongeacht hoe die
tot stand kwam.* Dat is precies de bedoelde semantiek.

**Waar het niet opgaat.** Twee gevallen die daarom expliciet buiten deze aanpak vallen:

- Kaarten waarvan de capability structureel verschilt — de drie splitsingen uit §2. Bij
  `adlar_state_backwater` (enum vs boolean) is de waarde zélf niet hetzelfde type, dus daar
  helpt de abstractie niet en splitsen we.
- Kaarten die een driver-specifieke service aanroepen in plaats van een capability —
  `modbus_read_register` en `modbus_write_register`. Die blijven Modbus-only met een
  `driver_id`-filter.

Deze twee uitzonderingen zijn precies waarom de 31 (Tuya) respectievelijk 46 (Modbus)
kaarten in `flow-card-manager-service.ts` per driver geregistreerd blijven, en niet naar
app-niveau gaan.

### 6. App-level voorzieningen die conditioneel moeten worden

| Voorziening | Herkomst | Actie |
|---|---|---|
| `dashboard-service.ts` (HTTP-server op instelbare poort) | Modbus | Alleen starten als er ≥1 Modbus-device gepaird is |
| Widget `adlar-live-operation` | Modbus | Moet lege staat tonen als er geen Modbus-device is |
| `public/dashboard*.html` (3 dashboards) | Modbus | Meeverhuizen, achter dezelfde conditie |

### 7. Dependencies

Union: `tuyapi` + `ajv` + `jsmodbus`. Geen versieconflicten.

Beide transportbibliotheken worden nu altijd geladen, ook bij een gebruiker met maar één
devicetype. Aanbeveling: lazy `require()` van `jsmodbus` in `modbus-tcp-service.ts` en van
`tuyapi` in `tuya-connection-service.ts`, zodat de niet-gebruikte stack niet in het geheugen
komt.

### 8. Overig

- **Locales**: Modbus heeft alleen `en`/`nl`; de doel-app heeft `en`/`nl`/`de`/`fr`. De
  Modbus-strings hebben `de`/`fr` nodig. In de compose-bestanden zitten de vertalingen
  al inline; alleen `locales/de.json` en `locales/fr.json` moeten worden aangevuld.
- **Driver settings**: 48 van 72/81 sleutels overlappen, maar settings zijn driver-scoped.
  Geen conflict, ongewijzigd overnemen.
- **Pairing**: aparte templates (`enter_device_info.html` vs `enter_modbus_info.html`),
  geen conflict.
- **Capability-migratie**: de bestaande Tuya-devices krijgen geen nieuwe capabilities, dus
  geen migratiecode nodig aan Tuya-zijde. De Modbus-driver is nieuw; alle devices worden
  vers gepaird.

## Fasering

| Fase | Inhoud | Verifieerbaar resultaat |
|---|---|---|
| **0** | **Vóór de merge, aparte release**: run-listeners in `flow-card-manager-service.ts` omzetten naar `args.device`, registratie eenmalig maken (§5a risico 4) | Twee gepairde Tuya-devices bedienen elk hun eigen kaarten |
| 1 | `lib/` herstructureren naar `shared/` + `tuya/`, imports bijwerken | `npm run build` + `homey app validate` groen, gedrag identiek aan v2.13.1 |
| 2 | `lib/modbus/` toevoegen, driver-map + compose-bestanden overnemen | Build groen, Modbus-driver zichtbaar bij pairing |
| 3 | De 89 gedeelde flow cards ontdubbelen (filters aanpassen) | `app.json` bevat 105 cards, geen dubbele ID's |
| 4 | De 4 splitsingen doorvoeren + 11 capabilities harmoniseren | 99 capabilities, validate groen |
| 5 | SelfHealingRegistry per driver scopen (§5a) + filters op de 4 Tuya-only app-level kaarten | Modbus-fouten degraderen geen Tuya-functies |
| 6 | Widget over beide drivers (§5c risico 5), `flowLoggingEnabled` scopen (risico 6), `energy`-object gelijktrekken (risico 7), dashboard conditioneel, locales aanvullen, lazy requires | Widget toont Tuya-devices; `homey app validate -l debug` groen |
| 7 | Regressietest op fysieke hardware, beide transports | Handmatige acceptatie |

Fase 1 is de belangrijkste veiligheidsklep: die moet aantoonbaar gedragsneutraal zijn
vóórdat er Modbus-code binnenkomt.

## Gevolgen

### Voor Tuya-gebruikers (circa 90%)

Geen actie. Geen gewijzigde capability-ID's, geen gewijzigde flow-card-ID's, geen
gewijzigde argumenttypes. Bereikverbreding op vier cards is achterwaarts compatibel.

Enige zichtbare wijziging: vier `heating_curve_*`-capabilities krijgen Insights-historie.

### Voor Modbus-gebruikers (circa 10%)

Eenmalige harde migratie. Homey kent geen cross-app device-migratie, dus:

1. Devices opnieuw pairen in `org.hhi.adlar-heatpump`
2. Alle flows opnieuw opbouwen
3. Alle 72 device-settings opnieuw invullen
4. Insights-historie gaat verloren

Aanbevolen begeleiding:

- Laatste release van `org.hhi.adlar-heatpump-modbus` met een changelog-melding die naar de
  nieuwe app verwijst
- Migratiehandleiding in `docs/setup/`
- Aankondiging in beide community-topics (143690 en 154741)
- Overweeg een export/import van device-settings als JSON om stap 3 te verlichten

### Voor onderhoud

Winst: één release, één changelog, één validatiecyclus, één community-topic.

Kosten: circa 16 lib-bestanden bestaan tijdelijk dubbel. Een bugfix in bijvoorbeeld
`adaptive-control-service.ts` moet nog steeds op twee plekken. Dit is bewust uitgesteld,
niet opgelost.

## Vervolgstappen (buiten scope van v3.0.0)

1. `constants.ts` en `shared-interfaces.ts` convergeren (klein: 13 en 10 diff-regels)
2. `AbstractServiceCoordinator` introduceren met twee subclasses
3. De vier zwaarst gedivergeerde services convergeren achter een `TransportAdapter`:
   `adaptive-control-service`, `building-model-service`, `energy-tracking-service`,
   `flow-card-manager-service`
4. `deprecated: true` overwegen op de Modbus-only cards die na convergentie overbodig zijn

## Openstaande verificatie

Vóór implementatie lokaal te bevestigen met de Homey CLI (niet mogelijk in de
analyseomgeving — geen npm-netwerktoegang):

1. Valideert een device-argument zónder `filter` naar verwachting, en toont het inderdaad
   alleen devices van de eigen app? (Docs impliceren ja; fallback is expliciete pipe-OR.)
2. Accepteert `homey app validate` twee drivers die dezelfde app-level flow card delen?
3. Werkt `"filter": "driver_id=a|b"` als de filterloze variant onverhoopt te breed blijkt?

## Afwegingen die zijn verworpen

- **Twee apps met gedeelde npm-library.** Technisch de beste prijs-kwaliteitverhouding
  (geen migratie, geen ID-conflicten), maar Homey staat het niet toe.
- **Merge onder het Modbus-app-ID.** Zou 90% van de gebruikers dwingen te migreren in
  plaats van 10%.
- **Harmoniseren in plaats van splitsen.** Schonere naamruimte, maar `fault_detected` zou
  bestaande Tuya-flows met numerieke tokenvergelijking stilzwijgend breken.

---

## Bijlage — Vragen en antwoorden tijdens het ontwerp

Vastgelegd omdat de antwoorden tot een correctie op deze ADR hebben geleid, en omdat de
onderliggende redenering bepaalt of het ontwerp houdbaar is.

### V1 — Waarin is of blijft `app.ts` zo omvangrijk?

**Niet in transportlogica.** Meting op de bestaande `app.ts` (1366 regels):

| Zoekterm | Treffers |
|---|---|
| `tuya`, `dps`, `adlar-mapping` | 0 |
| `ServiceCoordinator`, `getService` | 0 |
| `getCapabilityValue` | 8 |
| `registerRunListener` | 19 |

`app.ts` is dus nu al volledig transport-agnostisch: alle handlers werken uitsluitend via
de Homey Device-API.

De omvang komt van **defensieve boilerplate per handler** — self-healing-check,
argumentvalidatie, debug-logging en een fail-safe `try/catch`. In `water_flow_rate_check`
is van circa 50 regels er precies één de eigenlijke logica:

```typescript
const result = currentFlowRate > args.flowRate;
```

Verdeling: 175 regels logging-infrastructuur, 78 lifecycle, 47 registratie, 262 voor vier
complexe condities, 284 voor vier rekenkaarten, en 520 voor elf device-triggers.

De patroongebaseerde kaarten zijn al gefactoriseerd naar `lib/flow-helpers.ts` met
`FLOW_PATTERNS`-tabellen; `registerPatternBasedCards` is daardoor maar 15 regels. Dezelfde
behandeling toepassen op de vier condities en elf triggers brengt `app.ts` naar schatting
onder de 400 regels.

**Conclusie**: opruiming, geen merge-voorwaarde. Bewust buiten scope van v3.0.0 gehouden om
fase 1 gedragsneutraal te kunnen bewijzen.

**Correctie die hieruit volgde**: een eerdere versie van deze ADR stelde dat de 19
app-level kaarten moesten gaan dispatchen op `device.driver.id` via een
`AppFlowCardRouter`. Dat probleem bestaat niet. Fase 5 is teruggebracht tot het zetten van
capability-filters op vier kaarten.

### V2 — Kaarten met `"filter": "capabilities=adlar_cop"` komen toch bij beide drivers voor, met een totaal verschillende afhandeling. Hoe werkt dat?

De afhandeling verschilt niet. **De capability is de abstractielaag**, en het
transportspecifieke werk is al gebeurd vóórdat de handler draait.

Drie soorten app-level kaarten, geen ervan heeft dispatch nodig:

**Leeskaarten** lezen een capabilitywaarde:

```typescript
const rawFlowRate = device.getCapabilityValue('measure_water');
return (rawFlowRate ?? 0) > args.flowRate;
```

Op dat moment heeft `applyModbusSnapshot()` het register al gedecodeerd, respectievelijk
heeft de DPS-mapping datapoint 39 al geschaald. Wat in `measure_water` staat is een getal
in l/min zonder herkomst.

**Schrijfkaarten** dispatchen via polymorfisme. `registerSimpleActions` in
`lib/flow-helpers.ts` doet:

```typescript
await device.triggerCapabilityListener(pattern.capabilityName, value, {});
```

`intelligent-heat-pump/device.ts` heeft een listener op `target_temperature` die een
Tuya-DPS-write doet; `intelligent-heatpump-modbus/device.ts` heeft een listener op dezelfde
capability die een Modbus FC06-write doet. De kaart kiest niet — het device weet het zelf.

**Rekenkaarten** (`calculate_curve_value`, `calculate_linear_heating_curve`,
`calculate_time_based_value`, `get_seasonal_mode`) hebben geen device-argument.

`"filter": "capabilities=adlar_cop"` betekent dus letterlijk: *toon deze kaart bij elk
device dat een COP-waarde publiceert, ongeacht hoe die tot stand kwam.*

**Waar het niet opgaat** — en daarom expliciet uitgezonderd:

- Capabilities waarvan het waardetype verschilt (`adlar_state_backwater`: enum vs boolean).
  Daar helpt de abstractie niet → splitsen, zie §2.
- Kaarten die een driver-specifieke service aanroepen in plaats van een capability
  (`modbus_read_register`, `modbus_write_register`) → Modbus-only met `driver_id`-filter.

Dat is precies waarom de 31 (Tuya) en 46 (Modbus) kaarten in
`flow-card-manager-service.ts` per driver geregistreerd blijven.

### V3 — Betekent dit dat we gedeelde kaarten gaan krijgen?

Ja. Waar nu twee losse definities staan met hetzelfde ID, komt één definitie, één ID, één
run-listener, zichtbaar bij devices van beide drivers.

```diff
  {
    "id": "cop_efficiency_check",
    "args": [
      { "type": "device", "name": "device",
-       "filter": "driver_id=intelligent-heat-pump&capabilities=adlar_cop"
+       "filter": "capabilities=adlar_cop"
      },
```

| Categorie | Aantal |
|---|---|
| Gedeeld (beide drivers) | 88 |
| Alleen Tuya | 8 |
| Alleen Modbus | 7 |
| Gesplitst (`fault_detected` + `_modbus`) | 2 |
| **Totaal in `app.json`** | **105** |

Een Tuya-gebruiker ziet er circa 97, een Modbus-gebruiker circa 92. Geen enkele
Tuya-gebruiker merkt iets: de ID's en argumenten van die 88 blijven identiek aan v2.13.1.

Dit is geen exotische constructie maar hoe Homey-apps met meerdere drivers standaard
werken — een app met vijf lampdrivers heeft ook één "zet aan"-kaart, niet vijf.

**Twee aandachtspunten.**

Gedeelde kaart is gedeelde impact: een toekomstige argumentwijziging raakt beide drivers
tegelijk.

De listener moet een `null`-capability van beide kanten verdragen. De bestaande code doet
dat al — de `?? 0`-fallback met aparte debug-tak in `water_flow_rate_check` is precies dat
patroon. Bij een Modbus-device dat nog niet gepolld heeft is `null` een normale toestand.

**Onderbouwing dat dit veilig is**: de 71 overlappende capabilities zijn structureel
vergeleken op `type`, `units`, `decimals`, `min`, `max` en `step`. Daar zaten geen
verschillen; de enige afwijkingen waren `uiComponent`, `insights` en beschrijvende tekst.
Een gedeelde kaart leest aan beide kanten dezelfde eenheid en schaal. Zonder die uitkomst
was dit voorstel niet verantwoord geweest.
