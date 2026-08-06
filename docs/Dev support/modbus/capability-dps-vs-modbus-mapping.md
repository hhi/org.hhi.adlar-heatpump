# DPS vs Modbus Capability Mapping

This document compares the DPS-based capability model from `org.hhi.adlar-heatpump`
with the current Modbus implementation in `org.hhi.adlar-heatpump-modbus`.

The left column uses the DPS capability ids as the canonical reference.
The Modbus columns show the current equivalent capability and register mapping.

## Legend

- `read wired`: the Modbus driver currently fills the listed Modbus capability from the register.
- `write wired`: changing the listed Modbus capability currently writes back to the register.
- `register only`: the register exists in the Modbus service, but is not yet connected to a capability.

## Source Files

- DPS mapping: `../org.hhi.adlar-heatpump/lib/definitions/adlar-mapping.ts`
- Modbus registers: `lib/modbus/adlar-modbus-registers.ts`
- Modbus read wiring: `drivers/intelligent-heatpump-modbus/device.ts`
- Modbus write wiring: `drivers/intelligent-heatpump-modbus/device.ts`

## Control

| DPS capability | DPS | Modbus capability | Register | Read wired | Write wired | Register only | Notes |
|---|---:|---|---|---|---|---|---|
| `onoff` | 1 | `onoff` | `0x0305` | yes | yes | no | Direct 1:1 |
| `target_temperature` | 4 | `target_temperature` | `0x0301` | yes | yes | no | Direct 1:1 |
| `adlar_hotwater` | 101 | `target_temperature.dhw` | `0x0302` | yes | yes | no | Same function, different capability id |
| `adlar_enum_mode` | 2 | `adlar_mode` | `0x0304` | yes | yes | no | String/int mapping |
| `adlar_enum_work_mode` | 5 | - | `0x0307` | no | no | yes | Register and service support exist, no capability wiring |
| `adlar_enum_water_mode` | 10 | - | - | no | no | no | No direct Modbus equivalent |
| `adlar_enum_capacity_set` | 11 | - | `0x0315` | no | no | yes | Hot-water curve, protocol >= 130 |
| `adlar_sensor_capacity_set` | 11 | - | `0x0315` | no | no | yes | Same register as above |
| `adlar_enum_countdown_set` | 13 | - | `0x0314` | no | no | yes | Heating curve, protocol >= 130 |
| `adlar_picker_countdown_set` | 13 | - | `0x0314` | no | no | yes | Same register as above |
| `adlar_enum_volume_set` | 106 | - | - | no | no | no | No clear 1:1 mapping |

## Temperatures

| DPS capability | DPS | Modbus capability | Register | Read wired | Write wired | Register only | Notes |
|---|---:|---|---|---|---|---|---|
| `measure_temperature.temp_top` | 21 | `measure_temperature.inlet` | `0x004F` | yes | no | no | T6 |
| `measure_temperature.temp_bottom` | 22 | `measure_temperature.outlet` | `0x0050` | yes | no | no | T7 |
| `measure_temperature.coiler_temp` | 23 | `measure_temperature.outer_coil` | `0x004B` | yes | no | no | T2 |
| `measure_temperature.venting_temp` | 24 | `measure_temperature.exhaust` | `0x004E` | yes | no | no | T5 |
| `measure_temperature.around_temp` | 26 | `measure_temperature.ambient` | `0x004A` | yes | no | no | T1 |
| `measure_temperature.temp_current_f` | 35 | `measure_temperature.hp_sat` | `0x0048` | yes | no | no | HP sat |
| `measure_temperature.top_temp_f` | 36 | `measure_temperature.lp_sat` | `0x0049` | yes | no | no | LP sat |
| `measure_temperature.bottom_temp_f` | 37 | `measure_temperature.inner_coil` | `0x004C` | yes | no | no | T3 |
| `measure_temperature.around_temp_f` | 38 | `measure_temperature.dhw` | `0x0054` | yes | no | no | DHW tank |
| `measure_temperature.coiler_temp_f` | 41 | `measure_temperature.suction` | `0x004D` | yes | no | no | T4 |
| `measure_temperature.evlin` | 107 | `measure_temperature.econ_in` | `0x0051` | yes | no | no | T8 |
| `measure_temperature.eviout` | 108 | `measure_temperature.econ_out` | `0x0052` | yes | no | no | T9 |

## Electrical and Mechanical

| DPS capability | DPS | Modbus capability | Register | Read wired | Write wired | Register only | Notes |
|---|---:|---|---|---|---|---|---|
| `measure_frequency.compressor_strength` | 20 | `adlar_compressor_freq` | `0x0040` | yes | no | no | |
| `measure_frequency.fan_motor_frequency` | 40 | `adlar_fan_speed` | `0x0041` | yes | no | no | Unit label may differ from DPS naming |
| `adlar_measure_pulse_steps_temp_current` | 16 | `adlar_eev_step` | `0x0042` | yes | no | no | |
| `adlar_measure_pulse_steps_effluent_temp` | 25 | - | `0x0043` | no | no | yes | EVI step register exists |
| `measure_water` | 39 | `adlar_water_flow` | `0x0058` | yes | no | no | |
| `measure_power` | 104 | `measure_power` | `0x005C` | yes | no | no | |
| `measure_power.internal` | 104 | `measure_power` | `0x005C` | yes | no | no | No separate `.internal` capability |
| `meter_power.power_consumption` | 18 | - | - | no | no | no | No direct daily Modbus register |
| `meter_power.electric_total` | 105 | `meter_power` | `0x005D` | yes | no | no | Different capability id |
| `measure_current.cur_current` | 102 | `measure_current` | `0x005B` | yes | no | no | |
| `measure_current.b_cur` | 109 | `measure_current.b_phase` | `0x0077` | yes | no | no | |
| `measure_current.c_cur` | 110 | `measure_current.c_phase` | `0x0079` | yes | no | no | |
| `measure_voltage.voltage_current` | 103 | `measure_voltage` | `0x005A` | yes | no | no | |
| `measure_voltage.bv` | 111 | - | `0x0076` | no | no | yes | |
| `measure_voltage.cv` | 112 | - | `0x0078` | no | no | yes | |

## Status and Info

| DPS capability | DPS | Modbus capability | Register | Read wired | Write wired | Register only | Notes |
|---|---:|---|---|---|---|---|---|
| `adlar_state_compressor_state` | 27 | `adlar_compressor_on` | derived from `0x0040 > 0` | yes | no | no | Exact compatibility capability exists but is not populated |
| `adlar_state_defrost_state` | 33 | `adlar_defrosting` | `0x0000` bit 8 | yes | no | no | Exact compatibility capability exists but is not populated |
| `adlar_state_backwater` | 31 | - | - | no | no | no | Only backwater config registers `0x080B-0x080F`, no live state |
| `adlar_fault` | 15 | `adlar_fault_active`, `adlar_fault_1/2/3` | `0x0002-0x0009` | yes | no | no | Semantically richer than single DPS fault code |
| `adlar_firmware_mcu` | 14 | `adlar_firmware_mcu` | `0x0360` | yes | no | no | Program version decoded as packed version number, e.g. `130 -> v1.3.0` |

## Summary

- The currently write-wired DPS equivalents are: `onoff`, `target_temperature`,
  `adlar_hotwater` via `target_temperature.dhw`, and `adlar_enum_mode`.
- Most temperature and primary electrical readings are already read-wired.
- Additional Modbus-only version info is exposed via `adlar_protocol_version` from `0x0363`.
- The main gaps are: curves, work mode, B/C phase voltage, EVI step,
  and a few compatibility aliases that exist in the manifest but are not yet populated.
