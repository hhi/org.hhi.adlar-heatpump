# Driver Compose Capability Comparison: DPS vs Modbus

This note compares the capability lists from:

- DPS driver: `drivers/intelligent-heat-pump/driver.compose.json` (org.hhi.adlar-heatpump)
- Modbus driver: `drivers/intelligent-heatpump-modbus/driver.compose.json` (org.hhi.adlar-heatpump-modbus)

It complements:

- `docs/Dev support/capability-dps-vs-modbus-mapping.md`
- `docs/Dev support/sensor-capability-dps-vs-modbus-titles.md`

## Scope

This comparison is based on:

- capability ids in `driver.compose.json`
- capability metadata from `.homeycompose/capabilities/*.json`
- per-driver overrides in `capabilitiesOptions`

There is no separate `sensorType` field in these capability definitions. In the tables below, "sensor type" is approximated by:

- capability `type`
- capability `uiComponent`

Missing metadata is shown as `-`.

## Summary

| Metric | DPS | Modbus |
|---|---:|---:|
| Total capabilities | 102 | 125 |
| Exact same capability id | 71 | 71 |
| Only in DPS | 31 | - |
| Only in Modbus | - | 54 |
| Driver class | `heatpump` | `thermostat` |

## Functionally Equivalent But Renamed

| DPS capability | Modbus capability | DPS type/ui | Modbus type/ui | DPS min/max/step | Modbus min/max/step | Difference |
|---|---|---|---|---|---|---|
| `adlar_enum_mode` | `adlar_mode` | `enum/picker` | `enum/picker` | `-` | `-` | Same function, different id |
| `measure_temperature.around_temp` | `measure_temperature.ambient` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.temp_top` | `measure_temperature.inlet` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.temp_bottom` | `measure_temperature.outlet` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, Modbus uses explicit outlet id |
| `measure_temperature.coiler_temp` | `measure_temperature.outer_coil` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.venting_temp` | `measure_temperature.exhaust` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.temp_current_f` | `measure_temperature.hp_sat` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, Modbus names HP saturation explicitly |
| `measure_temperature.top_temp_f` | `measure_temperature.lp_sat` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, Modbus names LP saturation explicitly |
| `measure_temperature.bottom_temp_f` | `measure_temperature.inner_coil` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.around_temp_f` | `measure_temperature.dhw` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.coiler_temp_f` | `measure_temperature.suction` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.evlin` | `measure_temperature.econ_in` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_temperature.eviout` | `measure_temperature.econ_out` | `-/-` | `-/-` | `-50/150/-` | `-` | Same sensor, different naming |
| `measure_frequency.compressor_strength` | `adlar_compressor_freq` | `-/-` | `number/sensor` | `0/200/-` | `0/120/-` | Modbus uses explicit number capability and tighter range |
| `measure_frequency.fan_motor_frequency` | `adlar_fan_speed` | `-/-` | `number/sensor` | `0/100/-` | `0/3000/-` | Same metric, but different scale/presentation |
| `adlar_measure_pulse_steps_temp_current` | `adlar_eev_step` | `number/sensor` | `number/sensor` | `-500/500/1` | `0/500/-` | Modbus exposes only positive step range |
| `adlar_measure_pulse_steps_effluent_temp` | `adlar_evi_step` | `number/sensor` | `number/sensor` | `-500/500/1` | `0/500/-` | Same as above for EVI step |
| `measure_water` | `adlar_water_flow` | `-/-` | `number/sensor` | `0/100/-` | `0/60/-` | Modbus uses explicit flow capability with narrower range |
| `meter_power.electric_total` | `meter_power` | `-/-` | `-/-` | `0/9999999/-` | `-` | Same function, different id |
| `measure_current.cur_current` | `measure_current` | `-/-` | `-/-` | `0/99999/-` | `-` | Same function, different id |
| `measure_current.b_cur` | `measure_current.b_phase` | `-/-` | `-/-` | `0/99999/-` | `-` | Same function, different id |
| `measure_current.c_cur` | `measure_current.c_phase` | `-/-` | `-/-` | `0/99999/-` | `-` | Same function, different id |
| `measure_voltage.voltage_current` | `measure_voltage` | `-/-` | `-/-` | `0/10000/-` | `-` | Same function, different id |
| `adlar_state_compressor_state` | `adlar_compressor_on` | `boolean/sensor` | `boolean/sensor` | `-` | `-` | Same status meaning; Modbus also keeps the old id for compatibility |
| `adlar_state_defrost_state` | `adlar_defrosting` | `boolean/sensor` | `boolean/sensor` | `-` | `-` | Same status meaning; different active id in Modbus logic |

## Same Capability Id, But Metadata Differs

These capability ids exist in both drivers, but their metadata is not identical.

| Capability | DPS type/ui | Modbus type/ui | DPS min/max/step | Modbus min/max/step | Difference |
|---|---|---|---|---|---|
| `target_temperature` | `-/-` | `-/-` | `5/75/1` | `15/60/1` | Modbus uses the heating setpoint register range |
| `target_temperature.indoor` | `-/thermostat` | `-/thermostat` | `15/25/0.5` | `15/25/0.5` | Same adaptive-control range |
| `measure_temperature.indoor` | `-/sensor` | `-/-` | `-` | `-` | DPS declares UI explicitly |
| `adlar_enum_work_mode` | `enum/picker` | `enum/sensor` | `-` | `-` | Same enum, different UI presentation |
| `adlar_enum_capacity_set` | `enum/picker` | `enum/sensor` | `-` | `-` | Same enum, different UI presentation |

## Only In DPS

### DPS-specific enum / picker / compatibility ids

- `adlar_enum_water_mode`
- `adlar_sensor_capacity_set`
- `adlar_enum_volume_set`
- `adlar_picker_countdown_set`

### DPS-specific sensor naming

- `measure_frequency.compressor_strength`
- `measure_frequency.fan_motor_frequency`
- `measure_water`
- `measure_temperature.around_temp`
- `measure_temperature.temp_top`
- `measure_temperature.temp_bottom`
- `measure_temperature.coiler_temp`
- `measure_temperature.venting_temp`
- `measure_temperature.temp_current_f`
- `measure_temperature.top_temp_f`
- `measure_temperature.bottom_temp_f`
- `measure_temperature.around_temp_f`
- `measure_temperature.coiler_temp_f`
- `measure_temperature.evlin`
- `measure_temperature.eviout`
- `adlar_measure_pulse_steps_temp_current`
- `adlar_measure_pulse_steps_effluent_temp`

### DPS-specific electrical / energy ids

- `measure_power.internal`
- `meter_power.power_consumption`
- `meter_power.electric_total`
- `measure_current.cur_current`
- `measure_current.b_cur`
- `measure_current.c_cur`
- `measure_voltage.voltage_current`
- `measure_voltage.bv`
- `measure_voltage.cv`

### DPS-only miscellaneous

- `adlar_enum_mode`

## Only In Modbus

### Extra control / setpoint capabilities

- `target_temperature.cooling`
- `target_temperature.dhw`
- `target_temperature.floor`

### Extra temperature channels

- `measure_temperature.outlet`
- `measure_temperature.inlet`
- `measure_temperature.ambient`
- `measure_temperature.outer_coil`
- `measure_temperature.inner_coil`
- `measure_temperature.suction`
- `measure_temperature.exhaust`
- `measure_temperature.dhw`
- `measure_temperature.econ_in`
- `measure_temperature.econ_out`
- `measure_temperature.hp_sat`
- `measure_temperature.lp_sat`
- `measure_temperature.ipm`
- `measure_temperature.plate_hx`
- `measure_temperature.dhw_return`
- `measure_temperature.buffer_tank`
- `measure_temperature.total_outlet`
- `measure_temperature.zone1_mix`
- `measure_temperature.zone2`

### Extra mechanical / electrical capabilities

- `meter_power`
- `measure_voltage`
- `measure_current`
- `alarm_generic`
- `adlar_compressor_freq`
- `adlar_comp_target_freq`
- `adlar_fan_speed`
- `adlar_eev_step`
- `adlar_evi_step`
- `adlar_pump_pwm`
- `adlar_water_flow`
- `measure_current.comp_phase`
- `measure_current.b_phase`
- `measure_current.c_phase`

### Extra status / fault breakdown

- `adlar_mode`
- `adlar_defrosting`
- `adlar_running`
- `adlar_compressor_on`
- `adlar_antifreeze`
- `adlar_sterilization`
- `adlar_fault_shutdown`
- `adlar_fault_1`
- `adlar_fault_2`
- `adlar_fault_3`
- `adlar_fault_active`
- `adlar_daily_disconnect_count`

### Extra derived / diagnostics outputs

- `adlar_protocol_version`
- `heating_curve_formula`
- `heating_curve_slope`
- `heating_curve_intercept`
- `heating_curve_ref_outdoor`
- `heating_curve_ref_temp`

## Interpretation

- The DPS driver is more compact and still carries several Tuya/DPS-era ids and UI-oriented aliases.
- The Modbus driver is more explicit and technical, with more direct sensor channels, richer fault/status decomposition, and more register-oriented capabilities.
- The biggest structural differences are:
  - renamed capability ids for the same function
  - more fine-grained temperature and status capabilities in Modbus
  - more explicit `min/max/step` and `uiComponent` metadata in DPS for some older capabilities
