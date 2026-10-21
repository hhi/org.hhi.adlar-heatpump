# ADR-005 — Gedeelde rekenservices en bewaking van de Modbus-codebases

- **Status**: Voorgesteld (herzien 2026-10-21)
- **Datum**: 2026-10-19, herzien 2026-10-21
- **Doelversie**: 3.3.1 (voorlopig, C8)
- **Voorgangers**: [ADR-004](ADR-004-AURORA3-DRIVER-MERGE.md) (vervolgstappen 1
  en 2), [ADR-001](ADR-001-MODBUS-DRIVER-MERGE.md) (§5a risico 4)
- **Gemeten tegen**: `beacecf` (§1, v3.2.0), aangevuld op `eefcb3b` (v3.3.0)
- **Bronnen van de fork**: Aurora II `org.hhi.adlar-heatpump-modbus` (tot en met
  2.15.1, `10d1d04`), Aurora III `org.hhi.adlar3-heatpump-modbus` v1.9.4
  (`58e010a`)

## Herziening

De eerste versie van dit ADR (`fe76201`) stelde een volledige convergentie
voor: één `ModbusRuntime` met twee adapters, één flow-card-registry met
`args.device`, één `DashboardHost` per driver-ID, in 9 fasen. Die versie is
herzien om drie redenen:

1. **De producten groeien uit elkaar.** Sinds half juni was vrijwel elke
   wijziging productspecifiek (§2). De opbrengst "een fix gebeurt één keer"
   geldt dus vooral voor de code die nog gelijk is.
2. **Volledige convergentie maakt van twee foutdomeinen één.** Een fout in de
   gedeelde transportlaag, coördinator of flow-registry raakt dan alle
   Modbus-gebruikers tegelijk.
3. **De gebruikerswinst is klein.** De reparatie van risico 4 merkt alleen wie
   twee warmtepompen van hetzelfde model heeft.

Dit ADR deelt daarom alleen wat gelijk is en tegelijk verandert (de
rekenservices), en bewaakt de rest. Het ontwerp voor de volledige convergentie
blijft beschikbaar in `fe76201` (zie *Uitgesteld*).

## Samenvatting voor de eigenaar

- **Delen.** 7 bestanden met rekenlogica worden één gedeelde versie in
  `lib/modbus/`. Vijf zijn al gelijk; twee krijgen één instelling per model.
  Ongeveer 6.750 regels Aurora III-kopie vervallen (§3).
- **Bewaken.** De overige 11 bestandsparen blijven per product apart. Een
  nieuwe check, `npm run check:twins`, meldt elke wijziging aan één kant van
  een paar. Jij beslist dan: ook overzetten, of als productspecifiek
  accepteren met een reden (§4).
- **Gedrag.** Neutraal. Alleen logregels van de adaptieve regeling noemen geen
  registeradres meer.
- **Bug drempeltriggers: opgelost** in `1629b19` (fase 0), uitgebracht met
  3.3.0. De changelog-regel ontbreekt nog en komt mee met 3.3.1 (C7).
- **Niet in dit ADR**: `ModbusRuntime`, flow-card-registry, `DashboardHost`.
  Risico 4 blijft daardoor open voor beide Modbus-drivers.
- **Plan.** 5 fasen (0–4), één release (3.3.1).
- **Te beslissen:** C1–C8. De belangrijkste zijn C2 (falen of waarschuwen),
  C3 (check in CI) en C8 (versie).

## Context

ADR-004 heeft Aurora III als derde driver toegevoegd. Om nul regressierisico te
hebben, kreeg Aurora III daarbij een eigen kopie van de Modbus-services in
`lib/aurora3/` (ADR-004 O3, principe 3). Bewuste prijs: een bugfix in een
Modbus-service moet twee keer.

De fork is ouder dan de merge. Aurora III is op 2026-05-07 afgesplitst van de
Aurora II-app. Daarna zijn beide apps vijf maanden apart ontwikkeld, met
fixes die met de hand heen en weer zijn overgezet. Niet alles is overgezet
(§1b). Het risico is dus niet alleen dubbel werk, maar vooral dat een fix in
de andere variant vergeten wordt.

Buiten scope: de Tuya-driver en een gedeelde basisklasse voor `device.ts`.

## 1. Meting per bestandspaar

Methode: `diff` per bestandspaar tussen `lib/modbus/` en `lib/aurora3/` op
`beacecf`. Kolom *+/−* telt toegevoegde plus verwijderde regels. Kolom
*kern* telt dezelfde diff zonder importregels en zonder witruimte aan het
regeleinde. Aard: **C** = cosmetisch (commentaar, logtekst, volgorde,
importpad), **P** = protocolspecifiek (registers, snapshotvelden,
capability-ID's), **G** = gedivergeerd gedrag.

| Bestand | Regels A2 | Regels A3 | +/− | Kern | Aard | Dit ADR |
|---|---:|---:|---:|---:|---|---|
| `services/building-insights-service.ts` | 1382 | 1382 | 0 | 0 | — | Delen |
| `services/scop-calculator.ts` | 546 | 546 | 4 | 4 | P | Delen |
| `services/energy-tracking-service.ts` | 799 | 797 | 10 | 8 | P | Delen, met instelling |
| `constants.ts` | 343 | 342 | 11 | 11 | C/P | Delen |
| `types/shared-interfaces.ts` | 49 | 36 | 17 | 17 | C | Delen |
| `protocol/modbus-runtime-service.ts` | 55 | 50 | 21 | 19 | P/G | Bewaken |
| `services/building-model-service.ts` | 1185 | 1194 | 33 | 33 | P/G | Delen, met instelling |
| `services/modbus-cop-service.ts` | 286 | 301 | 45 | 40 | P/G | Bewaken |
| `services/adaptive-control-service.ts` | 2457 | 2457 | 48 | 36 | C | Delen |
| `services/capability-health-service.ts` | 679 | 646 | 45 | 43 | C/P | Bewaken |
| `services/performance-report-service.ts` | 923 | 882 | 59 | 59 | P | Bewaken |
| `services/modbus-connection-service.ts` | 366 | 337 | 71 | 66 | P/G | Bewaken |
| `services/snapshot-trigger-service.ts` | 179 | 165 | 94 | 89 | P | Bewaken |
| `services/service-coordinator.ts` | 898 | 912 | 170 | 162 | P/G | Bewaken |
| `services/widget-state-service.ts` | 365 | 273 | 186 | 183 | P | Bewaken |
| `protocol/modbus-tcp-service.ts` | 790 | 845 | 231 | 231 | P/G | Bewaken |
| `services/flow-card-manager-service.ts` | 2281 | 1880 | 665 | 662 | P/G | Bewaken |
| `services/dashboard-service.ts` | 1193 | 930 | 967 | 963 | P/G | Bewaken |
| **Totaal 18 paren** | **14.776** | **13.975** | **2.677** | **2.626** | | **7 delen, 11 bewaken** |

Buiten de paren:

| Bestand | Bevinding |
|---|---|
| `lib/aurora3/services/cop-calculator.ts` (1019) | Kopie van `lib/shared/services/cop-calculator.ts` zonder `refrigerant_circuit`, plus een helper `waterDeltaT()`. Aurora III kan waarschijnlijk de gedeelde versie gebruiken, maar dat moet eerst met fixtures bewezen worden. Niet in dit ADR (C4) |
| `drivers/*/device.ts` | 843 ↔ 821 regels, 380 diff-regels; buiten scope (C4) |
| Al gedeeld | `lib/modbus/adaptive/*` (4), `external-temperature-service`, `wind-correction-service`, `lib/shared/*` |

### 1b. Fixes en verschillen die maar in één variant zitten

Bron: de diffs hierboven en de git-historie van beide bronrepo's na de fork.
Geen van deze punten wordt in dit ADR geharmoniseerd. Wat in een bewaakt
bestand zit, blijft een eigen besluit met een eigen changelog-regel (C6).

| # | Alleen in | Wat | In dit ADR |
|---|---|---|---|
| F1 | A2 (2.15.1) | Na herstel van een poll-timeout worden de verbindings-capabilities altijd opnieuw gezet | Bewaakt bestand (coördinator); harmonisatie is C6 |
| F2 | A2 (v3.0.0) | Dashboard: JSON-500 met stack in de log, terugval op de standaardschaal, build-header | Bewaakt bestand; harmonisatie is C6 |
| F3 | A2 | `getRegisterCache()` geeft een kopie | Bewaakt bestand; harmonisatie is C6 |
| F4 | A2 | Runtime-leden getypeerd; A3 gebruikt drie `as unknown as`-casts | Bewaakt bestand; blijft zoals het is |
| F5 | A3 | `ModbusCOPService` respecteert `cop_calculation_enabled` | Bewaakt bestand; harmonisatie is C6 (zichtbare wijziging voor A2) |
| F6 | A3 | Dode `UserFlowPreferences` verwijderd | De gedeelde `shared-interfaces.ts` houdt het type, want de A2-flowmanager en -health-service gebruiken het nog |
| F7 | A3 | Configureerbare Modbus-timeout | Bewaakt bestand; blijft zoals het is |
| F8 | A3 | Strengere filters op 9 flow cards | Blijft zoals het is |
| F9 | A3 | Warmwaterpoort in `BuildingModelService` | Wordt gedeeld, actief alleen als het device `adlar_dhw_active` heeft (§3c). Neutraal voor A2 |

Kleine gedragsverschillen D1–D4 (change-log-venster, superfast-teller,
`getCurrentSnapshot()`, standaard-temperatuurschaal) zitten alle vier in
bewaakte bestanden en blijven per product.

### 1c. Aurora II-drempeltriggers vuurden nooit — opgelost

Sinds de merge van v3.0.0 (`c71641d`) riep `snapshot-trigger-service.ts` de
drempeltriggers aan met kaart-ID's met het achtervoegsel `_modbus`, terwijl de
sleutels van `CARD_PROFILES` dat achtervoegsel niet hadden. Het profiel viel
terug op state-veld `currentValue`, de run-listeners lazen `state.temperature`
(of `pulse_steps`, `flow_rate`, `frequency`) en kregen `null`. 15 van de 17
kaarten startten daardoor nooit een flow.

**Status: opgelost** in `1629b19`. Alle 17 sleutels hebben het achtervoegsel
`_modbus`. `test/unit/modbus-snapshot-trigger-service.test.js` controleert per
kaart uit `THRESHOLD_TRIGGER_CARDS` dat de trigger-state het veld bevat dat de
run-listener leest. De fix ging mee met 3.3.0, niet als losse 3.2.x-release.
De changelog van 3.3.0 noemt de fix niet (C7).

### 1d. Bestaande gebreken die dit ADR niet oplost

- **Risico 4**: beide flow-managers worden per device aangemaakt en
  registreren op app-brede kaarten. Handlers lezen `this.device`, het device
  dat het laatst registreerde.
- **Afmelden van flow-listeners doet niets**: `unregisterAllFlowCards()` logt
  alleen.
- **Dashboard-callbacks worden nooit losgemaakt** bij `onDeleted()`.
- **Poortinstelling per device, server per driver.**

Alle vier spelen alleen bij twee warmtepompen van hetzelfde model, of na het
verwijderen van een device. Ze horen bij de uitgestelde convergentie.

## 2. Hoe vaak raakt een wijziging beide producten?

Methode: alle commits die `lib/` raken in beide bronrepo's sinds de fork,
gekoppeld op datum, onderwerp en geraakte bestanden. Een schatting, geen
exacte telling.

| Periode | Aurora II | Aurora III | Overgezet naar de andere app |
|---|---:|---:|---|
| 7 mei – 15 juni | 28 | 20 | Ongeveer 17 paren, bijvoorbeeld 2.13.0 ↔ 1.8.0 (adaptieve regeling, gebouwmodel), 2.13.2 ↔ 1.8.1 (TCP en verbinding), 2.8.4 ↔ 1.3.3, 2.5.4 ↔ 1.1.4 (energie) |
| 16 juni – 15 oktober | 6 | 5 | Geen. Aurora II kreeg modusbewuste kaarten en registerdetails, Aurora III de nieuwe registermap (1.9.x) |

Van de 11 commits na half juni waren er 2 gemeenschappelijk van aard:

- **2.15.1** (herstel na poll-timeout, coördinator): niet naar Aurora III
  overgezet (F1). Valt onder de bewaking.
- **1.9.4** (device valt uit de flow-pickers, gebouwmodel): wel naar Aurora II
  overgezet (`68d9981`). Valt onder het delen.

In deze repo raakte sinds de merge 1 commit zowel `lib/modbus/` als
`lib/aurora3/`.

Conclusie: in de opbouwfase ging bijna alles twee keer. Nu de producten hun
eigen weg gaan, is het gemeenschappelijke werk zeldzaam, en wordt het juist
daardoor makkelijk vergeten. Delen loont voor de code die nog gelijk is;
voor de rest volstaat zichtbaar maken.

## 3. Rekenservices delen

### 3a. Compatibiliteit per bestand

| Bestand | Echt verschil | Gedeelde versie |
|---|---|---|
| `building-insights-service.ts` | Geen | Ongewijzigd |
| `adaptive-control-service.ts` | Alleen registernamen in logtekst en commentaar ("setpoint-register 0x0301" ↔ "Aurora III heating setpoint 4-2107") | Logtekst wordt neutraal: "setpoint (`target_temperature`)" |
| `scop-calculator.ts` | A2 kent de methode `refrigerant_circuit` extra | A2-versie; A3 levert die methode nooit aan |
| `constants.ts` | Volgorde, commentaar, COP-weging `refrigerant_circuit` | A2-versie; idem |
| `types/shared-interfaces.ts` | A2 heeft `UserFlowPreferences` | A2-versie (F6) |
| `energy-tracking-service.ts` | Compressor-capability: `adlar_state_compressor_state` ↔ `adlar_compressor_on` | Instelling `compressorCapabilityId` |
| `building-model-service.ts` | Moduspoort: `adlar_mode` met modi `0`/`2`/`4` ↔ `adlar_mode_aurora3` met `0`/`1`; warmwaterpoort alleen A3 | Instelling `modeGate`; warmwaterpoort op capability |

Alle services krijgen een gewoon `Homey.Device` mee. Geen constructor vraagt
een Aurora II- of Aurora III-specifiek type.

### 3b. Voorwaarden

1. **Drie services gaan samen over.** `building-insights-service` importeert
   de types `BuildingModelService` en `AdaptiveControlService`, en
   `adaptive-control-service` maakt zelf de `BuildingModelService` aan.
   Klassen met `private`-leden zijn in TypeScript nominaal getypeerd (ADR-004
   §4, voetnoot 1): een Aurora III-instantie past niet op het Aurora II-type.
   Gebouwmodel, adaptieve regeling en inzichten verhuizen dus in één commit.
2. **De afnemers wijzen naar de gedeelde versie.** Alleen importpaden:
   `lib/aurora3/services/service-coordinator.ts`, `flow-card-manager-service.ts`
   (alleen een type), `modbus-cop-service.ts`, `capability-health-service.ts`,
   `cop-calculator.ts`, `drivers/intelligent-heatpump-aurora3/device.ts` en
   de tests `test/unit/aurora3/{building-model,adaptive-control}-service.test.js`.

### 3c. Ontwerp van de instellingen

Eén object per model, aangemaakt in de coördinator en via de bestaande `opts`
doorgegeven aan `EnergyTrackingService` en `AdaptiveControlService`. Die
laatste geeft het door aan de `BuildingModelService` die hij aanmaakt.

```typescript
// lib/modbus/types/shared-interfaces.ts (gedeeld)
/** Modelspecifieke gegevens voor de gedeelde rekenservices. */
export interface ModbusCalcProfile {
  /** Capability met de ingestelde modus, en de modi waarin het gebouwmodel niet leert. */
  readonly modeGate: {
    readonly capabilityId: string;
    readonly nonHeatingModes: readonly string[];
  };
  /** Capability die aangeeft of de compressor draait. */
  readonly compressorCapabilityId: string;
}
```

| Waarde | Aurora II (`lib/modbus/calc-profile.ts`) | Aurora III (`lib/aurora3/calc-profile.ts`) |
|---|---|---|
| `modeGate.capabilityId` | `adlar_mode` | `adlar_mode_aurora3` |
| `modeGate.nonHeatingModes` | `['0', '2', '4']` (koelen, warm water, warm water + koelen) | `['0', '1']` (uit, koelen) |
| `compressorCapabilityId` | `adlar_state_compressor_state` | `adlar_compressor_on` |

- **Verplicht, zonder standaardwaarde.** Een vergeten profiel is dan een
  compileerfout, geen stille terugval op de Aurora II-waarden.
- **Warmwaterpoort op capability**: de poort loopt alleen als
  `this.device.hasCapability('adlar_dhw_active')`. Aurora II heeft die
  capability niet (niet in `driver.compose.json`, nergens via
  `addCapability()`), dus voor Aurora II verandert niets. Een toekomstig model
  met `adlar_dhw_active` krijgt de poort vanzelf.
- **Het modelspecifieke commentaar** (register 0x0304 is de ingestelde modus,
  niet de actuele werking; register 4-2100 met 0/1/2/4) verhuist van de
  service naar het profielbestand van het model.

### 3d. Plek

De gedeelde bestanden blijven in `lib/modbus/` staan; de Aurora III-kopieën
vervallen en Aurora III importeert uit `lib/modbus/`. Dat is het patroon dat
ADR-004 al gebruikt voor `lib/modbus/adaptive/*`, `external-temperature-service`
en `wind-correction-service`. Elk gedeeld bestand krijgt een kopregel:

```typescript
// Gedeeld door Aurora II en Aurora III (ADR-005). Een wijziging hier raakt beide drivers.
```

Een verhuizing naar `lib/modbus/common/` is netter maar verplaatst ook de
Aurora II-bestanden, zonder gedragswinst (C1).

## 4. Bewaking van de overige 11 paren

### 4a. Wat de check doet

`scripts/check-twins.js` (nieuw, `npm run check:twins`), naast het bestaande
`scripts/check-capability-ownership.js`:

1. **Paren**: de 11 bewaakte paren uit §1, als vaste lijst in het script.
2. **Normaliseren**: per bestand importregels en witruimte aan het regeleinde
   verwijderen. Importpaden verschillen per map en zijn geen inhoud.
3. **Basislijn**: `scripts/twins-baseline.json` bevat per paar de hash van
   beide genormaliseerde bestanden, het aantal diff-regels, een datum en een
   reden.
4. **Vergelijken** per paar:

   | Situatie | Uitkomst |
   |---|---|
   | Beide kanten gelijk aan de basislijn | OK |
   | Eén kant gewijzigd | Melding: welk bestand, de diff ten opzichte van de andere kant, en de vraag of de wijziging ook aan de andere kant hoort |
   | Beide kanten gewijzigd | Melding: ter controle of de wijziging aan beide kanten hetzelfde doet |

5. **Accepteren**: `npm run check:twins -- --accept <paar> --reason "<tekst>"`
   werkt de hashes van dat paar bij en legt de reden vast. De basislijn wordt
   zo een lijst van bekende verschillen, elk met een reden.

### 4b. Wanneer

- In `npm test`, na de build (C2).
- In GitHub Actions: de workflow `homey-app-validate.yml` draait nu alleen
  `homey app validate`, geen `npm test`. De check heeft geen build nodig en
  kan als losse stap mee (C3).

### 4c. Wat het kost

Tussen half juni en half oktober raakten 6 commits in beide bronrepo's samen
een van de 11 bewaakte bestanden. Dat is ongeveer één `--accept` per drie
weken, met één regel uitleg. Een wijziging
die alleen commentaar raakt, geeft ook een melding; dat is bewust, want
commentaar beschrijft hier vaak waarom een fix bestaat.

## 5. Gefaseerd plan

Elke fase is gedragsneutraal. Er wordt één keer uitgebracht, als 3.3.1.

| Fase | Inhoud | Risico | Bewijs |
|---|---|---|---|
| **0** ✅ | Hotfix `CARD_PROFILES` (§1c), afgerond in `1629b19`, uitgebracht met 3.3.0 | — | Test aanwezig; changelog-regel volgt in 3.3.1 (C7) |
| **1** | `check-twins.js` en basislijn op `main` voor de 11 paren; geen productiecode | Geen | De check is groen op `main`; een proefwijziging aan één kant geeft een melding |
| **2** | Vangnet: karakteriseringstests op de huidige code, per model | Geen | Tests groen vóór fase 3 |
| **3a** | `constants`, `shared-interfaces`, `scop-calculator` delen | Laag | Build en tests groen; `git diff --stat app.json` leeg |
| **3b** | `energy-tracking-service` delen, met `compressorCapabilityId` | Laag | Test per model: compressorstatus uit de juiste capability |
| **3c** | `building-model`, `adaptive-control`, `building-insights` samen delen, met `modeGate` en de warmwaterpoort | Laag-middel | De bestaande A3-tests draaien ongewijzigd tegen de gedeelde code met het A3-profiel (V1); test per model voor beide poorten |
| **4** | Release 3.3.1: lint, `homey app validate`, `npm run check:caps`, `verify.py`, hardware-acceptatie op beide units, testkanaal (C5) | — | Handmatige acceptatie |

### Fase 2 — Vangnet

Nieuwe tests, eerst groen op de huidige (nog dubbele) code:

- **Gebouwmodel, moduspoort**: Aurora II blokkeert in modus `0`, `2`, `4` en
  leert in `1`, `3`, `5`, `7`; Aurora III blokkeert in `0`, `1` en leert in
  `2`, `4`.
- **Gebouwmodel, warmwaterpoort**: blokkeert bij Aurora III als
  `adlar_dhw_active` `true` is; bij Aurora II nooit.
- **Energie**: de compressorstatus komt per model uit de juiste capability.
- **SCOP**: dezelfde metingen geven per model dezelfde kwaliteit en uitkomst.

De bestaande tests voor `building-model-service` en `adaptive-control-service`
(per model aanwezig) blijven ongewijzigd.

### Fase 3 — Delen

- Elke subfase is één commit; de Aurora III-kopieën gaan met `git rm`.
- Na 3c draaien `test/unit/aurora3/*-service.test.js` tegen
  `.homeybuild/lib/modbus/services/` met het A3-profiel. Slagen die
  ongewijzigd, dan is dat het bewijs van neutraliteit voor Aurora III.
- De coördinatoren veranderen alleen in importpaden en het meegeven van het
  profiel. Dat raakt een bewaakt paar aan beide kanten: één `--accept` met
  reden "ADR-005 fase 3".

## 6. Gereedschap om neutraliteit aan te tonen

| Middel | Bestaat | Wat het bewijst | Fasen |
|---|---|---|---|
| `npm run build` | ✓ | Types, importpaden, verplicht profiel | 3 |
| `npm test` | ✓ (uit te breiden) | Bestaande en nieuwe tests per model | 2, 3 |
| `npm run lint` | ✓ | Stijl | alle |
| `npm run check:twins` | nieuw | Geen ongeziene wijziging aan één kant van een paar | 1 en verder |
| `npm run check:caps` | ✓ | Capability-eigenaarschap ongewijzigd | 4 |
| `python3 scripts/migration/verify.py` | ✓ | Verdeling per driver, dubbele ID's | 4 |
| `homey app validate` | ✓ | Manifest | 4 |
| `git diff --stat app.json public/` | ✓ | Leeg: geen manifest- of HTML-wijziging | 3 |
| Hardware | ✓ | Werkelijke werking | 4 |

## Open besluiten

Opnieuw genummerd ten opzichte van de eerste versie.

| # | Vraag | Voorstel |
|---|---|---|
| **C1** | Gedeelde bestanden in `lib/modbus/` laten staan of naar `lib/modbus/common/` verhuizen | Laten staan, met kopregel (§3d) |
| **C2** | Check-twins: falen of alleen waarschuwen | Falen (exit 1). Een waarschuwing wordt na een paar weken genegeerd; accepteren kost één commando |
| **C3** | Check-twins ook in GitHub Actions | Ja, als losse stap in `homey-app-validate.yml`; geen build nodig |
| **C4** | Bewaking uitbreiden met `device.ts`, `driver.ts` en `lib/aurora3/services/cop-calculator.ts` ↔ `lib/shared/services/cop-calculator.ts` | Nu niet; eerst de 11 paren. `device.ts` is te productspecifiek en geeft vooral ruis |
| **C5** | 3.3.1 eerst via het testkanaal | Ja, met beide eigen units, vóór live |
| **C6** | Harmonisaties F1, F2, F3, F5 | Elk een eigen besluit buiten dit ADR, met eigen changelog-regel. F1 en F2 eerst: gemeenschappelijke fixes die in Aurora III ontbreken |
| **C7** | Changelog-regel voor de drempeltriggers (fase 0) | Opnemen in 3.3.1 |
| **C8** | Versie | 3.3.1: gedragsneutraal, plus de changelog-regel van C7 |

## Te verifiëren

1. **V1** — Slagen de bestaande Aurora III-tests voor `building-model-service`
   en `adaptive-control-service` ongewijzigd tegen de gedeelde code met het
   A3-profiel?
2. **V2** — Levert `scop-calculator` in de A2-versie voor Aurora III-metingen
   dezelfde kwaliteit en uitkomst als de eigen kopie? Verwachting ja, want
   Aurora III levert de methode `refrigerant_circuit` nooit aan.

## Uitgesteld

**Volledige convergentie** (de eerste versie van dit ADR, `fe76201`):
`ModbusRuntime` met twee adapters, flow-card-registry in `driver.onInit()` met
`args.device`, `DashboardHost` per driver-ID. Uitgesteld om de redenen in
*Herziening*. Opnieuw bekijken als:

- er een derde Modbus-model komt (dan wordt een derde kopie duurder dan
  convergentie);
- de bewaking vaak gemeenschappelijke wijzigingen in transport of coördinator
  laat zien;
- gebruikers met twee warmtepompen van hetzelfde model last krijgen van
  risico 4.

## Verworpen afwegingen

- **Alleen bewaken, niets delen.** De rekenservices zijn al gelijk en
  veranderden in de opbouwfase steeds samen. Daar levert delen ruim 6.700
  regels op, zonder nieuw foutdomein: een fout erin kwam ook nu al in beide
  apps terecht.
- **`if (model === …)`-takken in gedeelde code.** Verspreidt modelkennis over
  de services. Het profiel en de capability-poort houden die op één plek per
  model.
- **Een standaardprofiel met Aurora II-waarden.** Een vergeten profiel valt
  dan stil terug op verkeerde capability-ID's. Verplicht is veiliger.
- **De Tuya-driver meenemen.** Heeft eigen services met eigen verschillen.

## Gevolgen

### Voor gebruikers

- Geen merkbare wijziging. Geen kaart-, capability- of driver-ID wijzigt;
  geen device hoeft opnieuw te worden gepaird.
- De changelog van 3.3.1 meldt dat de Aurora II-drempeltriggers weer werken
  (fase 0, al uitgebracht met 3.3.0).
- Logregels van de adaptieve regeling noemen geen registeradres meer.

### Voor onderhoud

- Een fix in gebouwmodel, adaptieve regeling, inzichten, energie of SCOP
  gebeurt één keer.
- Een wijziging in een van de 11 bewaakte bestanden geeft een melding, met de
  vraag of de andere kant hem ook nodig heeft.
- Risico 4 en de gebreken uit §1d blijven bestaan.
- `docs/architecture/SERVICE_ARCHITECTURE.md`, sectie *Drivers and Service
  Variants*, wordt bijgewerkt in fase 4. De bestandsnaam van dit ADR blijft
  `ADR-005-MODBUS-CONVERGENCE.md`, zodat bestaande verwijzingen blijven werken.
