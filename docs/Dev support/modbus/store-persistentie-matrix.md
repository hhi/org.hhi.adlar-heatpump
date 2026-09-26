# Store Persistentiematrix

Overzicht van alle store-keys in de Modbus-driver. Per key is vastgelegd wie de eigenaar is, wat de semantiek is, wat de authoritative source is en of capability-herstel verplicht is bij `onInit()`.

Gebaseerd op ADR-037. Bijgewerkt na implementatie van fase 1, 3 en 4 (release 1.3.1).

---

## Categorieën

| Semantiek | Betekenis |
|---|---|
| `engine-state` | Geleerd model, optimizer-state, historische buffer — hersteld in service `initialize()` |
| `user-visible` | Waarde die gebruiker in UI verwacht terug te zien na herstart |
| `ttl-metadata` | Timestamp voor vervaldatum — geen capability-herstel, wel gebruikt voor sanity check |
| `configuratie` | Hoort in Homey settings, niet in store |

| Authoritative source | Betekenis |
|---|---|
| `store` | Store is de enige bron van waarheid |
| `modbus` | Live Modbus-register overschrijft de waarde elke poll |
| `flow-card` | Waarde komt uitsluitend van gebruikersflows |
| `settings` | Homey device settings |

---

## Energie & vermogen

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `cumulative_energy_kwh` | `EnergyTrackingService` | `engine-state` | `store` | `meter_power` — hersteld bij `initialize()` | ✅ Correct |
| `daily_consumption_kwh` | `EnergyTrackingService` | `engine-state` | `store` | Nee — geen dedicated capability | ✅ Correct |
| `external_cumulative_energy_kwh` | `EnergyTrackingService` | `engine-state` | `store` | `adlar_external_energy_total` — hersteld bij `initialize()` | ✅ Correct |
| `external_daily_consumption_kwh` | `EnergyTrackingService` | `engine-state` | `store` | `adlar_external_energy_daily` — reset bij dagelijkse reset | ✅ Correct |
| `last_energy_update` | `EnergyTrackingService` | `ttl-metadata` | `store` | Nee | ✅ Correct |
| `last_external_energy_update` | `EnergyTrackingService` | `ttl-metadata` | `store` | Nee | ✅ Correct |
| `triggered_energy_milestones` | `EnergyTrackingService` | `engine-state` | `store` | Nee — interne deduplicatie | ✅ Correct |

---

## Kosten

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `daily_cost_cache` | `EnergyTrackingService` | `engine-state` | `store` | `adlar_energy_cost_daily` — via `AdaptiveControlService.initialize()` | ✅ Correct |
| `hourly_cost_cache` | `EnergyTrackingService` | `engine-state` | `store` | `adlar_energy_cost_hourly` — via `AdaptiveControlService.initialize()` | ✅ Correct |
| `external_energy_prices` | `AdaptiveControlService` | `engine-state` | `flow-card` | Nee — prijsdata in optimizer geladen, capabilities via `updateEnergyPriceCapabilities()` | ✅ Correct |
| `external_energy_prices_timestamp` | `AdaptiveControlService` | `ttl-metadata` | `store` | Nee | ✅ Correct |

---

## Adaptieve regeling

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `adaptive_control_enabled` | `AdaptiveControlService` | `engine-state` | `store` | Nee — intern veld `isEnabled` | ✅ Correct |
| `adaptive_last_target` | `AdaptiveControlService` | `user-visible` | `store` | `adlar_simulated_target` — hersteld vroeg in `initialize()` | ✅ Correct |
| `adaptive_last_adjustment_time` | `AdaptiveControlService` | `engine-state` | `store` | Nee — intern throttling | ✅ Correct |
| `adaptive_accumulated_adjustment` | `AdaptiveControlService` | `engine-state` | `store` | Nee — intern PI state | ✅ Correct |
| `adaptive_last_action` | `AdaptiveControlService` | `ttl-metadata` | `store` | Nee | ✅ Correct |
| `adaptive_pi_history` | `AdaptiveControlService` | `engine-state` | `store` | Nee — intern PI-buffer | ✅ Correct |

---

## Optimizers & learners

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `energy_optimizer_state` | `AdaptiveControlService` / `EnergyPriceOptimizer` | `engine-state` | `store` | Indirect via cost capabilities | ✅ Correct |
| `cop_optimizer_state` | `AdaptiveControlService` / `COPOptimizer` | `engine-state` | `store` | Nee | ✅ Correct |
| `defrost_learning_state` | `AdaptiveControlService` / `DefrostLearner` | `engine-state` | `store` | Nee | ✅ Correct |
| `building_model_state` | `AdaptiveControlService` / `BuildingModelLearner` | `engine-state` | `store` | Capabilities via `updateModelCapabilities()` | ✅ Correct |
| `building_insights_state` | `BuildingInsightsService` | `engine-state` | `store` | Nee — inzichten herberekend bij `initialize()` | ✅ Correct |

---

## COP & SCOP

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `rolling_cop_data` | `RollingCOPCalculator` | `engine-state` | `store` | Capabilities hersteld bij `initialize()` via `device.ts` | ✅ Correct |
| `scop_data` | `SCOPCalculator` | `engine-state` | `store` | Capabilities hersteld bij `initialize()` via `device.ts` | ✅ Correct |

---

## Wind

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `wind_learned_alpha` | `WindCorrectionService` | `engine-state` | `store` | Nee — intern correctiemodel | ✅ Correct |
| `wind_learning_count` | `WindCorrectionService` | `engine-state` | `store` | Nee | ✅ Correct |
| `external_wind_speed` | `FlowCardManagerService` | `user-visible` | `flow-card` | `adlar_external_wind_speed` — hersteld bij `ServiceCoordinator.initialize()` | ✅ Correct (1.3.1) |
| `external_wind_speed_timestamp` | `FlowCardManagerService` | `ttl-metadata` | `store` | Nee | ✅ Correct |

---

## Externe inputs

| Store-key | Eigenaar | Semantiek | Auth. source | Capability-herstel | Status |
|---|---|---|---|---|---|
| `external_indoor_temp` | `ExternalTemperatureService` | `user-visible` | `flow-card` | `measure_temperature.indoor` + `adlar_external_indoor_temperature` — hersteld bij `initialize()`, TTL 4u | ✅ Correct (1.3.1) |
| `external_indoor_temp_timestamp` | `ExternalTemperatureService` | `ttl-metadata` | `store` | Nee | ✅ Correct (1.3.1) |
| `external_outdoor_temp` | `FlowCardManagerService` | `user-visible` | `flow-card` | `adlar_external_ambient` — hersteld bij `ServiceCoordinator.initialize()`, TTL 4u | ✅ Correct (1.3.1) |
| `external_outdoor_temp_timestamp` | `FlowCardManagerService` | `ttl-metadata` | `store` | Nee | ✅ Correct |
| `external_solar_power` | `FlowCardManagerService` | `user-visible` | `flow-card` | `adlar_external_solar_power` — hersteld bij `ServiceCoordinator.initialize()` | ✅ Correct (1.3.1) |
| `external_solar_power_timestamp` | `FlowCardManagerService` | `ttl-metadata` | `store` | Nee | ✅ Correct |
| `external_solar_radiation` | `FlowCardManagerService` | `user-visible` | `flow-card` | `adlar_external_solar_radiation` — hersteld bij `ServiceCoordinator.initialize()` | ✅ Correct (1.3.1) |
| `external_solar_radiation_timestamp` | `FlowCardManagerService` | `ttl-metadata` | `store` | Nee | ✅ Correct |

---

## Beslisregels voor nieuwe features

1. **Configuratie** → Homey settings. Nooit in store.
2. **Geleerde/engine state** → store. Herstel in `initialize()` als intern veld. Geen capability-schrijf tenzij de waarde user-visible is.
3. **User-visible flow-card input** → store + capability bij ontvangst. Herstel capability bij `initialize()` met sanity check (range + TTL indien van toepassing).
4. **Live Modbus-meting** → nooit in store. Capability wordt elke poll overschreven vanuit `device.ts` of de verantwoordelijke service.
5. **TTL-metadata** → store alleen. Nooit capability-herstel. Gebruik voor sanity check bij restore van de bijbehorende waarde.
6. **Elke store-key heeft precies één eigenaar.** Twee services die naar dezelfde key schrijven is een fout.
