# Adlar II capability naar Modbus-register mapping

*Datum: 5 mei 2026*  
*Scope: `drivers/intelligent-heatpump-modbus` / Adlar Castra Aurora II Modbus*

Dit document bevat alleen capabilities met een directe koppeling aan een Modbus-register. Capabilities die uitsluitend uit externe flow-data, adaptive control, COP-berekening, building model, pricing, diagnostics of historische aggregaties komen, zijn weggelaten.

Alle registers hieronder worden in de huidige transportlaag gelezen als **FC03 holding registers**.

`uiComponent = default` betekent dat er geen expliciete `uiComponent` in compose staat en Homey de standaardweergave voor het capability-type gebruikt.

## Mapping

| Capability | uiComponent | Register | R/W | Koppeling |
|---|---|---:|---|---|
| `onoff` | switch/default | `0x0305` | read/write | main switch |
| `target_temperature` | thermostat | `0x0301` | read/write | heating setpoint |
| `target_temperature.cooling` | thermostat/default | `0x0300` | read/write | cooling setpoint |
| `target_temperature.dhw` | thermostat/default | `0x0302` | read/write | DHW setpoint |
| `target_temperature.floor` | thermostat/default | `0x0303` | read/write | floor heating setpoint |
| `adlar_mode` | picker | `0x0304` | read/write | operating mode |
| `adlar_enum_work_mode` | sensor | `0x0307` | read/write | user/running mode |
| `adlar_enum_countdown_set` | sensor | `0x0314` | read/write | heating curve |
| `adlar_enum_capacity_set` | sensor | `0x0315` | read/write | hot water curve |
| `measure_temperature.ipm` | sensor/default | `0x0047` | read only | compressor IPM temp |
| `measure_temperature.hp_sat` | sensor/default | `0x0048` | read only | high pressure saturation temp |
| `measure_temperature.lp_sat` | sensor/default | `0x0049` | read only | low pressure saturation temp |
| `measure_temperature.ambient` | sensor/default | `0x004A` | read only | ambient T1 (always direct from Modbus) |
| `measure_temperature.outer_coil` | sensor/default | `0x004B` | read only | outer coil T2 |
| `measure_temperature.inner_coil` | sensor/default | `0x004C` | read only | inner coil T3 |
| `measure_temperature.suction` | sensor/default | `0x004D` | read only | suction T4 |
| `measure_temperature.exhaust` | sensor/default | `0x004E` | read only | exhaust T5 |
| `measure_temperature.inlet` | sensor/default | `0x004F` | read only | water inlet T6 |
| `measure_temperature.outlet` | sensor/default | `0x0050` | read only | water outlet T7 |
| `measure_temperature.econ_in` | sensor/default | `0x0051` | read only | economizer inlet T8 |
| `measure_temperature.econ_out` | sensor/default | `0x0052` | read only | economizer outlet T9 |
| `measure_temperature.dhw` | sensor/default | `0x0054` | read only | DHW tank temp |
| `measure_temperature.plate_hx` | sensor/default | `0x0055` | read only | plate HX exhaust temp |
| `measure_temperature.dhw_return` | sensor/default | `0x0059` | read only | DHW return temp |
| `measure_temperature.zone2` | sensor/default | `0x0073` | read only | zone 2 temp |
| `measure_temperature.buffer_tank` | sensor/default | `0x0074` | read only | buffer tank temp |
| `measure_temperature.total_outlet` | sensor/default | `0x0075` | read only | total water outlet temp |
| `measure_temperature.zone1_mix` | sensor/default | `0x007C` | read only | zone 1 mixing temp |
| `measure_frequency.compressor_freq` | sensor/default | `0x0040` | read only | compressor running frequency |
| `measure_frequency.comp_target_freq` | sensor/default | `0x0027` | read only | compressor target frequency |
| `adlar_fan_speed` | sensor | `0x0041` | read only | fan speed |
| `adlar_eev_step` | sensor | `0x0042` | read only | EEV open step |
| `adlar_evi_step` | sensor | `0x0043` | read only | EVI valve open step |
| `adlar_pump_pwm` | sensor | `0x0057` | read only | water pump PWM |
| `adlar_water_flow` | sensor | `0x0058` | read only | water flow, unless external flow active |
| `measure_power` | sensor/default | `0x005C` | read only | input power, unless external power active |
| `measure_voltage` | sensor/default | `0x005A` | read only | unit input voltage |
| `measure_current` | sensor/default | `0x005B` | read only | unit input current |
| `measure_current.comp_phase` | sensor/default | `0x0046` | read only | compressor phase current |
| `measure_current.b_phase` | sensor/default | `0x0077` | read only | B phase current |
| `measure_current.c_phase` | sensor/default | `0x0079` | read only | C phase current |
| `adlar_running` | sensor | `0x0000` | read only | running status 1 bit |
| `adlar_defrosting` | sensor | `0x0000` | read only | running status 1 defrost bit |
| `adlar_antifreeze` | sensor | `0x0000` | read only | running status 1 antifreeze bits |
| `adlar_fault_shutdown` | sensor | `0x0000` | read only | running status 1 fault shutdown bit |
| `adlar_sterilization` | sensor | `0x0001` | read only | running status 2 sterilization bit |
| `adlar_compressor_on` | sensor | `0x0040` | read only | derived: compressor frequency > 0 |
| `adlar_state_compressor_state` | sensor | `0x0040` | read only | derived: compressor frequency > 0 |
| `adlar_state_defrost_state` | sensor | `0x0000` | read only | defrost bit |
| `alarm_generic` | alarm/default | `0x0002`-`0x0004` | read only | active faults present |
| `adlar_fault` | sensor | `0x0002`-`0x0004` | read only | decoded fault count |
| `adlar_fault_1` | sensor | `0x0002` | read only | fault state 1 |
| `adlar_fault_2` | sensor | `0x0003` | read only | fault state 2 |
| `adlar_fault_3` | sensor | `0x0004` plus SYS1 prefix logic | read only | fault state 3 / SYS1 |
| `adlar_fault_active` | sensor | `0x0002`-`0x0004` | read only | decoded fault descriptions |
| `adlar_firmware_mcu` | sensor | `0x0360` | read only | program version |
| `adlar_protocol_version` | sensor | `0x0363` | read only | protocol version |
| `heating_curve_slope` | null | `0x0811` | read/write | L28 DIY curve coefficient |
| `heating_curve_intercept` | null | `0x0812` | read/write | L29 DIY curve constant |

## Opmerkingen

- `measure_power`, `measure_voltage`, `measure_current`, `meter_power` en de phase-current capabilities zijn dynamisch: ze worden toegevoegd of verwijderd via de setting `enable_power_measurements`.
- `measure_power` en `adlar_water_flow` kunnen door externe capabilities worden overschreven in de Homey UI. De Modbus-registers blijven dan wel de interne fallbackbron. `measure_temperature.ambient` toont altijd direct de T1-registerwaarde; `adlar_external_ambient` wordt afzonderlijk gebruikt door COP en adaptieve regeling (met eigen TTL van 1u).
- `meter_power` is niet opgenomen in de tabel omdat het geen directe registerwaarde is. De capability wordt door `EnergyTrackingService` opgebouwd uit internal/external power en tijd.
- `heating_curve_formula`, `heating_curve_ref_outdoor` en `heating_curve_ref_temp` zijn niet opgenomen als directe registerkoppeling: ze worden afgeleid uit L28/L29 of vaste referentiewaarden.
