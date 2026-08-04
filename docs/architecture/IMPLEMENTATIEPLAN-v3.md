# Implementatieplan — Modbus-driver integreren in org.hhi.adlar-heatpump

- **Uitvoeringsplan bij** [ADR-001](ADR-001-MODBUS-DRIVER-MERGE.md)
- **Doelversie**: 3.0.0 (huidig: 2.13.1)
- **Datum**: 2026-08-03
- **Status**: Concept — wacht op goedkeuring vóór uitvoering

## Uitgangspunten

1. De 90% Tuya-basis merkt niets. Geen gewijzigde capability-ID's, flow-card-ID's of
   argumenttypes.
2. Elke fase is afzonderlijk te bouwen, valideren en desnoods terug te draaien.
3. Fase 0 en fase 1 zijn **gedragsneutraal** en moeten dat aantoonbaar zijn vóórdat er
   Modbus-code binnenkomt.
4. Geen commit zonder expliciete opdracht (CLAUDE.md).

## Scope-overzicht: merge-werk versus bestaande schuld

**Gekozen scope: volledig plan** — fase 0 t/m 7, inclusief de schuldposten.

Het plan bevat twee soorten werk. Ze zijn hieronder gescheiden zodat zichtbaar blijft wat
de merge afdwingt en wat losstaande verbetering is. Dat onderscheid blijft nuttig ook nu
voor volledige scope is gekozen: valt er tijdsdruk, dan is de rechterkolom wat je kunt
laten vallen zonder de merge te blokkeren.

| Fase | 🔵 Vereist voor de merge | 🟠 Bestaande schuld |
|---|---|---|
| **0** | — | `args.device` i.p.v. `this.device` (30 handlers); registratie eenmalig maken |
| **1** | 14 bestanden naar `lib/shared/`, 15 importeurs bijwerken | Controle op module-level mutable state; klassenamen `MyApp`/`MyDevice`/`MyDriver` hernoemen |
| **2** | `lib/modbus/` + drivermap + 15 capabilities + `jsmodbus` + `public/` + widget | — |
| **3** | 65× filter verwijderen, 24× `driver_id` schrappen, 4× bereik verbreden + clamp-logica | — |
| **4** | 3 capability-splitsingen, 1 flow-card-splitsing, 11 harmonisaties | `check-capability-ownership.js`; 2 wees-capabilities opruimen |
| **5** | SelfHealingRegistry per driver scopen (5.1); capability-filters op 4 app-level kaarten (5.2) | Null-afhandeling in condities (5.3); app-cast op `flow-card-manager-service.ts:1297` vervangen |
| **6** | Widget over beide drivers; `energy`-object gelijktrekken; dashboard conditioneel | `flowLoggingEnabled` scopen; lazy `require`; doc-drift heartbeat-lagen corrigeren |
| **7** | Integratietest beide transports | — |
| **8** | — | 8 dode `flow_*`-instellingen verwijderen; `advanced: true` op 11 diagnostische kaarten; `highlight` snoeien van 54 naar 11 |

### Waarom fase 0 hier niet als "optioneel" staat

Van alle schuldposten is dit de enige die door de merge **erger** wordt. Vandaag treft de
`this.device`-fout alleen gebruikers met twee warmtepompen van dezelfde driver. Na de merge
kan een Modbus-device de gedeelde kaarten van een Tuya-gebruiker kapen — en dat faalt stil,
zonder foutmelding. Uitstellen betekent een bekende, transport-overschrijdende
correctheidsfout uitleveren.

De overige schuldposten worden door de merge niet ernstiger; alleen zichtbaarder.

### Wat de merge zelf feitelijk kost

Ter kalibratie, want het plan oogt zwaarder dan het is:

- 65 van de 89 kaartbewerkingen zijn **één regel schrappen**
- Fase 1 is bestanden verplaatsen; 15 importeurs, elk 1–4 verwijzingen
- Fase 2 is een map kopiëren
- De App-instanties verenigen is **~120 regels** toevoegen aan een bestaand bestand
- De enige echte ontwerpkeuze (3 splitsingen) is al beslist in ADR-001 §2

Het conceptueel moeilijke deel is klein. Het volume zit in herhaalde, mechanische
bewerkingen — en het risico in de 90% Tuya-basis, niet in de techniek.

## Voorwaarden vooraf

Drie verificaties die het plan kunnen wijzigen. Uit te voeren vóór fase 3.

| # | Vraag | Hoe | Als het faalt |
|---|---|---|---|
| V1 | ~~Toont een device-argument zónder `filter` alleen devices van de eigen app?~~ | **BEANTWOORD — zie hieronder** | Pipe-vorm toegepast |
| V2 | Accepteert `homey app validate` twee drivers die dezelfde app-level kaart delen? | Na fase 2, `homey app validate -l debug` | Kaarten per driver dupliceren met `_modbus`-suffix (grote scope-uitbreiding — heroverweeg de fasering) |
| V3 | Evalueert Homey conditiekaarten op een `setUnavailable()`-device? | Testdevice op unavailable zetten, conditieflow draaien | Bepaalt of §5a risico 3 blokkerend is of alleen hygiëne |

### V1 — beantwoord, en de aanname was fout

`homey app validate -l publish` gaf:

```
✖ Missing all args in flow.triggers['adaptive_simulation_update'].titleFormatted.en
```

Die kaart was op één ding na identiek aan HEAD: het `driver_id`-deel van het filter was weg.

**Een device-argument zónder `driver_id` maakt van een device-kaart een app-kaart.** Het
`device`-argument wordt dan een gewoon argument dat de gebruiker kiest, en moet daarom in
`titleFormatted` voorkomen als `[[device]]`. Bovendien verhuist de kaart in de UI: van "bij
het apparaat" naar "bij de app".

Het filter weglaten is dus **niet** equivalent aan "beide drivers". Het verandert de aard
van de kaart.

**Toegepast**: `"filter": "driver_id=intelligent-heat-pump|intelligent-heatpump-modbus"` op
alle 23 gedeelde kaarten (8 die geen filter meer hadden, 15 die alleen een
capability-filter hadden — die behouden hun capability-deel). `STRATEGY` in
`03-split-flowcards.py` staat nu op `'pipe'`.

**Bevestigd**: `homey app validate -l publish` accepteert
`driver_id=intelligent-heat-pump|intelligent-heatpump-modbus`. De pipe-OR werkt dus óók voor
`driver_id`, niet alleen voor `class` zoals de documentatie laat zien. De 23 kaarten blijven
device-kaarten en hun `titleFormatted` hoeft niet aangepast.

---

## ✅ Mijlpaal — publish-validatie geslaagd

```
✓ Typescript compilation successful
✓ App validated successfully against level `publish`
```

Daarmee is de hele manifest-operatie van fase 2 t/m 4 statisch geverifieerd:

| | Gevalideerd |
|---|---|
| Flow cards | **170** (73 Modbus-only, 79 Tuya-only, 18 gedeeld via pipe) |
| Capabilities | 99 |
| Drivers | 2 |
| Widget | 1 (Modbus-only, correct gescoped) |
| Dubbele ID's | geen |
| Ontbrekende assets | geen |
| Gedeelde kaarten door beide codebases gebruikt | 18 van 18 |
| TypeScript | compileert, inclusief `jsmodbus` |

**Tweede validatie na de `app.ts`-samenvoeging (fase 6.2) en het opruimen van §5.2bis:
opnieuw groen.** Daarmee zijn fase 1 t/m 6.2 statisch geverifieerd.

**Wat dit niet zegt.** `validate` is een statische controle. Nog volledig ongetest:

- of de Modbus-driver daadwerkelijk verbindt en registers leest
- of `applyModbusSnapshot()` na de capability-hernoeming de juiste waarden schrijft
  (string-substitutie, niet type-gevalideerd)
- of de fase 0-wijziging correct werkt met twee gepairde devices
- of de widget iets toont (app-level resolver ontbreekt tot fase 6)
- runtime-gedrag van beide drivers

### Lintresultaat — 554 meldingen, getrieerd

`npm run lint` levert 481 errors en 73 warnings. Ingedeeld naar herkomst:

| Groep | Aantal | Herkomst | Actie |
|---|---|---|---|
| Stijl in overgenomen Modbus-code | ~460 | `object-curly-newline`, `no-multi-spaces`, `key-spacing`, `brace-style` in `lib/modbus/protocol/` en `dashboard-service.ts` | **370 auto-fixbaar** met `eslint --fix`. Rest is handwerk |
| Ongebruikte import (V10) | 1 | Fase 0 verwijderde `getUserFlowPreferences()`, de import bleef | Opgelost |
| Verkeerde testpaden (V11) | ~40 | `test/*.js` verwijst naar oude `.homeybuild/lib/`-paden | Opgelost |
| Bestaande stijl in `test/` | ~50 | `no-console`, floating promises — stond er al vóór de merge | Buiten scope |

**Belangrijk**: de ~460 stijlmeldingen in `lib/modbus/` zijn niet door de merge ontstaan. Beide
repos gebruiken dezelfde config (`athom/homey-app`), dus die code voldeed in de bronrepo
evenmin. De merge maakt het alleen zichtbaar in één lintrun.

**Aanbevolen volgorde**: eerst

```bash
npm run lint -- --fix     # let op de dubbele --
```

`npm run lint --fix` werkt **niet**: npm vangt `--fix` zelf af ("Unknown cli config") en
geeft hem niet door aan eslint. Dat kost anders een ronde.

Daarna de resterende ~90 met de hand. Doe dit als losse commit — het is puur opmaak en
vervuilt anders de merge-diff.

#### Handmatige rest, ingedeeld

| Melding | Waar | Beoordeling |
|---|---|---|
| `no-use-before-define` (~25×) | `dashboard-service.ts` | Functiedeclaraties worden gehoist; werkt, maar leesvolgorde is rommelig. Cosmetisch |
| `max-classes-per-file` | `modbus-tcp-service.ts` | Twee klassen in één bestand. Splitsen of regel uitzetten |
| `no-nested-ternary` (4×) | diverse | Echt leesbaarheidsprobleem, waard om op te lossen |
| `no-empty-function` | `energy-tracking-service.ts:623` | Lege `onSettings()` — bewuste no-op? Comment toevoegen |
| `no-void` | `dashboard-service.ts:1130` | `void` als expression-statement |
| `no-unpublished-require` (~7×) | `test/` | `.homeybuild` staat niet in `files`. Pre-existent |
| `no-console` (~70 warnings) | `test/simulation/` | Simulatiescript — logisch dat het logt. Pre-existent |

**V12** — `lib/modbus/protocol/modbus-runtime-service.ts` miste de disable-header die alle
Tuya-bestanden wél hebben (`import/no-unresolved`, `node/no-missing-import`,
`import/extensions`). Zonder die header rapporteert eslint een import als onvindbaar terwijl
het bestand gewoon bestaat — de resolver kent `.ts` niet. Header toegevoegd, consistent met
de rest van de codebase.

---

## Fase 0 — `args.device` in flow-card-manager-service

**Aparte release vóór de merge**, bijvoorbeeld v2.14.0. Doel: de bestaande
multi-device-fout (ADR-001 §5a risico 4) in isolatie corrigeren en valideren tegen de
huidige gebruikersbasis.

### Waarom apart

Deze correctie verandert gedrag voor gebruikers met twee of meer warmtepompen. Meng je hem
met de merge, dan is een regressie niet toewijsbaar.

### Stappen

1. In `lib/services/flow-card-manager-service.ts`: alle 30 run-listeners omzetten van
   `this.device` naar `args.device`.

   ```typescript
   // van
   const targetTempListener = targetTempCard.registerRunListener(async (args) => {
     const currentValue = this.device.getCapabilityValue('target_temperature') || 0;

   // naar
   const targetTempListener = targetTempCard.registerRunListener(async (args) => {
     const device = args.device as AdlarDevice;
     const currentValue = device.getCapabilityValue('target_temperature') || 0;
   ```

   Alle 30 kaarten hebben een device-argument in het manifest — geen kaart waarvoor het
   doeldevice geraden moet worden. Twee kaarten (`force_insight_analysis`,
   `generate_performance_report`) negeren `args` nu volledig; ook daar is `args.device`
   beschikbaar.

2. Registratie eenmalig maken.

   **Uitgevoerd via een registrar-referentie, niet via verplaatsing naar `driver.ts`.**
   Bij implementatie bleek `FlowCardManagerService` twee verantwoordelijkheden te
   combineren: app-brede kaartregistratie én **device-scoped** timers voor het
   prestatierapport (`scheduleDailyReportTimer`, uurlijkse score-update, init-rapport na
   2 minuten). Verplaatsen naar `driver.ts` vereist die klasse eerst te splitsen — een
   grotere ingreep dan fase 0 rechtvaardigt.

   ```typescript
   private static registrar: FlowCardManagerService | null = null;
   …
   const isRegistrar = FlowCardManagerService.registrar === null
     || FlowCardManagerService.registrar === this;
   if (isRegistrar) { FlowCardManagerService.registrar = this; /* registreer */ }
   // per-device werk draait altijd:
   this.schedulePerformanceReportTimers();
   ```

   Het eerdere bezwaar tegen een statische vlag — "die bevriest de eerste registratie en
   maakt de instelling onwerkzaam" — gold voor *conditionele* registratie. Nu registratie
   onvoorwaardelijk is en elke handler zijn device uit `args.device` haalt, is één
   registrar functioneel gelijkwaardig aan registratie op driverniveau.

   `destroy()` geeft de registrar-rol vrij, zodat een overblijvend device hem overneemt
   wanneer het registrerende device wordt verwijderd.

   Splitsen van de klasse (driver-scoped registrar + per-device rapportplanner) blijft
   wenselijk, maar hoort bij de servicesconvergentie ná v3.0.0.

3. Handlers die via de closure een *service* benaderen (bijvoorbeeld
   `price_in_cheapest_hours`, dat `this.device.serviceCoordinator` uitleest) moeten die
   service voortaan via `args.device` opzoeken.

### De 30 kaarten

```
calculate_preheat_time            capacity_setting_is           confidence_above
cop_efficiency_check              cop_trend_analysis            daily_cop_above_threshold
device_power_is                   force_insight_analysis        generate_performance_report
heating_curve_is                  heating_mode_is               hotwater_temperature_is
insight_is_active                 monthly_cop_above_threshold   performance_report_ready
price_in_cheapest_hours           price_trend_is                price_vs_daily_average
receive_external_ambient_data     receive_external_energy_prices
receive_external_flow_data        receive_external_indoor_temperature
receive_external_power_data       receive_external_solar_power
receive_external_solar_radiation  receive_external_wind_data
savings_above                     target_temperature_is         volume_setting_is
water_mode_is                     work_mode_is
```

### Verificatie

- `npm run build` en `npm run lint` groen
- **Twee** Tuya-devices pairen. Voor elk een flow met `target_temperature_is` bouwen met
  verschillende drempels. Beide moeten hun eigen waarde lezen.
- `receive_external_power_data` naar device A sturen; device B mag niet wijzigen.

### Rollback

Losse release, los terug te draaien. Raakt geen manifest, dus geen migratie.

---

## Fase 1 — `lib/` herstructureren

Gedragsneutraal. Alleen verplaatsen en imports bijwerken.

### Doelstructuur

```
lib/
├─ shared/          14 byte-identieke bestanden
├─ tuya/            bestaande lib/, ongewijzigd verplaatst
└─ (modbus/ volgt in fase 2)
```

### Naar `lib/shared/`

| Bestand | Importeurs |
|---|---|
| `error-types.ts` | 4 |
| `building-model-learner.ts` | 3 |
| `flow-handler-wrapper.ts` | 2 |
| `logger.ts` | 2 |
| `preheat-calculator.ts` | 2 |
| `defrost-learner.ts` | 2 |
| `curve-calculator.ts` | 1 |
| `seasonal-mode-calculator.ts` | 1 |
| `self-healing-registry.ts` | 1 |
| `time-schedule-calculator.ts` | 1 |
| `cop-calculator.ts` | 1 |
| `rolling-cop-calculator.ts` | 1 |
| `settings-manager-service.ts` | 1 |
| `weather-forecast-service.ts` | 1 |

Totaal 15 bestanden importeren uit `lib/`. Beperkte importimpact.

### Verplichte extra controle

Per bestand niet alleen op byte-gelijkheid toetsen, maar ook op **module-level mutable
state** (ADR-001 §5c risico 6). Bekend geval:

```typescript
// lib/flow-handler-wrapper.ts
let flowLoggingEnabled = false;   // wordt één vlag voor beide drivers
```

Beslis per geval: acceptabel gedeeld, of verplaatsen naar een per-driver instantie. Voor
`flowLoggingEnabled` is gedeeld acceptabel (alleen logging), mits bewust vastgelegd.

### Verificatie

- `npm run build` groen
- `homey app validate` groen
- `git diff --stat` toont uitsluitend verplaatsingen en importregels
- Handmatig: één device draaien, capabilities updaten zoals voorheen

### Uitgevoerd

| | Resultaat |
|---|---|
| Verplaatste bestanden | 35 (14 → `lib/shared/`, 21 → `lib/tuya/`) |
| Door git herkend als rename | 35 van 35 — historie blijft behouden |
| Herschreven imports | 31 |
| Wijzigingen in `app.ts` / `drivers/` | 17 regels, **uitsluitend** importpaden |
| `tsc --noEmit` | groen |

**Controle op module-level mutable state** — uitgevoerd over alle 14 gedeelde bestanden.
Precies één treffer, zoals voorspeld in §5c risico 6:

```typescript
// lib/shared/flow-handler-wrapper.ts
let flowLoggingEnabled = false;
```

Bewust gedeeld gelaten: de vlag stuurt alleen diagnostische logging aan, dus inschakelen
voor de ene driver doet dat ook voor de andere — onschadelijk en bij debuggen zelfs
wenselijk. Vastgelegd in een commentaarblok in het bestand zelf, inclusief de waarschuwing
dat byte-gelijkheid geen garantie is dat delen veilig is.

**Restpunt**: de lege mappen `lib/adaptive`, `lib/definitions`, `lib/services`, `lib/types`
en `lib/utils` staan nog op schijf. Git volgt geen lege mappen, dus dit raakt de repository
niet — lokaal opruimen met `rmdir`.

---

## Fase 2 — Modbus-code toevoegen

Nog steeds geen gedeelde manifest-wijzigingen.

### Stappen

1. `lib/modbus/` overnemen uit de Modbus-app (registers, enum-mappers,
   fault-descriptions, tcp-service, runtime-service, adlar2-service, services/)
2. `drivers/intelligent-heatpump-modbus/` overnemen (device.ts, driver.ts,
   driver.compose.json, driver.settings.compose.json, pair/, assets/)
3. `.homeycompose/capabilities/`: de 15 Modbus-only capabilities toevoegen
4. `package.json`: `jsmodbus` toevoegen
5. `public/` (3 dashboards) en `widgets/adlar-live-operation/` overnemen
6. De 15 driver-exclusieve flow cards overnemen **met hun bestaande
   `driver_id`-filter ongewijzigd** (ADR-001 §2b)

### Klassestructuur: waar zit het onderscheid tussen de transports?

**Op App-niveau kan het niet.** Homey instantieert precies één `Homey.App`, opgelost uit
`app.js` (gecompileerd uit `app.ts`) via `module.exports`. `this.homey.app` is één object.
Twee afgeleide App-classes bestaan niet als mechanisme.

**Op Driver- en Device-niveau kan het wél — en je hebt het al.** Homey instantieert per
driver de klasse uit die drivermap:

| Niveau | Instanties | Tuya | Modbus |
|---|---|---|---|
| `Homey.App` | **1** per app | `MyApp` | *(vervalt bij merge)* |
| `Homey.Driver` | 1 per driver | `MyDriver` | `ModbusDriver` |
| `Homey.Device` | 1 per gepaird device | `MyDevice` (5342 regels) | `AdlarModbusDevice` (843 regels) |

De merge verandert hier niets aan: fase 2 neemt `drivers/intelligent-heatpump-modbus/`
inclusief `ModbusDriver` en `AdlarModbusDevice` ongewijzigd over. Homey kiest zelf de juiste
klasse op basis van de mapnaam. Alle transportspecifieke attributen en gedrag horen dáár —
en staan daar al.

#### Hoe app-level code onderscheid maakt

Vandaag hoeft dat nauwelijks: `app.ts` bevat 0 verwijzingen naar transport. Waar het straks
tóch nodig is (fase 5.1 SelfHealingRegistry, fase 3C clamp-logica, fase 6 widget) is
`device.driver.id` beschikbaar, maar dat is stringly-typed.

Voorkeur — een getypeerde discriminator, zonder gedeelde basisklasse:

```typescript
// lib/shared/heatpump-driver.ts
export type Transport = 'tuya' | 'modbus';

export interface HeatPumpDriver extends Homey.Driver {
  readonly transport: Transport;
}
```

```typescript
// drivers/intelligent-heat-pump/driver.ts
class MyDriver extends Homey.Driver implements HeatPumpDriver {
  readonly transport = 'tuya' as const;
}

// drivers/intelligent-heatpump-modbus/driver.ts
class ModbusDriver extends Homey.Driver implements HeatPumpDriver {
  readonly transport = 'modbus' as const;
}
```

Gebruik:

```typescript
const { transport } = args.device.driver as HeatPumpDriver;
const limits = transport === 'modbus' ? { min: 20, max: 75 } : { min: 30, max: 75 };
```

`implements` in plaats van `extends`: de compiler dwingt de eigenschap af zonder dat de twee
device- of driverklassen een gemeenschappelijke ouder krijgen. Met een `switch` op
`transport` en een `never`-vangnet vangt TypeScript bovendien een vergeten geval als er ooit
een derde transport bijkomt.

#### Wat we bewust níét doen in v3.0.0

Een gedeelde abstracte basisklasse (`BaseHeatPumpDevice`, `BaseHeatPumpDriver`) invoeren.
Dat is precies de servicesconvergentie die in ADR-001 is uitgesteld — en het zou betekenen
dat `MyDevice` (5342 regels) en `AdlarModbusDevice` (843 regels) op één hiërarchie moeten
worden gebracht. Kandidaat voor ná v3.0.0, samen met `AbstractServiceCoordinator`.

#### Twee kleine opruimpunten

1. **Klassenamen.** `MyApp`, `MyDevice` en `MyDriver` zijn scaffold-namen. In een app met
   twee drivers staat `MyDevice` verwarrend naast `AdlarModbusDevice`. Hernoemen naar
   `AdlarApp`, `AdlarTuyaDevice`, `AdlarTuyaDriver` is puur cosmetisch — klassenamen komen
   niet in `app.json` voor — maar scheelt bij het lezen. Optioneel, in fase 1 mee te nemen.

2. **Fragiele app-koppeling.** `flow-card-manager-service.ts:1297` cast de app naar een
   index-type om triggerkaarten te bereiken:

   ```typescript
   const app = this.device.homey.app as unknown as {
     [key: string]: { trigger?: (device: unknown, tokens: unknown) => Promise<void> } };
   ```

   Dat omzeilt typecontrole op de app-instantie. Met twee drivers die dezelfde app delen
   wordt die cast riskanter — een Modbus-service die een Tuya-triggerveld verwacht faalt pas
   op runtime. Vervangen door een expliciete interface op de app-klasse. Meenemen in fase 5.

### Nog niet doen

Gedeelde kaarten ontdubbelen (fase 3), splitsingen (fase 4), app-brede risico's (fase 5–6).
Op dit punt bestaan de 89 gedeelde kaarten nog dubbel — de build zal dat melden. Dat is
verwacht en wordt in fase 3 opgelost.

### Verificatie

- `npm run build` groen
- `homey app validate` meldt dubbele kaart-ID's → bevestigt dat fase 3 nodig is
- Modbus-driver verschijnt in de pairing-lijst

### Uitgevoerd

| | Resultaat |
|---|---|
| Lib-bestanden naar `lib/modbus/` | 28 |
| Overgeslagen (identiek, komen uit `lib/shared/`) | 14 |
| Herschreven imports | 78 |
| Drivermap | `drivers/intelligent-heatpump-modbus/` compleet |
| Capabilities toegevoegd | 15 (96 totaal) |
| Exclusieve flow cards toegevoegd | 7 (104 totaal) |
| `public/` + `widgets/` | gekopieerd |
| `package.json` | `jsmodbus ^4.0.10` toegevoegd |
| `tsc --noEmit` | 1 fout: `Cannot find module 'jsmodbus'` — verwacht, `npm install` nodig |

**Afwijking van het plan**: de Modbus-app heeft een `lib/modbus/`-submap. Eén-op-één
kopiëren zou `lib/modbus/modbus/adlar-modbus-registers.ts` opleveren. Die submap heet nu
`lib/modbus/protocol/` — zelfde inhoud, leesbaarder pad.

**Geen dubbele flow-card-ID's**: de 89 gedeelde kaarten bestonden al in de doel-app, dus
kopiëren van alléén de 7 exclusieve levert 104 unieke ID's op. `homey app validate` zal
hier dus géén ID-conflict melden — anders dan het plan voorspelde. De ontdubbeling in
fase 3 blijft nodig, maar om een andere reden: 72 kaarten dragen nog een Tuya-only
`driver_id`-filter en zijn daardoor onzichtbaar voor Modbus-devices.

**Nog niet gedaan — de widget werkt nog niet.** `widgets/adlar-live-operation/api.js` roept
`homey.app.getAdlarLiveOperationWidgetState()` aan, en die methode zit in de *Modbus*
`app.ts` (116 unieke regels: widget-state-resolver plus `setDashboardPort`). Die moeten naar
de Tuya `app.ts`. Staat gepland in fase 6, samen met het over beide drivers laten itereren
van `_getAdlarDevices()`. Tot dan is de widget aanwezig maar niet functioneel — dat blokkeert
pairing en normale werking niet.

---

## Fase 3 — Gedeelde flow cards ontdubbelen

Kern van de merge. 89 kaarten worden 88 + 1 splitsing.

### A. Filter volledig verwijderen — 65 kaarten

Behoud de Tuya-definitie, verwijder de Modbus-kopie, schrap `"filter"` uit het
device-argument.

```
acties (23)
  calculate_curve_value, calculate_linear_heating_curve, calculate_preheat_time,
  calculate_time_based_value, force_insight_analysis, generate_performance_report,
  get_seasonal_mode, receive_external_ambient_data, receive_external_energy_prices,
  receive_external_flow_data, receive_external_indoor_temperature,
  receive_external_power_data, receive_external_solar_power,
  receive_external_solar_radiation, receive_external_wind_data, set_capacity,
  set_desired_indoor_temperature, set_device_onoff, set_heating_curve,
  set_heating_mode, set_hotwater_temperature, set_target_temperature, set_work_mode

condities (17)
  capacity_setting_is, compressor_running, confidence_above, device_power_is,
  fault_active, heating_curve_is, heating_mode_is, hotwater_temperature_is,
  insight_is_active, power_above_threshold, savings_above, target_temperature_is,
  temperature_above, temperature_differential, total_consumption_above,
  water_flow_rate_check, work_mode_is

triggers (25)
  ambient_temperature_changed, coiler_temperature_alert, daily_consumption_threshold,
  discharge_temperature_alert, economizer_inlet_temperature_alert,
  economizer_outlet_temperature_alert, eev_pulse_steps_alert, evi_pulse_steps_alert,
  fault_detected*, forecast_heating_advice, heating_mode_changed,
  high_pressure_temperature_alert, incoiler_temperature_alert,
  inlet_temperature_changed, low_pressure_temperature_alert,
  outlet_temperature_changed, performance_report_ready, power_threshold_exceeded,
  pre_heat_recommendation, suction_temperature_alert, tank_temperature_alert,
  temperature_adjustment_recommended, total_consumption_milestone, water_flow_alert,
  work_mode_changed
```

\* `fault_detected` wordt in fase 4 gesplitst; behoudt hier de Tuya-definitie.

### B. Alleen `driver_id` schrappen, capability-filter behouden — 24 kaarten

```diff
- "filter": "driver_id=intelligent-heat-pump&capabilities=adlar_cop"
+ "filter": "capabilities=adlar_cop"
```

| Kaart | Capability |
|---|---|
| `cop_efficiency_check`, `compressor_efficiency_alert`, `cop_efficiency_changed`, `cop_outlier_detected`, `fan_motor_efficiency_alert` | `adlar_cop` |
| `cop_trend_analysis`, `cop_trend_detected` | `adlar_cop_trend` |
| `daily_cop_above_threshold`, `daily_cop_efficiency_changed` | `adlar_cop_daily` |
| `monthly_cop_above_threshold`, `monthly_cop_efficiency_changed` | `adlar_cop_monthly` |
| `price_in_cheapest_hours`, `price_trend_is`, `price_vs_daily_average`, `cheapest_block_started`, `expensive_block_approaching`, `price_trend_changed` | `energy_prices_data` |
| `adaptive_simulation_update`, `adaptive_status_change` | `adlar_simulated_target` |
| `building_insight_detected` | `building_insight_insulation` |
| `building_profile_mismatch` | `building_insight_profile` |
| `daily_cost_threshold` | `adlar_energy_cost_daily` |
| `learning_milestone_reached` | `adlar_building_c` |
| `price_threshold_crossed` | `adlar_energy_price_category` |

Alle twaalf genoemde capabilities bestaan in **beide** drivers. Omdat Modbus vandaag al zijn
eigen kopie van deze 24 kaarten heeft, verandert de zichtbaarheid niet — er komt één
definitie voor twee die er al waren.

### C. Bereik verbreden — 4 kaarten

| Kaart | Modbus | Tuya | Wordt |
|---|---|---|---|
| `set_target_temperature` | 15–60 / 1 | 5–75 / 1 | 5–75 / 1 |
| `target_temperature_is` | 15–60 / 1 | 5–60 / 0.5 | 5–60 / 0.5 |
| `set_hotwater_temperature` | 20–75 / 1 | 30–75 / 1 | 20–75 / 1 |
| `hotwater_temperature_is` | 20–75 / 1 | 30–75 / 1 | 20–75 / 1 |

**Verplicht bijwerken**: de run-listeners moeten per device clampen. `set_hotwater_temperature`
verbreedt de Tuya-ondergrens van 30 naar 20 °C — zonder clamp schuift een Tuya-gebruiker
buiten het DPS-bereik.

```typescript
const device = args.device as AdlarDevice;
const limits = device.driver.id === 'intelligent-heatpump-modbus'
  ? { min: 20, max: 75 }
  : { min: 30, max: 75 };
const value = Math.min(Math.max(args.temperature, limits.min), limits.max);
```

### D. Niet aankomen

`cop_calculation_method_is` is Tuya-only, maar filtert op `adlar_cop_method` — en Modbus
heeft die capability. Het `driver_id`-deel **blijft staan**. Zie ADR-001 §2b.

### Verificatie

- `app.json` bevat 105 flow cards, geen dubbele ID's
- `homey app validate -l debug` groen
- Bestaande Tuya-flow met `set_target_temperature` opnieuw openen: argument en waarde
  ongewijzigd
- Modbus-device: kaart verschijnt en werkt

### Uitgevoerd — manifestdeel

| Categorie | Aantal |
|---|---|
| Filter volledig verwijderd (gedeeld) | 65 |
| `driver_id` geschrapt, capability behouden | 24 |
| Modbus-exclusief, filter intact | 7 |
| Tuya-exclusief, filter intact | 8 |
| Bereik verbreed | 2 (`set_hotwater_temperature`, `hotwater_temperature_is`: 30 → 20 °C) |
| `cop_calculation_method_is` | ongemoeid, zoals besloten in §2b |

De twee `target_temperature`-kaarten bleken al op het bredere Tuya-bereik te staan; alleen
de warmwaterkaarten zijn aangepast.

De filterstrategie staat als één constante in het migratiescript (`STRATEGY='remove'`).
Blijkt uit V1 dat een device-argument zonder filter te breed is, dan levert
`STRATEGY='pipe'` dezelfde 65 kaarten met `driver_id=intelligent-heat-pump|intelligent-heatpump-modbus`.

---

## 🔴 Blokkerende vondst — fase 3 is niet af

Het manifestdeel van fase 3 is klaar, maar er is een tweede helft die in het oorspronkelijke
plan ontbrak.

**58 flow-card-ID's krijgen in de gemergde app een handler uit béíde codebases.**

| | Aantal |
|---|---|
| Kaart-ID's geregistreerd door Tuya-code (`app.ts`, `flow-helpers.ts`, `flow-card-manager-service.ts`) | 76 |
| Kaart-ID's geregistreerd door Modbus-code (`lib/modbus/…`, Modbus `device.ts`) | 61 |
| **Overlap** | **58** |

Omdat `registerRunListener()` per kaart één listener kent, wint de laatste registratie —
en die is transport-specifiek. Concreet voorbeeld: `set_hotwater_temperature` schrijft bij
Tuya via `triggerCapabilityListener('adlar_hotwater')`, maar de Modbus-driver **heeft die
capability niet** en schrijft rechtstreeks naar een register. Eén van beide implementaties
verdwijnt.

Dit is dezelfde klasse als §5a risico 4, maar een niveau hoger: daar sloot één handler over
het verkeerde *device*, hier bestaan twee volledig verschillende *implementaties* van
dezelfde kaart.

### Wat er nog moet gebeuren

Voor elk van de 58 ID's geldt één van drie:

1. **Handler is transport-agnostisch** (leest een capability die beide drivers hebben) →
   één implementatie behouden, de andere schrappen. Geldt voor het merendeel: de
   COP-condities, `temperature_above`, `fault_active`, de `receive_external_*`-acties.
2. **Handler verschilt per transport** → één handler die dispatcht op
   `args.device.driver.id`, respectievelijk delegeert naar een methode op het device
   (polymorfisme, zoals §5b beschrijft). Geldt voor de schrijfacties.
3. **Capability ontbreekt bij één driver** → kaart hoort niet gedeeld te zijn; alsnog een
   `capabilities=`-filter geven. Geldt voor `set_hotwater_temperature` en
   `hotwater_temperature_is` (`adlar_hotwater` bestaat niet bij Modbus).

Categorie 3 betekent dat de zojuist uitgevoerde bereikverbreding op die twee kaarten
mogelijk overbodig is — als ze Tuya-only worden, kan het bereik terug naar 30–75.

**Inschatting**: dit is de grootste post van de hele merge en groter dan fase 3 zoals
oorspronkelijk begroot. Het raakt `lib/tuya/services/flow-card-manager-service.ts` (30
listeners), `lib/modbus/services/flow-card-manager-service.ts` (45 listeners), `app.ts` en
beide `flow-helpers`-varianten.

### Besluit B5 — kaarten splitsen in plaats van handlers unificeren

**Gekozen: splitsen met `_modbus`-suffix.** Kaarten met een handler aan beide kanten worden
niet gedeeld; de Modbus-variant krijgt een eigen ID en zijn `driver_id`-filter terug.

Doorslaggevend: **Modbus-gebruikers bouwen hun flows toch volledig opnieuw op** — ze pairen
in een andere app. Nieuwe kaart-ID's kosten hen dus niets, terwijl Tuya-ID's exact
ongewijzigd blijven. Niemand breekt, en er hoeft geen enkele handler te worden herschreven.

Het sluit bovendien aan bij de al genomen besluiten: services naast elkaar (§4) en splitsen
bij conflicten (§2). Kaarten delen was de enige plek waar we tegen die lijn in gingen.

| | Delen | Splitsen (gekozen) |
|---|---|---|
| Handlers te unificeren | 66 | **0** |
| Kaarten in `app.json` | 104 | 170 |
| Onderhoud per gesplitste kaart | 1 definitie | 2 definities |
| Risico voor de 90% Tuya-basis | handler-race | geen |

#### Uitgevoerd

| Categorie | Aantal |
|---|---|
| Modbus-only (eigen ID + `driver_id`-filter) | 73 |
| Tuya-only (`driver_id`-filter hersteld) | 74 |
| Gedeeld met capability-filter | 15 |
| Gedeeld zonder filter | 8 |
| **Totaal** | **170** |
| Dubbele ID's | geen |

De 23 werkelijk gedeelde kaarten zijn die met een handler aan **één** kant — daar valt niets
te botsen. De rest is gesplitst.

**Correctie tijdens uitvoering**: mijn eerste scan telde 58 dubbele registraties. De
Modbus-code gebruikt echter een tweede registratiepatroon (`registerCapabilityAction(...)`)
dat de scan miste, goed voor 8 extra kaarten — waaronder `set_target_temperature`,
`set_hotwater_temperature` en `set_device_onoff`. Totaal dus 66. Zonder die correctie waren
juist de meest gebruikte schrijfacties stilzwijgend blijven botsen.

**Bijvangst die daarmee opgelost is**: `set_hotwater_temperature` werkte bij Tuya via
capability `adlar_hotwater`, die de Modbus-driver niet heeft. Door de splitsing is dat geen
probleem meer — de bereikverbreding naar 20 °C op de Tuya-kaart kan desgewenst terug naar
30–75, want die kaart is nu weer Tuya-only.

---

## Fase 4 — Capabilities: splitsen en harmoniseren

### Splitsen (3)

| Nieuw Modbus-ID | Reden |
|---|---|
| `adlar_state_backwater_modbus` | `enum` vs `boolean` |
| `adlar_enum_work_mode_modbus` | `uiComponent: sensor` vs `picker` |
| `adlar_enum_capacity_set_modbus` | `uiComponent: sensor` vs `picker` |

Bijwerken in: `.homeycompose/capabilities/`, `driver.compose.json` van de Modbus-driver, en
`applyModbusSnapshot()` in `drivers/intelligent-heatpump-modbus/device.ts`.

### Splitsen (1 flow card)

`fault_detected_modbus` — token `string` in plaats van `number`, argument `text` in plaats
van `range`. Krijgt `"filter": "driver_id=intelligent-heatpump-modbus"`.

### Harmoniseren (11)

- Beschrijvingen transport-neutraal maken ("Modbus device connection state" /
  "Tuya device connection state" → "Heat pump connection state")
- `heating_curve_slope`, `_intercept`, `_ref_temp`, `_ref_outdoor`: `insights: true`
  toevoegen (niet-brekend)

### Capability-eigenaarschap: hoe onderscheid je de drivers?

`.homeycompose/capabilities/` is **vlak en app-breed**. Homey Compose kent geen
capability-map per driver. Het onderscheid ligt een niveau lager:

| Laag | Bestand | Betekenis |
|---|---|---|
| **Definitie** | `.homeycompose/capabilities/<id>.json` | *Wat* de capability is: `type`, `units`, `decimals`, `uiComponent`, titel. App-scoped, één vlakke naamruimte |
| **Toewijzing** | `drivers/<id>/driver.compose.json` → `"capabilities": [...]` | *Welke driver* hem heeft |

Een definitie is dus een gedeelde pool; de `capabilities`-array van elke driver kiest
eruit. Onderscheid op definitieniveau is niet nodig en niet mogelijk.

Situatie na de merge (custom capabilities; systeemcapabilities als `onoff` en
`measure_power` hebben geen definitiebestand):

| Groep | Aantal |
|---|---|
| Definities in `.homeycompose/capabilities/` | 96 (+3 splitsingen = 99) |
| Toegewezen aan **beide** drivers | 65 |
| Alleen `intelligent-heat-pump` | 8 |
| Alleen `intelligent-heatpump-modbus` | 21 |
| Toegewezen aan **geen enkele** driver | **2** |

De twee wezen zijn `adlar_measure_pressure_effluent_temp` en
`adlar_measure_pressure_temp_current`: gedefinieerd, nergens gebruikt. Homey waarschuwt
hier niet voor. Opruimen of documenteren waarom ze bestaan.

#### Wat dit kost aan overzicht

Vandaag is eigenaarschap impliciet: twee repositories, dus een capability in de Modbus-repo
is per definitie van Modbus. Na de merge staan 96 bestanden in één map, allemaal met
`adlar_`-prefix, zonder enige aanwijzing welke driver ze gebruikt. Die impliciete kennis
verdwijnt.

**Niet doen**: alle 21 Modbus-only capabilities hernoemen naar `_modbus`. Dat is
gratuit hernoemen van werkende ID's, met migratiekosten en zonder functioneel voordeel. De
drie splitsingen uit §Splitsen krijgen die suffix omdat ze moeten, niet als conventie.

**Wel doen**: `driver.compose.json` als enige bron van waarheid vastleggen, en een
controlescript toevoegen dat bij elke build:

1. per custom capability rapporteert welke driver(s) hem gebruiken;
2. faalt op wezen (gedefinieerd, nergens toegewezen);
3. de lijst van 65 gedeelde capabilities apart toont — dat zijn de definities waar een
   wijziging **beide** drivers raakt.

#### Deliverable: `scripts/check-capability-ownership.js`

Uitgevoerd tegen de huidige Tuya-app en werkend bevonden. Toevoegen aan `package.json`:

```json
"scripts": {
  "check:caps": "node scripts/check-capability-ownership.js",
  "build": "npm run check:caps && tsc"
}
```

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

// Capabilities die bewust alleen runtime via addCapability() bestaan en
// dus terecht niet in driver.compose.json staan.
const RUNTIME_ONLY = new Set([
  'adlar_daily_disconnect_count',
]);

const ROOT = process.argv[2] || process.cwd();
const CAP_DIR = path.join(ROOT, '.homeycompose', 'capabilities');
const DRIVERS_DIR = path.join(ROOT, 'drivers');

const defs = fs.readdirSync(CAP_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5));

const drivers = fs.readdirSync(DRIVERS_DIR)
  .filter((d) => fs.existsSync(path.join(DRIVERS_DIR, d, 'driver.compose.json')))
  .map((d) => ({
    id: d,
    caps: new Set(
      (JSON.parse(fs.readFileSync(path.join(DRIVERS_DIR, d, 'driver.compose.json'), 'utf8')).capabilities || [])
        .map((c) => c.split('.')[0]),  // sub-capabilities normaliseren
    ),
  }));

const owners = new Map(defs.map((c) => [c, drivers.filter((d) => d.caps.has(c)).map((d) => d.id)]));
const orphans = defs.filter((c) => owners.get(c).length === 0 && !RUNTIME_ONLY.has(c));
const shared = defs.filter((c) => owners.get(c).length > 1);

console.log(`Capability-eigenaarschap (${defs.length} definities, ${drivers.length} drivers)\n`);
for (const d of drivers) {
  const own = defs.filter((c) => owners.get(c).length === 1 && owners.get(c)[0] === d.id);
  console.log(`  ${d.id}: ${own.length} exclusief`);
}
console.log(`  GEDEELD door meerdere drivers: ${shared.length}`);
console.log(`  WEES (nergens toegewezen)    : ${orphans.length}`);

if (shared.length) {
  console.log('\nGedeeld — een wijziging hier raakt meerdere drivers:');
  shared.forEach((c) => console.log(`   ${c}  ->  ${owners.get(c).join(', ')}`));
}
if (orphans.length) {
  console.log('\n❌ Wezen — gedefinieerd maar aan geen enkele driver toegewezen:');
  orphans.forEach((c) => console.log(`   ${c}`));
  process.exit(1);
}
console.log('\n✅ Geen wezen.');
```

**De `RUNTIME_ONLY`-allowlist is niet cosmetisch.** Bij de eerste testrun tegen de huidige
Tuya-app faalde het script op `adlar_daily_disconnect_count` — een capability die bewust
alleen via `addCapability()` bestaat en dus terecht niet in het manifest staat. Zonder
allowlist zou de regel "faal op wezen" de build breken op een correct geval. Precies deze
capability is ook degene waarvoor géén capability-filter mag worden gebruikt (ADR-001 §2b);
de allowlist is daarmee tevens de plek waar dat verband gedocumenteerd staat.

**Testresultaat huidige Tuya-app** (81 definities, 1 driver): 73 exclusief, 0 gedeeld, en
8 wezen — `adlar_daily_disconnect_count`, `adlar_measure_pressure_effluent_temp`,
`adlar_measure_pressure_temp_current` en de vijf `heating_curve_*`. De laatste vijf zijn in
de Tuya-app gedefinieerd maar uitsluitend aan de **Modbus**-driver toegewezen; na de merge
verdwijnen ze dus uit de wezenlijst. Netto blijven er dan 2 over.

Punt 3 is het belangrijkst voor de lange termijn. Het risico na de merge is niet de
eenmalige samenvoeging maar de dagelijkse: iemand past `units` of `decimals` aan van wat
hij voor een Modbus-capability aanziet, en verandert stilzwijgend het gedrag voor
Tuya-devices. Een gegenereerde eigenaarschapsmatrix maakt dat zichtbaar vóór de commit.

Alternatief voor het groeperen van capability-lijsten: `.homeycompose/drivers/templates/`
ondersteunt gedeelde driver-eigenschappen via `$extends`. Daarmee kun je de 65 gedeelde
capabilities in één template zetten en per driver alleen de eigen aanvullingen opnemen.
Overweeg dit ná v3.0.0 — het herschrijft twee `driver.compose.json`-bestanden en is geen
voorwaarde voor de merge.

### Verificatie

- 99 capabilities in `app.json`
- `homey app validate` groen
- Bestaand Tuya-device: geen enkele capability verdwenen of van type veranderd
- Controlescript: 0 wezen, eigenaarschapsmatrix compleet

### Uitgevoerd

| | Resultaat |
|---|---|
| Capabilities totaal | **99**, geen dubbele ID's |
| Structureel gesplitst | 3 (`adlar_enum_capacity_set`, `adlar_enum_work_mode`, `adlar_state_backwater` → `_modbus`) |
| `insights: true` toegevoegd | 4 × `heating_curve_*` |
| Transport-neutrale tekst | `adlar_connection_status` |
| `fault_detected_modbus` | al aangemaakt in fase 3 (zat bij de 66 gesplitste kaarten) |
| Driver-verwijzingen bijgewerkt | `driver.compose.json` + 2 codebestanden |
| Drivers verwijzen naar ongedefinieerde capability | geen |

**Twee correcties tijdens uitvoering.**

Mijn tekstvervanging voor transport-neutraliteit knipte "Tuya" met een regex weg en liet in
het Duits `"Aktueller -Geräteverbindungsstatus"` achter. Alle vier de vertalingen zijn
daarna handmatig gezet. Les: regex-substitutie op vertaalstrings is geen veilige aanpak —
schrijf de doeltekst voluit.

Het controlescript uit §"Capability-eigenaarschap" liep vast op
`cop_optimizer_diagnostics.json`, dat **geen `id`-veld** had. Dat is een pre-existente
omissie tegen de eis in CLAUDE.md ("elke capability MOET een expliciete `id` hebben") en
stond er al vóór de merge. Toegevoegd.

**Nog te doen bij deze fase**: migratiecode in de Modbus-`device.ts` is niet nodig — de
Modbus-driver is nieuw, dus alle devices worden vers gepaird met de `_modbus`-ID's. Wel
controleren of `applyModbusSnapshot()` de hernoemde capabilities correct schrijft; de
hernoeming is met een string-substitutie gedaan en `tsc` kan dit niet valideren omdat het
strings betreft.

---

## Fase 5 — App-brede risico's (blokkerend)

### 5.0 Herijking na fase 3 — risico 1 is fors kleiner geworden

Gemeten ná de kaartsplitsing van fase 3:

| | Aantal |
|---|---|
| `trackError`-aanroepen in `app.ts` | 41 |
| `trackError` in Modbus-code (`lib/modbus/`, Modbus `device.ts`) | **0** |
| `trackError` in `lib/tuya/` | **0** |
| `SelfHealingRegistry`-instanties | 1, in `app.ts` |

De registry wordt dus uitsluitend gebruikt door de app-level handlers in `app.ts`. De
Modbus-codebase raakt hem niet aan.

Van de 45 kaarten die `app.ts` en `lib/tuya/flow-helpers.ts` registreren zijn er na fase 3
nog **41 Tuya-only** (ze kregen hun `driver_id`-filter terug omdat Modbus een eigen
`_modbus`-variant heeft). Voor die 41 kan een Modbus-device de teller niet meer raken.

**Vier kaarten blijven gedeeld** en daar geldt risico 1 nog wel:

```
cop_efficiency_changed   daily_cop_efficiency_changed
monthly_cop_efficiency_changed   power_threshold_exceeded
```

Dit zijn triggers met een capability-filter (`adlar_cop*`, `measure_power`) die beide
drivers hebben. Een Modbus-device dat daarop herhaaldelijk faalt, kan die vier features nog
steeds app-breed uitschakelen.

**Gevolg voor 5.1**: de scoping blijft nodig, maar de urgentie is gedaald van "41 kaarten
kunnen kruisbesmetten" naar "4". Het blijft goedkoper om alle 41 aanroepen uniform te
scopen dan om vier uitzonderingen te onderhouden.

### 5.1 SelfHealingRegistry per driver scopen

41 aanroepen in `app.ts`:

```typescript
// van
this.selfHealing.trackError(featureName, { error });

// naar
const scope = `${featureName}:${args.device.driver.id}`;
this.selfHealing.trackError(scope, { error });
```

`isFeatureEnabled()` moet dezelfde sleutel gebruiken. Zonder deze wijziging kan een
Modbus-storing een functie uitschakelen voor Tuya-gebruikers (ADR-001 §5a risico 1).

### 5.2 Capability-filters — grotendeels vervallen, één nieuw gat

**Vervallen.** De vier kaarten die hier stonden hebben door de splitsing van fase 3 al een
`driver_id=intelligent-heat-pump`-filter gekregen:

| Kaart | Filter nu | Actie |
|---|---|---|
| `electrical_balance_check` | `driver_id=intelligent-heat-pump` | geen |
| `system_pulse_steps_differential` | `driver_id=intelligent-heat-pump` | geen |
| `temperature_differential` | `driver_id=intelligent-heat-pump` | geen |
| `water_flow_rate_check` | `driver_id=intelligent-heat-pump` | geen |

Een capability-filter zou hier niets toevoegen: `driver_id` sluit Modbus al uit.

#### 🔴 Nieuw gat — `power_threshold_exceeded`

Van de vier nog gedeelde app-level kaarten hebben er drie een capability-filter dat klopt:

```
cop_efficiency_changed          → capabilities=adlar_cop          (beide drivers: JA)
daily_cop_efficiency_changed    → capabilities=adlar_cop_daily    (beide drivers: JA)
monthly_cop_efficiency_changed  → capabilities=adlar_cop_monthly  (beide drivers: JA)
power_threshold_exceeded        → GEEN capability-filter
```

`power_threshold_exceeded` staat op `driver_id=intelligent-heat-pump|intelligent-heatpump-modbus`
zonder capability-deel, maar de handler leest `measure_power` — en **die capability heeft de
Modbus-driver niet**. De kaart verschijnt dus bij Modbus-devices en levert daar altijd `0`
op (de `|| 0`-fallback uit besluit B1).

**Actie**: capability-filter toevoegen.

```diff
- "filter": "driver_id=intelligent-heat-pump|intelligent-heatpump-modbus"
+ "filter": "driver_id=intelligent-heat-pump|intelligent-heatpump-modbus&capabilities=measure_power"
```

Daarmee valt de kaart automatisch weg bij Modbus zolang die geen `measure_power` levert, en
komt hij vanzelf terug als dat verandert. Krijgt de Modbus-driver later `measure_power`
(zie besluit B2 over het `energy`-object), dan werkt de kaart meteen.

Dit is een voorbeeld van de klasse fouten die `validate` niet vindt: het manifest is
geldig, de kaart verschijnt netjes, en hij geeft stilzwijgend het verkeerde antwoord.

**Doorgevoerd.** Er staat nu ook een controle in `verify.py` die per gedeelde kaart
rapporteert hoe hij gescoped is.

> **Correctie op mijn eerste versie van die controle.** Die vlagde "capability ontbreekt bij
> een driver" als fout — maar dat is juist de bedoelde constructie: zo beperk je een gedeelde
> kaart tot de driver die hem kan bedienen. De controle rapporteert nu drie categorieën, en
> alleen de laatste twee vragen aandacht:
>
> - *beperkt via capability* — correct, informatief
> - *gedeeld zónder capability-filter* — handmatig te beoordelen
> - *dode kaart* (geen enkele driver heeft de capability) — fout

**Uitkomst:**

| Categorie | Aantal |
|---|---|
| Beperkt via capability | 1 (`power_threshold_exceeded` → alleen Tuya) |
| Gedeeld zonder capability-filter | **7** — handmatig te controleren |
| Dode kaart | 0 |

De zeven zonder filter zijn: `forecast_heating_advice`, `heating_mode_changed`,
`daily_consumption_threshold`, `work_mode_changed`, `pre_heat_recommendation`,
`temperature_adjustment_recommended`, `total_consumption_milestone`.

#### Handmatige beoordeling — uitgevoerd

| Kaart | Wie vuurt hem af | Capability-afhankelijkheid | Oordeel |
|---|---|---|---|
| `heating_mode_changed` | beide (`snapshot-trigger-service` + Tuya `device.ts`) | geen — pure trigger | ✅ terecht gedeeld |
| `work_mode_changed` | beide | geen | ✅ |
| `daily_consumption_threshold` | beide (`energy-tracking-service`) | geen | ✅ |
| `total_consumption_milestone` | beide | geen | ✅ |
| `temperature_adjustment_recommended` | beide (`adaptive-control-service`) | geen | ✅ |
| `forecast_heating_advice` | beide | `adlar_forecast_advice`, `adlar_forecast_cop_correction` — **beide drivers hebben ze** | ✅ |
| `pre_heat_recommendation` | beide | `target_temperature.indoor` (beide) + `desired_indoor_temp` | ⚠️ zie hieronder |

De eerste zes zijn terecht gedeeld: het zijn triggers die elke driver zelf afvuurt, zonder
capability die één kant mist. Geen `power_threshold_exceeded`-achtig lek.

#### ⚠️ Bestaande bug: `desired_indoor_temp` bestaat niet

`building-insights-service.ts` leest op twee plaatsen:

```typescript
const targetTemp = await this.device.getCapabilityValue('desired_indoor_temp');
```

Die capability bestaat **niet** — geen definitiebestand, en geen van beide drivers heeft
hem. `getCapabilityValue()` geeft daar dus permanent `null`.

Dit is **geen merge-fout**: de aanroep stond al in de Tuya-app en is in beide kopieën van
de service aanwezig. Waarschijnlijk bedoeld was `target_temperature.indoor`, dat wél
bestaat en in dezelfde functie wordt gebruikt.

**Actie**: los van de merge te repareren. Beoordelen of de aanroep naar
`target_temperature.indoor` moet, of dat de logica eromheen dood is. Opgenomen als V13.

**Conclusie**: de zeven gedeelde kaarten zonder capability-filter zijn alle zeven correct
gescoped. De enige vondst is een pre-existente bug in een capability-naam.

### 5.2bis — Driver-onafhankelijkheid: er zijn géén app-level kaarten

Getoetst na fase 3:

| | Aantal |
|---|---|
| Kaarten zónder device-argument | **0** |
| Kaarten met device-argument zónder `driver_id` | **0** |

Alle 173 kaarten zijn **device-kaarten**. App-level kaarten in de Homey-zin bestaan niet in
deze app. Dat was de zorg over onafhankelijkheid, en die is ongegrond.

#### De 20 gedeelde kaarten koppelen de drivers niet

Van de gedeelde kaarten hebben er **18 geen gedeelde handler**: het zijn triggers die elke
driver zelf afvuurt met `.trigger(device, tokens)`. Eén definitie, twee onafhankelijke
aanroepers, Homey routeert op device. Geen koppeling.

#### Vermeende koppeling die niet bestond

Ik diagnosticeerde drie kaarten (`cop_efficiency_changed`, `daily_cop_efficiency_changed`,
`monthly_cop_efficiency_changed`) als koppeling: run-listener alleen in Tuya-code, dus
Modbus zou daarvan afhankelijk zijn.

**Bij het splitsen bleek de Modbus-code die ID's nul keer te noemen.** Modbus vuurde ze
nooit af. Er wás geen koppeling — alleen Tuya gebruikte ze, terwijl het filter suggereerde
dat ze gedeeld waren.

Correcte uitkomst: de drie zijn nu **Tuya-only** met behoud van hun capability-filter. De
`_modbus`-varianten die ik tijdens de splitsing aanmaakte zijn dode kaarten en moeten
worden verwijderd:

```bash
rm .homeycompose/flow/triggers/cop_efficiency_changed_modbus.json
rm .homeycompose/flow/triggers/daily_cop_efficiency_changed_modbus.json
rm .homeycompose/flow/triggers/monthly_cop_efficiency_changed_modbus.json
```

*(De analyse-sandbox mag geen bestanden verwijderen; lokaal uitvoeren. Daarna staat het
totaal weer op 170.)*

#### Opgeruimd — eindtoestand

| Handeling | Resultaat |
|---|---|
| Drie dode `_modbus`-kaarten verwijderd | `cop_efficiency_changed_modbus`, `daily_cop_efficiency_changed_modbus`, `monthly_cop_efficiency_changed_modbus` |
| `cop_outlier_detected` → Tuya-only | Modbus vuurt hem niet af |
| `cop_trend_detected` → Tuya-only | idem |
| Lege `lib/`-mappen uit fase 1 | opgeruimd |
| `assets/.DS_Store` | verwijderd |

**Eindverdeling:**

| Categorie | Aantal |
|---|---|
| Modbus-only | 73 |
| Tuya-only | 79 |
| Gedeeld (`driver_id=a\|b`) | 18 |
| **Totaal** | **170** |

**Sluitende controle**: alle 18 gedeelde kaarten worden door **beide** codebases gebruikt —
elk vuurt ze af voor zijn eigen devices. Geen enkele gedeelde kaart hangt nog aan één kant.

```
gedeeld: 18  |  door beide gebruikt: 18
```

**Conclusie**: nul app-level kaarten, nul gedeelde run-listeners, nul eenzijdig gebruikte
gedeelde kaarten. De drivers zijn volledig onafhankelijk. Risico 1 uit §5.0 heeft daarmee
geen pad meer — 5.1 is hygiëne voor toekomstige toevoegingen, geen publicatievoorwaarde.

### 5.3bis — Restrisico dat blijft

De drie COP-kaarten hebben hun capability wél bij beide drivers, dus die blijven terecht
gedeeld. Daar geldt risico 1 uit §5.0 onverkort: een Modbus-device dat herhaaldelijk faalt
op `cop_efficiency_changed` kan die kaart app-breed uitschakelen voor Tuya-gebruikers.

Dat is precies de reden om 5.1 alsnog uit te voeren, ook al is de urgentie gedaald: het gaat
nu om drie kaarten in plaats van 41, maar het pad bestaat nog.

### 5.3 Null-afhandeling in app-level condities — grotendeels vervallen

**Besluit B1**: de `|| 0`-fallback blijft. Een ontbrekende meetwaarde is geen fout — vóór
de eerste poll is `null` een normale toestand, en een exceptie zou flows onnodig stoppen.
Geen wijziging aan de 8 `getCapabilityValue`-aanroepen.

Resteert één voorstel: `electrical_balance_check` laten weigeren te oordelen wanneer
**alle drie** de stroommetingen ontbreken, in plaats van `true` = "in balans" terug te
geven voor een dood device. Zie B1 onder "Genomen besluiten". Nog te beslissen.

### Status fase 5

| Onderdeel | Status |
|---|---|
| 5.1 SelfHealingRegistry scopen | 🟡 **Open** — enige resterende taak. Urgentie: hygiëne |
| 5.2 Capability-filters | ✅ Afgerond; `power_threshold_exceeded` gerepareerd |
| 5.2bis Driver-onafhankelijkheid | ✅ Getoetst: 0 app-kaarten, 0 gedeelde handlers |
| 5.3 Null-afhandeling | ✅ Vervallen door besluit B1 |

**5.1 is het enige dat rest, en de aanleiding is grotendeels weg.** Na §5.2bis zijn er geen
gedeelde run-listeners meer: elke kaart die een Modbus-device kan afvuren wordt door
Modbus-code afgehandeld, en `trackError()` staat uitsluitend in `app.ts` — dat nu alleen nog
Tuya-kaarten bedient.

Uitvoeren blijft verstandig als vangnet voor toekomstige gedeelde kaarten, maar het is geen
voorwaarde meer voor publicatie:

```typescript
const scope = `${featureName}:${args.device.driver.id}`;
this.selfHealing.trackError(scope, { error });
```

**Uitgevoerd.** Een helper `scopedFeature(featureName, args)` op de app-klasse hangt de
`driver.id` van `args.device` aan de sleutel, met terugval op de kale naam wanneer de
kaart geen device-argument heeft (de rekenkaarten — die blijven bewust app-breed).

| | Aantal |
|---|---|
| `isFeatureEnabled()` gescoped | 15 |
| `trackError()` gescoped | 41 |
| Resterend ongescoped | **0** |

`tsc --noEmit` groen.

### Verificatie

- Modbus-device 60 fouten laten produceren op één kaart; Tuya-device blijft die kaart
  gewoon uitvoeren
- Kaart met ontbrekende capability verschijnt niet bij een Modbus-device
- Conditie op een offline device stopt de flow zichtbaar

---

## Fase 6 — App-brede voorzieningen

| Onderwerp | Actie |
|---|---|
| Widget (§5c risico 5) | **INGETROKKEN — geen wijziging nodig.** Zie hieronder |
| `flowLoggingEnabled` (risico 6) | Gedeeld gedrag bewust vastleggen of per driver scopen |
| `energy`-object (risico 7) | Bepalen of de Modbus-driver `approximation.usageConstant` krijgt of `measure_power` levert |
| DashboardService | Alleen starten bij ≥1 gepaird Modbus-device |
| Locales | **Vervalt — gemeten.** Beide apps hebben 9 sleutels in `locales/*.json`; Modbus heeft **0** sleutels die Tuya niet ook heeft. De vertalingen van capabilities en flow cards staan inline in de compose-bestanden en dekken al en/nl/de/fr. Modbus mist alleen de bestanden `de.json`/`fr.json`, met identieke inhoud aan Tuya |
| Lazy require | `jsmodbus` en `tuyapi` pas laden bij gebruik |

### Verificatie

- Tuya-only installatie: widget toont de Tuya-pomp, dashboard-server start niet
- Modbus-only installatie: widget toont de Modbus-pomp, dashboard bereikbaar
- `homey app validate -l debug` groen

---

### 6.1 — Widget: risico 5 ingetrokken

De widget is **bewust alleen voor de Modbus-driver bedoeld**, en de bestaande implementatie
klopt daarmee.

`widgets/adlar-live-operation/widget.compose.json`:

```json
"filter": { "class": "heatpump",
            "capabilities": "measure_temperature.outlet,measure_temperature.inlet" }
```

| Capability | Tuya | Modbus |
|---|---|---|
| `measure_temperature.outlet` | — | JA |
| `measure_temperature.inlet` | — | JA |

De Tuya-driver heeft die twee capabilities niet, dus de widget-filter sluit Tuya-devices al
uit. `_getAdlarDevices()` dat `getDriver('intelligent-heatpump-modbus')` aanroept is
**consistent** met dat filter, geen bug.

**Correctie op §5c risico 5.** Ik nam aan dat een app-scoped widget over beide drivers moest
itereren en noemde dat blokkerend voor de 90% Tuya-basis. Dat was een aanname over de
bedoeling, niet een waarneming. De filter stond er al en scopet correct.

**Wat wél moet gebeuren**: de ~116 unieke regels uit de Modbus-`app.ts` overzetten —
`getAdlarLiveOperationWidgetState` (62), `setDashboardPort` (26), `_findAdlarDevice` (18) en
`_getAdlarDevices` (10). Zonder die methodes bestaat de API die `widgets/*/api.js` aanroept
niet en toont de widget niets. `ADLAR_DRIVER_ID` blijft daarbij op
`intelligent-heatpump-modbus` staan.

> Aandachtspunt bij het overzetten: een Tuya-only installatie heeft de Modbus-driver wel in
> het manifest maar geen gepairde devices. `getDriver()` slaagt dan, `getDevices()` geeft een
> lege array, en de bestaande code vangt dat al af met "Geen Adlar warmtepomp gekoppeld".
> Voor die gebruikers verschijnt de widget niet in de kiezer, omdat het capability-filter
> geen enkel device matcht.

### 6.2 — Uitgevoerd: `app.ts` samengevoegd

Via `scripts/migration/05-merge-app-ts.py` (idempotent — een tweede run doet niets).

| | Resultaat |
|---|---|
| Toegevoegde regels Modbus-code | 112 |
| Overgezette methodes | `getAdlarLiveOperationWidgetState`, `_getAdlarDevices`, `_findAdlarDevice`, `setDashboardPort` |
| Toegevoegde imports | `DashboardService`, `LiveOperationWidgetState` uit `lib/modbus/services/` |
| Klassevelden | `_dashboard`, `_dashboardPort` + `dashboard`-getter |
| `ADLAR_DRIVER_ID` | blijft `intelligent-heatpump-modbus` (§6.1) |
| `tsc --noEmit` | groen |

**Dashboard start conditioneel:**

```typescript
const modbusDevices = this.homey.drivers.getDriver(ADLAR_DRIVER_ID).getDevices();
if (modbusDevices.length > 0) {
  await this.setDashboardPort(DEFAULT_DASHBOARD_PORT);
} else {
  this.logger.debug('App: no Modbus devices paired — dashboard server not started');
}
```

Een Tuya-only installatie krijgt zo geen HTTP-server op poort 8090. `onUninit` ruimt de
server op.

> **Procesfout P4 — plaatsing van het startblok.** Mijn eerste versie van het script zette
> dit blok aan het *begin* van `onInit()`. Daar bestaat `this.logger` nog niet — die wordt
> pas halverwege `onInit` geïnitialiseerd (regel ~203), dus `this.logger.debug()` zou een
> `TypeError` gooien op elke Tuya-only installatie. `tsc` ziet dit niet: `this.logger` is
> gedeclareerd met `!` (definite assignment), dus het type klopt.
>
> Blok verplaatst naar het einde van `onInit`; het script is gecorrigeerd met een
> brace-teller die het einde van de methode zoekt, plus een commentaar dat de reden vastlegt.

### 6.3 — Lazy `require`: geadviseerd om **niet** te doen

Gemeten:

| Bibliotheek | Omvang | Eigen dependencies | Gebruikspunten |
|---|---|---|---|
| `tuyapi` | 104 KB | `debug`, `p-queue`, `p-retry`, `p-timeout` | 50 in `tuya-connection-service.ts` |
| `jsmodbus` | 880 KB | `crc`, `debug` | 4 in `modbus-tcp-service.ts` |

Samen circa 1 MB, waarvan een gebruiker er altijd één daadwerkelijk nodig heeft. De winst
van lazy laden is dus hooguit ~0,9 MB bij een Modbus-only installatie en ~0,1 MB bij
Tuya-only.

Daar staat tegenover dat het omzetten van `import TuyAPI from 'tuyapi'` naar een lazy
`require` **50 gebruikspunten** raakt in `tuya-connection-service.ts` — het bestand met de
meeste defensieve logica van de hele app (2333 regels, vijf heartbeat-lagen). Types
behouden vraagt een `import type` + module-level cache, en elke fout daarin raakt de
verbindingslaag van de 90%-basis.

**Advies: niet doen.** De verhouding tussen risico en winst is ongunstig. Een Homey Pro
heeft ruim voldoende geheugen voor een ongebruikte module van 900 KB.

**Alternatief als geheugendruk ooit een echt probleem wordt**: alleen `jsmodbus` lazy maken
(4 gebruikspunten, 880 KB — het grootste deel van de winst voor een fractie van het risico)
en `tuyapi` laten staan.

**Fase 6 is daarmee afgerond.** Resteert alleen het `energy`-object (besluit B2), dat
bewust is doorgeschoven omdat het modelafhankelijk is.

## Fase 7 — Integratietest op hardware

| Scenario | Verwacht |
|---|---|
| Alleen Tuya gepaird | Identiek aan v2.13.1 |
| Alleen Modbus gepaird | Identiek aan Modbus v2.15.0 |
| Beide gepaird | Kaarten werken op het geselecteerde device; geen kruisbesmetting |
| Modbus-gateway ontkoppeld | Tuya blijft volledig functioneel; geen app-brede degradatie |
| Tuya-verbinding verbroken | Modbus blijft volledig functioneel |
| Bewust onafgevangen socketfout | App overleeft; `uncaughtException`-handler logt (§5a risico 2) |

---

## Fase 8 — Kaartcuratie herstellen (🟠 bestaande schuld)

Niet merge-blokkerend. Wel de grootste zichtbare kwaliteitswinst voor gebruikers die we
onderweg tegenkwamen, en het raakt code die in fase 0 toch al open ligt.

### Wat kapot is

**Acht instellingen doen niet wat hun label belooft.** `flow_temperature_alerts`,
`flow_voltage_alerts`, `flow_current_alerts`, `flow_power_alerts`,
`flow_pulse_steps_alerts`, `flow_state_alerts`, `flow_efficiency_alerts` en
`flow_expert_mode` staan als dropdown of checkbox in de device-settings, met labels als
*"Control temperature alert flow cards visibility"*. Op de zichtbaarheid van flow cards
hebben ze geen enkel effect.

> **Correctie op een eerdere versie van deze paragraaf.** Daarin stond dat de acht
> instellingen "niets doen". Dat klopt niet. `CapabilityHealthService.isCategoryEnabled()`
> leest ze wél — om te bepalen welke capability-categorieën meedoen aan health tracking:
>
> ```typescript
> case 'temperature':
>   return userPrefs.flow_temperature_alerts !== 'disabled';
> ```
>
> Ze zijn dus niet dood maar **verkeerd gelabeld**: het label zegt "flow cards visibility",
> het effect is "meedoen aan health tracking". Dat verandert de aanbeveling hieronder
> ingrijpend — verwijderen zou health tracking stukmaken.

Bewijsketen:

| Stap | Bevinding |
|---|---|
| `updateFlowCards()` roept 7× `registerFlowCardsByCategory()` aan | Die methode berekent `shouldRegister`, logt, en **registreert niets**. Code-commentaar: *"Flow cards are handled by the pattern-based system in app.ts"* |
| Dat patroon-systeem staat in `lib/flow-helpers.ts` | Raadpleegt de `flow_*`-instellingen **0 keer** |
| `flow_expert_mode` gate `registerExpertFeatureCards()` | Die methode bevat **0** `registerRunListener`-aanroepen |

De 30 werkelijke registraties komen uit `registerActionBasedConditionCards` (16),
`registerExternalDataActionCards` (8) en `registerBuildingInsightsCards` (5) — allemaal
onvoorwaardelijk.

### De oorspronkelijke bedoeling

Uit `shouldRegisterCategory()`:

```typescript
case 'disabled': return false;
case 'enabled':  return availableCaps.length > 0;                    // heeft de capability
case 'auto':     return availableCaps.length > 0
                     && availableCaps.some((c) => capabilitiesWithData.includes(c));
```

Per categorie kaarten tonen op basis van capability-aanwezigheid én daadwerkelijke
datastroom. Bij 97 flow cards een zinnig doel.

**Het `auto`-gedrag is niet realiseerbaar.** Homey biedt geen runtime per-device
kaartzichtbaarheid: geen unregister-API voor run-listeners, en `filter: "capabilities=…"`
volgt expliciet geen `addCapability`/`removeCapability`. Die belofte kan in geen enkele
implementatie worden ingelost.

### Wat Homey wél biedt — en wat daarvan gebruikt wordt

| Mechanisme | Werking | Nu in gebruik |
|---|---|---|
| `"highlight": true` | Kaart in een aparte lijst bovenaan | **54 van 97 kaarten** |
| `"advanced": true` | Kaart alleen beschikbaar in Advanced Flow | **0 kaarten** |
| `filter: "capabilities=…"` | Statisch, per driver | 24 kaarten |
| `"deprecated": true` | Verdwijnt uit de kiezer, bestaande flows blijven werken | 0 kaarten |

Het mechanisme dat het probleem oplost — `advanced` — is ongebruikt. Het mechanisme dat
alleen helpt bij spaarzaam gebruik is toegepast op 84% van de acties, 41% van de condities
en 49% van de triggers. De Homey-documentatie waarschuwt daar expliciet voor: *"If you
highlight too many cards this list can quickly become just as hard to navigate as the list
of all Flow cards."*

### Voorstel

**8.1 — Hernoem de acht instellingen; verwijder ze niet.** Ze sturen health tracking aan,
dus weghalen breekt `CapabilityHealthService`. Wat wél moet: label en hint laten beschrijven
wat ze werkelijk doen.

```diff
- "label": { "en": "Temperature alert flow cards" }
- "hint":  { "en": "Control temperature alert flow cards visibility" }
+ "label": { "en": "Temperature sensor monitoring" }
+ "hint":  { "en": "Include temperature sensors in capability health tracking" }
```

Overweeg tegelijk hernoemen van de sleutels (`flow_temperature_alerts` →
`health_temperature_monitoring`). Dat vraagt migratiecode in `onInit()` om bestaande
waarden over te zetten; zonder die code vallen alle devices terug op de default.

De code-opruiming is inmiddels uitgevoerd (zie hieronder): `updateSettings()`,
`shouldRegisterCategory()`, `registerFlowCardsByCategory()`, `registerExpertFeatureCards()`
en drie ongebruikte lokale kopieën zijn uit `flow-card-manager-service.ts` verwijderd. De
instellingen zelf zijn ongemoeid gelaten.

**8.2 — `"advanced": true` op de 11 diagnostische alarmkaarten.** Deze horen thuis in
Advanced Flow, niet in de standaardkiezer:

```
coiler_temperature_alert              high_pressure_temperature_alert
low_pressure_temperature_alert        incoiler_temperature_alert
tank_temperature_alert                suction_temperature_alert
discharge_temperature_alert           economizer_inlet_temperature_alert
economizer_outlet_temperature_alert   eev_pulse_steps_alert
evi_pulse_steps_alert
```

Dit realiseert alsnog het doel van `flow_expert_mode` — diagnostiek scheiden van dagelijks
gebruik — maar met het mechanisme dat Homey daarvoor heeft. Overweeg ook de vier
`calculate_*`-acties; dat zijn rekenhulpen voor gevorderde flows.

**8.3 — Snoei `highlight` van 54 naar ongeveer 11.** Voorstel:

| Type | Behouden |
|---|---|
| Acties | `set_target_temperature`, `set_device_onoff`, `set_heating_mode`, `set_hotwater_temperature` |
| Condities | `fault_active`, `compressor_running`, `temperature_above` |
| Triggers | `fault_detected`, `heating_mode_changed`, `ambient_temperature_changed`, `cop_efficiency_changed` |

De acht `receive_external_*`-acties zijn integratie-plumbing voor wie externe meetdata
aankoppelt — nuttig, maar niet wat een gebruiker als eerste zoekt. Idem de
`price_*`-condities en de `building_insight_*`-triggers.

### Alternatief als je de instellingen wilt behouden

Zet de conditie in de handler: een uitgeschakelde categorie laat de kaart `false`
teruggeven. Functioneel honoreert dat de instelling, maar het woord *visibility* in het
label blijft onwaar — de kaart blijft zichtbaar en doet alleen niets. Half ingelost is hier
slechter dan eerlijk weggehaald.

### Verificatie

- `homey app validate` groen
- Instellingenpagina toont geen niet-werkende opties meer
- Standaard-flowkiezer toont 11 uitgelichte kaarten in plaats van 54
- De 11 diagnostische kaarten verschijnen alleen in Advanced Flow
- Bestaande flows met die kaarten blijven werken (`advanced` verbergt alleen bij toevoegen)

## Release en migratie

### Volgorde

1. **v2.14.0** — fase 0 alleen. Minimaal twee weken in productie laten staan.
2. **v3.0.0** — fasen 1 t/m 7.

### Modbus-gebruikers

Homey kent geen cross-app device-migratie. Vereist:

1. Devices opnieuw pairen in `org.hhi.adlar-heatpump`
2. Alle flows opnieuw opbouwen
3. 72 device-settings opnieuw invullen
4. Insights-historie gaat verloren

Begeleiding:

- Laatste release van `org.hhi.adlar-heatpump-modbus` met changelog-verwijzing
- Migratiehandleiding in `docs/setup/`
- Aankondiging in beide community-topics (143690 en 154741)
- Overweeg export/import van device-settings als JSON om stap 3 te verlichten

### Changelog v3.0.0

Conform CLAUDE.md: feitelijk, geen waarom of hoe.

```text
"Modbus-warmtepompen (Adlar Castra via RS485-gateway) worden nu door deze app
ondersteund via een tweede driver."
"Stooklijn-capabilities (slope, intercept, referentietemperaturen) hebben nu
Insights-historie."
```

---

## Rollbackstrategie

| Fase | Terugdraaien |
|---|---|
| 0 | Losse release, los terug te draaien. Geen manifestwijziging |
| 1 | Puur verplaatsingen — `git revert` volstaat |
| 2 | Additief — Modbus-bestanden verwijderen |
| 3–4 | **Manifestwijziging.** Terugdraaien ná publicatie raakt gebruikersflows. Grondig valideren vóór publicatie |
| 5–6 | Codewijziging zonder manifestimpact — terug te draaien |

Vanaf fase 3 is publiceren een eenrichtingsstap. Fasen 3 en 4 samen valideren en pas na
fase 7 publiceren.

## Voortgang

| Fase | Status |
|---|---|
| 0 — `args.device` in flow-card-manager | ✅ Code klaar. **Aparte release v2.14.0**, nog niet uitgeleverd |
| 1 — `lib/` herstructureren | ✅ 35 bestanden, 31 imports, gedragsneutraal bewezen |
| 2 — Modbus overnemen | ✅ 28 lib-bestanden, driver, 15 capabilities, assets |
| 3 — Flow cards ontdubbelen | ✅ 66 gesplitst (B5), 170 kaarten, geen dubbele ID's |
| 4 — Capabilities | ✅ 3 splitsingen, 99 capabilities |
| 5 — App-brede risico's | ✅ **Afgerond** — 5.1 gescoped (56 aanroepen), 5.2 + 5.2bis klaar, 5.3 vervallen (B1) |
| 6 — App-voorzieningen | ✅ **Afgerond** — `app.ts` samengevoegd, dashboard conditioneel, lazy `require` beargumenteerd afgewezen. `energy` doorgeschoven (B2) |
| 7 — Hardwaretest | ⬜ Niet begonnen |
| 8 — Kaartcuratie | ⬜ Niet begonnen |

**Twee keer `homey app validate -l publish` groen**: na fase 4 en na fase 6.2.

### Wat nog niet is aangeraakt

| Onderwerp | Waar |
|---|---|
| ~~7 gedeelde kaarten zonder capability-filter~~ — ✅ beoordeeld, alle zeven correct | §5.2 |
| `desired_indoor_temp` bestaat niet (pre-existente bug) | V13 |
| `energy.approximation` voor Modbus | B2 |
| ~~Lazy `require`~~ — ✅ gemeten en beargumenteerd afgewezen | §6.3 |
| Settings-export voor Modbus-migratie | B4 — hoort in de láátste release van de Modbus-app |
| `npm run lint -- --fix` als losse commit | Lintsectie |
| 2× `no-nested-ternary`, `max-classes-per-file` | Lintsectie |
| `getRollingCOPCalculator()` bestaat niet op `ServiceCoordinator` | V1 in het logboek |
| `electrical_balance_check` bij eenfase-installaties | Fase 8 / B1 |

## Migratiescripts

De fasen 1 t/m 4 zijn met scripts uitgevoerd, niet met de hand. Ze staan in
`scripts/migration/` zodat het plan reproduceerbaar is in plaats van reconstrueerbaar.

| Script | Fase | Wat het doet |
|---|---|---|
| `01-restructure-lib.py` | 1 | 35 bestanden via `git mv` naar `lib/shared/` + `lib/tuya/`, imports herschrijven |
| `02-import-modbus.py` | 2 | Modbus-lib, driver, capabilities, exclusieve kaarten, `public/`, `widgets/` |
| `03-split-flowcards.py` | 3 | Kaarten splitsen (B5) en filters zetten; `STRATEGY`-constante bovenaan |
| `04-split-capabilities.py` | 4 | 3 capability-splitsingen, `insights`, transport-neutrale tekst, ontbrekende `id` |
| `05-merge-app-ts.py` | 6 | Modbus-widget/dashboard-code naar `app.ts`; idempotent |
| `verify.py` | alle | Verdeling, dubbele ID's, capabilities zonder `id`, ongedefinieerde verwijzingen, scoping van gedeelde kaarten |

Draaien vanuit de repository-root, met `../org.hhi.adlar-heatpump-modbus` ernaast. Na elk
script `verify.py` plus `npx tsc --noEmit`.

De procesfouten P1 t/m P3 uit het logboek hieronder zijn in de scripts **gecorrigeerd
verwerkt**, met een commentaarblok dat uitlegt waarom. Wie de scripts opnieuw draait loopt
er dus niet in.

Twee dingen die de scripts bewust **niet** doen, omdat ze buiten een script om beter gaan:

- `package.json` aanpassen (`jsmodbus`) — één regel, handmatig
- De lege mappen na fase 1 opruimen — `rmdir` volstaat

## Bevindingen tijdens uitvoering — reproduceerbaarheidslogboek

Dit plan moet zo compleet zijn dat het opnieuw uitvoeren vanaf een schone checkout tot
dezelfde eindtoestand leidt. Onderstaande punten zijn tijdens de bouw ontdekt en zijn géén
onderdeel van het oorspronkelijke ontwerp. Ze staan hier gebundeld zodat ze niet alleen in
losse fase-secties verstopt zitten.

### Vondsten in bestaande code (bestonden al vóór de merge)

| # | Vondst | Waar | Actie |
|---|---|---|---|
| V1 | `cop_trend_analysis` riep `serviceCoordinator.getRollingCOPCalculator()` aan; die methode bestaat niet op `ServiceCoordinator` (het veld zit privé op de device-klasse). Gooide een `TypeError` en brak de flow af; de guard eronder werd nooit bereikt | `flow-card-manager-service.ts` | Optionele aanroep `?.()`; kaart degradeert netjes. **Onderliggende oorzaak nog niet opgelost** — de accessor ontbreekt echt |
| V2 | `unregisterAllFlowCards()` deregistreerde niets: `registerRunListener()` geeft de `FlowCard` terug, geen handle, en `FlowCard` heeft geen `unregister`. De logregel "Unregistered flow card: X" stond bovendien buiten de `if` en loog dus altijd | `flow-card-manager-service.ts` | Log verplaatst naar binnen de `if`; commentaar toegevoegd |
| V3 | `updateSettings()` had geen enkele aanroeper — dode code | idem | Verwijderd |
| V4 | De acht `flow_*`-instellingen sturen géén kaartzichtbaarheid aan, maar wél `CapabilityHealthService.isCategoryEnabled()` | `capability-health-service.ts` | Niet verwijderd; hernoemen staat in fase 8 |
| V5 | `cop_optimizer_diagnostics.json` mist het verplichte `id`-veld (CLAUDE.md-eis) | `.homeycompose/capabilities/` | Toegevoegd |
| V6 | ~~`npm run lint` crasht op `import/no-extraneous-dependencies`~~ **INGETROKKEN** — dit was een artefact van de analyse-sandbox (kapotte `node_modules`), niet van de repo. Lokaal draait lint gewoon | — | Geen actie. Wel: ik heb hier vijf fasen lang ten onrechte gemeld dat lint stuk was |
| V10 | `lib/tuya/services/flow-card-manager-service.ts` importeerde `UserFlowPreferences` nog, terwijl fase 0 `getUserFlowPreferences()` verwijderde | idem | Import opgeschoond |
| V13 | `building-insights-service.ts` leest 2× `getCapabilityValue('desired_indoor_temp')` — die capability bestaat niet (geen definitie, geen driver). Levert permanent `null`. Pre-existent, in beide kopieën van de service | `lib/tuya/` + `lib/modbus/` | **Niet opgelost.** Beoordelen: bedoeld was vermoedelijk `target_temperature.indoor` |
| V11 | Zes bestanden in `test/` verwijzen naar `.homeybuild/lib/adaptive/…` en `.homeybuild/lib/services/…` — de **oude** paden. De import-rewriter van fase 1 raakte alleen `.ts`, niet `.js` | `test/` | Alle zes bijgewerkt naar `lib/shared/…` respectievelijk `lib/tuya/…` |
| V7 | `generate_performance_report` riep `generateAndStoreReport()` zonder device aan → rapport belandde altijd op het device van de registrar | `flow-card-manager-service.ts` | `args.device` doorgegeven; default naar `this.device` voor interne planners |
| V8 | `homey app validate -l publish` faalde op: *"App widgets devices property requires a compatibility of at least >=12.3.0"*. De doel-app stond op `>=12.2.0`, de Modbus-app op `>=12.3.0`; de meegekomen widget gebruikt de `devices`-property | `.homeycompose/app.json` | `compatibility` verhoogd naar `>=12.3.0` |
| V9 | `validate` faalde vervolgens op `Filepath does not exist: /assets/antifreeze.svg`. Fase 2 kopieerde `public/` en `widgets/` maar **niet `assets/`** — de 15 Modbus-capabilities verwijzen naar eigen iconen | `assets/` | 6 ontbrekende SVG's gekopieerd (`antifreeze`, `compressor-freq`, `fan-speed`, `pump`, `sterilization`, `water-flow`). Script 02 aangevuld. Volledige referentiecheck: 56 verwezen, 0 ontbrekend |

### Ontwerpaannames die tijdens de bouw onjuist bleken

| # | Aanname in het plan | Werkelijkheid | Gevolg |
|---|---|---|---|
| A1 | Registratie verplaatsen naar `driver.ts` | De service combineert kaartregistratie met **device-scoped** rapporttimers | Registrar-referentie i.p.v. verplaatsing; zie B3 |
| A2 | Fase 2 levert dubbele kaart-ID's op, `validate` klaagt | De 89 gedeelde kaarten bestonden al; alleen 7 exclusieve gekopieerd → geen dubbele ID's | Fase 3 blijft nodig, maar om een andere reden: 72 kaarten hadden nog een Tuya-only filter |
| A3 | Gedeelde kaarten kunnen één handler delen | 66 kaart-ID's hebben een handler in **beide** codebases; laatste registratie wint | Besluit B5: splitsen i.p.v. unificeren |
| A4 | 58 dubbele registraties | De Modbus-code gebruikt óók `registerCapabilityAction(...)`; 8 extra, waaronder `set_target_temperature` | Totaal 66 |
| A5 | Locales `de`/`fr` aanvullen voor Modbus | Modbus heeft 0 sleutels die Tuya niet ook heeft | Taak vervalt |
| A6 | Risico 1 raakt alle app-level kaarten | Na fase 3 zijn 41 van 45 Tuya-only; nog 4 gedeeld | Urgentie gedaald, scoping blijft |
| A7 | `compatibility` speelt geen rol bij de merge | De Modbus-app eist `>=12.3.0`, de doel-app stond op `>=12.2.0`. De meegekomen widget dwingt 12.3.0 af | **Gebruikers op firmware 12.2.x verliezen toegang tot de app.** Zie besluit hieronder |

#### Gevolg van A7 — verhoogde firmware-eis

Het verhogen naar `>=12.3.0` is nodig om te kunnen valideren, maar het is een
gebruikersbeslissing, geen technische: Tuya-gebruikers op Homey-firmware 12.2.x krijgen de
update niet meer.

Alternatief als dat onacceptabel is: de `devices`-property uit
`widgets/adlar-live-operation/widget.compose.json` halen. De widget verliest dan zijn
device-koppeling — hij kan geen specifiek device meer tonen — maar de app blijft op
`>=12.2.0`. Gezien de widget sowieso nog niet werkt (de app-level resolver ontbreekt tot
fase 6) is dit een reële optie.

**Te beslissen vóór publicatie.** Nu doorgevoerd als `>=12.3.0` omdat validatie anders
blokkeert.

### Procesfouten die ik zelf maakte en herstelde

| # | Fout | Herstel |
|---|---|---|
| P1 | Import-herschrijver in fase 1 loste specifiers op tegen de **nieuwe** maplocatie i.p.v. de oude → 14 kapotte imports | Tweede pass die tegen de oorspronkelijke map oploste |
| P2 | Fase 3-script rekende de 7 in fase 2 gekopieerde Modbus-exclusieve kaarten tot de "gedeelde" set en verwijderde hun `driver_id`-filter | Filters hersteld via `git status --short` als bron van waarheid |
| P3 | Regex-substitutie van "Tuya" in vertaalstrings liet `"Aktueller -Geräteverbindungsstatus"` achter | Alle vier vertalingen voluit geschreven. **Regel: geen regex op vertaalteksten** |
| P4 | Dashboard-startblok ingevoegd aan het *begin* van `onInit()`, waar `this.logger` nog niet bestaat → `TypeError` op elke Tuya-only installatie. `tsc` ziet dit niet omdat `logger` met `!` is gedeclareerd | Verplaatst naar het einde van `onInit`; script gecorrigeerd met brace-teller |
| P5 | Splitsing van `cop_efficiency_changed` c.s. leverde drie dode `_modbus`-kaarten op — Modbus vuurde die triggers nooit af | Originelen op Tuya-only gezet; de drie dode bestanden moeten lokaal worden verwijderd (§5.2bis) |

### Afwijkingen van het plan die bewust zijn gemaakt

- `lib/modbus/modbus/` → **`lib/modbus/protocol/`** (voorkomt het dubbele pad)
- Fase 3 filterstrategie staat als één constante (`STRATEGY='remove'`) zodat de V1-uitkomst
  met één wijziging omgezet kan worden naar `'pipe'`
- `flowLoggingEnabled` blijft bewust app-breed gedeeld; vastgelegd in het bestand zelf

## Wat in dit plan nog niet is uitgewerkt

Expliciet gemaakt om te voorkomen dat een aanbeveling voor een voorziening wordt aangezien.
De volgende punten staan in het plan als richting, niet als uitvoerbare stap:

| Onderwerp | Fase | Status | Wat ontbreekt |
|---|---|---|---|
| `check-capability-ownership.js` | 4 | ✅ **Uitgewerkt en getest** | — |
| Locales de/fr | 6 | ✅ **Gemeten: vervalt** | — |
| Clamp-logica bereikverbreding | 3C | 🟡 Voorbeeldcode aanwezig | Exacte veilige grenzen per capability uit `adlar-modbus-registers.ts` respectievelijk de DPS-definities |
| Lazy `require` van transportbibliotheken | 6 | 🟡 Richting | Waar precies; `jsmodbus` wordt op moduleniveau geïmporteerd, dus dit vraagt een dynamische import en een typeaanpassing |
| Settings-export voor Modbus-migratie | Release | 🔴 Hand-wave | "Overweeg export/import als JSON" — geen ontwerp, geen inschatting. Ofwel uitwerken ofwel schrappen en handmatig invullen accepteren. **Valt buiten de gekozen scope**: dit is migratiegemak, geen merge-vereiste en geen bestaande schuld |
| `energy.approximation` voor Modbus | 6 | ⏭️ **Doorgeschoven (B2)** | Naar TODO; modelafhankelijk. Verifieer of `measure_power` en `approximation` naast elkaar kunnen |
| Fase 0 — registratieplaats | 0 | ✅ **Besloten (B3)** | `driver.ts`; conditie verhuist naar de handler |
| Null-afhandeling condities | 5.3 | ✅ **Besloten (B1)** | `\|\| 0` blijft; alleen `electrical_balance_check` nog te beslissen |
| Settings-export migratie | Release | ✅ **Besloten (B4)** | Ontwerp uitgewerkt: dashboard-endpoint + pair-veld |
| Tijdsinschatting per fase | Alle | 🔴 Ontbreekt | Bewust weggelaten — zonder kennis van je beschikbare tijd zijn schattingen misleidend |

## Genomen besluiten

### B1 — Fase 5.3: `|| 0` blijft, geen fout gooien

**Besluit**: de bestaande `|| 0`-fallback blijft. Een ontbrekende meetwaarde is geen fout:
tijdens opstarten of vóór de eerste poll is `null` een normale toestand. Een fout gooien
geeft een verkeerde indruk en zou flows onnodig laten stoppen.

Fase 5.3 vervalt daarmee grotendeels. `debugLog` bij een `null`-waarde blijft zoals hij is.

#### `electrical_balance_check` — groter probleem dan een null-randgeval

De drie stroomcapabilities komen uit DPS 102 (fase A), 109 (B) en 110 (C) en staan
**onvoorwaardelijk** in `driver.compose.json`. Een eenfase-installatie krijgt die
capabilities dus wél, maar ontvangt nooit DPS 109 en 110.

Gevolg: bij elke eenfase-warmtepomp zijn `b_cur` en `c_cur` **permanent `null`**, worden ze
`0`, en luidt het oordeel structureel "in balans". Niet alleen tijdens een storing — altijd.
Voor die gebruikers is de kaart een diagnostiek die per definitie nooit aanslaat.

Dat verschuift de vraag van "randgeval repareren" naar "voor wie werkt deze kaart
eigenlijk?".

Eén geval waar `|| 0` niet neutraal is maar een onwaarheid oplevert:

```typescript
const avgCurrent = (currentA + currentB + currentC) / 3;   // 0 bij drie nulls
const balanceA = Math.abs(currentA - avgCurrent) <= toleranceValue;  // true
return balanceA && balanceB && balanceC;                    // true = "in balans"
```

Drie ontbrekende metingen leveren een positief diagnostisch oordeel op: een dood device
rapporteert een gezonde elektrische balans. Dat is iets anders dan "nog geen data" —
het is een bewering die niet waar te maken is.

**Voorstel** — geen fout gooien, wél weigeren te oordelen zonder data:

```typescript
if (currentAIsNull && currentBIsNull && currentCIsNull) {
  this.debugLog(`${featureName}: alle drie de stroommetingen ontbreken — geen oordeel mogelijk`);
  return false;   // niet "in balans", maar "niet vast te stellen"
}
```

Consistent met B1: geen exceptie, geen gestopte flow, wel een eerlijk antwoord. Raakt één
conditie en verandert alleen gedrag in de situatie waarin er niets gemeten is.

> Ter beslissing. Wijs je dit af, dan blijft `electrical_balance_check` fail-open en is dat
> een bewuste keuze in plaats van een over het hoofd geziene.

### B2 — Fase 6: `energy.approximation` naar TODO

**Besluit**: doorgeschoven. Sommige Adlar-modellen leveren wel energiedata terug, andere
niet; een statische waarde in `driver.compose.json` kan dat onderscheid niet uitdrukken.

Aandachtspunt voor als het opgepakt wordt: `energy` is per driver statisch, maar Homey
Energy gebruikt `measure_power` wanneer die aanwezig is en valt alleen terug op
`approximation` als die ontbreekt. Als dat klopt — **te verifiëren** — kunnen beide naast
elkaar bestaan en is "it depends" geen blokkade: modellen die echt vermogen rapporteren
gebruiken `measure_power`, de rest krijgt de schatting. Dat maakt het mogelijk een
onvoorwaardelijke `approximation` toe te voegen.

Toevoegen aan de TODO-lijst, niet aan v3.0.0.

### B3 — Fase 0: registratie naar `driver.ts`

**Besluit**: registratie verhuist naar `driver.ts` `onInit()`. Geen statische guard.

Doorslaggevend is `updateFlowCards()` in
`lib/services/flow-card-manager-service.ts:125`. De eerste regel van de body:

```typescript
async updateFlowCards(capabilitiesWithData?: string[]): Promise<void> {
  …
  this.unregisterAllFlowCards();                                    // ← alles weg

  const userPrefs = this.getUserFlowPreferences();                  // dít device
  const availableCaps = this.getAvailableCapabilities();            // dít device
  const healthyCapabilities = capabilitiesWithData
    ?? await this.detectCapabilitiesWithData();                     // dít device, live

  await this.registerFlowCardsByCategory('temperature', availableCaps.temperature,
    userPrefs.flow_temperature_alerts, healthyCapabilities);
  // … zes categorieën verder
}
```

Aangeroepen vanuit `initialize()` (regel 103) — dus **bij elke device-init**.

`FlowCardManagerService` is per device. Bij twee devices wist device B's initialisatie dus
alle registraties van device A, en registreert daarna alleen wat B's instellingen,
capabilities én *actuele datastroom* toestaan. `detectCapabilitiesWithData()` maakt het
resultaat bovendien niet-deterministisch: na een app-herstart bepaalt welk device toevallig
al data heeft, welke kaarten er zijn.

Dit is conditionele registratie van app-brede kaart-singletons op basis van per-device
toestand — een model dat principieel niet kan werken. Er is één kaartobject; twee devices
kunnen niet elk hun eigen set hebben.

> **Correctie op een eerdere formulering.** Ik schreef eerder dat dit getriggerd wordt door
> `updateSettings()` bij wijziging van een `flow_*`-instelling. Dat klopt niet:
> `updateSettings()` (regel 1664) heeft **geen enkele aanroeper** in de codebase — het is
> dode code, en dat settingspad vuurt dus nooit. Het werkelijke pad is `initialize()` →
> `updateFlowCards()`, dat bij élke device-init loopt. Dat maakt het probleem groter, niet
> kleiner: het treedt op zonder dat de gebruiker iets wijzigt.
>
> Los mee te nemen: `updateSettings()` opruimen of alsnog aansluiten op `onSettings()`.

#### Waarom deregistreren per device geen optie is

De voor de hand liggende reparatie — `unregisterAllFlowCards()` alleen de kaarten van het
eigen device laten opruimen — kan niet. Er is namelijk niets om te deregistreren.

Volgens de SDK-typings:

```typescript
// node_modules/@types/homey/lib/FlowCard.d.ts:71
registerRunListener(listener: FlowCard.RunCallback): FlowCard;
```

De retourwaarde is **de FlowCard zelf**, geen subscription-handle. `FlowCard` heeft precies
drie publieke methoden — `registerArgumentAutocompleteListener`, `getArgument`,
`registerRunListener` — en géén `unregister`. De SDK kent wel `unregisterApi`,
`unregisterWebhook`, `unregisterImage`, `unregisterToken` en `unregisterAnimation`, maar
niets voor run-listeners.

De bestaande implementatie (regel 1256):

```typescript
this.flowCardListeners.forEach((listener, cardId) => {
  if (listener && typeof (listener as { unregister?: () => void }).unregister === 'function') {
    (listener as { unregister: () => void }).unregister();     // ← nooit waar
  }
  this.logger(`Unregistered flow card: ${cardId}`);            // ← staat buiten de if
});
this.flowCardListeners.clear();
```

`listener` is een `FlowCard`; `.unregister` bestaat daar niet, dus de guard is **altijd
onwaar**. De methode is een no-op richting Homey en logt vervolgens tóch "Unregistered flow
card: X" — die logregel staat buiten de `if`. Alleen de eigen boekhoud-`Map` wordt geleegd.

Wat er in werkelijkheid gebeurt bij een tweede registratie is dat
`registerRunListener` het enige listener-slot **overschrijft**.

Daarmee is conditionele registratie per device niet een bug die je repareert, maar een model
dat niet kan bestaan: één kaart heeft één listener, en "de listener van device A" bestaat
niet meer zodra device B registreert.

> **Bijvangst**: de logregel `Unregistered flow card: …` beweert iets dat nooit gebeurt.
> Corrigeren of verwijderen bij fase 0 — misleidende logging kost debugtijd.

De correcte vorm:

1. **Registratie is onvoorwaardelijk en eenmalig**, in `driver.ts` `onInit()`.
2. **De per-device conditie verhuist naar de handler**:

   ```typescript
   const device = args.device as AdlarDevice;
   if (!device.getSetting('flow_temperature_alerts')) return false;
   ```

3. `updateSettings()` hoeft geen kaarten meer te herregistreren en kan vervallen of
   verschrompelen tot logging.

Een statische guard zou dit niet oplossen — hij bevriest juist de eerste registratie en
maakt de instelling helemaal onwerkzaam.

#### Omvang

| | Aantal |
|---|---|
| `this.device` in `flow-card-manager-service.ts` | 122 |
| waarvan `this.device.homey` (onschuldig, alleen route naar `homey`) | 44 |
| netto te wijzigen | **~78** |
| helper-methodes die een `device`-parameter moeten krijgen | 7 (`handleReceiveExternal*`) |

De helpers moeten in beide varianten een `device`-parameter krijgen — handlers geven
`args.device` immers door. De keuze voor `driver.ts` kost dus nauwelijks extra werk boven de
statische guard, en levert wel de juiste plaatsing op.

### B4 — Migratie: settings-export bouwen

**Besluit**: bouwen. Terug in scope.

72 instellingen, waarvan 14 groepskoppen; netto **58 waarden** (40 number, 13 checkbox,
4 dropdown, 1 text). Allemaal JSON-serialiseerbaar.

#### Exportzijde — laatste release van `org.hhi.adlar-heatpump-modbus`

De `DashboardService` draait al een HTTP-server met zeventien endpoints (`/api/snapshot`,
`/api/registers`, `/api/expert/read`, …). Eén endpoint erbij:

```typescript
if (method === 'GET' && url === '/api/export-settings') {
  return this.sendJson(res, {
    version: 1,
    exportedAt: new Date().toISOString(),
    devices: this.devices.map((d) => ({
      name: d.getName(),
      settings: d.getSettings(),
    })),
  });
}
```

De gebruiker opent `http://<homey-ip>:8090/api/export-settings`, kopieert de JSON. Geen
nieuwe UI nodig — de dashboardpagina kan er een downloadknop bij krijgen.

#### Importzijde — v3.0.0, pairing

`drivers/intelligent-heatpump-modbus/pair/enter_modbus_info.html` is een eenvoudig formulier
met host, poort en unit-ID. Eén optioneel veld erbij:

```html
<div class="homey-form-group">
  <label class="homey-form-label" for="importJson"
         data-i18n="pair.enter_modbus_info.import">Geëxporteerde instellingen (optioneel):</label>
  <textarea class="homey-form-input" id="importJson" rows="4"
            placeholder='{"version":1,…}'></textarea>
</div>
```

De pair-sessie geeft de JSON door aan `onPairListDevices`; het device past hem toe in
`onInit()` via `setSettings()`.

#### Aandachtspunten

- **Uitsluitingslijst**: `info_app_version` en soortgelijke read-only velden niet importeren
- **Verbindingsvelden**: `modbus_host`, `modbus_port`, `modbus_unit_id` staan al in het
  pair-formulier — de import mag die niet overschrijven
- **Versieveld**: `version: 1` meenemen zodat een toekomstig formaat herkenbaar is
- **Validatie**: onbekende sleutels negeren in plaats van de import laten falen; een
  gebruiker die uit een oudere versie exporteert moet niet stranden

#### Wat het niet oplost

Flows moeten nog steeds handmatig opnieuw worden gebouwd, en Insights-historie gaat
verloren. De export beperkt zich tot instellingen — dat is de grootste handmatige post
(58 velden), niet de enige.

## Nog openstaand

1. **B1-uitzondering** — `electrical_balance_check` laten weigeren te oordelen bij drie
   ontbrekende metingen, of fail-open accepteren?
2. **V1 t/m V3** — de drie verificaties onder "Voorwaarden vooraf"; V1 bepaalt 89
   bestandsbewerkingen en kost tien minuten.
