# ADR-004 — Aurora III Modbus-driver integreren in org.hhi.adlar-heatpump

- **Status**: Aanvaard — besluiten O1 t/m O9 genomen op 2026-10-18
- **Datum**: 2026-10-17 (voorstel), 2026-10-18 (besluit)
- **Doelversie**: 3.2.0
- **Bron-app**: `org.hhi.adlar3-heatpump-modbus` v1.9.4
- **Doel-app**: `org.hhi.adlar-heatpump` v3.1.3 (gemeten); uitvoering start op v3.1.4
- **Voorganger**: [ADR-001](ADR-001-MODBUS-DRIVER-MERGE.md) (Aurora II Modbus, v3.0.0)
- **Uitvoeringsplan**: [IMPLEMENTATIEPLAN-AURORA3.md](IMPLEMENTATIEPLAN-AURORA3.md)

## Context

Na v3.0.0 bevat de app twee drivers: `intelligent-heat-pump` (Tuya) en
`intelligent-heatpump-modbus` (Aurora II via Modbus TCP). De Aurora III-integratie is
daarna als aparte app ontwikkeld in `org.hhi.adlar3-heatpump-modbus`. Die app is een
afsplitsing van de Aurora II-app: dezelfde servicearchitectuur, maar met een eigen
registermap (Aurora III input/holding registers, o.a. `3-0038`, `4-2100`), een eigen
protocolservice (`Adlar3ModbusService`) en een smallere runtime-interface.

Doel is de Aurora III als **derde driver** in dezelfde app onder te brengen, met dezelfde
argumenten als bij ADR-001: één release, één changelog, één community-topic.

ADR-001 §5c sloot af met: *"Bij toekomstige driver-toevoegingen is deze tabel het
startpunt."* Dit ADR volgt die inventaris.

## Uitgangssituatie in cijfers

Gemeten tegen de huidige `main` (v3.1.3) en de Aurora III-repo op v1.9.4.

| Oppervlak | Aurora III | Botsing met huidige app |
|---|---|---|
| Driver-map | `drivers/intelligent-heatpump-modbus/` | 🔴 **zelfde ID als de Aurora II-driver** |
| TypeScript-bestanden `lib/` | 40 | 13 deelbaar met `lib/shared`, 6 met `lib/modbus`, **21 eigen kopie** |
| Capabilities | 80 | 62 alleen beschrijving, 9 titel/metadata, **1 structureel** (`adlar_mode`), 8 nieuw |
| Flow cards | 84 | 57 botsen met Aurora II-handlers, 20 deelbaar, 5 nieuw, 2 dood |
| Driver-settings | 59 | 0 — settings zijn driver-scoped |
| Locale-sleutels | 69 | 0 conflicten, 3 nieuw (alleen en/nl) |
| Assets | 68 | 0 inhoudelijk verschillend, 6 nieuw (3 capability-iconen, 3 app-afbeeldingen van de bron-app) |
| `public/` dashboards | 5 | 🔴 zelfde 5 bestandsnamen, andere inhoud |
| Widget | `adlar-live-operation` | 🔴 zelfde ID, ander state-contract |
| Dependencies | `jsmodbus ^4.0.10` | geen — al aanwezig |

## Besluit

De Aurora III-driver wordt toegevoegd als derde driver. Het app-ID blijft
`org.hhi.adlar-heatpump`. De principes van ADR-001 blijven ongewijzigd van kracht en
worden uitgebreid naar drie drivers:

1. **Bestaande gebruikers merken niets.** Geen enkel Tuya- of Aurora II-capability-ID,
   flow-card-ID of argumenttype wijzigt. Ook de Aurora II-code en -manifesten blijven
   functioneel onaangeroerd.
2. **Conflicten worden gesplitst, niet geharmoniseerd.** Aurora III krijgt een eigen
   suffix (voorstel `_aurora3`, zie O2) waar een ID al door een andere driver bezet is.
3. **Services blijven voorlopig gescheiden.** Alleen aantoonbaar identieke bestanden worden
   gedeeld. Convergentie van de twee Modbus-codebases is een aparte, latere stap (O3).

### 1. Driver-ID

`intelligent-heatpump-modbus` is bezet. De Aurora III-driver krijgt een nieuwe ID.

**Voorstel: `intelligent-heatpump-aurora3`** (O1). Een driver-ID is permanent: na
publicatie kan hij niet meer wijzigen zonder dat gepairde devices breken.

Alle `driver_id=intelligent-heatpump-modbus`-filters in de Aurora III-manifesten worden
herschreven naar de nieuwe ID. In de Aurora III-code staat de driver-ID op één plek
(`app.ts`); in de device-code nergens.

### 2. Flow cards — gemeten indeling

| Groep | Aantal | Behandeling |
|---|---|---|
| **A. Splitsen** — zelfde basis-ID als een Aurora II `_modbus`-kaart of een Aurora II-exclusieve kaart | 57 | Nieuwe ID `<id>_aurora3` + `driver_id`-filter op de nieuwe driver |
| **B. Delen via pipe-filter** — triggers die al op `driver_id=tuya\|modbus` staan, met identieke tokens en argumenten | 17 | Derde driver toevoegen aan het pipe-filter |
| **C. COP-triggers uit de gedeelde `rolling-cop-calculator`** | 3 | Aurora III toevoegen aan het filter (zie hieronder) |
| **D. Nieuw en Aurora III-exclusief** | 5 | ID behouden, `driver_id`-filter op de nieuwe driver |
| **E. Dood in Aurora III** — gedefinieerd, nergens afgevuurd of geregistreerd | 2 | Niet overnemen |
| **Totaal** | **84** | 62 nieuwe kaarten → app.json van 170 naar **232** |

**Waarom groep A niet gedeeld kan worden.** De Aurora III `flow-card-manager-service.ts`
registreert per device run-listeners op app-brede kaart-singletons en leest daarbij
`this.device` (22×) in plaats van `args.device` (1×). Dat is risico 4 uit ADR-001 §5a.
Delen met de Aurora II-kaarten zou de handler-race transport-overschrijdend maken: de
driver die het laatst initialiseert wint, en een Aurora II-gebruiker krijgt condities die
Aurora III-waarden lezen. Besluit B5 uit v3.0.0 geldt hier één-op-één: Aurora III-gebruikers
pairen toch opnieuw, dus nieuwe ID's kosten hen niets.

**Waarom groep B wel gedeeld kan worden.** Deze 17 triggers worden door de device-code zelf
afgevuurd (`getDeviceTriggerCard(id).trigger(device, …)`) en hebben geen per-device
run-listener. Afvuren vanuit drie drivers botst niet. Tokens en argumenten zijn
structureel identiek gemeten. De capability-filters (`adlar_simulated_target`,
`energy_prices_data`, `building_insight_*`, …) zijn allemaal aanwezig in de Aurora
III-driver.

Twee kanttekeningen:

- `heating_mode_changed` levert `mode` als string. De waardeverzameling verschilt per
  model, en ook de spelling van gelijke modi: Aurora II levert `Cooling`/`Heating`
  (plus `Hot Water`, `Floor Heating`, combinaties), Aurora III `Off`/`Cool`/`Heat`/`Auto`.
  Een flow die op `"Heating"` vergelijkt, werkt dan bij het ene model wel en bij het andere
  niet. Voorstel: bij import de Aurora III-strings gelijktrekken naar de Aurora II-spelling
  (`Cooling`, `Heating`); `Off` en `Auto` blijven. Aurora III-gebruikers bouwen hun flows
  toch opnieuw op, dus dit kost hen niets.
- `power_threshold_exceeded` filtert op `capabilities=measure_power`. Aurora III voegt
  `measure_power` **runtime** toe via `addCapability()` (instelling voor interne
  vermogensmeting). Volgens de Homey-docs werkt `addCapability()` dit filter niet bij.
  Te verifiëren in fase 6; valt het tegen, dan wordt de kaart een groep A-splitsing.

**Groep C — een bestaand gat dat zichtbaar wordt.** `cop_trend_detected`,
`daily_cop_efficiency_changed` en `monthly_cop_efficiency_changed` worden afgevuurd door
`lib/shared/services/rolling-cop-calculator.ts`, een bestand dat door alle drivers wordt
gedeeld. De kaarten staan echter op `driver_id=intelligent-heat-pump`. Ook Aurora II-devices
vuren ze dus af, maar gebruikers kunnen ze daar niet selecteren. De run-listeners in
`app.ts` zijn puur `args`/`state`-gebaseerd en al per driver gescoped (`scopedFeature`),
dus delen is veilig.

Voorstel: Aurora III toevoegen aan het filter. Aurora II óók toevoegen is een losse
gedragswijziging voor bestaande Aurora II-gebruikers (nieuwe kaarten verschijnen) en wordt
daarom als apart besluit voorgelegd (O6).

### 3. Capabilities

| Groep | Aantal | Behandeling |
|---|---|---|
| Identiek op beschrijving na | 62 | Gedeelde definitie behouden |
| Alleen titel/insights-titel verschilt | 8 | Bestaande titel behouden (raakt Aurora II-gebruikers anders zichtbaar) |
| `cop_optimizer_diagnostics` | 1 | Bestaande definitie behouden (Aurora III mist `id`, heeft wel `icon` — `icon` overnemen) |
| `adlar_mode` | 1 | 🔴 **Splitsen** → `adlar_mode_aurora3` |
| Nieuw | 8 | Toevoegen zonder suffix (geen botsing) |

Van de 70 gedeelde definities noemen er **10** in hun beschrijving een Aurora II-register
(bijv. *"Modbus status register 0x0000, bit 8"*). Na de merge is dat voor Aurora
III-devices onjuist. Die tien worden transport-neutraal herschreven, in alle vier talen
voluit (les uit v3.0.0 fase 4: geen regex op vertaalstrings).

`adlar_mode` is de enige structurele botsing, en die is hard: dezelfde enum-ID's hebben een
andere betekenis.

| ID | Aurora II | Aurora III |
|---|---|---|
| `0` | Koelen | **Uit** |
| `1` | Verwarmen | Koelen |
| `2` | Warm water | Verwarmen |
| `4` | Koelen + warm water | Auto |

Een gedeelde definitie zou Aurora II- of Aurora III-devices een verkeerd label in de UI en
Insights geven. De hernoeming raakt 13 plekken in de Aurora III-code, -manifesten en -HTML (o.a.
`device.ts`, `widget-state-service.ts`, `dashboard-live.html`) en twee testbestanden. Les uit
v3.0.0 (fase 4): `tsc` valideert geen strings; na de hernoeming per bestand handmatig
controleren.

De acht nieuwe capabilities (`adlar_backup_heater_forced`, `adlar_compressor_on`,
`adlar_dhw_active`, `adlar_dhw_enabled`, `adlar_disinfection_enabled`,
`adlar_high_pressure`, `adlar_low_pressure`, `adlar_silent_mode`) bestaan nergens in de app
en krijgen conform ADR-001 §4 geen suffix — gratuit hernoemen is niet de bedoeling.

### 4. Lib-structuur

| Herkomst | Aantal | Behandeling |
|---|---|---|
| Identiek aan `lib/shared/` | 10 | Importeren uit `lib/shared/` |
| Identiek aan `lib/shared/` op importpad na | 2 | Importeren uit `lib/shared/` (`defrost-learner`, `weather-forecast-service`) |
| `flow-handler-wrapper.ts` | 1 | Vervalt — alleen gebruikt in `app.ts`, die de gedeelde versie al aanroept |
| Identiek aan `lib/modbus/` (Aurora II) | 6 | Importeren uit `lib/modbus/` (O3) |
| Identiek aan `lib/modbus/` op importpad na, maar typegekoppeld¹ | 1 | Eigen kopie (`building-insights-service`) |
| Gedivergeerd of nieuw | 20 | Eigen kopie |
| **Totaal in `lib/aurora3/`** | **21** | |

¹ `building-insights-service.ts` importeert de types `BuildingModelService` en
`AdaptiveControlService` uit zijn eigen map. Die services zijn gedivergeerd, en klassen met
`private`-leden zijn in TypeScript nominaal getypeerd: een Aurora III-instantie past niet
op het Aurora II-type. Byte-gelijkheid van een bestand zegt niets over wat het importeert.

Doelstructuur:

```text
lib/
├─ shared/                      ← ongewijzigd
├─ tuya/                        ← ongewijzigd
├─ modbus/                      ← Aurora II, ongewijzigd
└─ aurora3/                     ← nieuw
   ├─ constants.ts
   ├─ types/shared-interfaces.ts
   ├─ protocol/
   │  ├─ adlar3-modbus-registers.ts
   │  ├─ adlar3-modbus-service.ts
   │  ├─ modbus-runtime-service.ts
   │  └─ modbus-tcp-service.ts
   └─ services/                 ← 15 services
```

De zwaarst gedivergeerde bestanden ten opzichte van Aurora II: `dashboard-service.ts` (970
diff-regels), `flow-card-manager-service.ts` (654), `modbus-tcp-service.ts` (254),
`service-coordinator.ts` (186), `widget-state-service.ts` (186), `cop-calculator.ts` (139;
Aurora III heeft `refrigerant_circuit` vervangen door `power_estimation`).

De runtime-interface is ook gedivergeerd: Aurora II biedt `setHeatingCurve()`,
`setUserMode()` en vier curve-setters; Aurora III biedt één generieke
`setFeature(feature, value)`. Een gedeelde `ModbusRuntime`-abstractie is daarmee geen
kopieerwerk maar ontwerpwerk — precies de convergentie die ADR-001 uitstelde.

**Bewuste consequentie**: na deze merge bestaan circa 14 services in **drie** varianten
(Tuya, Aurora II, Aurora III). Een bugfix in bijvoorbeeld `adaptive-control-service.ts`
moet op drie plekken. Dat is de prijs voor nul regressierisico op de bestaande drivers. De
convergentie van de twee Modbus-varianten is daarmee urgenter geworden dan na v3.0.0 en
staat als eerste vervolgstap genoteerd.

### 5. App-brede voorzieningen

Inventaris volgens ADR-001 §5c, nu voor drie drivers.

| Oppervlak | Bevinding | Besluit |
|---|---|---|
| `homey.flow` — kaart-singletons | Handler-race bij delen (§2) | Splitsen, groep A |
| SelfHealingRegistry | Al per driver gescoped via `scopedFeature(featureName, args)` | 🟢 Geen actie |
| Flow-logging (`flow-handler-wrapper`) | Al per device via `log_level` | 🟢 Geen actie |
| `DashboardService` | Eén app-instantie, getter `app.dashboard`, setter `app.setDashboardPort()`; beide drivers zouden dezelfde instantie, poort 8090 en `public/`-map gebruiken | 🔴 Tweede instantie voor Aurora III, eigen `public/aurora3/`, standaardpoort 8091 |
| Widget `adlar-live-operation` | Zie hieronder | 🔴 O4 |
| `process.on(...)`-handlers | Derde transportstack in hetzelfde proces | 🟡 Geaccepteerd, zoals ADR-001 risico 2 |
| `homey.settings` (app-breed) | Niet gebruikt door Aurora III | 🟢 |
| Locales | Geen conflicten; 3 nieuwe sleutels missen de/fr | 🟡 Aanvullen |
| `energy`-object | Afwezig, zoals bij Aurora II | 🟡 Doorgeschoven, zoals ADR-001 B2 |

**Dashboard.** Aurora III-devices praten met de app via `app.dashboard` en
`app.setDashboardPort()`, dezelfde leden die Aurora II gebruikt. Zonder ingreep schrijven
beide drivers snapshots naar één server die Aurora III-HTML serveert met Aurora II-data of
andersom. Besluit: Aurora II-leden blijven exact zoals ze zijn; Aurora III krijgt
parallelle leden (`aurora3Dashboard`, `setAurora3DashboardPort()`) en de Aurora III-code
wordt bij import daarop aangepast. Een generieke `DashboardHost` per driver-ID is de
nettere vorm, maar raakt de Aurora II-code; vervolgstap.

Een eigen poort is hier geen gemakskeuze maar volgt uit de HTML: alle vijf Aurora
III-pagina's gebruiken absolute paden (`fetch('/api/snapshot')`, `href="/live"`; 11
`fetch`-aanroepen en 4 navigatielinks). Eén server met een route-prefix zou elke URL in de
HTML laten herschrijven en twee sets schrijfendpoints (`/api/write`, `/api/expert/write`)
naast elkaar op één server zetten. Met een eigen poort blijft de HTML ongewijzigd.

Wel nodig: de Aurora III-`DashboardService` krijgt een `publicDir`-optie. Hij bouwt het pad
nu hard als `<appDir>/public`, en `appDir` kan niet verlegd worden omdat dezelfde service er
ook `app.json` (capability-metadata) en `assets/` mee vindt. De Aurora II-service blijft
ongewijzigd.

Poortbotsing tussen de twee instanties wordt al afgevangen (`EADDRINUSE` → log, geen
crash); de settings-hints noemen de standaardpoort van de andere driver. Beide dashboards
hebben ongeauthenticeerde schrijfendpoints op het LAN; dat is bestaand ontwerp, maar het
aantal open poorten verdubbelt en de dashboardgids moet dat vermelden.

`dashboard-live.html` groepeert capabilities op letterlijke ID's. Na de `adlar_mode`-splitsing
moet `adlar_mode_aurora3` in de groep *Status* staan, anders valt hij stil in de restgroep.
Dat dit risico reëel is, blijkt uit de Aurora II-versie: die noemt nog
`adlar_enum_work_mode`, `adlar_enum_capacity_set` en `adlar_state_backwater`, ID's die in
v3.0.0 naar `_modbus` zijn hernoemd. Die drie stonden op het Aurora II-dashboard dus in de
verkeerde groep; hersteld in v3.1.4.

**Widget.** Beide repo's hebben widget-ID `adlar-live-operation` met identieke `api.js`,
maar:

- de app-resolver zoekt devices hard op de Aurora II-driver;
- het state-contract verschilt: Aurora II levert een `regulation`-blok en
  `status.connectionLabel`, Aurora III levert `temperatures.setpointC`;
- het device-filter van de widget (`class=heatpump` +
  `measure_temperature.outlet,measure_temperature.inlet`) matcht **beide** Modbus-drivers.

Dat laatste maakt een tweede, losse widget minder aantrekkelijk dan het eerder leek: beide
widgets zouden in hun device-picker devices van beide drivers tonen en bij de "verkeerde"
falen, tenzij het widgetfilter op `driver_id` kan filteren — dat is niet gedocumenteerd en
moet worden geverifieerd (V2).

De dispatch bestaat al: de app-resolver bouwt de state niet zelf, maar roept
`device.getLiveOperationWidgetState()` aan, en beide `device.ts`-varianten hebben die
methode met hun eigen state-service. Polymorfisme via het device, net als bij de
schrijfkaarten in ADR-001 §5b.

**Voorstel (O4)**: één widget. Wijzigingen: `_getAdlarDevices()` verzamelt devices van
beide Modbus-drivers; het type `LiveOperationWidgetState` in `app.ts` wordt de unie van de
twee contracten; `index.html` toont optionele blokken (`regulation`, `connectionLabel`,
`setpointC`) alleen als ze aanwezig zijn.

### 6. Documentatie

Na v3.0.0 is de documentatie per **onderwerp** geordend (`docs/setup/`,
`docs/Dev support/modbus/`, `docs/Heatpump specs/modbus/`), niet per bronrepo. De Aurora
III-documentatie wordt daarin ingevoegd; er komt geen `docs/aurora3/`.

Van de 19 documentbestanden in de bronrepo zijn er 5 identiek aanwezig, 2 al aanwezig op een
ander pad (waarvan 1 inhoudelijk gelijk en 1 door Aurora III uitgebreid), 4 spreadsheets met
afwijkende inhoud op hetzelfde pad, en 8 nieuw.

Inhoudelijk het belangrijkst:

- **Elfin EW11-gids**: één gids voor beide modellen, omdat ze ~90% gelijk zijn. Het
  verschil doet er wel toe: Aurora I/II gebruikt `9600 8N1`, Aurora III `9600 8N2`, en
  Aurora III vereist `Serial protocol = Modbus` op de gateway. Een gebruiker die de
  verkeerde instelling volgt krijgt geen verbinding, zonder duidelijke foutmelding.
- **Dashboardgids** (4 talen): per model de poort en welke pagina's er zijn
  (`/heating-curve` alleen Aurora II).
- **Flow Cards Guide** (4 talen): de 5 Aurora III-exclusieve kaarten.
- **Migratiehandleiding** (4 talen): nieuw.

De volledige lijst per bestand staat in het implementatieplan, fase 5b.

### 7. Drivernamen in de pairinglijst

Gebruikers kiezen bij het pairen op weergavenaam. Huidig en na de merge:

| Driver | Nu | Voorstel (O7) |
|---|---|---|
| Tuya | Adlar Castra Aurora Heat Pump (Tuya) | ongewijzigd |
| Aurora II | Adlar Castra Aurora Heat Pump (Modbus) | Adlar Castra Aurora II Heat Pump (Modbus) |
| Aurora III | *(bron)* Adlar Castra Heat Pump (Aurora-III Modbus) | Adlar Castra Aurora III Heat Pump (Modbus) |

Zonder aanpassing staan *"(Modbus)"* en *"(Aurora-III Modbus)"* naast elkaar, en lijkt de
eerste de generieke keuze voor alle Modbus-modellen. Het wijzigen van de weergavenaam van
de Aurora II-driver is niet-brekend: de driver-ID blijft, en de namen van al gepairde
devices veranderen niet. Ook het driver-icoon (`assets/icon.svg`) is byte-identiek tussen
beide Modbus-drivers; alleen de drivernaam en de driverafbeeldingen onderscheiden ze in de
pairinglijst.

**Bijgesteld op 2026-10-19 (O7).** In de pairinglijst kort Homey lange namen af, waardoor het
onderscheidende deel achteraan wegvalt. De namen beginnen nu met model en protocol, voor alle
drie de drivers en in alle vier talen (`de`: *über*):

| Driver | `name` in `driver.compose.json` |
|---|---|
| Tuya | Aurora I/II via Tuya |
| Aurora II (Modbus) | Aurora I/II via Modbus |
| Aurora III (Modbus) | Aurora III via Modbus |

De Tuya-driver krijgt hiermee ook een nieuwe weergavenaam, en voor het eerst `de` en `fr`.

#### Risico — verkeerd model gepaird (nieuw door de merge)

Zolang elk model een eigen app had, kon een gebruiker het verkeerde model niet kiezen. Na de
merge staan twee Modbus-drivers in één lijst, en **geen van beide controleert tijdens het
pairen welk model er aan de gateway hangt**: `list_devices` maakt het device aan op basis
van IP-adres, poort en unit-ID, zonder registerprobe.

Gevolg bij een vergissing: de Aurora II-driver leest en **schrijft** naar Aurora
II-registeradressen (bijv. `CONTROL_REGISTERS.mainSwitch`, `.mode`) op een Aurora III-unit,
of andersom. In het gunstige geval antwoordt de unit met een Modbus-exception; in het
ongunstige geval bestaat het adres wel en heeft het een andere betekenis.

**Besluit (O8)**: geen modelprobe in 3.2.0. De keuze van de gebruiker is leidend; het risico
wordt afgedekt met onderscheidende drivernamen (O7) en een waarschuwingsregel in het eerste
pairingscherm van beide Modbus-drivers (*"Kies het model dat op het typeplaatje staat"*).

Overwogen en voor 3.2.0 afgewezen:

- **Harde probe** (pairen weigeren bij een ander model). Vereist dat V4 op beide modellen
  op echte hardware is bevestigd; de testopstelling heeft één echte unit en een
  Modbus-simulator, en een simulator antwoordt zoals hij is ingericht, niet zoals de
  echte unit.
- **Zachte probe** (alleen waarschuwen bij een Modbus-exception op een register dat de
  eigen driver toch al pollt). Veilig bij een half geverifieerde V4 — een correcte keuze
  kan geen onterechte waarschuwing geven — maar wijzigt `driver.ts` van de Aurora
  II-driver, in strijd met principe 1. Kan later als losse release, als in de praktijk
  blijkt dat gebruikers het verkeerde model kiezen.

### 8. Migratie voor Aurora III-gebruikers

Gelijk aan ADR-001: Homey kent geen cross-app device-migratie.

1. Devices opnieuw pairen in `org.hhi.adlar-heatpump` (nieuwe driver "Aurora III")
2. Flows opnieuw opbouwen (nieuwe kaart-ID's met `_aurora3`)
3. Device-settings opnieuw invullen (59 sleutels; de settings-export uit v3.0.0 besluit B4
   is herbruikbaar als die in de bron-app aanwezig is)
4. Insights-historie gaat verloren

Begeleiding: laatste release van `org.hhi.adlar3-heatpump-modbus` met een verwijzende
changelog, migratiehandleiding in `docs/setup/`, aankondiging in community-topic 154741.

**Parallelle periode.** Tijdens de overstap draaien de oude app en de nieuwe driver
mogelijk tegelijk tegen dezelfde gateway. Dan pollen twee Modbus-masters dezelfde RS485-bus
via de EW11A, met meer kans op time-outs, en **schrijven** beide (adaptieve regeling,
setpoints). De migratiehandleiding moet voorschrijven: eerst de adaptieve regeling in de
oude app uitzetten of het oude device verwijderen, daarna pas pairen in de nieuwe app.
De oude app gebruikt bovendien poort 8090 voor zijn dashboard; met de nieuwe standaard 8091
voor Aurora III botst dat niet.

## Volledige inventaris van integratievlakken

De eerste versie van dit ADR is opgebouwd vanuit opvallende verschillen, niet vanuit een
volledige lijst. Daardoor bleven het dashboard en de documentatie eerst onderbelicht —
dezelfde methodefout die ADR-001 §5c al benoemde. Deze sectie corrigeert dat. Ze loopt
**alle 353 bestanden van de bronrepo** (gegroepeerd per gebied) en **alle app-brede
oppervlakken** af. Per regel staat of het onderdeel is gemeten en waar het besluit staat.

Legenda: ✅ gemeten, geen actie of al gedekt · 🟡 gemeten, actie in het plan ·
🔴 gemeten, besluit nodig.

### A. Bronrepo, per gebied

| Gebied | Bestanden | Status | Bevinding | Waar |
|---|---|---|---|---|
| `.homeycompose/app.json`, `app.json` (gegenereerd) | 2 | ✅ | App-niveau; niet overnemen | Plan 1c |
| `.homeycompose/capabilities/` | 80 | 🟡 | 1 splitsing, 8 nieuw, 10 beschrijvingen neutraal | §3, plan 2 |
| `.homeycompose/flow/` | 84 | 🟡 | 57 splitsen, 20 delen, 5 nieuw, 2 dood | §2, plan 3 |
| `drivers/…/driver.compose.json` | 1 | 🟡 | `pair` identiek aan Aurora II; ~22 strings zonder de/fr | Plan 1b, 5a |
| `drivers/…/driver.settings.compose.json` | 1 | ✅ | 59 sleutels; gedeelde sleutels hebben identieke standaardwaarden en typen; alleen `dashboard_port`-hint wijzigt | Plan 1b |
| `drivers/…/driver.ts` | 1 | ✅ | Geen modelcontrole bij pairen; bewust zo gelaten | §7, O8 |
| `drivers/…/device.ts` | 1 | 🟡 | Alle `homey.*`-aanroepen nagelopen; 4 app-casts; `adlar_mode`-listener en hardgecodeerde capability-lijst (`DRIVER_COMPOSE_CAPABILITIES`) | Plan 1b, 2b, 4a |
| `drivers/…/pair/` | 1 | ✅ | Byte-identiek aan Aurora II | — |
| `drivers/…/assets/` | 6 | ✅ | Driverafbeeldingen in juiste maten (75/500/1000); icoon identiek aan Aurora II | §7 |
| `lib/` | 40 | 🟡 | 19 meegebruikt, 21 eigen kopie; 0 module-brede state in de meegebruikte bestanden | §4, plan 1a |
| `public/` | 5 | 🟡 | Absolute paden → eigen poort; `publicDir`-optie | §5, plan 4a |
| `widgets/` | 5 | 🟡 | Dispatch via device bestaat al; devicelijst en type uitbreiden | §5, plan 4b |
| `locales/` | 2 | 🟡 | 0 conflicten; 3 sleutels zonder de/fr | Plan 5a |
| `assets/` | 68 | 🟡 | 6 nieuw: 3 iconen (iOS-conform per element), 3 app-afbeeldingen (niet nodig) | Plan 1c |
| `docs/` | 19 | 🟡 | Invoegen in bestaande structuur | §6, plan 5b |
| `test/` | 16 | 🟡 | 5 naambotsingen; `tsconfig` sluit `test/` uit (ts-scripts via `tsx`) | Plan 1c |
| `app.ts` | 1 | 🟡 | Alleen dashboard, widget, logging, procesbrede handlers; geen app-level kaarten | §5, plan 4 |
| `app-debug.ts`, `launch.json`, `test-network-stability.sh` | 3 | ✅ | Debughulpen; doel-app heeft eigen varianten (shell-script identiek) | Niet overnemen |
| `package.json`, `package-lock.json` | 2 | ✅ | Alleen `jsmodbus` (al aanwezig); ESLint 8 vs 7 | Plan 6 |
| `tsconfig.json`, `.eslintrc.json`, `.gitignore`, `.homeyignore` | 4 | ✅ | Doel-app is strenger (`test/` uitgesloten van build en pakket) | — |
| `.homeychangelog.json`, `README*` (6) | 7 | ✅ | App-niveau; niet overnemen, wel verwijzen | Plan 5a |
| `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.claude/settings.json` | 4 | 🟡 | Aurora III-regels (registernotatie, timer-provider, sync-regel voor `capability-modbus-mapping.md`) overnemen in doel-`CLAUDE.md`; `.claude/settings.json` (`Bash(*)`) **niet** overnemen | Plan 5b |
| *(niet in repo)* `ADR/` | — | 🔴 | Code van beide apps verwijst naar ADR-020 t/m ADR-061; die staan in geen van beide repo's (bron: `ADR/` in `.gitignore`) | O9 |

### B. App-brede oppervlakken (vervolg op ADR-001 §5c)

| Oppervlak | Status | Bevinding |
|---|---|---|
| `homey.flow` — kaart-singletons | 🟡 | §2; de 20 gedeelde triggers hebben geen per-device run-listener (gemeten) |
| `homey.drivers.getDriver/getDrivers` | ✅ | Alleen in `app.ts` (widget) en een niet-nul-controle in beide flow-card-managers |
| `homey.app`-casts uit services | ✅ | Terugval op `app[<naam>Trigger]` in de flow-card-manager vindt na het hernoemen naar `_aurora3` geen Tuya-trigger meer |
| `homey.settings` (app-breed) | ✅ | Niet gebruikt door Aurora III |
| `homey.notifications` | ✅ | Alleen procesbrede handlers in `app.ts`; doel-app heeft eigen teksten |
| `homey.i18n` | ✅ | Alleen `getLanguage()` voor rapporten |
| `homey.manifest` / `version` | ✅ | Device toont straks de versie van de doel-app — correct |
| Timers | ✅ | Via `homey.setTimeout`; `modbus-tcp-service` heeft een injecteerbare timer-provider met globale terugval |
| Procesbrede handlers | 🟡 | Derde transport in hetzelfde proces (ADR-001 risico 2) |
| Module-brede state in gedeelde bestanden | ✅ | 0 treffers in de 19 meegebruikte bestanden |
| SelfHealingRegistry, Flow-logging | ✅ | Al per driver resp. per device gescoped |
| Dashboard-HTTP-servers | 🟡 | §5: twee poorten, beveiligingsnotitie |
| Device `data.id` | ✅ | Beide Modbus-drivers gebruiken `modbus-<host>-<unit>`; uniek per driver, en het widget zoekt op Homey-device-ID |
| Capability- en kaart-naamruimte | 🟡 | §2, §3 |
| Settings-naamruimte | ✅ | Driver-scoped |
| `energy`-object | ✅ | Afwezig bij beide Modbus-drivers; doorgeschoven (ADR-001 B2) |
| Pakketinhoud (`.homeyignore`) | 🟡 | `scripts/` wordt nu meegepakt in de app; met `scripts/migration/aurora3/` groeit dat. `scripts/*` toevoegen |
| CI (`.github/workflows`) | ✅ | Alleen `homey app validate` op PR's; tests en lint draaien lokaal (fase 6) |
| Agent-instructies doel-app | 🟡 | `AGENTS.md`, `GEMINI.md` en `.github/copilot-instructions.md` beschrijven nog een app met één driver (bestaand); bijwerken naar drie |

### C. Gebruikers- en releaseaspecten

| Aspect | Status | Bevinding |
|---|---|---|
| Driverkeuze bij pairen | 🟡 | O7 (naam), O8 (waarschuwingstekst, geen probe) |
| Parallelle periode oude/nieuwe app | 🟡 | §8: volgorde voorschrijven in de migratiehandleiding |
| Gateway-instellingen per model | 🟡 | §6: 8N1 vs 8N2 |
| Flows en Insights van Aurora III-gebruikers | ✅ | Gaan verloren; gedocumenteerd (§8) |
| Bestaande Tuya- en Aurora II-flows | ✅ | Geen ID- of argumentwijziging; alleen 20 filterregels verbreed |

## Gevolgen

### Voor Tuya- en Aurora II-gebruikers

Geen actie. Zichtbaar alleen als O6 wordt aangenomen (drie COP-triggers verschijnen ook bij
Aurora II).

### Voor Aurora III-gebruikers

Eenmalige harde migratie (§8).

### Voor onderhoud

- `app.json`: 170 → 232 flow cards, 101 → 110 capabilities, 2 → 3 drivers
- Drie servicevarianten naast elkaar (§4) — dit is de grootste structurele schuld van deze
  release
- `scripts/check-capability-ownership.js` (ADR-001 §4) wordt bij drie drivers een
  noodzaak: 62 capability-definities worden straks door drie drivers gedeeld

## Besluiten

Op 2026-10-18 besloten. O1 t/m O7 en O9 zijn aanvaard zoals voorgesteld; bij O8 is gekozen
voor het minimale alternatief (§7), waardoor V4 vervalt. Uitvoering per fase volgens het
[implementatieplan](IMPLEMENTATIEPLAN-AURORA3.md).

| # | Vraag | Besluit |
|---|---|---|
| **O1** | Driver-ID | `intelligent-heatpump-aurora3` |
| **O2** | Suffix voor gesplitste kaarten en capabilities | `_aurora3` |
| **O3** | Splitsen (`lib/aurora3/`, 6 bestanden uit `lib/modbus/` meegebruiken) of eerst de Modbus-codebases convergeren | Splitsen; convergentie als v3.3-traject |
| **O4** | Widget: één widget met driver-dispatch, of twee widgets | Eén widget met unie-contract |
| **O5** | Versienummer | 3.2.0 (nieuwe driver, niet-brekend voor bestaande gebruikers) |
| **O6** | De drie COP-triggers (groep C) ook voor Aurora II openzetten | Ja, maar als losse changelog-regel en los te testen |
| **O7** | Weergavenamen van de twee Modbus-drivers per model onderscheiden (§7) | Ja; op 2026-10-19 bijgesteld naar *model via protocol* voor alle drie de drivers (zie §7) |
| **O8** | Modelprobe bij het pairen van beide Modbus-drivers (§7) | Nee; O7 + waarschuwingsregel in het pairingscherm. Probe eventueel later als losse release |
| **O9** | De externe ADR-reeks (ADR-020 t/m ADR-061, nu buiten beide repo's) in de repo opnemen? | Ja, als `docs/architecture/decisions/` met herkomstvermelding per bron. Vooraf vaststellen of na de fork van Aurora II naar Aurora III hetzelfde nummer voor verschillende besluiten is gebruikt. Dit staat los van de reeks ADR-001…004 in `docs/architecture/`; die twee nummerreeksen expliciet onderscheiden (bijv. de nieuwe merge-ADR's een prefix `MERGE-` geven, of de externe reeks `LEGACY-ADR-0xx`) |

## Te verifiëren

1. **V1** — Toont `power_threshold_exceeded` (filter `capabilities=measure_power`) bij een
   Aurora III-device waarbij `measure_power` runtime is toegevoegd?
2. **V2** — Ondersteunt het `devices.filter` van een widget een `driver_id`-sleutel?
   Bepaalt of O4 met twee widgets alsnog haalbaar is.
3. **V3** — Werkt een pipe-filter met drie waarden
   (`driver_id=a|b|c`) zoals met twee? V1 uit v3.0.0 bevestigde alleen twee waarden.
4. ~~**V4** — Welk register onderscheidt Aurora II en Aurora III betrouwbaar?~~ Vervallen
   door het besluit over O8 (geen modelprobe in 3.2.0).

## Afwegingen die zijn verworpen

- **Aurora III-kaarten delen met de Aurora II `_modbus`-kaarten.** Zou 57 kaarten besparen,
  maar vraagt het unificeren van twee flow-card-managers met elk eigen handlers, plus de
  `args.device`-reparatie aan Aurora II-zijde. Dat is de convergentie van O3 in vermomming.
- **De Aurora III-driver hernoemen naar het oude ID en Aurora II een nieuw ID geven.**
  Breekt alle Aurora II-gebruikers die sinds v3.0.0 gemigreerd zijn.
- **`adlar_mode` harmoniseren via een vertaaltabel.** Een enum-capability heeft één
  waardenlijst per app; harmoniseren betekent de Aurora II-waarden hernummeren, wat
  bestaande Insights en flows breekt.
- **De 8 nieuwe capabilities een `_aurora3`-suffix geven.** Geen botsing, dus geen reden;
  zou alleen toekomstige convergentie bemoeilijken.

## Vervolgstappen (buiten scope van 3.2.0)

1. Modbus-convergentie: één `lib/modbus/common/` met `ModbusRuntime`-abstractie en twee
   protocoladapters (Aurora II, Aurora III); daarna één flow-card-manager met `args.device`
2. `DashboardHost` per driver-ID in plaats van parallelle app-leden
3. `.homeycompose/drivers/templates/` met `$extends` voor de gedeelde capability-lijsten
4. `energy.approximation` voor beide Modbus-drivers (ADR-001 B2)
