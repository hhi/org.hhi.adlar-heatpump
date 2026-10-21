# ADR-005 — Convergentie van de Modbus-codebases (Aurora II en Aurora III)

- **Status**: Voorgesteld
- **Datum**: 2026-10-19
- **Doelversie**: 3.3.0 (voorlopig)
- **Voorgangers**: [ADR-004](ADR-004-AURORA3-DRIVER-MERGE.md) (vervolgstappen 1
  en 2), [ADR-001](ADR-001-MODBUS-DRIVER-MERGE.md) (§5a risico 4)
- **Gemeten tegen**: `feature/aurora3-merge` op `beacecf` (v3.2.0, fasen 0–6
  van ADR-004 gecommit, hardware-acceptatie nog open)
- **Bronnen van de fork**: Aurora II `org.hhi.adlar-heatpump-modbus` (tot en met
  2.15.1, `10d1d04`), Aurora III `org.hhi.adlar3-heatpump-modbus` v1.9.4
  (`58e010a`)

## Samenvatting voor de eigenaar

- **Omvang.** 18 bestanden bestaan in `lib/modbus/` én `lib/aurora3/`, samen
  13.975 regels aan Aurora III-zijde. 11 daarvan verschillen minder dan 60
  regels; vaak gaat het alleen om importpaden, registernamen in
  commentaar of één capability-ID. De echte verschillen zitten in vijf
  bestanden: dashboard, flow-card-manager, service-coordinator, widget-state en
  de TCP-laag. Schatting: 11.000–12.000 regels hoeven daarna niet meer dubbel
  onderhouden te worden.
- **Een bug die nu al speelt, buiten deze convergentie.** 15 van de 17
  drempeltriggers van Aurora II (`*_alert_modbus`,
  `ambient_temperature_changed_modbus`) vuren sinds v3.0.0 **nooit**. Bij
  de merge kregen de kaart-ID's het achtervoegsel `_modbus`, maar de
  profieltabel in `snapshot-trigger-service.ts` niet. Voorstel: een losse
  hotfix (C3).
- **Fixes die maar in één variant zitten.** Er zijn er 9: 4 alleen in Aurora II
  en 5 alleen in Aurora III (§1b). Geen ervan wordt stilzwijgend
  meegenomen: de convergentie zelf is gedragsneutraal, en elke harmonisatie is
  een eigen besluit met een eigen changelog-regel (C4).
- **Runtime.** Eén `ModbusRuntime` met de gemeenschappelijke schrijfacties en
  één getypeerde `setFeature(feature, value)` voor modelspecifieke functies.
  Twee adapters vertalen die naar de bestaande protocolservices. Of een model
  een functie kent, lees je af uit `runtime.features`, niet uit de driver-ID.
- **Flow cards.** Registratie verhuist van het device naar `driver.onInit()`
  (één keer per driver), en elke handler leest `args.device`. Daarmee is
  ADR-001 risico 4 opgelost voor beide Modbus-drivers. Het afmelden van
  listeners, dat beide managers nu doen, bleek een no-op te zijn.
- **Kaarten delen.** 55 van de 57 `_aurora3`-kaarten zijn op hun ID na
  structureel gelijk aan hun Aurora II-tweeling. Toch adviseer ik de
  **kaart-ID's te laten staan** en alleen de code te delen (C5, variant K1).
  Samenvoegen in het manifest levert vrijwel niets op, omdat de oude ID's moeten
  blijven bestaan voor flows die er al op draaien.
- **Dashboard.** Eén `DashboardHost` per driver-ID in `app.ts`, met een
  gedeelde HTTP-laag en een modelprofiel. HTML, poorten (8090/8091) en
  URL's blijven gelijk.
- **Plan.** 9 fasen (0–8). Elke fase is te bewijzen met tests, een
  manifest-vingerafdruk, `verify.py` en `npm run check:caps`. Starten pas na
  publicatie en hardware-acceptatie van 3.2.0 (C2).
- **Te beslissen:** C1–C10 (onderaan). De belangrijkste zijn C2 (wanneer), C3
  (hotfix), C4 (harmonisaties) en C5 (kaartdeling).

## Context

ADR-004 heeft Aurora III als derde driver toegevoegd. Om nul regressierisico te
hebben, kreeg Aurora III daarbij een eigen kopie van de Modbus-services in
`lib/aurora3/` (ADR-004 O3, principe 3). Bewuste prijs: een bugfix in een
Modbus-service moet twee keer, en voor de services die ook een Tuya-variant
hebben drie keer.

De fork is ouder dan de merge. Aurora III is op 2026-05-07 afgesplitst van de
Aurora II-app. Daarna zijn beide apps vijf maanden apart ontwikkeld, met
fixes die met de hand heen en weer zijn overgezet (bijvoorbeeld Aurora II
2.8.4 ↔ Aurora III 1.3.3: degraded-warning wissen bij herstel). Niet alles is
overgezet. Dit ADR brengt in kaart wat er verschilt, en waarom.

ADR-004 noemde twee vervolgstappen die hier samen worden uitgewerkt:

1. Modbus-convergentie: gemeenschappelijke code met een `ModbusRuntime` en
   twee protocoladapters, daarna één flow-card-manager met `args.device`.
2. Een `DashboardHost` per driver-ID in plaats van de parallelle app-leden
   `dashboard` en `aurora3Dashboard`.

Buiten scope: de Tuya-driver (die heeft hetzelfde risico 4: 33
`registerRunListener`-aanroepen en 4 keer `args.device`; dat wordt een eigen
ADR), en een gedeelde basisklasse voor `device.ts` (C9).

## 1. Meting per service

Methode: `diff` per bestandspaar tussen `lib/modbus/` en `lib/aurora3/` op
`beacecf`. Kolom *+/−* telt toegevoegde plus verwijderde regels. Kolom
*kern* telt dezelfde diff zonder importregels en zonder witruimte aan het
regeleinde. Aard: **C** = cosmetisch (commentaar, logtekst, volgorde,
importpad), **P** = protocolspecifiek (registers, snapshotvelden,
capability-ID's), **G** = gedivergeerd gedrag (dezelfde situatie, een andere
uitkomst).

| Bestand | Regels A2 | Regels A3 | +/− | Kern | Aard | Kern van het verschil |
|---|---:|---:|---:|---:|---|---|
| `services/building-insights-service.ts` | 1382 | 1382 | 0 | 0 | — | Byte-identiek; alleen apart vanwege nominale types (ADR-004 §4) |
| `services/scop-calculator.ts` | 546 | 546 | 4 | 4 | P | `refrigerant_circuit` ontbreekt in A3 |
| `services/energy-tracking-service.ts` | 799 | 797 | 10 | 8 | P | Compressor-ID `adlar_state_compressor_state` ↔ `adlar_compressor_on` |
| `constants.ts` | 343 | 342 | 11 | 11 | C/P | Volgorde, commentaar, COP-weging `refrigerant_circuit` |
| `types/shared-interfaces.ts` | 49 | 36 | 17 | 17 | C | A2 bevat dode `UserFlowPreferences` |
| `protocol/modbus-runtime-service.ts` | 55 | 50 | 21 | 19 | P/G | Runtime-interface, zie §2 |
| `services/building-model-service.ts` | 1185 | 1194 | 33 | 33 | P/G | Modus-poort (`adlar_mode` ↔ `adlar_mode_aurora3`); DHW-poort alleen A3 |
| `services/modbus-cop-service.ts` | 286 | 301 | 45 | 40 | P/G | Sensorvelden, m³/h-omrekening; A3 respecteert `cop_calculation_enabled` |
| `services/adaptive-control-service.ts` | 2457 | 2457 | 48 | 36 | C | Alleen importpaden en registernamen in log/commentaar |
| `services/capability-health-service.ts` | 679 | 646 | 45 | 43 | C/P | A2: dode Tuya-flowvoorkeuren; mode-capability |
| `services/performance-report-service.ts` | 923 | 882 | 59 | 59 | P | A2: koudemiddel-telemetrie en poort op `enable_intelligent_energy_tracking` |
| `services/modbus-connection-service.ts` | 366 | 337 | 71 | 66 | P/G | Schrijf-API (§2); A3 `timeoutMs`, FC04; A2 getypeerd, A3 met casts |
| `services/snapshot-trigger-service.ts` | 179 | 165 | 94 | 89 | P | Sensorvelden, modustabel, foutteksten; 🔴 bug in A2 (§1c) |
| `services/service-coordinator.ts` | 898 | 912 | 170 | 162 | P/G | Medium-snapshotpad (A3), herstel-sync, tellers (§1b) |
| `services/widget-state-service.ts` | 365 | 273 | 186 | 183 | P | Ander state-contract (unie in `app.ts`, ADR-004 O4) |
| `protocol/modbus-tcp-service.ts` | 790 | 845 | 231 | 231 | P/G | A3 is superset (FC04, `fc` per blok); cache-semantiek, venster 50 ↔ 100 |
| `services/flow-card-manager-service.ts` | 2281 | 1880 | 665 | 662 | P/G | A2: dode categoriecode, modusbewuste kaarten; beide risico 4 (§3) |
| `services/dashboard-service.ts` | 1193 | 930 | 967 | 963 | P/G | Registercatalogus, routes; A2-hardening ontbreekt in A3 (§1b) |
| **Totaal 18 paren** | **14.776** | **13.975** | **2.677** | **2.626** | | |

Daarnaast, buiten de paren:

| Bestand | Bevinding |
|---|---|
| `lib/aurora3/services/cop-calculator.ts` (1019) | Kopie van `lib/shared/services/cop-calculator.ts` zonder `refrigerant_circuit`, plus een helper `waterDeltaT()`; 139 diff-regels. De gedeelde versie kiest `power_estimation` vóór `refrigerant_circuit`, en die laatste vereist hoge- en lagedruktemperaturen die A3 niet levert. Aurora III kan dus waarschijnlijk zonder gedragsverschil de gedeelde versie gebruiken (te bewijzen in fase 2) |
| `lib/aurora3/types/app-host.ts` | Vervalt met de `DashboardHost` (§4) |
| `drivers/*/device.ts` | 843 ↔ 821 regels, 380 diff-regels; buiten scope (C9) |
| `drivers/*/driver.ts` | 6 diff-regels |
| Al gedeeld | `lib/modbus/adaptive/*` (4), `external-temperature-service`, `wind-correction-service`, `lib/shared/*` |

### 1a. Wat de getallen zeggen

- **Eén groep is vrijwel triviaal**: `building-insights`, `scop`,
  `energy-tracking`, `constants`, `shared-interfaces` en `adaptive-control`.
  Dat is 5.560 regels met hooguit 48 diff-regels per bestand. Wat
  verschilt is één capability-ID of een registernaam in een logregel.
  `adaptive-control-service.ts` noemt in A3 bijvoorbeeld *"Aurora III
  heating setpoint 4-2107"* waar A2 *"setpoint-register 0x0301"* noemt. In
  gemeenschappelijke code wordt dat de transportneutrale term *"setpoint"*.
  Dat verandert een logregel, geen gedrag.
- **De protocolspecifieke verschillen zitten in een paar gegevens per
  model.** Het gaat om sensorvelden (`ambientT1` ↔ `ambientT4`, `inletT6` ↔
  `retourTE1`, `outletT7` ↔ `aanvoerTA`, `inputPowerKw` ↔ `derivedPowerKw`),
  capability-ID's (`adlar_mode` ↔ `adlar_mode_aurora3`), moduswaarden en de
  registercatalogus van het dashboard. Dat zijn gegevens, geen algoritmen, en
  ze passen in een modelprofiel (§2c).
- **Echte gedragsdivergentie is zeldzaam en loopt over een paar lijnen.** Zie
  §1b. Bijna alles is een fix of opschoning die in één app wel is gedaan en in
  de andere niet.

### 1b. Fixes en verbeteringen die maar in één variant zitten

Bron: diffs hierboven, de git-historie van beide bronrepo's na de fork
(2026-05-07) en van deze repo na v3.0.0 (`c71641d`, `e3035c1`, `68d9981`,
`e4a6194`, `aae3d92`).

| # | Alleen in | Wat | Situatie in de andere variant | Voorstel |
|---|---|---|---|---|
| F1 | A2 (v3.1.3 / bron 2.15.1) | Na herstel van een poll-timeout worden de verbindings-capabilities altijd opnieuw gezet, ook als de vlag `_visibleConnectionConnected` al `true` is | A3 heeft de oude guard nog, maar start met de vlag op `false`. Daardoor synchroniseert A3 na een herstart wél. Hetzelfde symptoom is dus langs een andere weg opgelost | Harmoniseren naar de A2-vorm (H1) |
| F2 | A2 (v3.0.0, `e3035c1`) | Dashboard: onverwachte fouten als JSON-500 met stack in de log; terugval op de standaard-temperatuurschaal als de device-callback gooit; header `X-Adlar-Dashboard-Build` | A3 geeft `text/plain` 500 en gooit door als de callback faalt tijdens reconnect | Overnemen in de gedeelde HTTP-laag (H2) |
| F3 | A2 | `getRegisterCache()` geeft een kopie van de cache | A3 geeft de interne `Map` zelf terug. De enige consument (dashboard) leest alleen, dus nu onschadelijk, maar elke toekomstige consument kan de cache muteren | Kopie voor beide; functioneel neutraal voor A3 (fase 2) |
| F4 | A2 | `getSnapshot`, `getChangeLog` en `getRegisterCache` staan getypeerd in het runtime-interface | A3 gebruikt drie `as unknown as`-casts in `modbus-connection-service.ts` | Opgelost door `ModbusRuntime` (§2) |
| F5 | A3 | `ModbusCOPService` respecteert `cop_calculation_enabled`: is die uit, dan worden de COP-capabilities op 0 / *Disabled* gezet | A2 schrijft COP-waarden door, ook als de gebruiker COP-berekening uitzet. Alleen de adaptieve regeling en de health-service kijken naar de instelling | Overnemen voor A2 (H3); zichtbare gedragswijziging |
| F6 | A3 | Dode code verwijderd: `UserFlowPreferences`, `registerFlowCardsByCategory()` en de vier `flow_*_alerts`-instellingen (die bestaan in geen enkele Modbus-driver; de code logt alleen) | Aanwezig in A2 | Verwijderen; aantoonbaar neutraal, want de instellingen bestaan niet |
| F7 | A3 | Configureerbare Modbus-timeout (`timeoutMs`) | A2 vast op 10 s | Profielparameter, A2-standaard 10 s |
| F8 | A3 | Strengere filters op 9 flow cards (`&capabilities=adlar_cop…` / `energy_prices_data`) | A2 filtert alleen op driver | Laten zoals het is; alle 5 capabilities zitten vast in de A2-driver, dus de filters zouden daar niets veranderen. Geen manifestwijziging aan A2-kaarten zonder reden |
| F9 | A3 | DHW-poort in `BuildingModelService`: geen leermonster terwijl er warm water wordt gemaakt (`adlar_dhw_active`) | A2 heeft geen `adlar_dhw_active`. Het commentaar in A2 erkent dat DHW-cycli in gecombineerde modi als ruis worden geaccepteerd | Poort capability-afhankelijk maken: neutraal voor A2 zolang die capability ontbreekt |

Verder zijn er kleine verschillen die geen fix zijn, maar wel gedrag:

| # | Verschil | Voorstel |
|---|---|---|
| D1 | Change-log-venster: laatste 50 (A2) of 100 (A3) intervallen per register | Profielparameter; harmoniseren is een los besluit (H4) |
| D2 | Superfast-faaltelling: A2 reset alleen bij een superfast-snapshot, A3 bij elke niet-medium snapshot | Profielhaak in fase 4; harmoniseren is los (H5) |
| D3 | `getCurrentSnapshot()`: A2 uit een coördinatorcache, A3 rechtstreeks uit de verbinding | Gelijkwaardig zolang de verbinding bestaat; A2-vorm overnemen (overleeft reconnect) |
| D4 | Standaard-temperatuurschaal dashboard: `x1` (A2) of `x10` (A3) | Protocolspecifiek: profielparameter |

Fixes die al in beide varianten zitten (ter controle nagelopen): het
flikkeren van de device-picker bij `setCapabilityOptions()` (A2 `68d9981`, A3
1.9.4), het wissen van de degraded-warning bij herstel en startup-stagger (A2
2.8.4, A3 1.3.3), en poll-detectie na een expert-read (A2 2.9.0; A3
vergelijkt ook tegen `entry.lastValue`).

### 1c. 🔴 Bevinding buiten de convergentie: Aurora II-drempeltriggers vuren nooit

`lib/modbus/services/snapshot-trigger-service.ts` zoekt het drempelprofiel
op met de kaart-ID:

```typescript
const profile = CARD_PROFILES[cardId] ?? { threshold: 0.5, stateField: 'currentValue' };
trigger(cardId, tokens, { condition, [profile.stateField]: value, currentValue: value });
```

Sinds de merge van v3.0.0 (`c71641d`) zijn de aanroepen omgezet naar
`'tank_temperature_alert_modbus'` enzovoort, maar de sleutels van
`CARD_PROFILES` zijn gebleven zoals ze waren (`tank_temperature_alert`). In de
bronrepo pasten ze wél bij elkaar. Het gevolg voor 15 van de 17 kaarten uit
`THRESHOLD_TRIGGER_CARDS`; alleen `inlet_temperature_changed_modbus` en
`outlet_temperature_changed_modbus` lopen via `_detectInletOutletChange()`,
dat het state-veld zelf meegeeft:

1. Het profiel valt terug op drempel 0,5 en state-veld `currentValue`.
2. De run-listener in `flow-card-manager-service.ts` leest `state.temperature`
   (of `pulse_steps`, `flow_rate`, `frequency`). Dat veld bestaat niet, dus
   `getStateNumber()` geeft `null` en `evaluateThreshold()` geeft `false`.
3. De trigger wordt wel aangeroepen, maar geen enkele flow start.

De Aurora III-tabel is bij de import van ADR-004 wél consequent hernoemd en
heeft dit probleem niet. Er is geen unit-test voor `SnapshotTriggerService`.

**Voorstel (C3)**: een losse hotfix vóór de convergentie: sleutels van
`CARD_PROFILES` corrigeren, plus een test die per kaart controleert dat het
state-veld van de run-listener in de trigger-state zit. Dit is een
**zichtbare gedragswijziging**: kaarten die sinds v3.0.0 stil waren, gaan
weer vuren (met drempel 2 °C of 20 stappen, zoals bedoeld). Dat hoort in de
changelog.

### 1d. Andere bestaande gebreken in beide varianten

- **Afmelden van flow-listeners doet niets.** `registerRunListener()` geeft
  volgens de SDK-types de `FlowCard` zelf terug (`FlowCard.d.ts`), en die heeft
  geen `unregister()`. `unregisterAllFlowCards()` logt dus alleen. Gevolg: na
  het verwijderen van een device blijven de kaarten wijzen naar de closure van
  het verwijderde device, tot een ander device opnieuw registreert.
- **Dashboard-callbacks worden nooit losgemaakt.** Een device bindt zijn
  callbacks bij `onInit()` en bij een poortwijziging, maar niet los bij
  `onDeleted()`. Met twee devices van dezelfde driver wint het laatst
  gebonden device (hetzelfde patroon als risico 4).
- **Poortinstelling per device, server per driver.** `dashboard_port` is een
  device-instelling, maar de server is app-breed per driver. Twee devices met
  verschillende poorten herstarten elkaars server. Dat speelt alleen bij twee
  warmtepompen van hetzelfde model.

## 2. Runtime: één `ModbusRuntime` met twee protocoladapters

### 2a. Huidige situatie

Beide varianten hebben een interface `ModbusRuntimeService<TSnapshot>`
(ADR-031 in de bronrepo's) met dezelfde verbindings-, poll- en eventleden.
Het verschil zit in de schrijfacties:

| Schrijfactie | Aurora II | Aurora III | Aanroepers |
|---|---|---|---|
| `setTemperature`, `setMainSwitch`, `setMode`, `setExternalFlow` | ✓ | ✓ | beide coördinatoren en devices |
| `setHeatingCurve`, `setHotWaterCurve`, `setCoolingCurve`, `setFloorHeatingCurve` | ✓ | — | A2-device, A2-flowmanager, A2-coördinator |
| `setDiyHeatingCurve(k, b)` | ✓ | — | A2-dashboard (`/api/set-diy-curve`), A2-flowkaart |
| `setUserMode(0\|1\|2)` | ✓ | — | A2-device |
| `setFeature('dhw_enabled' \| 'silent_mode' \| 'backup_heater_forced', number)` | — | ✓ | A3-device (3×) |
| `getSnapshot`, `getChangeLog`, `getRegisterCache` | in interface | via cast | dashboard, coördinator |
| `readInputRegister` (FC04) | — | via cast | A3-device, A3-coördinator |

De Aurora II-service heeft nog meer schrijfacties die niet op het interface
staan (`setPowerfulMode`, `setSilentMode`, `forceDefrost`,
`forceSterilization`, frequentie- en pompinstellingen). Die worden buiten de
protocolservice nergens aangeroepen; gebruikers bereiken die registers alleen
via de expertroute (`writeRegister`).

Elke laag erboven (`ModbusConnectionService`, `ServiceCoordinator`, device)
geeft deze methoden één-op-één door. Het verschil in het interface plant zich
dus door tot in drie bestanden per variant.

### 2b. Ontwerp

```typescript
// lib/modbus/common/runtime.ts

/** Modelspecifieke schrijffuncties, met per sleutel een eigen waardetype. */
export interface FeatureValues {
  heating_curve: number;
  hot_water_curve: number;
  cooling_curve: number;
  floor_heating_curve: number;
  diy_heating_curve: { k: number; b: number };
  user_mode: 0 | 1 | 2;
  dhw_enabled: boolean;
  silent_mode: number; // Aurora III: niveau 0..2
  backup_heater_forced: boolean;
}
export type ModbusFeature = keyof FeatureValues;
export type ModbusModel = 'aurora2' | 'aurora3';

export interface ModbusRuntime<TSnapshot> {
  readonly model: ModbusModel;
  /** Welke features dit model kent. Vervangt elke controle op driver-ID. */
  readonly features: ReadonlySet<ModbusFeature>;

  // Verbinding en polling: ongewijzigd ten opzichte van beide varianten
  connect(): Promise<void>;
  destroy(): Promise<void>;
  startPolling(ms?: PollIntervals): void;

  // Schrijfacties die beide modellen kennen
  setTemperature(type: string, value: number): Promise<void>;
  setMainSwitch(on: boolean): Promise<void>;
  setMode(mode: number): Promise<void>;
  setExternalFlow(lpm: number | null): void;

  // Modelspecifiek; gooit UnsupportedFeatureError buiten `features`
  setFeature<K extends ModbusFeature>(feature: K, value: FeatureValues[K]): Promise<void>;

  // Lezen: getypeerd, zonder casts
  getSnapshot(): TSnapshot | null;
  getChangeLog(mode?: RegisterChangeLogMode): Map<number, RegisterChangeEntry>;
  getRegisterCache(): Map<number, number>; // altijd een kopie (F3)
  readHoldingRegister(addr: number): Promise<number>;
  readInputRegister(addr: number): Promise<number>; // A2: gooit
  readCoil(addr: number): Promise<number>; // A3: gooit
  writeRegister(addr: number, raw: number): Promise<void>;
  writeCoil(addr: number, on: boolean): Promise<void>;

  on(event: 'connected', cb: () => void): this;
  // … overige events identiek aan het huidige interface
}
```

**Adapters.** De twee bestaande protocolservices blijven intact. Een dunne
adapter per model implementeert `ModbusRuntime`:

| Adapter | `features` | Vertaling |
|---|---|---|
| `Aurora2Runtime` (wrapt `Adlar2ModbusService`) | de vier curves, `diy_heating_curve`, `user_mode` | `setFeature('heating_curve', c)` → `setHeatingCurve(c)`, enzovoort |
| `Aurora3Runtime` (wrapt `Adlar3ModbusService`) | `dhw_enabled`, `silent_mode`, `backup_heater_forced` | `setFeature('dhw_enabled', b)` → bestaande `setFeature('dhw_enabled', b ? 1 : 0)`; de boolean→getal-omzetting staat in de adapter, zodat de registerschrijfacties bit-gelijk blijven |

`ModbusConnectionService` wordt één gemeenschappelijke klasse die alleen
`ModbusRuntime` kent. De zes curve-doorgeefmethoden in elke laag vervallen
voor één `setFeature`.

**Waarom niet het Aurora II-interface met optionele methoden?** Elke nieuwe
modelspecifieke functie zou dan een optioneel lid op drie lagen worden, met
`?.`-controles bij elke aanroeper. Bij één getypeerde sleutel blijft de
signatuur stabiel. Dat een functie bestaat, zie je aan `features`, en
`FeatureValues[K]` houdt de waarde toch op compileertijd getypeerd.

**Waarom niet alles via `setFeature`?** `setTemperature` en `setMode` worden
door gedeelde code (adaptieve regeling, flowkaarten) voor beide modellen
aangeroepen met dezelfde betekenis. Ze generiek houden zou een gemeenschappelijke
aanroep onnodig indirect maken.

### 2c. Modelprofiel en genormaliseerde snapshot

De protocolspecifieke verschillen uit §1 zijn gegevens. Die bundel ik in één
profiel per driver:

```typescript
// lib/modbus/common/model-profile.ts
export interface ModbusModelProfile<TSnapshot> {
  readonly driverId: 'intelligent-heatpump-modbus' | 'intelligent-heatpump-aurora3';
  readonly model: ModbusModel;
  readonly cardSuffix: '_modbus' | '_aurora3';
  readonly defaultDashboardPort: number; // 8090 | 8091
  readonly defaultTemperatureScale: 'x1' | 'x10'; // D4
  readonly changeLogIntervalWindow: number; // 50 | 100 (D1)
  createRuntime(cfg: ModbusConnectionConfig, timers: TimerProvider): ModbusRuntime<TSnapshot>;
  normalize(snapshot: TSnapshot): NormalizedSnapshot;
  readonly capabilityIds: { mode: string; compressorOn: string; dhwActive?: string };
  readonly modes: { nonHeating: readonly string[]; labels: Readonly<Record<number, string>> };
  readonly triggers: SnapshotTriggerTable; // kaart-ID's en profielen per model
  readonly dashboard: DashboardProfile; // §4
  readonly telemetryChecks?: TelemetryCheckSet; // A2: koudemiddelcircuit
  describeFault(code: string): string;
}
```

`NormalizedSnapshot` heeft modelneutrale velden (`ambientC`, `inletC`,
`outletC`, `flowLpm`, `compressorHz`, `fanHz`, `electricalPowerKw`,
`defrosting`, `compressorOn`, `dhwActive?`, `modeId`, `faultCodes`,
`sourcePollGroup`). De gemeenschappelijke services werken daarop. De ruwe
`TSnapshot` blijft beschikbaar voor de modelspecifieke delen (widget-state,
dashboard).

## 3. Flow cards: één manager met `args.device`

### 3a. Huidige constructie (gemeten)

| | Aurora II | Aurora III |
|---|---:|---:|
| `registerRunListener`-aanroepen | 45 | 42 |
| `this.device`-verwijzingen in de manager | 144 | 131 |
| `args.device`-verwijzingen | 4 | 1 |
| Registratiemoment | per device, in `onInit` en bij elke `updateSettings` | idem |
| Afmelden | `unregisterAllFlowCards()`: no-op (§1d) | idem |

Beide managers worden **per device** aangemaakt en registreren op
**app-brede** kaart-singletons. Daarbij lezen de handlers `this.device`, het
device dat het laatst registreerde. Het lage aantal `args.device`-treffers
onderschat wel wat al goed gaat: de eenvoudige actiekaarten (A2: 10, A3: 7,
waaronder de modusbewuste kaarten `set_setpoint_for_mode` en
`set_curve_for_mode` uit bron 2.14.2/2.15) lopen via
`registerCapabilityAction()` en `triggerSelectedDeviceCapability(args, …)`,
en die helper leest `args.device`. Dat patroon is het vertrekpunt.

De handlers vallen in vier groepen:

1. **Puur `args`/`state`**: de 17 drempeltriggers en `fault_detected_*`. Die
   zijn nu al device-veilig, maar worden per device opnieuw geregistreerd.
2. **Al via `args.device`**: de eenvoudige actiekaarten hierboven.
3. **Lezen of schrijven via het device**: condities en acties die
   `this.device.getCapabilityValue()` of een device-methode aanroepen. Dit is
   de kern van risico 4.
4. **Via een per-device service**: Building Insights, het prestatierapport en
   externe data. Die roepen `this.buildingInsightsService` (12×) of
   `this.handleReceiveExternal…` aan, oftewel de service van het verkeerde
   device.

De manager heeft ook taken die echt per device zijn: de timer voor het
dagrapport (23:00), de score per uur, het init-rapport en het afvuren van
triggers.

### 3b. Ontwerp

```text
driver.onInit()                         (één keer per driver per app-start)
  └─ registerModbusFlowCards(driver, profile)
       for spec of MODBUS_FLOW_CARDS:
         card = homey.flow.get…Card(cardId(spec, profile))
         card.registerRunListener((args, state) =>
           spec.run(asModbusFlowTarget(args.device), args, state))

device.onInit()
  └─ ModbusFlowDeviceService            (per device: timers, rapport, triggers)
```

- **`MODBUS_FLOW_CARDS`** is één tabel met kaartspecificaties: basis-ID,
  soort, handler en eventueel `requires: ModbusFeature`. Eén handler bedient
  beide modellen. De kaart-ID volgt uit `basis + profile.cardSuffix`, met een
  uitzonderingslijst voor de kaarten zonder achtervoegsel die de Aurora
  II-code gebruikt: 7 Aurora II-exclusief
  (`inlet_temperature_value_changed`, `outlet_temperature_value_changed`,
  `modbus_read_register`, `modbus_write_register`, `set_curve_for_mode`,
  `set_diy_heating_curve`, `set_setpoint_for_mode`) plus
  `work_mode_changed`, die Aurora II deelt met Tuya.
- **`ModbusFlowTarget`** is een smal interface dat beide `device.ts`-klassen
  implementeren: `getCapabilityValue`, `getSetting`,
  `triggerCapabilityListener`, `runtime` en de per-device services
  (`buildingInsights`, `performanceReport`, `externalData`).
  `asModbusFlowTarget()` gooit een gelokaliseerde fout als `args.device`
  geen Modbus-device is.
- **Modelspecifieke kaarten** (`heating_mode_is_*`, `set_heating_mode_*`, de
  curvekaarten) krijgen een handler per model, of controleren `requires`
  tegen `runtime.features`.
- **Registreren in `driver.onInit()`** in plaats van `app.ts`: Homey maakt
  per driver één instantie, dus een guard is overbodig. De kaarten van een
  driver komen ook alleen beschikbaar als die driver bestaat. `app.ts`
  blijft de plek voor de kaarten die alle drivers delen (pipe-filter,
  `scopedFeature`).
- **Vervalt**: `unregisterAllFlowCards()`, het opnieuw registreren in
  `updateSettings()` (dat bepaalde alleen wat er gelogd werd) en
  `registerFlowCardsByCategory()` (F6).

### 3c. Kunnen de `_modbus`- en `_aurora3`-kaarten daarna gedeeld worden?

Gemeten op de 57 `_aurora3`-kaarten: `args` structureel vergeleken (namen,
typen, enum-ID's, bereiken), `tokens`, en het filter zonder `driver_id`.

| Groep | Aantal | Bevinding |
|---|---:|---|
| Identiek aan de `_modbus`-tweeling, op ID na | 51 | Titels en `titleFormatted` zijn ook gelijk |
| Identiek aan een Aurora II-kaart zonder achtervoegsel | 4 | `inlet/outlet_temperature_value_changed`, `modbus_read/write_register` |
| Andere enum-waarden in `mode` | 2 | `heating_mode_is_*`, `set_heating_mode_*`: A2 kent 7 modi, A3 `off`/`cool`/`heat`/`auto` |
| Waarvan met strenger `capabilities=`-filter in A3 | 9 van de 51 | F8 |

Kaart-ID's zijn na publicatie permanent. Een bestaande flow verwijst naar een
ID, en verdwijnt die, dan breekt de flow. De `_modbus`-ID's zijn sinds v3.0.0
gepubliceerd. De `_aurora3`-ID's worden permanent op het moment dat 3.2.0
verschijnt.

Drie varianten:

| Variant | Wat | Gevolg | Advies |
|---|---|---|---|
| **K0** — vóór publicatie van 3.2.0 | De 55 gelijke `_aurora3`-kaarten weglaten en de tweelingen openzetten met `driver_id=…-modbus\|…-aurora3` | 55 ID's worden nooit permanent. Maar dit vereist de reparatie van risico 4 aan Aurora II-zijde **vóór** 3.2.0, in strijd met ADR-004 principe 1, en maakt de verificatie van fasen 3 en 6 ongeldig | ❌ Niet doen; 3.2.0 is bevroren tot de hardware-acceptatie |
| **K1** — ID's blijven, code gedeeld | Beide ID-sets blijven bestaan. Eén handlertabel (§3b) registreert ze per driver. Nieuwe Modbus-kaarten krijgen na de convergentie één ID **zonder** achtervoegsel en filter `driver_id=…-modbus\|…-aurora3` (ADR-001 §4: geen achtervoegsel zonder botsing) | Geen flow breekt, geen manifestwijziging. Het onderhoud van de handlers halveert. De 57 dubbele compose-bestanden blijven, maar kunnen uit één bron worden gegenereerd (ADR-004 vervolgstap 3) | ✅ **Advies** |
| **K2** — ID's samenvoegen na 3.2.0 | `_modbus`-tweeling openzetten voor Aurora III, de `_aurora3`-kaart markeren met `"deprecated": true` en zijn handler laten staan | Bestaande Aurora III-flows blijven werken (te verifiëren, V1). Nieuwe flows gebruiken de `_modbus`-ID, die dan ook "Aurora III" betekent. Het manifest wordt níet kleiner (afgeschafte kaarten blijven staan), en een Aurora III-gebruiker heeft voortaan oude en nieuwe ID's door elkaar | ❌ Kost meer dan het oplevert |

Conclusie: delen gebeurt **in de code, niet in het manifest**. Zo hoeft geen
kaart-ID te wijzigen, en hoeft er ook geen nieuwe ID bij.

## 4. Dashboard: één `DashboardHost` per driver-ID

### 4a. Huidige situatie

`app.ts` heeft twee parallelle sets leden (ADR-004 §5):
`_dashboard`/`dashboard`/`setDashboardPort()` voor Aurora II en
`_aurora3Dashboard`/`aurora3Dashboard`/`setAurora3DashboardPort()` voor Aurora
III. De twee `setXxxPort()`-methoden zijn op naam, klasse, standaardpoort en
`publicDir` na regel voor regel gelijk. Aurora II bereikt de leden met een
`as unknown as`-cast, Aurora III via het getypeerde `Aurora3AppHost`.

`dashboard-service.ts` bestaat uit twee lagen:

- **Gemeenschappelijk**: serverlevenscyclus, `EADDRINUSE`-afhandeling,
  routering, statische bestanden, JSON-fouten en het registreren van
  callbacks.
- **Modelspecifiek**: registercatalogus (`buildRegisterBlocks`,
  `WRITABLE_REGISTERS`), `CONTROL_CAPABILITIES` (A3), extra routes
  (`/heating-curve` en `/api/set-diy-curve` alleen bij A2, `/api/control`
  alleen bij A3) en de standaardschaal.

### 4b. Ontwerp

```typescript
// lib/modbus/common/dashboard/dashboard-host.ts
export class DashboardHost {
  constructor(opts: { appDir: string; logger: Logger; profile: DashboardProfile });
  ensurePort(port: number): Promise<void>; // huidige set…DashboardPort()
  bind(deviceId: string, binding: DashboardBinding): void;
  unbind(deviceId: string): void; // nieuw: aanroepen in onDeleted()
  setSnapshot(deviceId: string, snapshot: unknown): void;
  destroy(): Promise<void>;
}

// app.ts
private readonly dashboardHosts = new Map<string, DashboardHost>(); // per driver-ID
getDashboardHost(driverId: ModbusDriverId): DashboardHost; // lui aangemaakt
```

- `ModbusAppHost` (één getypeerd interface met `getDashboardHost`) vervangt
  `Aurora3AppHost` en de cast aan Aurora II-zijde.
- `DashboardProfile` levert `publicDir` (`public/` of `public/aurora3/`),
  standaardpoort, registercatalogus, extra routes en standaardschaal.
- **Binding per device**: de host houdt een `Map<deviceId, binding>` bij en
  gebruikt de meest recente. Bij `unbind()` valt hij terug op een andere
  binding van dezelfde driver. Dat lost de verouderde callbacks na het
  verwijderen van een device op (§1d), zonder de huidige "laatste wint" te
  veranderen voor wie één warmtepomp heeft.
- **Ongewijzigd**: alle HTML onder `public/`, alle URL's, de poorten 8090 en
  8091, het widget en `onUninit()` (sluit nu alle hosts in een lus).
- De leden `dashboard` en `aurora3Dashboard` zijn intern (het widget gebruikt
  `getAdlarLiveOperationWidgetState()`). Ze kunnen vervallen zonder
  compatibiliteitslaag.

Device-selectie per verzoek (twee warmtepompen van hetzelfde model op één
dashboard) valt buiten scope (C7).

## 5. Doelstructuur

```text
lib/
├─ shared/                    ← ongewijzigd (+ cop-calculator door A3 gebruikt)
├─ tuya/                      ← ongewijzigd
└─ modbus/
   ├─ adaptive/               ← ongewijzigd, al gedeeld
   ├─ common/                 ← nieuw: modelneutraal
   │  ├─ runtime.ts, model-profile.ts, normalized-snapshot.ts
   │  ├─ modbus-tcp-service.ts, modbus-connection-service.ts
   │  ├─ services/            ← de 14 gemeenschappelijke services
   │  ├─ flow/                ← registry, kaarttabel, ModbusFlowDeviceService
   │  └─ dashboard/           ← DashboardHost, HTTP-laag
   ├─ aurora2/                ← registers, Adlar2ModbusService, adapter, profiel
   └─ aurora3/                ← registers, Adlar3ModbusService, adapter, profiel
                                (was lib/aurora3/)
```

De huidige `lib/modbus/services/` en `lib/modbus/protocol/` (Aurora II)
verhuizen naar `common/` of `aurora2/`. `lib/aurora3/` verhuist naar
`lib/modbus/aurora3/` (C1).

## 6. Gefaseerd plan

Uitgangspunt: **elke fase is gedragsneutraal**, behalve fase 0 en fase 7, die
alleen expliciet besloten gedragswijzigingen bevatten. Elke fase is één of
meer commits op een featurebranch. Er wordt één keer uitgebracht, als 3.3.0
(C10).

| Fase | Inhoud | Risico | Bewijs van gedragsneutraliteit |
|---|---|---|---|
| **0** | Hotfix `CARD_PROFILES` (§1c), losse 3.2.x-release (C3) | Laag in code, **zichtbaar** voor gebruikers | Nieuwe test per drempelkaart: state-veld aanwezig, drempel uit profiel; changelog-regel |
| **1** | Karakteriseringstests en manifest-vingerafdruk; geen productiecode | Laag | Tests groen op de 3.2.0-code |
| **2a** | Pure verplaatsing naar `lib/modbus/{common,aurora2,aurora3}` | Laag | `git diff -M --stat` toont alleen hernoemingen plus importregels; build en tests groen; vingerafdruk gelijk |
| **2b** | Bijna-identieke bestanden samenvoegen: TCP-laag, `constants`, `shared-interfaces`, `scop-calculator`, A3 naar gedeelde `cop-calculator` | Laag-middel | TCP-tests met een nep-jsmodbus-client; COP-golden-test A3 (zelfde methode en waarde per fixture) |
| **3** | `ModbusRuntime`, twee adapters, gemeenschappelijke `ModbusConnectionService`; aanroepers naar `setFeature` | Middel: een verkeerde vertaling schrijft naar een verkeerd register | Adaptertest met een registrerende nep-TCP: voor elke oude methode levert het nieuwe pad dezelfde reeks (adres, waarde) |
| **4** | Profiel en `NormalizedSnapshot`; services samenvoegen, kleinste diff eerst (§6, fase 4) | Middel; hoog voor de coördinator | Golden master per model (snapshotreeks → capability-writes, triggers, beschikbaarheid) gelijk vóór en na, per service een eigen commit |
| **5** | Flow cards: registry in `driver.onInit()`, `args.device`, `ModbusFlowDeviceService`; beide managers vervallen | Hoog: elke Modbus-flow loopt hierdoor (maar het lost risico 4 op) | Registry-test: elke kaart-ID van de driver precies één listener; test met twee devices: de handler leest `args.device`; vingerafdruk, `verify.py`, `check:caps` gelijk |
| **6** | `DashboardHost` per driver-ID; gedeelde HTTP-laag en profielen | Middel | HTTP-contracttest per profiel (alle routes: status en JSON-vorm); `git diff public/` leeg; poorten ongewijzigd |
| **7** | Besloten harmonisaties H1–H5 (C4), elk een eigen commit en changelog-regel | Per item, zichtbaar | Per item een test die het nieuwe gedrag vastlegt |
| **8** | Lint, `homey app validate`, documentatie, hardware-acceptatie van beide modellen | — | Handmatige acceptatie op de Aurora II-unit en de Aurora III-unit, plus de simulator |

### Fase 0 — Hotfix drempeltriggers (los van de convergentie)

- **Bestanden**: `lib/modbus/services/snapshot-trigger-service.ts`, nieuw
  `test/unit/modbus/snapshot-trigger-service.test.js`,
  `.homeychangelog.json`, `.homeycompose/app.json`, `package.json`,
  `package-lock.json`.
- **Risico**: flows die gebruikers ooit hebben gebouwd, gaan na de update
  ineens starten. Dat is bedoeld, maar wel nieuw voor hen.

### Fase 1 — Vangnet

- **Tests** (nieuw, in `test/unit/modbus/` en `test/unit/aurora3/`):
  `snapshot-trigger-service`, `modbus-cop-service`, `modbus-tcp-service` (met
  een nep-client), `modbus-connection-service` (met een nep-runtime), de
  flow-handlers (een nep-`homey.flow` die `registerRunListener` vastlegt en
  handlers aanroept met `args.device`) en een HTTP-contracttest voor beide
  dashboards (Aurora III heeft al een dashboardtest om op voort te bouwen).
- **Fixtures**: de bestaande registerdumps `test/modbus/testrun-dump.txt` en
  `test/aurora3/test-adlar3-registers-dump.txt`, omgezet naar
  snapshotreeksen.
- **`scripts/convergence/manifest-fingerprint.js`** (nieuw): schrijft een
  gesorteerde JSON met drivers, capabilities per driver en per flow card de
  ID, soort, args (naam, type, enum-ID's, bereik), tokens en filter. Een
  basislijn `scripts/convergence/baseline-3.2.0.json` wordt gecommit. Elke
  latere fase moet een leeg verschil opleveren, behalve waar een besluit
  anders zegt.
- `npm test` uitbreiden met `test/unit/modbus/*.test.js`.

### Fase 2 — Verplaatsen, daarna samenvoegen

- **2a** gebruikt `git mv` zodat de historie leesbaar blijft. Verder alleen
  importpaden aanpassen, geen inhoudelijke wijziging. `tsc` vangt elk gemist
  pad.
- **2b** volgorde: `shared-interfaces` (dode code eruit, F6), `constants`,
  `scop-calculator` (unie van methoden), `modbus-tcp-service` (A3 als basis,
  `changeLogIntervalWindow` als parameter, kopie in `getRegisterCache()`),
  en `lib/modbus/aurora3/services/cop-calculator.ts` laten vervallen ten
  gunste van `lib/shared/services/cop-calculator.ts`.
- **Risico**: gemist verschil tussen twee "bijna gelijke" bestanden. Dat
  ondervangen de karakteriseringstests van fase 1. Neem bij twijfel de
  regel als profielparameter op in plaats van te kiezen.

### Fase 3 — Runtime

- **Bestanden**: `lib/modbus/common/runtime.ts`,
  `lib/modbus/common/modbus-connection-service.ts`,
  `lib/modbus/aurora2/aurora2-runtime.ts`,
  `lib/modbus/aurora3/aurora3-runtime.ts`, beide coördinatoren, beide
  `device.ts`, de A2-flowmanager (`setCoolingCurve`, `setFloorHeatingCurve`)
  en de DIY-curvecallback van het A2-dashboard.
- **Risico**: een feature die naar het verkeerde register wordt vertaald.
  Aurora III doet read-modify-write op `4-2103`. De adapter roept de
  bestaande `setFeature` aan en voert dat niet zelf uit.

### Fase 4 — Services samenvoegen

Volgorde (kleinste diff eerst, elk een eigen commit met eigen golden test):
`building-insights` → `adaptive-control` → `energy-tracking` →
`building-model` (modussemantiek en DHW-poort via het profiel, F9) →
`capability-health` → `performance-report` (telemetriecontroles via het
profiel) → `modbus-cop` (via `normalize()`) → `snapshot-trigger`
(gemeenschappelijke motor, triggertabel per model) → `widget-state`
(gedeelde bouwer, modelextensie, unie-contract blijft) →
`service-coordinator`.

De coördinator gaat als laatste en is het risicovolst: de toestandsmachine
voor de verbindingskwaliteit (ADR-042/043), het medium-snapshotpad van Aurora
III en de tellers (D2) lopen erdoorheen. Profielhaken houden het gedrag per
model gelijk. Harmoniseren gebeurt pas in fase 7.

### Fase 5 — Flow cards

- **Bestanden**: `lib/modbus/common/flow/{registry,cards,device-service}.ts`,
  beide `driver.ts` (`onInit`), beide `device.ts`. Beide
  `flow-card-manager-service.ts` vervallen.
- **Risico**: een handler die bij het omzetten nog een closure over een
  device vasthoudt, of een kaart die niet meer geregistreerd wordt. De
  registry-test dekt beide: voor elke kaart in het manifest met
  `driver_id=<driver>` precies één listener, en geen enkele handler raakt een
  device anders dan via `args.device` (de test geeft twee nep-devices met
  verschillende waarden mee).
- Gedrag dat bewust verandert: na deze fase werkt elke kaart op het gekozen
  device. Dat is de reparatie van risico 4. Voor gebruikers met één
  warmtepomp per model is dat niet merkbaar, en het hoort in de changelog.

### Fase 6 — Dashboard

- **Bestanden**: `app.ts`, `lib/modbus/common/dashboard/*`,
  `lib/modbus/{aurora2,aurora3}/dashboard-profile.ts`, beide `device.ts`
  (binden en losmaken). `lib/aurora3/types/app-host.ts` vervalt.
- **Risico**: een route of een JSON-vorm die verschuift, waardoor de
  ongewijzigde HTML breekt. De contracttest van fase 1 legt dat vast.

## 7. Gereedschap om neutraliteit aan te tonen

| Middel | Bestaat | Wat het bewijst | Fasen |
|---|---|---|---|
| `npm run build` | ✓ | Types, importpaden | alle |
| `npm test` | ✓ (uit te breiden) | Bestaande en nieuwe unit-tests per model | alle |
| `npm run lint` | ✓ | Stijl | alle |
| `python3 scripts/migration/verify.py` | ✓ | Verdeling per driver, dubbele ID's, ongedefinieerde capabilities | alle; vooral 5 |
| `npm run check:caps` | ✓ | Capability-eigenaarschap per driver, geen nieuwe wezen | alle |
| `homey app validate` | ✓ | Manifest | 0, 8 |
| `scripts/convergence/manifest-fingerprint.js` | nieuw | Kaart-ID's, args, filters en capabilities ongewijzigd | 2–7 |
| Golden-master-tests per model | nieuw | Zelfde snapshotreeks geeft dezelfde writes en triggers | 2b–4 |
| Adaptertest met registrerende nep-TCP | nieuw | Zelfde registerschrijfacties | 3 |
| Registry-test met twee devices | nieuw | Elke kaart één listener, `args.device` | 5 |
| HTTP-contracttest per dashboardprofiel | deels (A3) | Routes en JSON-vorm | 6 |
| `git diff --stat app.json public/` | ✓ | Leeg in fasen zonder manifest- of HTML-besluit | 2–6 |
| Simulator en hardware | ✓ | Werkelijke werking | 8 |

## Open besluiten

Genummerd met **C** (convergentie), om verwarring met O1–O9 uit ADR-004 te
voorkomen.

| # | Vraag | Voorstel |
|---|---|---|
| **C1** | Doelstructuur: `lib/modbus/{common,aurora2,aurora3}/` (Aurora II-bestanden verhuizen ook) of een losse `lib/modbus-common/` naast de huidige mappen | `lib/modbus/{common,aurora2,aurora3}/`: symmetrisch, en `lib/aurora3/` verdwijnt als top-level map |
| **C2** | Wanneer starten | Na publicatie en hardware-acceptatie van 3.2.0 (ADR-004 fase 7). Eerder gestart werk zou bij elke acceptatiefix opnieuw gemerged moeten worden |
| **C3** | De dode Aurora II-drempeltriggers (§1c): losse hotfix 3.2.x, of meenemen in 3.3.0 | Losse hotfix, zo snel mogelijk na 3.2.0; de fout zit sinds v3.0.0 bij gebruikers |
| **C4** | Gedivergeerd gedrag: tijdens de convergentie kiezen, of eerst neutraal met profielparameters en daarna per item beslissen | Eerst neutraal; daarna per item: **H1** herstel-sync (F1) A2-vorm voor beide · **H2** dashboard-hardening (F2) voor beide · **H3** `cop_calculation_enabled` ook voor A2 (F5) · **H4** change-log-venster (D1) 100 voor beide · **H5** superfast-teller (D2) A2-vorm voor beide. Elk een eigen changelog-regel |
| **C5** | Kaartdeling `_modbus` ↔ `_aurora3` (§3c) | **K1**: ID's blijven, code gedeeld; nieuwe kaarten zonder achtervoegsel met pipe-filter |
| **C6** | Registratieplek van de driver-gebonden kaarten | `driver.onInit()` |
| **C7** | Dashboard met meerdere devices per model | Nu: "laatste wint" plus losmaken bij verwijderen (§4b). Device-selectie per verzoek later, als er vraag naar is |
| **C8** | Gemeenschappelijke services op een `NormalizedSnapshot`, of losse accessors per service in het profiel | `NormalizedSnapshot`: één plek per model waar de veldnamen vertaald worden |
| **C9** | Gedeelde basisklasse voor beide `device.ts` (380 diff-regels) in 3.3.0 | Nee; apart ADR na 3.3.0. Fasen 3–6 maken `device.ts` al dunner |
| **C10** | Uitbrengen per fase (3.3.x) of één keer (3.3.0) | Eén keer, na fase 8. Fase 0 apart (C3) |

## Te verifiëren

1. **V1** — Blijft een flow werken die een kaart met `"deprecated": true`
   gebruikt? Alleen nodig als K2 alsnog wordt gekozen.
2. **V2** — Registreren in `driver.onInit()`: is `args.device` dan altijd de
   device-instantie van deze app, ook voor flows die vóór de herstart al
   bestonden? Verwachting ja (standaard SDK-gedrag). Vastleggen met een
   handmatige test in fase 8.
3. **V3** — Vervangt een tweede `registerRunListener()` op dezelfde kaart de
   eerste? ADR-001 ging daarvan uit op basis van de documentatie. Na fase 5
   doet het er niet meer toe, maar het verklaart of het huidige gedrag
   "laatste wint" is of "beide lopen".
4. **V4** — Levert de gedeelde `cop-calculator` voor Aurora III bij alle
   fixtures dezelfde methode en waarde als de eigen kopie (fase 2b)?

## Verworpen afwegingen

- **De convergentie in 3.2.0 meenemen.** Dat ondermijnt het principe "nul
  regressierisico" van ADR-004 juist voor de release die nog op
  hardware-acceptatie wacht.
- **Aurora III terugbrengen naar een fork van de Aurora II-bestanden met
  `if (model === …)`-takken.** Dat is snel, maar verspreidt de
  modelkennis over elke service. Het profiel houdt die op één plek per model.
- **Gemeenschappelijke code die zelf registeradressen kent.** Daarmee is de
  scheiding tussen protocol en logica weg. Adressen blijven in de adapters en
  de registermappen.
- **Eerst `device.ts` samenvoegen.** Dat bestand is het meest
  modelspecifiek (snapshot naar capabilities). Na de fasen 3–6 is het kleiner
  en is de overlap beter te zien (C9).
- **Ook de Tuya-driver in deze stap.** Die heeft geen Modbus-runtime, en
  haar flow-manager vraagt hetzelfde soort werk met eigen risico's. Het patroon
  uit §3b is wel herbruikbaar.

## Gevolgen

### Voor gebruikers

- Fase 0: Aurora II-drempeltriggers werken weer.
- Fase 5: elke Modbus-kaart werkt op het device dat in de kaart is gekozen.
  Merkbaar alleen voor wie twee warmtepompen van hetzelfde model heeft.
- Fase 7: alleen de harmonisaties die bij C4 worden aangenomen, elk met een
  eigen changelog-regel.
- Geen kaart-, capability- of driver-ID wijzigt. Geen device hoeft opnieuw te
  worden gepaird en geen flow hoeft te worden aangepast.

### Voor onderhoud

- 18 dubbele bestanden worden gemeenschappelijke code plus twee kleine
  modelmappen. Schatting: 11.000–12.000 regels minder dubbel onderhoud.
- Een fix in een Modbus-service gebeurt één keer. Voor de services met een
  Tuya-variant blijft het twee keer (Tuya en Modbus), niet drie.
- `docs/architecture/SERVICE_ARCHITECTURE.md`, sectie *Drivers and Service
  Variants*, wordt bijgewerkt in fase 8.
- Een nieuw Modbus-model kost voortaan een registermap, een adapter, een
  profiel en een driver. Geen derde kopie van de services.
