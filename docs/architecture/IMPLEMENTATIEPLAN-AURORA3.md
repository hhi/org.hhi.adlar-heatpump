# Implementatieplan — Aurora III Modbus-driver integreren in org.hhi.adlar-heatpump

- **Uitvoeringsplan bij** [ADR-004](ADR-004-AURORA3-DRIVER-MERGE.md)
- **Doelversie**: 3.2.0 (huidig 3.1.4)
- **Bron**: `org.hhi.adlar3-heatpump-modbus` v1.9.4 (commit `58e010a`)
- **Datum**: 2026-10-17
- **Status**: In uitvoering — O1 t/m O9 aanvaard op 2026-10-18; fase 0 gestart

In dit plan staan de aanvaarde waarden uit ADR-004 ingevuld: driver-ID
`intelligent-heatpump-aurora3`, suffix `_aurora3`. De migratiescripts nemen beide als
constante bovenaan, zodat een ander besluit één regel wijziging is.

## Uitgangspunten

1. Tuya- en Aurora II-gebruikers merken niets. Geen gewijzigde ID's, argumenten of
   gedrag; de Aurora II-code blijft functioneel onaangeroerd.
2. Elke fase is afzonderlijk te bouwen, te valideren en terug te draaien.
3. Alle massabewerkingen lopen via scripts in `scripts/migration/aurora3/`, niet met de
   hand — reproduceerbaar in plaats van reconstrueerbaar (zoals v3.0.0).
4. Geen commit zonder expliciete opdracht (CLAUDE.md).

## Scope-overzicht

| Fase | 🔵 Vereist voor de merge | 🟠 Bestaande schuld / optioneel |
|---|---|---|
| **0** | Baseline, ownership-script voor N drivers, `verify.py` generiek | — |
| **1** | `lib/aurora3/` (21 bestanden), drivermap onder nieuwe ID, waarschuwingsregel bij pairen (O8), assets, tests, `.homeyignore` | — |
| **2** | 8 capabilities, `adlar_mode_aurora3`, 10 beschrijvingen neutraal | `icon` op `cop_optimizer_diagnostics` |
| **3** | 57 kaarten splitsen, 17 pipe-filters uitbreiden, 3 COP-triggers, 5 nieuw | O6: COP-triggers ook voor Aurora II |
| **4** | Tweede dashboard-instantie op eigen poort, `publicDir`-optie, widget-resolver per driver | — |
| **5** | Locales de/fr, drivernamen, changelog, README's, versie; documentatie invoegen in bestaande structuur (Elfin-gids, dashboardgids, Flow Cards Guide, migratiehandleiding) | Mapping-documenten Tuya ↔ Aurora II van kopvermelding voorzien; settings-export |
| **6** | `validate -l publish`, unit tests, V1–V3 | — |
| **7** | Hardware-acceptatie: drie drivers naast elkaar | — |

## Voorwaarden vooraf

| # | Voorwaarde | Waarom |
|---|---|---|
| P1 | O1 t/m O9 besloten | Driver-ID en suffix zijn na publicatie permanent |
| ~~P5~~ | ~~V4 beantwoord~~ | Vervallen: O8 zonder modelprobe |
| P2 | `npm ci` lukt en `npm run build` + `npm test` zijn groen op `main` | Baseline; zonder groene start is geen fase aantoonbaar gedragsneutraal |
| P3 | Homey CLI beschikbaar voor `homey app validate` | Niet aanwezig in de cloud-analyseomgeving; lokaal uitvoeren |
| P4 | Bronrepo op een vaste commit (`58e010a`) | Wijzigingen in de bronrepo tijdens de merge maken de scripts niet-reproduceerbaar |

---

## Fase 0 — Baseline en gereedschap

Gedragsneutraal: alleen scripts en documentatie.

### Stappen

1. **Baseline vastleggen**: `npm run build`, `npm run lint`, `npm test`,
   `homey app validate -l publish`. Aantallen noteren: 101 capabilities, 170 flow cards,
   2 drivers.
2. **`scripts/check-capability-ownership.js`** toevoegen (ADR-001 §4, script staat
   uitgeschreven in IMPLEMENTATIEPLAN-v3 fase 4). Het script is al generiek over
   `drivers/*`; controleren dat de uitvoer drie drivers aankan en de lijst gedeelde
   capabilities per driver-combinatie toont (Tuya+A2, A2+A3, alle drie).
3. **`scripts/migration/verify.py` generiek maken**: de drivers komen nu als lijst uit
   `drivers/*/driver.compose.json` in plaats van twee constanten. Controles blijven:
   dubbele ID's, capabilities zonder `id`, ongedefinieerde verwijzingen, scoping van
   gedeelde kaarten.
4. **Snapshot van de bronrepo**: `scripts/migration/aurora3/SOURCE` met repo-URL en commit.

### Verificatie

- Alle baselinecommando's groen
- `verify.py` geeft op `main` dezelfde uitkomst als vóór de aanpassing

---

## Fase 1 — Code en driver importeren

Additief. Script: `scripts/migration/aurora3/10-import-aurora3.py`.

### 1a. Lib-bestanden

**Niet kopiëren — importeren uit bestaande map (19):**

| Bron (Aurora III) | Doel-import |
|---|---|
| `curve-calculator.ts`, `error-types.ts`, `logger.ts`, `seasonal-mode-calculator.ts`, `self-healing-registry.ts`, `time-schedule-calculator.ts` | `lib/shared/…` |
| `utils/preheat-calculator.ts`, `adaptive/building-model-learner.ts`, `adaptive/defrost-learner.ts`¹ | `lib/shared/…` |
| `services/rolling-cop-calculator.ts`, `services/settings-manager-service.ts`, `services/weather-forecast-service.ts`¹ | `lib/shared/services/…` |
| `flow-handler-wrapper.ts` | vervalt — alleen door `app.ts` gebruikt |
| `adaptive/cop-optimizer.ts`, `adaptive/energy-price-optimizer.ts`, `adaptive/heating-controller.ts`, `adaptive/weighted-decision-maker.ts` | `lib/modbus/adaptive/…` |
| `services/external-temperature-service.ts`, `services/wind-correction-service.ts` | `lib/modbus/services/…` |

¹ Inhoudelijk identiek; verschilt alleen in importpad.

**Kopiëren naar `lib/aurora3/` (21):**

| Doel | Bestanden |
|---|---|
| `lib/aurora3/` | `constants.ts` |
| `lib/aurora3/types/` | `shared-interfaces.ts` |
| `lib/aurora3/protocol/` | `adlar3-modbus-registers.ts`, `adlar3-modbus-service.ts`, `modbus-runtime-service.ts`, `modbus-tcp-service.ts` |
| `lib/aurora3/services/` | `adaptive-control-service.ts`, `building-insights-service.ts`², `building-model-service.ts`, `capability-health-service.ts`, `cop-calculator.ts`, `dashboard-service.ts`, `energy-tracking-service.ts`, `flow-card-manager-service.ts`, `modbus-connection-service.ts`, `modbus-cop-service.ts`, `performance-report-service.ts`, `scop-calculator.ts`, `service-coordinator.ts`, `snapshot-trigger-service.ts`, `widget-state-service.ts` |

² Inhoudelijk gelijk aan de Aurora II-versie, maar typegekoppeld aan gedivergeerde services
— zie controlepunt 1 hieronder.

Het script herschrijft daarna alle relatieve imports in de gekopieerde bestanden en in de
drivermap op basis van deze tabel.

Twee controlepunten horen bij deze stap:

1. **Impliciete koppeling via imports.** Byte-gelijkheid van een bestand zegt niets over
   de gelijkheid van wat het importeert (les uit ADR-001 risico 6). Gemeten:
   `building-insights-service.ts` is inhoudelijk gelijk aan de Aurora II-versie, maar
   importeert de *types* `BuildingModelService` en `AdaptiveControlService` uit zijn eigen
   map. Die twee services zijn gedivergeerd, en TypeScript-klassen met `private`-leden zijn
   nominaal getypeerd: een Aurora III-instantie is niet toewijsbaar aan het Aurora II-type.
   Daarom gaat dit bestand naar `lib/aurora3/services/` en niet naar de meegebruikte
   groep. De overige zes meegebruikte `lib/modbus/`-bestanden importeren alleen `homey` of
   elkaar.
2. **Module-level state.** Module-brede, veranderlijke state in een meegebruikt bestand
   wordt na de merge gedeeld door drie drivers. **Gemeten tijdens de analyse: 0 treffers**
   in de 19 bestanden (`let`/`var` op moduleniveau, niet-`readonly` statische velden,
   module-brede `Map`/`Set`). Bij de uitvoering herhalen tegen de dan actuele bestanden.

### 1b. Driver

1. `drivers/intelligent-heatpump-modbus/` (bron) → `drivers/intelligent-heatpump-aurora3/`
2. `driver.ts`: klasse `ModbusDriver` → `Aurora3ModbusDriver`; logregels en de
   `list_devices`-naam blijven zoals ze zijn
3. `device.ts`: klasse hernoemen naar `Aurora3ModbusDevice`; imports herschrijven (1a)
4. `driver.compose.json` en `driver.settings.compose.json`: ongewijzigd overnemen; in de
   setting `dashboard_port` standaard en hint 8090 → 8091 (alle vier talen voluit)
5. `pair/enter_modbus_info.html`: overnemen (driver-scoped; byte-identiek aan Aurora II),
   alleen de waarschuwingsregel uit stap 7 toevoegen
6. Drivermap-assets (`Aurora-drv-*.png`, `icon.svg`): ongewijzigd. Het icoon is identiek
   aan dat van de Aurora II-driver; een eigen icoon is optioneel (svg-icon-designer,
   iOS-richtlijnen uit CLAUDE.md)
7. **Waarschuwingsregel bij pairen (O8)** — in het eerste pairingscherm van **beide**
   Modbus-drivers één gelokaliseerde regel (vier talen): *"Kies het model dat op het
   typeplaatje staat."* Eén `data-i18n`-element in beide `enter_modbus_info.html` plus één
   sleutel in `locales/*.json`. Alleen tekst, geen probe en geen wijziging in `driver.ts`. Voor
   Aurora II is dit, naast de drivernaam (O7), de enige zichtbare wijziging

**`device.ts` — nagelopen oppervlakken**: `homey.app` (4 casts, fase 4a),
`homey.flow` (via `triggerFlowCard`, ID's uit 3A/3B/3C), `homey.drivers` (alleen een
niet-nul-controle), `homey.manifest`/`version`/`platform` (info-settings), timers via
`homey.setTimeout`/`setInterval`, `setSettings` voor info-velden, `getStoreValue` voor
COP-data. `DRIVER_COMPOSE_CAPABILITIES` is een hardgecodeerde kopie van de
capability-lijst uit `driver.compose.json` en moet de hernoeming uit fase 2b meekrijgen;
bij voorkeur in fase 2 vervangen door een import van `driver.compose.json`, zodat de twee
niet uit elkaar kunnen lopen.

### 1c. Overig

| Onderdeel | Actie |
|---|---|
| `assets/` | 3 nieuwe capability-iconen kopiëren: `backup-heater.svg`, `silent-mode.svg`, `dhw-tank.svg` (per element `fill`/`stroke`, dus iOS-conform; `viewBox` 24×24 zoals 10 bestaande iconen). De overige 62 zijn byte-identiek aanwezig |
| `assets/images/WP-adlar3-modbus-*.png` | Niet kopiëren — app-afbeeldingen van de bron-app; de doel-app heeft eigen app-afbeeldingen |
| `public/` | 5 dashboards → `public/aurora3/`, ongewijzigd (fase 4a sluit ze aan) |
| `test/unit/*.test.js` (7) | → `test/unit/aurora3/`; `require('../../.homeybuild/lib/…')` herschrijven naar de nieuwe paden. Vijf namen botsen met bestaande tests (o.a. `adaptive-control-service.test.js`) — de submap voorkomt dat |
| `test/*.mbs`, `test-adlar3-registers*`, `test-sim3-registers*`, `test/readme.md` | → `test/aurora3/`. Let op: de doel-`tsconfig.json` sluit `test/` uit van de build (de bron niet). De twee `.ts`-scripts draaien dan via `npx tsx`, zoals `test/modbus/test-modbus-service.ts` voor Aurora II; hun imports naar `lib/aurora3/` herschrijven |
| `test/simulation/adaptive-simulation.js` | Bestaat in beide repo's met andere imports (Tuya- resp. Aurora III-adaptieve modules). Overnemen als `adaptive-simulation-aurora3.js` plus script `simulate:aurora3`, of weglaten — de adaptieve modules zijn identiek aan `lib/modbus/adaptive/`, dus de meerwaarde is beperkt. Voorstel: weglaten |
| `package.json` `test`-script | Glob uitbreiden: `test/unit/*.test.js test/unit/aurora3/*.test.js` |
| `.homeyignore` | `scripts/*` toevoegen — de migratiescripts gaan nu mee in het app-pakket (bestaand; groeit door `scripts/migration/aurora3/`) |
| `docs/` van de bron | Invoegen in de bestaande structuur, niet in een eigen map — zie fase 5b |
| `.homeychangelog.json`, `app.json`, `README*`, `.homeycompose/app.json` van de bron | Niet overnemen (app-niveau) |
| `app-debug.ts`, `launch.json`, `.eslintrc.json`, `.gitignore`, `tsconfig.json` van de bron | Niet overnemen; de doel-app heeft eigen varianten (gemeten: alleen cosmetische of strengere verschillen) |
| `.claude/settings.json` van de bron | **Niet overnemen** — staat `Bash(*)` toe, ruimer dan de doel-app |

### Nog niet doen

Capability-splitsing (fase 2), kaarten (fase 3), dashboard/widget (fase 4). Na fase 1
compileert de code, maar het manifest is nog niet consistent: de drivermap verwijst naar
`adlar_mode` en de flow cards ontbreken. `homey app validate` zal falen; dat is verwacht.

### Verificatie

- `npx tsc --noEmit` groen
- `node --test test/unit/aurora3/*.test.js` groen na build
- `git diff --stat -- lib/shared lib/tuya lib/modbus drivers/intelligent-heat-pump drivers/intelligent-heatpump-modbus`
  is **leeg** — bewijs dat bestaande drivers onaangeroerd zijn

---

## Fase 2 — Capabilities

Script: `scripts/migration/aurora3/20-capabilities.py`.

### 2a. Nieuw (8)

`adlar_backup_heater_forced`, `adlar_compressor_on`, `adlar_dhw_active`,
`adlar_dhw_enabled`, `adlar_disinfection_enabled`, `adlar_high_pressure`,
`adlar_low_pressure`, `adlar_silent_mode` — ongewijzigd uit de bron. Controleren: `id`
aanwezig, `icon` aanwezig, iconen voldoen aan de SVG-richtlijnen uit CLAUDE.md (iOS).

### 2b. Splitsen (1)

`adlar_mode` → `adlar_mode_aurora3`.

| Bestand | Plekken |
|---|---|
| `.homeycompose/capabilities/adlar_mode_aurora3.json` | nieuw, `id` aangepast |
| `drivers/intelligent-heatpump-aurora3/driver.compose.json` | 1 |
| `drivers/intelligent-heatpump-aurora3/device.ts` | 3 |
| `lib/aurora3/constants.ts` | 1 |
| `lib/aurora3/services/building-model-service.ts` | 2 |
| `lib/aurora3/services/capability-health-service.ts` | 1 |
| `lib/aurora3/services/flow-card-manager-service.ts` | 2 |
| `lib/aurora3/services/widget-state-service.ts` | 1 |
| `public/aurora3/dashboard-live.html` | 1 |
| `test/unit/aurora3/building-model-service.test.js`, `dashboard-service.test.js` | 4 |

Substitutie alleen op het exacte, gequote token (`'adlar_mode'`, `"adlar_mode"`), nooit op
een prefix — `adlar_mode` is een prefix van geen andere ID, maar die aanname per bestand
bevestigen. Daarna elke plek met de hand nalezen; `tsc` valideert geen strings.

### 2c. Transport-neutrale beschrijvingen (10)

`adlar_antifreeze`, `adlar_defrosting`, `adlar_eev_step`, `adlar_evi_step`,
`adlar_fan_speed`, `adlar_fault_active`, `adlar_fault_shutdown`, `adlar_pump_pwm`,
`adlar_running`, `adlar_sterilization`.

Nu noemen ze een Aurora II-register (*"Modbus status register 0x0000, bit 8"*). Nieuwe tekst
beschrijft de betekenis, niet de bron (*"Defrost cycle active"*). Handmatig, in en/nl/de/fr
voluit. Titels en `insightsTitle*` blijven ongewijzigd — die zien Aurora II-gebruikers.

### Verificatie

- 110 capability-definities, geen dubbele ID's
- `check-capability-ownership.js`: 0 wezen; `adlar_mode` alleen bij Aurora II,
  `adlar_mode_aurora3` alleen bij Aurora III
- `grep -rn "'adlar_mode'" lib/aurora3 drivers/intelligent-heatpump-aurora3 public/aurora3`
  levert niets op

---

## Fase 3 — Flow cards

Script: `scripts/migration/aurora3/30-flowcards.py`. Bron van waarheid voor de indeling is
de bronrepo plus de huidige doelmap, niet een doorsnede (les P2 uit v3.0.0).

### 3A. Splitsen naar `_aurora3` (57)

Definitie uit de bronrepo, `id` → `<id>_aurora3`, device-filter →
`driver_id=intelligent-heatpump-aurora3` (een eventueel `capabilities=`-deel blijft staan).

| Type | Kaarten |
|---|---|
| Acties (20) | `calculate_curve_value`, `calculate_preheat_time`, `calculate_time_based_value`, `force_insight_analysis`, `generate_performance_report`, `get_seasonal_mode`, `modbus_read_register`, `modbus_write_register`, `receive_external_ambient_data`, `receive_external_energy_prices`, `receive_external_flow_data`, `receive_external_indoor_temperature`, `receive_external_power_data`, `receive_external_solar_power`, `receive_external_solar_radiation`, `receive_external_wind_data`, `set_desired_indoor_temperature`, `set_heating_mode`, `set_hotwater_temperature`, `set_target_temperature` |
| Condities (21) | `compressor_running`, `confidence_above`, `cop_efficiency_check`, `cop_trend_analysis`, `daily_cop_above_threshold`, `device_power_is`, `fault_active`, `heating_mode_is`, `hotwater_temperature_is`, `insight_is_active`, `monthly_cop_above_threshold`, `power_above_threshold`, `price_in_cheapest_hours`, `price_trend_is`, `price_vs_daily_average`, `savings_above`, `target_temperature_is`, `temperature_above`, `temperature_differential`, `total_consumption_above`, `water_flow_rate_check` |
| Triggers (16) | `ambient_temperature_changed`, `coiler_temperature_alert`, `compressor_efficiency_alert`, `discharge_temperature_alert`, `eev_pulse_steps_alert`, `evi_pulse_steps_alert`, `fan_motor_efficiency_alert`, `fault_detected`, `inlet_temperature_changed`, `inlet_temperature_value_changed`, `outlet_temperature_changed`, `outlet_temperature_value_changed`, `performance_report_ready`, `suction_temperature_alert`, `tank_temperature_alert`, `water_flow_alert` |

`set_heating_mode_aurora3` en `heating_mode_is_aurora3` krijgen de Aurora III-waarden
(Uit/Koelen/Verwarmen/Auto) en verwijzen naar `adlar_mode_aurora3`.

**Code-hernoeming.** De 57 ID's komen als string-literal voor in precies twee
Aurora III-bestanden: `lib/aurora3/services/flow-card-manager-service.ts` en
`lib/aurora3/services/snapshot-trigger-service.ts`. Twee meegebruikte bestanden
(`lib/shared/self-healing-registry.ts`, `lib/modbus/services/external-temperature-service.ts`)
noemen enkele ID's alleen in commentaar en worden **niet** aangeraakt. Gemeten: geen van de
57 ID's is ook een capability-ID of settings-sleutel, dus hernoemen van het gequote token
is veilig. Registratiepatronen zoals in `03-split-flowcards.py`, inclusief
`registerCapabilityAction(` (les A4 uit v3.0.0: dat patroon miste de eerste scan).

### 3B. Pipe-filter uitbreiden (17)

`driver_id=intelligent-heat-pump|intelligent-heatpump-modbus` →
`…|intelligent-heatpump-aurora3`, capability-deel ongemoeid:

`adaptive_simulation_update`, `adaptive_status_change`, `building_insight_detected`,
`building_profile_mismatch`, `cheapest_block_started`, `daily_consumption_threshold`,
`daily_cost_threshold`, `expensive_block_approaching`, `forecast_heating_advice`,
`heating_mode_changed`, `learning_milestone_reached`, `power_threshold_exceeded`,
`pre_heat_recommendation`, `price_threshold_crossed`, `price_trend_changed`,
`temperature_adjustment_recommended`, `total_consumption_milestone`.

Bijbehorende code-aanpassing: in `lib/aurora3/services/snapshot-trigger-service.ts` de
`MODE_OPTIONS`-strings `Cool`/`Heat` → `Cooling`/`Heating` (ADR-004 §2).

### 3C. COP-triggers uit de gedeelde calculator (3)

`cop_trend_detected`, `daily_cop_efficiency_changed`, `monthly_cop_efficiency_changed`:
`driver_id=intelligent-heat-pump` → `intelligent-heat-pump|intelligent-heatpump-aurora3`.
Met O6 komt `intelligent-heatpump-modbus` erbij; dat is een aparte changelog-regel.

### 3D. Nieuw en exclusief (5)

`set_backup_heater`, `set_dhw_function`, `set_silent_mode`, `dhw_heating_active`,
`silent_mode_is` — ID behouden, filter `driver_id=intelligent-heatpump-aurora3`.

### 3E. Niet overnemen (2)

`cop_efficiency_changed`, `cop_outlier_detected` — gedefinieerd in de bron, maar geen
enkele Aurora III-code vuurt of registreert ze. Overnemen zou ze bij Aurora III-devices
zichtbaar maken zonder dat ze ooit afgaan.

### Verificatie

- 232 flow cards, geen dubbele ID's
- `verify.py`: geen enkele Aurora III-kaart zonder filter; elke `_aurora3`-kaart heeft
  een registratie of trigger-aanroep in `lib/aurora3/` of de drivermap, en omgekeerd
  (geen literal in de Aurora III-code die naar een niet-bestaande kaart wijst)
- Bestaande Tuya- en Aurora II-kaartbestanden: alleen de 20 filterregels uit 3B/3C zijn
  gewijzigd (`git diff --stat`)

---

## Fase 4 — App-brede voorzieningen

Handmatig in `app.ts`; het enige gedeelde codebestand dat in deze merge wijzigt.

### 4a. Dashboard

```typescript
// Aurora II — ongewijzigd
get dashboard(): DashboardService | null { … }
async setDashboardPort(port: number): Promise<void> { … }

// Aurora III — nieuw, parallel
private _aurora3Dashboard: Aurora3DashboardService | null = null;
get aurora3Dashboard(): Aurora3DashboardService | null { … }
async setAurora3DashboardPort(port: number): Promise<void> { … }
```

**Waarom een eigen poort en geen route-prefix.** Alle vijf Aurora III-pagina's gebruiken
absolute paden: `fetch('/api/snapshot')`, `fetch('/api/write')`, `href="/live"`, enzovoort
(gemeten: 11 `fetch`-aanroepen en 4 navigatielinks). Bij één server met een prefix
(`/aurora3/live`) moet elke URL in de HTML worden herschreven, en de Aurora II-routes
`/api/write` en `/api/expert/write` zouden naast de Aurora III-varianten staan op dezelfde
server. Een eigen poort laat de HTML **ongewijzigd** en houdt de schrijfendpoints per
driver gescheiden.

Gemeten verschillen in de routes, ter controle dat er niets gedeeld hoeft te worden:

| Route | Aurora II | Aurora III |
|---|---|---|
| `/`, `/interactive`, `/live`, `/expert`, `/changelog` | ✓ | ✓ |
| `/api/snapshot`, `/api/write`, `/api/capabilities`, `/api/registers`, `/api/register-cache`, `/api/register-changelog`, `/api/expert/read`, `/api/expert/write` | ✓ | ✓ |
| `/heating-curve`, `/api/set-diy-curve` | ✓ | — (geen DIY-stooklijn op Aurora III) |
| `/api/control` (capability via listener) | — | ✓ |
| `/assets/*` | uit `assets/` | uit `assets/` — gedeeld, 0 botsingen |

Stappen:

1. **`publicDir` configureerbaar maken** in `lib/aurora3/services/dashboard-service.ts`.
   Nu staat er hard `path.join(appDir, 'public')`. `appDir` zelf kan niet worden verlegd,
   omdat dezelfde service er ook `app.json` (capability-metadata voor `/api/capabilities`)
   en `assets/` mee oplost. Nieuwe optie `publicDir?: string`, standaard ongewijzigd;
   `app.ts` geeft `path.join(__dirname, 'public', 'aurora3')` mee. Alleen de Aurora
   III-kopie verandert; de Aurora II-service blijft zoals hij is.
2. **`app.ts`**: tweede instantie met standaardpoort 8091 (zie de codeschets hierboven);
   `onUninit()` ruimt beide op.
3. **Aurora III `device.ts`**: de vier `homey.app`-casts (`dashboard`, `setDashboardPort`,
   `DashboardApp`) naar de nieuwe leden. Bij voorkeur één getypeerde interface op de
   app-klasse in plaats van `as unknown as` (ADR-001 §2 opruimpunt 2).
4. **Starten** alleen als er ≥1 Aurora III-device is, net als bij Aurora II.
5. **`public/aurora3/dashboard-live.html`**: de groepering in categorieën werkt met
   letterlijke capability-ID's (`match: id => [...].includes(id)`). Bijwerken:
   `adlar_mode` → `adlar_mode_aurora3` (fase 2b). De 8 nieuwe capabilities staan er al in.
   Een ID die niet in een lijst staat, belandt stil in de restgroep; `tsc` en `validate`
   zien dat niet.
6. **Poortbotsing**: kiest een gebruiker voor beide drivers dezelfde poort, dan start de
   tweede server niet (`EADDRINUSE` wordt gelogd, geen crash). Acceptabel, maar in de
   settings-hint van beide drivers noemen welke poort de andere driver standaard gebruikt.

> **Beveiliging — bestaande blootstelling verdubbelt.** Beide dashboards luisteren op alle
> interfaces zonder authenticatie, met schrijfendpoints (`/api/write`,
> `/api/expert/write`, `/api/control`). Dat is bestaand ontwerp (ADR-041a in de bronrepo's)
> en geen merge-fout, maar na de merge staan er twee van zulke poorten open op hetzelfde
> LAN-adres. Niet blokkerend voor 3.2.0; wel vermelden in de dashboardgids (5b).

### 4b. Widget

De dispatch bestaat al: `getAdlarLiveOperationWidgetState(deviceId?)` bouwt de state niet
zelf, maar roept `device.getLiveOperationWidgetState()` aan, en beide `device.ts`-varianten
hebben die methode met hun eigen state-service. Wat er moet gebeuren:

1. `_getAdlarDevices()`: devices van `intelligent-heatpump-modbus` **en**
   `intelligent-heatpump-aurora3` samenvoegen; de constante `ADLAR_DRIVER_ID` wordt een
   lijst
2. Type: `LiveOperationWidgetState` in `app.ts` wordt de unie van het Aurora II- en het
   Aurora III-type; de lege-staat-respons blijft de Aurora II-vorm
3. `widgets/adlar-live-operation/public/index.html`: de Aurora II-versie blijft de basis;
   de blokken `regulation`, `status.connectionLabel` en `temperatures.setpointC` alleen
   tonen als ze aanwezig zijn. De Aurora III-layoutverschillen (55 regels CSS) beoordelen
   en alleen overnemen wat nodig is om `setpointC` te tonen
4. `widget.compose.json` en `api.js`: ongewijzigd

Valt V2 positief uit (widgetfilter ondersteunt `driver_id`), dan blijft twee widgets een
alternatief; besluit O4 bepaalt.

### 4c. Typecontrole

De cast in `lib/aurora3/services/flow-card-manager-service.ts:1479`
(`homey.app as unknown as { [key: string]: … }`) is dezelfde als die ADR-001 al als
fragiel aanmerkte. Met drie drivers op één app is een getypeerde app-interface het minimum.

### Verificatie

- Met alleen een Tuya-device: geen HTTP-server actief
- Met een Aurora II- en een Aurora III-device: twee servers op 8090 en 8091, elk met eigen
  data
- Alle vijf Aurora III-pagina's laden op 8091 en hun `fetch`-aanroepen geven 200; op 8090
  verschijnen uitsluitend de Aurora II-pagina's (incl. `/heating-curve`)
- `/api/capabilities` op 8091 bevat `adlar_mode_aurora3` met titel uit `app.json`, en
  `dashboard-live` toont hem in de groep *Status*
- Widget toont bij beide Modbus-drivers de juiste waarden; bij Tuya-devices de bestaande
  lege staat

---

## Fase 5 — Teksten, versie, documentatie

### 5a. App-teksten en versie

| Onderdeel | Actie |
|---|---|
| `locales/en.json`, `nl.json` | 3 nieuwe sleutels: `building_model.blocked_dhw_active`, `errors.silent_level2_r290_only`, `errors.zone_onoff_disabled` |
| `locales/de.json`, `fr.json` | Dezelfde 3 sleutels vertalen |
| `es`-vertalingen in bron-manifesten | Weglaten — de app ondersteunt geen `es` |
| Drivernamen (O7) | Aurora III: *"Adlar Castra Aurora III Heat Pump (Modbus)"*; Aurora II van *"… (Modbus)"* naar *"… Aurora II … (Modbus)"* — alleen de weergavenaam, de ID blijft |
| Driver-manifest `de`/`fr` | `driver.compose.json` van Aurora III heeft 22 strings met alleen en/nl (drivernaam en `capabilitiesOptions`-titels); aanvullen zoals bij de twee bestaande drivers. Capabilities, flow cards en settings van de bron hebben al alle vier talen (gemeten) |
| `.homeycompose/app.json` | Versie 3.2.0 (O5); beschrijving en `tags` beoordelen op vermelding van Modbus/Aurora III |
| `.homeychangelog.json` | Regel per CLAUDE.md-richtlijn, bijv. *"Nieuwe driver voor de Adlar Aurora III (Modbus TCP)."* |
| `README.txt`, `README.en.txt`, `README.nl.txt`, `readme.de.txt`, `readme.fr.txt` | Aurora III als derde koppelmethode; verwijzing naar de dashboardgids aanvullen met poort 8091 |

### 5b. Documentatie

**Uitgangspunt: invoegen in de bestaande structuur, geen `docs/aurora3/`-eiland.** Na
v3.0.0 is de documentatie per *onderwerp* georganiseerd (`docs/setup/`, `docs/Dev
support/modbus/`, `docs/Heatpump specs/modbus/`), niet per bronrepo. Een eigen map voor
Aurora III zou dat doorbreken en gebruikers twee plekken laten zoeken.

Gemeten overlap van de 19 documentbestanden in de bronrepo:

| Status | Aantal | Bestanden |
|---|---|---|
| Identiek aanwezig | 5 | `Heatpump specs/modbus/Eflin EW11a/*` (handleidingen gateway) |
| Zelfde pad, andere inhoud | 4 | `Heatpump specs/modbus/Adlar III/HHi/*.xlsx` (registermap, capability-mapping, A2-vs-A3-mapping) |
| Al aanwezig onder `docs/Dev support/modbus/`, ander pad | 2 | `adr-061-building-model-persistence.md` (alleen kop en paden anders), `building-model-sample-gating.md` (Aurora III-versie voegt de gate `blocked_dhw_active` toe) |
| Nieuw | 8 | `capability-modbus-mapping.md`, 6 setup-afbeeldingen/pdf's, `setup/README.md` (Elfin-gids) |

#### Gebruikersdocumentatie (`docs/setup/`)

| Document | Huidig | Actie |
|---|---|---|
| `modbus-elfin-ew11-setup.md` | Alleen Aurora I/II, NL | **Eén gids voor beide modellen.** De Aurora III-gids (`setup/README.md` uit de bron) is ~90% gelijk. Verschillen in een tabel per model opnemen — zie hieronder. |
| `Elfin EW11 - Adlar Aurora 2/` | 6 bestanden | Blijft |
| `Elfin EW11 - Adlar Aurora 3/` | — | Nieuw: de 3 Aurora III-screenshots. De 3 overige bestanden (`aansluiting zijkant.pdf`, `rs485…jpg`, `usb2-5v…pdf`) zijn byte-identiek aan de Aurora 2-map → niet dupliceren; de gids verwijst naar één kopie. De bronnaam `… Aurora series` wordt `… Aurora 3` voor symmetrie |
| `MODBUS_DASHBOARD_GUIDE.{nl,en,de,fr}.md` | Aurora II: poort 8090, `/heating-curve` | Per model: poort (8090 / 8091), welke pagina's er zijn (`/heating-curve` alleen Aurora II; `/interactive` bij Aurora III met tapwater, stille modus, bijverwarming), de `dashboard_port`-instelling per driver, en de beveiligingsnotitie uit fase 4a. Vier talen |
| `guide/FLOW_CARDS_GUIDE.{nl,en,de,fr}.md` | Noemt Modbus nergens (0 treffers); kaarten zijn op titel beschreven | De 5 Aurora III-exclusieve kaarten toevoegen (`set_backup_heater`, `set_dhw_function`, `set_silent_mode`, `dhw_heating_active`, `silent_mode_is`) met de vermelding "alleen Aurora III". Voor de 57 gesplitste kaarten volstaat één alinea: dezelfde kaart verschijnt per driver, titels zijn gelijk. Vier talen |
| Migratiehandleiding Aurora III | — | Nieuw, `docs/setup/MIGRATION_AURORA3.{nl,en,de,fr}.md`: **volgorde** (eerst adaptieve regeling in de oude app uit of het oude device verwijderen, pas daarna pairen — anders pollen en schrijven twee Modbus-masters tegelijk via één gateway, ADR-004 §8), de juiste driver kiezen (O7/O8), flows herbouwen (kaart-ID's krijgen `_aurora3`), settings overnemen, Insights-verlies, dashboardpoort 8091 |
| `guide/ADAPTIVE_CONTROL_GUIDE`, `BUILDING_INSIGHTS_GUIDE` | Transport-neutraal | Geen actie; controleren op uitspraken die alleen voor Tuya gelden |
| `PROTOCOL_VERSION_GUIDE`, `Tuya_LocalKey_*`, `USER_QUICK_FIX` | Tuya-only | Geen actie |

Verschillen in de Elfin-gids tussen de modellen (gemeten):

| Instelling | Aurora I/II | Aurora III / PRO |
|---|---|---|
| Serieel | `9600 8N1` | `9600 8N2` |
| Stopbits | `1` | `2` |
| `Serial protocol` | (niet vermeld) | `Modbus` — bij `None` (transparant) geen geldige antwoorden |
| TCP-poort in Homey | `502` | gelijk aan `Local port` van de EW11A |
| Dashboardpagina's | incl. `/heating-curve` | incl. uitgebreid `/interactive`, `/changelog` |

De opmerking over `Serial protocol = Modbus` geldt vermoedelijk ook voor Aurora II, maar is
daar niet getest; als algemene tip opnemen, niet als Aurora II-eis.

#### Ontwikkelaarsdocumentatie

| Bron | Doel | Opmerking |
|---|---|---|
| `Dev support/capability-modbus-mapping.md` | `docs/Dev support/modbus/adlar3-capability-modbus-register-mapping.md` | Naamgeving naast het bestaande `adlar2-capability-modbus-register-mapping.md`; tabel bijwerken met `adlar_mode_aurora3` |
| `Dev support/adr-061-building-model-persistence.md` | — (bestaat al in `docs/Dev support/modbus/`) | Inhoudelijk gelijk; alleen de kop (project, codepaden) verschilt. Niet kopiëren; in het bestaande document de regel *Codegebied* aanvullen met de `lib/aurora3/`-paden. De nummering `adr-061` hoort bij de ADR-reeks van de bronrepo's, niet bij `docs/architecture/ADR-00x` |
| `Dev support/building-model-sample-gating.md` | `docs/Dev support/modbus/building-model-sample-gating.md` | Samenvoegen: de Aurora III-versie is een superset (extra gate `blocked_dhw_active`, sinds bron-v1.9.0). Eén document dat per gate vermeldt bij welke driver hij geldt. Er staat bovendien een tweede kopie in `docs/Dev support/Architectural overview/`; vaststellen welke de bron van waarheid is |
| `Heatpump specs/…/Adlar III/HHi/*.xlsx` (4) | Zelfde pad | Inhoud verschilt; de bronversie is de nieuwste (laatste werk aan Aurora III vond in die repo plaats). Overschrijven na controle van de wijzigingsdatum in de bestandsmetadata; bij twijfel beide bewaren met datumsuffix |
| `Heatpump specs/…/Eflin EW11a/*` (5) | — | Identiek, niet kopiëren |

#### Architectuur- en indexdocumenten

| Document | Actie |
|---|---|
| `docs/README.{nl,en,de,fr}.md` (index) | Verwijzingen naar de migratiehandleiding, de Elfin-gids (nu voor twee modellen) en de dashboardgids |
| `README.md` (root) | Tabel *koppelmethoden* van 2 naar 3 rijen; pairing-stappen per Modbus-model |
| `docs/architecture/SERVICE_ARCHITECTURE.md` | Drie drivers, `lib/aurora3/`, welke services in drie varianten bestaan |
| `docs/architecture/ADR-001-MODBUS-DRIVER-MERGE.md` | Kopregel *"Vervolg: ADR-004"* |
| `CLAUDE.md` | Projectarchitectuur: derde driver, `lib/aurora3/`, suffixconventie `_aurora3`, de regel "nieuwe kaart-ID's per driver uniek". Overnemen uit de bron-`CLAUDE.md`: de Aurora III-registernotatie (`3-0038` = inputregister, `4-2100` = holdingregister), de regel "geef `this.homey` mee als `TimerProvider` aan `modbus-tcp-service`", en de sync-regel "houd `capability-modbus-mapping.md` bij bij elke nieuwe of verlegde capability" |
| `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md` | Beschrijven nu nog een app met één driver (bestaand). Bijwerken naar drie drivers, of terugbrengen tot een verwijzing naar `CLAUDE.md` om drie kopieën niet uiteen te laten lopen |
| Externe ADR-reeks (O9) | Beide codebases verwijzen in commentaar naar ADR-020 t/m ADR-061 (gemeten: 27 resp. 23 nummers), maar die documenten staan in geen van beide repo's. Afhankelijk van O9: opnemen onder `docs/architecture/decisions/` met herkomst per bron, na controle op nummers die na de fork twee betekenissen kregen |
| `docs/Dev support/modbus/flow-card-dps-vs-modbus-mapping.md`, `capability-dps-vs-modbus-mapping.md`, `driver-compose-capability-comparison-dps-vs-modbus.md` | Kolom Aurora III toevoegen, of in de kop vermelden dat ze alleen Tuya ↔ Aurora II vergelijken. Voorstel: kopvermelding — volledig bijwerken is veel handwerk voor documenten die vooral historisch zijn |

**Wat níét wordt overgenomen**: `.homeychangelog.json` van de bron (gebruikers zien hun oude
changelog niet in de nieuwe app; de migratiehandleiding verwijst ernaar), de bron-`README*`,
en de app-afbeeldingen `WP-adlar3-modbus-*.png` (de doel-app heeft eigen app-afbeeldingen).

### Verificatie

- Markdownlint op alle gewijzigde `.md`-bestanden (CLAUDE.md)
- Geen dode relatieve links: een linkcheck over `docs/` en `README.md`, met speciale
  aandacht voor de paden met spaties (`<…>`-notatie zoals in de Elfin-gids)
- Elke gebruikersgids bestaat in alle talen waarin hij al bestond

---

## Fase 6 — Validatie

1. `npm run build`, `npm run lint` (let op: de bron gebruikte ESLint 8 / athom 4, de
   doel-app ESLint 7 / athom 3 — nieuwe meldingen in `lib/aurora3/` verwacht; triëren zoals
   in v3.0.0)
2. `npm test` — bestaande en Aurora III-tests
3. `homey app validate -l publish`
4. `verify.py` en `check-capability-ownership.js`
5. **V1** — Aurora III-device met interne vermogensmeting aan: verschijnt
   `power_threshold_exceeded`? Zo niet: naar groep 3A verplaatsen
6. **V2** — Widgetfilter met `driver_id` (alleen relevant als O4 = twee widgets)
7. **V3** — Pipe-filter met drie waarden in de Flow-editor zichtbaar bij alle drie
8. ~~**V4**~~ — vervallen (O8 zonder modelprobe)

---

## Fase 7 — Hardware-acceptatie

Eén Homey met een Tuya-, een Aurora II- en een Aurora III-device.

| Test | Verwacht |
|---|---|
| Bestaande Tuya-flow met `set_target_temperature` | Ongewijzigd |
| Bestaande Aurora II-flow met `set_target_temperature_modbus` | Ongewijzigd |
| Aurora III: `set_target_temperature_aurora3` | Schrijft naar Aurora III, niet naar Aurora II |
| Gedeelde trigger `heating_mode_changed` bij alle drie | Vuurt per device, tokens consistent gespeld |
| Herstartvolgorde wisselen (Aurora III eerst, dan Aurora II) | Geen kaart wisselt van doeldevice |
| Gateway Aurora III loskoppelen | Aurora II en Tuya blijven werken; geen procescrash |
| Dashboards 8090 en 8091 | Elk eigen data |
| Aurora III `/interactive`: setpoint en stille modus wijzigen | Wijziging zichtbaar op het device en in de Homey-app; Aurora II onaangeroerd |
| Aurora III `/expert`: één register lezen | Waarde van Aurora III, niet van Aurora II |
| Elfin-gids stap voor stap volgen voor Aurora III (8N2) | Verbinding komt tot stand zonder aanvullende kennis |
| Pairinglijst en eerste pairingscherm van beide Modbus-drivers (O7/O8) | Model staat in de drivernaam; waarschuwingsregel zichtbaar in alle vier talen |
| Bestaand Aurora II-device na update | Ongewijzigd; alleen de drivernaam in de pairinglijst is anders (O7) |
| Oude Aurora III-app en nieuwe driver kort naast elkaar (migratiescenario) | Gedrag zoals beschreven in de migratiehandleiding |

---

## Release en migratie

1. Laatste release van `org.hhi.adlar3-heatpump-modbus` met een changelog die naar de
   hoofdapp verwijst
2. Release 3.2.0 van `org.hhi.adlar-heatpump`
3. Aankondiging in community-topic 154741

## Rollbackstrategie

Elke fase is additief ten opzichte van de bestaande drivers; de enige wijzigingen in
gedeelde bestanden zijn de 20 filterregels (3B/3C) en `app.ts` (4). Terugdraaien vóór
release = de fasecommits reverten. Na release is een driver niet meer terug te trekken
zonder gepairde Aurora III-devices te breken — vandaar P1.

## Omvangsinschatting

| Fase | Aard | Volume |
|---|---|---|
| 0 | Scripts aanpassen | Klein |
| 1 | Kopiëren + import-herschrijving | 21 bestanden, ~60 importregels; mechanisch |
| 2 | 1 splitsing (13 plekken), 10 beschrijvingen × 4 talen | Klein, handwerk |
| 3 | 57 + 5 kaartbestanden, 20 filterregels, 2 codebestanden hernoemen | Mechanisch, script |
| 4 | `app.ts` dashboard + widget-dispatch | **Grootste ontwerppost** |
| 5 | Teksten + documentatie; dashboardgids, Flow Cards Guide en migratiehandleiding elk in vier talen | **Middelgroot** — handwerk, niet te scripten |
| 6–7 | Validatie, hardware | Afhankelijk van beschikbaarheid hardware |

Het conceptueel moeilijke deel zit in fase 4 en in de controlepunten van fase 1a. De rest
is volume dat met de v3.0.0-scripts als sjabloon reproduceerbaar te doen is.

## Bijlage — Meetmethode

De aantallen in dit plan en in ADR-004 zijn gemeten met analysescripts tegen
`main` @ `a613281` en de bronrepo @ `58e010a`:

- **Lib**: per bronbestand byte-vergelijking met de kandidaatlocaties in `lib/shared/` en
  `lib/modbus/`; bij verschil `diff` om import-only te onderscheiden
- **Capabilities**: JSON-vergelijking met en zonder tekstvelden (`title`, `desc`,
  `description`, `insightsTitle*`)
- **Flow cards**: per kaart (1) bestaat de basis-ID of een `_modbus`-variant in de doelmap,
  (2) het huidige device-filter, (3) signatuur van argumenten en tokens zonder tekstvelden,
  (4) of de ID als string-literal voorkomt in de Tuya-, Aurora II- en Aurora III-code
- **Collisiecontrole hernoeming**: de 57 te splitsen ID's tegen alle capability-ID's en
  settings-sleutels van de bron

De scripts worden in fase 0 opgenomen in `scripts/migration/aurora3/` zodat de meting
herhaalbaar is.
