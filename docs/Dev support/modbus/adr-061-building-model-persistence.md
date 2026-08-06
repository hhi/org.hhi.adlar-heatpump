# ADR-061 - Building model persistence over software reset and Homey app update

**Project:** org.hhi.adlar-heatpump-modbus  
**Status:** voorgesteld  
**Datum:** 2026-06-11  
**Gerelateerd:** ADR-037 store-persistentie, ADR-056 building model hardening, ADR-057 learner safeguards, ADR-060 adaptive harmonisatie  
**Codegebied:** `lib/services/building-model-service.ts`, `lib/services/adaptive-control-service.ts`, `lib/services/service-coordinator.ts`, `drivers/intelligent-heatpump-modbus/device.ts`

## Context

Het gebouwmodel leert thermische parameters van de woning via `BuildingModelLearner`:

- `C`: thermische massa
- `UA`: warmteverlies
- `g`: zonnewinst
- `P_int`: interne warmtelast
- `sampleCount`, `theta`, `P`, `lastMeasurement` en excitation counters als interne RLS-state

Deze state is `engine-state` en hoort persistent te zijn over:

- software reset van de Homey app
- Homey reboot
- app update/install
- coordinator restart door gewijzigde Modbus/poll-settings

De user-facing instellingen voor het gebouwmodel zijn Homey device settings:

- `building_model_enabled`
- `building_model_forgetting_factor`
- `building_profile`
- `enable_dynamic_pint`
- `reset_building_model`

Deze settings horen door Homey zelf persistent beheerd te worden. De geleerde modelstate hoort door de app in device store te worden beheerd onder `building_model_state`.

## Vraagstelling

De vraag is of de building modeler na software reset, Homey reboot, app update/install of coordinator restart zijn configuratie en geleerde state behoudt, en via welke persistentielaag dat gebeurt.

Daarbij moeten twee soorten data strikt uit elkaar worden gehouden:

- **Configuratie/settings**: Homey device settings uit `driver.settings.compose.json`, gelezen via `device.getSetting()`.
- **Geleerde modelstate**: RLS-engine-state van `BuildingModelLearner`, opgeslagen in device store onder `building_model_state`.

## Analyse

Bij code-inspectie zijn twee concrete risico's zichtbaar voor de geleerde samples/state:

1. `BuildingModelService.collectAndLearn()` persist `building_model_state` alleen elke 10 geaccepteerde samples.
   - Bij een restart/update vóór sample 10 is er nog geen state opgeslagen.
   - Na sample 10 kan nog steeds maximaal 9 samples, dus maximaal 45 minuten bij 5-minuten interval, verloren gaan.

2. `ServiceCoordinator.destroy()` roept `this.adaptiveControl.destroy()` aan zonder `await`.
   - `AdaptiveControlService.destroy()` is async en wacht intern op `this.buildingModel.destroy()`.
   - `BuildingModelService.destroy()` doet de finale persist van `building_model_state`.
   - Zonder `await` kan app teardown doorgaan terwijl de finale persist nog niet afgerond is.

Voor de settings zelf is in de huidige code geen app-eigen persistencepad nodig of aanwezig: Homey device settings zijn de authoritative source. De app leest deze waarden op bij service-constructie, reset en settings-wijzigingen. Zolang de setting-id's gelijk blijven en het device niet opnieuw gepaired wordt, horen deze settings door Homey bewaard te blijven over reboot en app update.

## Besluit

We behandelen building model persistence als een expliciet lifecycle-contract:

1. **Elke geaccepteerde learning sample wordt direct persistent gemaakt.**
   - `learner.addMeasurement()` succesvol afgerond betekent: `building_model_state` moet naar device store.
   - UI-capabilities en diagnostics blijven rate-limited, bijvoorbeeld elke 10 samples.
   - Rationale: een 5-minuten sample is klein; betrouwbaarheid is belangrijker dan micro-optimalisatie van store writes.

2. **Shutdown moet alle async persistence afwachten.**
   - `ServiceCoordinator.destroy()` moet `await this.adaptiveControl.destroy()`.
   - `AdaptiveControlService.destroy()` blijft verantwoordelijk voor het awaiten van `BuildingModelService.destroy()`.
   - Destroy-volgorde moet geen subservice vernietigen voordat diens persist klaar is.

3. **Restore logging moet aantonen wat er is hersteld.**
   - Bij `BuildingModelService.initialize()` loggen:
     - store-key aanwezig/afwezig
     - sample count
     - confidence
     - modelparameters op hoofdlijnen
     - restore reject met validatiefout indien van toepassing
   - Dit maakt het verschil zichtbaar tussen:
     - geen state opgeslagen
     - state aanwezig maar corrupt/rejected
     - state correct hersteld

4. **Settings blijven Homey-managed.**
   - `building_model_*` settings blijven Homey settings, niet dupliceren in store.
   - Deze ADR wijzigt geen settingsopslag en introduceert geen settings-restore vanuit store.
   - `reset_building_model` blijft een expliciete destructive action en mag niet impliciet door restart/update worden getriggerd.

## Openstaande punten

### 1. Persist-frequentie

**Huidig gedrag:** persist alleen bij `sampleCount % 10 === 0` en bij destroy.  
**Risico:** alle samples sinds laatste checkpoint kwijt bij harde restart/update.

**Behandeling:**

- Na elke succesvolle `addMeasurement()` direct `await persistState()`.
- `updateModelCapabilities()` en `updateDiagnosticsCapability()` blijven op 10-sample cadence.
- Bij persist-fout: loggen, maar learning niet blokkeren.

**Acceptatiecriterium:**

- Na 1 geaccepteerde sample staat `building_model_state.sampleCount >= 1` in store.
- Na 9 samples en een gesimuleerde restart wordt sampleCount 9 hersteld, niet 0.

### 2. Async destroy-chain

**Huidig gedrag:** `ServiceCoordinator.destroy()` roept `this.adaptiveControl.destroy()` zonder `await`.  
**Risico:** finale building-model persist wordt niet gegarandeerd afgerond.

**Behandeling:**

- Wijzig naar `await this.adaptiveControl.destroy()`.
- Houd bestaande expliciete optimizer-state save intact.
- Zorg dat errors in destroy worden gelogd zonder verdere cleanup volledig te blokkeren.

**Acceptatiecriterium:**

- Een test met mock-device-store toont dat `building_model_state` geschreven is voordat `ServiceCoordinator.destroy()` resolved.

### 3. Restore-validatie

**Huidig gedrag:** `BuildingModelLearner.restoreState()` reject corrupte theta/P-state defensief.  
**Risico:** correcte reject lijkt voor gebruiker op "alles kwijt" als de reden niet zichtbaar is.

**Behandeling:**

- Restorepad logt expliciet of state:
  - afwezig is
  - geldig hersteld is
  - rejected is, inclusief validatiefout
- Diagnostics krijgen zo nodig een `lastRestoreStatus` of vergelijkbaar veld, als gewone logging onvoldoende blijkt.

**Acceptatiecriterium:**

- Bij corrupte persisted state is in logs/diagnostics zichtbaar waarom het model op defaults start.

### 4. Homey settings versus learned state

**Huidig gedrag:** settings staan in `driver.settings.compose.json`; learned state staat in store.  
**Risico:** verwarring tussen twee persistentielagen kan het probleem verkeerd laten behandelen.

**Behandeling:**

- Bij startup restore diagnostics mogen de actuele Homey settingswaarden mee gelogd worden voor context:
  - `building_model_enabled`
  - `building_model_forgetting_factor`
  - `building_profile`
  - `enable_dynamic_pint`
- Niet automatisch settings naar store kopiëren.
- Geen settings-migratie of settings-herstel toevoegen zolang setting-id's stabiel blijven en er geen reproduceerbaar Homey settingsverlies is vastgesteld.

**Acceptatiecriterium:**

- Na update leest de app de Homey settings via dezelfde setting-id's.
- `building_model_state` wordt afzonderlijk hersteld uit device store.
- Startup diagnostics maken zichtbaar welke settingswaarden zijn gelezen en welke learned state is hersteld.

### 5. Reset-toggle veiligheid

**Huidig gedrag:** `reset_building_model=true` triggert `BuildingModelService.reset()` en zet daarna de toggle terug naar false via deferred `setSettings()`.  
**Risico:** als de deferred reset van de toggle niet lukt, kan een latere settings-cyclus opnieuw resetten.

**Behandeling:**

- Log altijd of de toggle succesvol teruggezet is.
- Overweeg een store-based one-shot guard met timestamp/request-id als herhaalde resets in praktijk voorkomen.
- Geen wijziging tenzij reproduceerbaar, omdat extra guards complexiteit toevoegen.

**Acceptatiecriterium:**

- Een mislukte toggle-reset is zichtbaar in logs.
- Er is geen impliciete reset bij normale app update zonder expliciete user action.

## Voorgestelde implementatievolgorde

1. Maak `BuildingModelService` crash-safe voor samples:
   - persist na elke geaccepteerde sample
   - behoud 10-sample cadence voor capabilities/diagnostics

2. Maak shutdown await-safe:
   - `await this.adaptiveControl.destroy()` in `ServiceCoordinator.destroy()`

3. Verbeter restore-observability:
   - log sample count/confidence bij restore
   - log afwezig/rejected/geldig expliciet

4. Voeg tests toe:
   - unit/mock-test voor persist na sample
   - unit/mock-test voor awaited destroy-chain
   - simulatie of service-test voor restart na minder dan 10 samples

5. Pas `docs/Dev support/store-persistentie-matrix.md` aan:
   - markeer `building_model_state` pas weer correct wanneer de fix en tests aanwezig zijn
   - noteer persist-frequentie als "per accepted sample + final destroy"

## Teststrategie

Minimale testdekking voor deze ADR:

1. **Service persistence test**
   - Mock `Homey.Device` met `getStoreValue` en `setStoreValue`.
   - Injecteer geldige indoor/outdoor/power/COP data.
   - Forceer een `collectAndLearn()`-cyclus of exposeer een testbare helper.
   - Assert: `setStoreValue('building_model_state', ...)` is aangeroepen na sample 1.

2. **Restart restore test**
   - Maak learner/service, voeg 1-9 samples toe, persist store.
   - Maak nieuwe service met dezelfde mock-store.
   - Assert: restored `sampleCount` is gelijk aan opgeslagen count.

3. **Destroy-chain test**
   - Mock `AdaptiveControlService.destroy()` als async promise.
   - Assert: `ServiceCoordinator.destroy()` resolved pas na die promise.

4. **Manual update checklist**
   - Voor release: app installeren over bestaande versie met actief building model.
   - Voor update: noteer `building_model_state.sampleCount` uit restore diagnostics.
   - Na update: sample count en settings blijven behouden.

## Consequenties

Positief:

- Geen verlies van vroege learning na update/restart.
- Hooguit 0 samples verlies na nette shutdown; bij harde stroomuitval maximaal de sample die op dat moment nog niet geschreven was.
- Betere diagnose wanneer state ontbreekt of rejected wordt.

Negatief:

- Meer store writes: maximaal een write per 5 minuten per device bij actief leren.
- Iets meer logging bij startup/restore.

Acceptabel, omdat learning-state schaars en waardevol is en de write-frequentie laag blijft.

## Niet doen

- Learned state niet naar Homey settings kopiëren.
- Settings niet dupliceren in store zonder bewijs dat Homey settings zelf niet persistent zijn.
- `reset_building_model` niet automatisch activeren bij corrupt state; corrupt state moet zichtbaar worden en alleen expliciet resetten.
- Geen directe edit aan gegenereerde `app.json`; settings blijven via compose.
