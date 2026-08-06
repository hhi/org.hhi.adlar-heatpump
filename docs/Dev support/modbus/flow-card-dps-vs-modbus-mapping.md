# Flow Card DPS vs Modbus Mapping

> Current note: the local Modbus `lib/flow-helpers.ts` legacy file has been
> removed. Supported Modbus flow cards are registered through
> `FlowCardManagerService` and service/device trigger hooks. Older conclusions
> about a missing `flow-helpers.ts` bootstrap are historical only.

This document compares the runtime implementation status of flow cards in:

- `org.hhi.adlar-heatpump` (DPS / Tuya)
- `org.hhi.adlar-heatpump-modbus` (Modbus)

The `.homeycompose/flow` catalogs are similar, but the runtime wiring is driver-specific.
Do not copy DPS helper assumptions into the Modbus driver: Modbus uses explicit handlers.

## Legend

- `helper`: registered in the DPS app bootstrap via its `flow-helpers.ts`
- `custom`: registered directly in `app.ts`
- `manager`: registered by `FlowCardManagerService`
- `direct`: directly fired by a service or device implementation
- `compose only`: flow card JSON exists, but no runtime registration path was found
- `skipped`: registration code exists, but required service is not injected in the current Modbus app
- `alias gap`: runtime registration exists, but it points to a DPS compatibility capability that the Modbus driver does not populate or listen to
- `not wired`: code tries to use a trigger path, but the current Modbus implementation does not provide the required device hook
- `ok`: current Modbus runtime is functionally present
- `missing helper bootstrap`: historical pre-cleanup status where the DPS app registered helper cards from `app.ts`, while the Modbus app did not use that helper path
- `missing app custom listener`: a DPS custom `app.ts` registration path is absent in Modbus
- `missing app trigger listener`: the DPS app registers a `getDeviceTriggerCard(...).registerRunListener(...)` path that Modbus does not
- `missing device trigger source`: no Modbus-side code currently detects and fires the trigger
- `missing device trigger hook`: a service expects `device.triggerFlowCard(...)` or `RollingCOPCalculator.config.device`, but Modbus does not provide it
- `missing capability listener`: the target capability exists or could exist, but Modbus has no write listener for it
- `service not injected`: runtime registration depends on a service that Modbus does not currently pass into `FlowCardManagerService`
- `alias mismatch`: the shared flow logic targets DPS capability ids while Modbus uses different ids
- `no runtime registration`: the compose JSON exists, but neither repo currently registers a runtime handler
- `no Modbus equivalent`: no clear Modbus-side capability or command exists yet

## Main Differences

- The DPS app initializes its legacy helper path from `app.ts`.
- The Modbus app does not use the DPS helper bootstrap path; supported Modbus flow cards are handled by `FlowCardManagerService` and service/device trigger hooks.
- The Modbus `FlowCardManagerService` registers Modbus-specific simple actions, simple conditions, threshold trigger run listeners, external-data cards, performance report cards, and pricing/adaptive cards.
- The Modbus `ServiceCoordinator` does not inject `BuildingInsightsService` into `FlowCardManagerService`, so the related action and condition cards are skipped.
- The Modbus driver uses several different capability ids than the DPS app. Current Modbus handlers should use Modbus capability ids directly instead of DPS aliases.
- The Modbus device does not expose the DPS-style `triggerFlowCard()` helper, and `RollingCOPCalculator` is created without a device trigger hook. That leaves several trigger cards effectively unwired.

## Device Scope Note

Registration from `app.ts` is app-wide, but that does not automatically make a flow card cross-device or unscoped.

- For actions and conditions, the listener is registered once, but execution is still per selected device because Homey passes `args.device`.
- For device triggers, the runtime stays device-scoped when code uses `getDeviceTriggerCard(...)` and later calls `.trigger(device, tokens, state)` with the originating device.
- The important rule is: shared registration may live in `app.ts`, but mutable state and actual measurements should remain on the device or device-owned services.

## Actions

| Flow card | DPS runtime | Modbus runtime | Modbus basis | Gap cause | Notes |
|---|---|---|---|---|---|
| `calculate_curve_value` | `custom` | `compose only` | none | `missing app custom listener` | Registered in DPS `app.ts`; no Modbus equivalent found |
| `calculate_linear_heating_curve` | `custom` | `compose only` | none | `missing app custom listener` | Registered in DPS `app.ts`; no Modbus equivalent found |
| `calculate_preheat_time` | `manager` | `skipped` | gated behind `BuildingInsightsService` | `service not injected` | `FlowCardManagerService` only registers this when the service is injected |
| `calculate_time_based_value` | `custom` | `compose only` | none | `missing app custom listener` | Registered in DPS `app.ts`; no Modbus equivalent found |
| `force_insight_analysis` | `manager` | `skipped` | gated behind `BuildingInsightsService` | `service not injected` | Registration path exists but is not reached in current Modbus app |
| `generate_performance_report` | `manager` | `manager` | `PerformanceReportService` | `ok` | Present in both repos |
| `get_seasonal_mode` | `custom` | `compose only` | none | `missing app custom listener` | Registered in DPS `app.ts`; no Modbus equivalent found |
| `receive_external_ambient_data` | `manager` | `manager` | `FlowCardManagerService` | `ok` | Present in both repos |
| `receive_external_energy_prices` | `manager` | `manager` | `FlowCardManagerService` + `AdaptiveControlService` | `ok` | Present in both repos |
| `receive_external_flow_data` | `manager` | `manager` | `FlowCardManagerService` | `ok` | Present in both repos |
| `receive_external_indoor_temperature` | `manager` | `manager` | `FlowCardManagerService` + `AdaptiveControlService` | `ok` | Present in both repos |
| `receive_external_power_data` | `manager` | `manager` | `FlowCardManagerService` + `EnergyTrackingService` | `ok` | Present in both repos |
| `receive_external_solar_power` | `manager` | `manager` | `FlowCardManagerService` | `ok` | Present in both repos |
| `receive_external_solar_radiation` | `manager` | `manager` | `FlowCardManagerService` | `ok` | Present in both repos |
| `receive_external_wind_data` | `manager` | `manager` | `FlowCardManagerService` | `ok` | Present in both repos |
| `set_capacity` | `helper` | `compose only` | register `0x0315` exists | `missing helper bootstrap; missing capability listener` | Modbus app does not call `registerSimpleActions()`; no capability listener for curve setting |
| `set_desired_indoor_temperature` | `helper` | `compose only` | `target_temperature.indoor` capability only | `missing helper bootstrap; missing capability listener` | No Modbus capability listener for indoor target |
| `set_device_onoff` | `helper` | `compose only` | `onoff -> 0x0305` | `missing helper bootstrap` | Underlying write path exists, but the flow action is not registered in Modbus |
| `set_heating_curve` | `helper` | `compose only` | register `0x0314` exists | `missing helper bootstrap; missing capability listener` | No flow helper init and no Modbus capability listener for the curve |
| `set_heating_mode` | `helper` | `compose only` | listener exists on `adlar_mode` | `missing helper bootstrap; alias mismatch` | DPS helper targets `adlar_enum_mode`; Modbus listens to `adlar_mode` |
| `set_hotwater_temperature` | `helper` | `compose only` | listener exists on `target_temperature.dhw` | `missing helper bootstrap; alias mismatch` | DPS helper targets `adlar_hotwater`; Modbus writes via `target_temperature.dhw -> 0x0302` |
| `set_target_temperature` | `helper` | `compose only` | `target_temperature -> 0x0301` | `missing helper bootstrap` | Underlying write path exists, but Modbus never registers the simple action |
| `set_volume` | `helper` | `compose only` | no clear Modbus equivalent | `missing helper bootstrap; no Modbus equivalent` | DPS-only control at the flow layer today |
| `set_water_mode` | `helper` | `compose only` | no direct Modbus equivalent | `missing helper bootstrap; no Modbus equivalent` | DPS-only control at the flow layer today |
| `set_work_mode` | `helper` | `compose only` | register `0x0307` exists | `missing helper bootstrap; missing capability listener` | No simple action init and no Modbus capability listener for work mode |

## Conditions

| Flow card | DPS runtime | Modbus runtime | Modbus basis | Gap cause | Notes |
|---|---|---|---|---|---|
| `capacity_setting_is` | `manager` | `alias gap` | reads `adlar_enum_capacity_set` | `alias mismatch` | Modbus driver does not populate the DPS compatibility capability |
| `compressor_running` | `helper` | `compose only` | live state is `adlar_compressor_on` | `missing helper bootstrap; alias mismatch` | DPS helper condition is never registered in Modbus |
| `confidence_above` | `manager` | `skipped` | gated behind `BuildingInsightsService` | `service not injected` | Registration path exists but current Modbus app skips it |
| `cop_calculation_method_is` | `compose only` | `compose only` | none | `no runtime registration` | No runtime registration found in either repo |
| `cop_efficiency_check` | `manager` | `manager` | `adlar_cop` + `adlar_compressor_freq` | `ok` | Present in both repos |
| `cop_trend_analysis` | `manager` | `manager` | `adlar_cop_trend` | `ok` | Present in both repos |
| `daily_cop_above_threshold` | `manager` | `manager` | `adlar_cop_daily` | `ok` | Present in both repos |
| `device_power_is` | `manager` | `manager` | `onoff` | `ok` | Present in both repos |
| `electrical_balance_check` | `custom` | `compose only` | none | `missing app custom listener` | DPS custom condition in `app.ts`; no Modbus equivalent found |
| `fault_active` | `helper` | `compose only` | live Modbus state is `adlar_fault_active` | `missing helper bootstrap; alias mismatch` | DPS helper condition is never registered in Modbus |
| `heating_curve_is` | `manager` | `alias gap` | reads `adlar_enum_countdown_set` | `alias mismatch` | Modbus driver does not populate the DPS compatibility capability |
| `heating_mode_is` | `manager` | `alias gap` | reads `adlar_enum_mode` | `alias mismatch` | Modbus driver populates `adlar_mode` instead |
| `hotwater_temperature_is` | `manager` | `alias gap` | reads `adlar_hotwater` | `alias mismatch` | Modbus driver populates `target_temperature.dhw` instead |
| `insight_is_active` | `manager` | `skipped` | gated behind `BuildingInsightsService` | `service not injected` | Registration path exists but current Modbus app skips it |
| `monthly_cop_above_threshold` | `manager` | `manager` | `adlar_cop_monthly` | `ok` | Present in both repos |
| `power_above_threshold` | `helper` | `compose only` | live Modbus capability is `measure_power` | `missing helper bootstrap` | Underlying value exists, but the simple condition is not registered in Modbus |
| `price_in_cheapest_hours` | `manager` | `manager` | `AdaptiveControlService` pricing data | `ok` | Present in both repos |
| `price_trend_is` | `manager` | `manager` | `AdaptiveControlService` pricing data | `ok` | Present in both repos |
| `price_vs_daily_average` | `manager` | `manager` | `AdaptiveControlService` pricing data | `ok` | Present in both repos |
| `savings_above` | `manager` | `skipped` | gated behind `BuildingInsightsService` | `service not injected` | Registration path exists but current Modbus app skips it |
| `system_pulse_steps_differential` | `custom` | `compose only` | none | `missing app custom listener` | DPS custom condition in `app.ts`; no Modbus equivalent found |
| `target_temperature_is` | `manager` | `manager` | `target_temperature` | `ok` | Present in both repos |
| `temperature_above` | `helper` | `compose only` | live Modbus capability is `measure_temperature.ambient` | `missing helper bootstrap; alias mismatch` | DPS helper reads `measure_temperature.around_temp` and is never registered in Modbus |
| `temperature_differential` | `custom` | `compose only` | none | `missing app custom listener` | DPS custom condition in `app.ts`; no Modbus equivalent found |
| `total_consumption_above` | `helper` | `compose only` | live Modbus capability is `meter_power` | `missing helper bootstrap; alias mismatch` | DPS helper reads `meter_power.electric_total` and is never registered in Modbus |
| `volume_setting_is` | `manager` | `alias gap` | reads `adlar_enum_volume_set` | `alias mismatch` | Modbus driver does not populate the DPS compatibility capability |
| `water_flow_rate_check` | `custom` | `compose only` | none | `missing app custom listener` | DPS custom condition in `app.ts`; no Modbus equivalent found |
| `water_mode_is` | `manager` | `alias gap` | reads `adlar_enum_water_mode` | `alias mismatch` | Modbus driver does not populate the DPS compatibility capability |
| `work_mode_is` | `manager` | `alias gap` | reads `adlar_enum_work_mode` | `alias mismatch` | Modbus driver does not populate the DPS compatibility capability |

## Triggers

| Flow card | DPS runtime | Modbus runtime | Modbus basis | Gap cause | Notes |
|---|---|---|---|---|---|
| `adaptive_simulation_update` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `adaptive_status_change` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `ambient_temperature_changed` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers run listener and device trigger logic; no Modbus equivalent found |
| `building_insight_detected` | `direct` | `skipped` | `BuildingInsightsService` absent | `service not injected` | No current Modbus trigger path |
| `building_profile_mismatch` | `direct` | `skipped` | `BuildingInsightsService` absent | `service not injected` | No current Modbus trigger path |
| `cheapest_block_started` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `coiler_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `compressor_efficiency_alert` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS device implements frequency-change trigger logic; Modbus does not |
| `cop_efficiency_changed` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS device implements COP-change trigger logic; Modbus does not |
| `cop_outlier_detected` | `direct` | `compose only` | none | `missing device trigger source` | DPS device triggers on COP outliers; Modbus does not |
| `cop_trend_detected` | `direct` | `not wired` | `RollingCOPCalculator` has no device trigger hook | `missing device trigger hook` | Current Modbus calculator is created without `config.device` |
| `daily_consumption_threshold` | `direct` | `not wired` | `EnergyTrackingService` expects `device.triggerFlowCard()` | `missing device trigger hook` | Modbus device does not expose that helper |
| `daily_cop_efficiency_changed` | `direct` | `not wired` | `RollingCOPCalculator` has no device trigger hook | `missing device trigger hook` | Current Modbus calculator is created without `config.device` |
| `daily_cost_threshold` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `discharge_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `economizer_inlet_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `economizer_outlet_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `eev_pulse_steps_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the pulse alert run listener; Modbus does not |
| `evi_pulse_steps_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the pulse alert run listener; Modbus does not |
| `expensive_block_approaching` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `fan_motor_efficiency_alert` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS device implements fan-change trigger logic; Modbus does not |
| `fault_detected` | `direct` | `compose only` | none | `missing device trigger source` | DPS device triggers on new fault codes; Modbus does not |
| `forecast_heating_advice` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `heating_mode_changed` | `direct` | `compose only` | none | `missing device trigger source` | DPS device triggers on DPS mode changes; Modbus does not |
| `high_pressure_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `incoiler_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `inlet_temperature_changed` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers run listener and device trigger logic; Modbus does not |
| `learning_milestone_reached` | `direct` | `direct` | `BuildingModelService` | `ok` | Present in both repos |
| `low_pressure_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `monthly_cop_efficiency_changed` | `direct` | `not wired` | `RollingCOPCalculator` has no device trigger hook | `missing device trigger hook` | Current Modbus calculator is created without `config.device` |
| `outlet_temperature_changed` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers run listener and device trigger logic; Modbus does not |
| `performance_report_ready` | `direct` | `direct` | `FlowCardManagerService` daily scheduler | `ok` | Present in both repos |
| `power_threshold_exceeded` | `direct` | `direct` | `EnergyTrackingService` | `ok` | Present in both repos |
| `pre_heat_recommendation` | `direct` | `skipped` | `BuildingInsightsService` absent | `service not injected` | No current Modbus trigger path |
| `price_threshold_crossed` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `price_trend_changed` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `suction_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `tank_temperature_alert` | `helper` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS app registers the temperature alert run listener; Modbus does not |
| `temperature_adjustment_recommended` | `direct` | `direct` | `AdaptiveControlService` | `ok` | Present in both repos |
| `total_consumption_milestone` | `direct` | `direct` | `EnergyTrackingService` | `ok` | Present in both repos |
| `water_flow_alert` | `custom` + `direct` | `compose only` | none | `missing app trigger listener; missing device trigger source` | DPS device implements flow-change trigger logic; Modbus does not |
| `water_mode_changed` | `direct` | `compose only` | none | `missing device trigger source` | DPS device triggers on DPS water mode changes; Modbus does not |
| `work_mode_changed` | `direct` | `compose only` | none | `missing device trigger source` | DPS device triggers on DPS work mode changes; Modbus does not |

## Short Summary

- Shared Modbus runtime coverage is strongest for:
  - external-data actions
  - pricing and adaptive conditions/triggers
  - performance report cards
  - a subset of direct service triggers
- The biggest Modbus gaps are:
  - all DPS helper-based simple actions and simple conditions: `missing helper bootstrap`
  - DPS custom app-level calculator and condition cards: `missing app custom listener`
  - DPS trigger cards for temperatures, pulse steps, fault, mode changes, and efficiency alerts: `missing app trigger listener` and/or `missing device trigger source`
  - Building Insights cards: `service not injected`
  - COP trend / daily COP / monthly COP / daily consumption triggers: `missing device trigger hook`

## Source Files

- DPS app bootstrap: `org.hhi.adlar-heatpump/app.ts`
- DPS helper mappings: `org.hhi.adlar-heatpump/lib/flow-helpers.ts`
- DPS device trigger logic: `org.hhi.adlar-heatpump/drivers/intelligent-heat-pump/device.ts`
- DPS flow manager: `org.hhi.adlar-heatpump/lib/services/flow-card-manager-service.ts`
- Modbus app bootstrap: `org.hhi.adlar-heatpump-modbus/app.ts`
- Modbus device listeners and snapshot mapping: `org.hhi.adlar-heatpump-modbus/drivers/intelligent-heatpump-modbus/device.ts`
- Modbus flow manager: `org.hhi.adlar-heatpump-modbus/lib/services/flow-card-manager-service.ts`
- Modbus service injection: `org.hhi.adlar-heatpump-modbus/lib/services/service-coordinator.ts`
- Modbus adaptive triggers: `org.hhi.adlar-heatpump-modbus/lib/services/adaptive-control-service.ts`
- Modbus energy triggers: `org.hhi.adlar-heatpump-modbus/lib/services/energy-tracking-service.ts`
- Modbus rolling COP triggers: `org.hhi.adlar-heatpump-modbus/lib/services/rolling-cop-calculator.ts`
