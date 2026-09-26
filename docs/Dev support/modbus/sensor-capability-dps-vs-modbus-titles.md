# Sensor Capability DPS vs Modbus Mapping With Titles

This document compares the sensor and measurement capabilities between:

- `org.hhi.adlar-heatpump` (DPS / Tuya)
- `org.hhi.adlar-heatpump-modbus` (Modbus)

Scope:

- included: measurement and sensor-like capabilities
- excluded: control capabilities and most pure state/flow-card capabilities

Title source:

- first choice: `driver.compose.json` `capabilitiesOptions`
- fallback: `.homeycompose/capabilities/*.json`
- if no local title override exists: `Homey standaardtitel`

## Same Physical Sensor, Different Capability Id

| DPS capability | DPS title | Modbus capability | Modbus title | Notes |
|---|---|---|---|---|
| `measure_temperature.around_temp` | `Buitentemperatuur` | `measure_temperature.ambient` | `Buitentemperatuur (T1)` | T1 outside / ambient |
| `measure_temperature.temp_top` | `Water intrede temperatuur` | `measure_temperature.inlet` | `Inlaattemperatuur (T6)` | T6 water inlet |
| `measure_temperature.temp_bottom` | `Water uittrede temperatuur` | `measure_temperature.outlet` | `Uitlaattemperatuur (T7)` | T7 water outlet |
| `measure_temperature.coiler_temp` | `Verdampingscondensator temperatuur` | `measure_temperature.outer_coil` | `Buitenste spoel temperatuur (T2)` | T2 outer coil |
| `measure_temperature.venting_temp` | `Persgas temperatuur` | `measure_temperature.exhaust` | `Uitlaattemperatuur compressor (T5)` | T5 exhaust / discharge |
| `measure_temperature.temp_current_f` | `Hogedruk verzadigingstemperatuur` | `measure_temperature.hp_sat` | `HP saturatietemperatuur` | HP saturation |
| `measure_temperature.top_temp_f` | `Lagedruk verzadigingstemperatuur` | `measure_temperature.lp_sat` | `LP saturatietemperatuur` | LP saturation |
| `measure_temperature.bottom_temp_f` | `Condensor temperatuur` | `measure_temperature.inner_coil` | `Binnenste spoel temperatuur (T3)` | T3 inner coil |
| `measure_temperature.around_temp_f` | `Tapwater temperatuur` | `measure_temperature.dhw` | `Warmwaterboiler temperatuur` | DHW tank |
| `measure_temperature.coiler_temp_f` | `Zuiggas temperatuur` | `measure_temperature.suction` | `Zuigtemperatuur (T4)` | T4 suction |
| `measure_temperature.evlin` | `EVI wamtewisselaar zuiggas temperatuur` | `measure_temperature.econ_in` | `Economizer inlaat (T8)` | T8 economizer inlet |
| `measure_temperature.eviout` | `EVI wamtewisselaar persgas temperatuur` | `measure_temperature.econ_out` | `Economizer uitlaat (T9)` | T9 economizer outlet |
| `measure_frequency.compressor_strength` | `Compressor frequentie` | `adlar_compressor_freq` | `Compressorfrequentie` | compressor frequency |
| `measure_frequency.fan_motor_frequency` | `Ventilator frequentie` | `adlar_fan_speed` | `Ventilatorsnelheid` | fan frequency / speed |
| `adlar_measure_pulse_steps_temp_current` | `EEV Open` | `adlar_eev_step` | `EEV-openingsstappen` | EEV step |
| `measure_water` | `Water doorstroming` | `adlar_water_flow` | `Waterdebiet` | water flow |
| `meter_power.electric_total` | `Totaal stroomverbruik` | `meter_power` | `Homey standaardtitel` | total energy |
| `measure_current.cur_current` | `Hudige stroomsterkte` | `measure_current` | `Homey standaardtitel` | input current |
| `measure_current.b_cur` | `Amperage B` | `measure_current.b_phase` | `B-fase stroom` | B phase current |
| `measure_current.c_cur` | `Amperage C` | `measure_current.c_phase` | `C-fase stroom` | C phase current |
| `measure_voltage.voltage_current` | `Huidige spanning` | `measure_voltage` | `Homey standaardtitel` | input voltage |

## Same Capability Id

Important nuance:

- for the actual built-in heat-pump sensors, only `measure_power` stayed exactly the same
- the rest of this section is mostly external or virtual measurement data

| Capability | DPS title | Modbus title | Notes |
|---|---|---|---|
| `measure_power` | `Huidig vermogen` | `Homey standaardtitel` | same physical power measurement |
| `measure_temperature.indoor` | `Binnentemperatuur gemeten` | `Homey standaardtitel` | same external indoor measurement |
| `adlar_external_power` | `Externe Vermogen Meting` | `Externe Vermogen Meting` | same external measurement |
| `adlar_external_flow` | `Externe Water Doorstroom Meting` | `Externe Water Doorstroom Meting` | same external measurement |
| `adlar_external_ambient` | `Externe Buitentemperatuur` | `Externe Buitentemperatuur` | same external measurement |
| `adlar_external_indoor_temperature` | `Externe Binnen Temperatuur` | `Externe Binnen Temperatuur` | same external measurement |
| `adlar_external_energy_daily` | `Dagelijks Geschat Energieverbruik` | `Dagelijks Geschat Energieverbruik` | same estimated measurement |
| `adlar_external_energy_total` | `Geschat Totaal Energieverbruik` | `Geschat Totaal Energieverbruik` | same estimated measurement |
| `adlar_external_solar_power` | `Externe Zonnepaneel Vermogen` | `Externe Zonnepaneel Vermogen` | same external measurement |
| `adlar_external_solar_radiation` | `Externe Zonnestraling` | `Externe Zonnestraling` | same external measurement |
| `adlar_external_wind_speed` | `Externe Windsnelheid` | `Externe Windsnelheid` | same external measurement |

## Modbus Only

| Modbus capability | Modbus title | Notes |
|---|---|---|
| `measure_temperature.ipm` | `IPM temperatuur` | extra internal sensor |
| `measure_temperature.plate_hx` | `Plaatwarmtewisselaar temperatuur` | extra internal sensor |
| `measure_temperature.dhw_return` | `Warmwater retourtemperatuur` | extra hydronic sensor |
| `measure_temperature.buffer_tank` | `Buffervat temperatuur` | extra hydronic sensor |
| `measure_temperature.total_outlet` | `Totaal uitlaattemperatuur water` | extra hydronic sensor |
| `measure_temperature.zone1_mix` | `Zone 1 mengtemperatuur` | extra zone sensor |
| `measure_temperature.zone2` | `Zone 2 temperatuur` | extra zone sensor |
| `measure_current.comp_phase` | `Compressor fasestroom` | extra electrical measurement |
| `adlar_comp_target_freq` | `Compressor doelfrequentie` | target telemetry |
| `adlar_pump_pwm` | `Pomp PWM` | pump telemetry |

## DPS Only

| DPS capability | DPS title | Notes |
|---|---|---|
| `adlar_measure_pulse_steps_effluent_temp` | `EVI-openingsstap` | no exposed Modbus capability yet |
| `measure_voltage.bv` | `Spanning B` | Modbus register exists, capability not exposed |
| `measure_voltage.cv` | `Voltage C` | Modbus register exists, capability not exposed |
| `measure_power.internal` | `Intern Vermogen (DPS)` | DPS-specific duplicate of power |
| `meter_power.power_consumption` | `Stroom dagverbruik` | DPS-specific daily consumption capability |

## Short Takeaways

- The Modbus project renamed almost all built-in heat-pump sensors to clearer protocol-oriented names such as `ambient`, `inlet`, `outer_coil`, `econ_in`, and `hp_sat`.
- Only `measure_power` stayed truly unchanged as a built-in physical measurement capability.
- The Modbus project adds a substantial extra sensor surface: IPM, plate heat exchanger, DHW return, buffer tank, zone temperatures, compressor phase current, target compressor frequency, and pump PWM.
- The DPS project still exposes a few measurements that the Modbus project does not currently surface as capabilities, especially EVI step, phase B/C voltage, and daily power consumption.
