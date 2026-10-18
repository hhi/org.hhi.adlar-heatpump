# Capability naar Modbus-register mapping

Dit document vat de runtime-mapping samen van Homey capabilities naar Aurora III Modbus-registers voor de driver `intelligent-heatpump-aurora3` (stand: bron-app v1.9.4, overgenomen in v3.2.0; ADR-004). De Aurora II-tegenhanger is [adlar2-capability-modbus-register-mapping.md](adlar2-capability-modbus-register-mapping.md).

Bronnen in de code:

- `drivers/intelligent-heatpump-aurora3/device.ts` → `applyModbusSnapshot()` en capability listeners
- `lib/aurora3/protocol/adlar3-modbus-service.ts` → pollgroepen, snapshot-opbouw, schrijfpaden
- `lib/aurora3/protocol/adlar3-modbus-registers.ts` → registermetadata, bitmaskers, `VERIFICATION_TASKS`

Registerbronnen: de officiële Aurora III register map (leidend; `docs/Heatpump specs/modbus/Adlar III/HHi/Adlar-III_modbus_registers HHi.xlsx`, tabblad "Register Map"), de Home Assistant-packages `adlar_heatpump.yaml` en `adlar_warmtepomp.yaml` ([HA-modbus-Adlar-aurora-Pro-III](https://github.com/OnnoTimmermans/HA-modbus-Adlar-aurora-Pro-III)) en kruisverwijzingen naar Aurora II.

## Notatie

Aurora III gebruikt Modicon-notatie:

- `3-NNNN`: input register, FC04, read-only.
- `4-NNNN`: holding register, FC03/FC06, read/write.

Temperatuurwaarden met x10-schaal worden als raw registerwaarde `temperatuur_C * 10` opgeslagen.

## Pollgroepen

Elke capability wordt bijgewerkt vanuit de snapshot van de pollgroep die het register leest. De `medium`-groep levert sinds v1.9.0 een eigen snapshot (`sourcePollGroup: 'medium'`); daarvóór kregen de medium-capabilities geen updates.

| Groep | Standaardinterval | Registers |
|---|---|---|
| `superfast` | 5 s (adaptief 2 s) | `3-38..39`, `3-42..43`, `3-64`, `3-79` |
| `fast` | 10 s | `3-40..56`, `3-62..64`, `3-70..81` |
| `medium` | 30 s | `3-9`, `3-60..61`, `3-86..103`, `4-2100..2114` |
| `slow` | 300 s | `3-10..31` (limieten), `3-66..69` (stooklijn) |
| `once` | bij verbinden | `3-0..9` (configuratie), `3-34..37` (afgiftesystemen) |

## Aurora III mapping

### Status en storingen

| Capability | Register | FC | Scaling | Bereik / mogelijke waarden |
|---|---:|---|---:|---|
| `adlar_antifreeze` | `3-38` bit 2 | FC04 input | bitmask | `false/true`, bit `0x0004` |
| `adlar_defrosting` | `3-38` bit 1 | FC04 input | bitmask | `false/true`, bit `0x0002` |
| `adlar_sterilization` | `3-38` bit 4 | FC04 input | bitmask | `false/true`, bit `0x0010` (desinfectie loopt nu) |
| `adlar_dhw_active` | `3-9` bit 2 | FC04 input | bitmask | `true` als de warmtepomp op dit moment tapwater verwarmt |
| `adlar_running` | afgeleid uit `3-79` of `3-80` | FC04 input | `3-79` x1 Hz | `true` als compressorfrequentie > 0 of pompstatus = 1 |
| `adlar_compressor_on` | `3-79` | FC04 input | x1 Hz | `true` als > 0 |
| `adlar_state_compressor_state` | `3-79` | FC04 input | x1 Hz | zelfde boolean als `adlar_compressor_on` |
| `adlar_state_defrost_state` | `3-38` bit 1 | FC04 input | bitmask | zelfde boolean als `adlar_defrosting` |
| `adlar_fault_shutdown` | `3-90..3-101` | FC04 input | bitveld | `true` als er actieve fault/protection codes zijn |
| `alarm_generic` | `3-90..3-101` | FC04 input | bitveld | `true` als er actieve fault/protection codes zijn |
| `adlar_fault` | `3-90..3-101` | FC04 input | bitveld | aantal actieve codes |
| `adlar_fault_active` | `3-90..3-101` | FC04 input | bitveld | codes gescheiden door `; `, bijv. `E03; P17` |

Storingsregisters zijn bitvelden: bit *n* van het *k*-de register is code *k*·16 + *n* + 1. `3-90..3-95` geven `E01..E96`, `3-96..3-101` geven `P01..P96`. Voorbeeld: `3-90 = 0x0004` → `E03`; `3-97 = 0x0001` → `P17`. De omschrijving per code staat niet in de register map.

### Bediening

| Capability | Register | FC | Scaling | Bereik / mogelijke waarden |
|---|---:|---|---:|---|
| `onoff` | `4-2101` | FC03/FC06 holding | x1 | read: `2101 ≠ 0` (vóór de eerste read van 2101: `2100 ≠ 0`). Write alleen met instelling `experimental_zone_onoff`: uit = `0`, aan = laatst bekende waarde ≠ 0, anders `1` (één zone) of `3` (twee zones volgens `3-2`) |
| `adlar_mode_aurora3` | `4-2100` | FC03/FC06 holding | x1 | `1=Cool`, `2=Heat`, `4=Auto`; `0=Off` wordt getoond maar nooit geschreven |
| `adlar_dhw_enabled` | `4-2102` | FC03/FC06 holding | x1 | `0=uit`, `1=aan` |
| `adlar_silent_mode` | `4-2103` bits 4-5 | FC03/FC06 holding | bitveld | `0=uit`, `1=niveau 1`, `2=niveau 2` (alleen R290, `3-7 = 1`); read-modify-write |
| `adlar_backup_heater_forced` | `4-2103` bit 3 | FC03/FC06 holding | bitmask | geforceerde elektrische bijverwarming; read-modify-write |
| `adlar_disinfection_enabled` | `4-2103` bit 6 | FC03 holding | bitmask | instelling desinfectiefunctie; alleen-lezen |
| `target_temperature` | `4-2107` | FC03/FC06 holding | raw = C x10 | registermetadata `18-50 C`; capability listener accepteert `15-60 C` |
| `target_temperature.cooling` | `4-2106` | FC03/FC06 holding | raw = C x10 | `7-25 C` |
| `target_temperature.dhw` | `4-2105` | FC03/FC06 holding | raw = C x10 | begrensd door `3-15..3-14` als die plausibel zijn, anders `20-75 C` |
| `target_temperature.floor` | `4-2114` | FC03 holding | raw = C x10 | toont het ruimtetemperatuur-setpoint; schrijven via deze capability is niet beschikbaar (het interactieve dashboard schrijft 2114 direct, `16-28 C` en `3-31..3-30`) |
| `target_temperature.indoor` | geen Modbus-write | n.v.t. | n.v.t. | alleen lokale/adaptieve-control waarde; listener accepteert `15-25 C` |

Schrijfacties op `4-2103` lezen het register eerst opnieuw in en wijzigen alleen de eigen bits; onbekende bits blijven behouden.

### Temperaturen, druk en mechaniek

| Capability | Register | FC | Scaling | Bereik / mogelijke waarden |
|---|---:|---|---:|---|
| `measure_temperature.outlet` | `3-43` | FC04 input | x0.1 C | aanvoertemperatuur (TA) |
| `measure_temperature.inlet` | `3-42` | FC04 input | x0.1 C | retourtemperatuur (TE1) |
| `measure_temperature.ambient` | `3-50` | FC04 input | x0.1 C | altijd directe Modbuswaarde; `adlar_external_ambient` blijft aparte externe input voor COP/adaptieve regeling |
| `measure_temperature.outer_coil` | `3-49` | FC04 input | x0.1 C | |
| `measure_temperature.suction` | `3-53` | FC04 input | x0.1 C | |
| `measure_temperature.exhaust` | `3-52` | FC04 input | x0.1 C | persgastemperatuur |
| `measure_temperature.dhw` | `3-46` | FC04 input | x0.1 C | |
| `measure_temperature.buffer_tank` | `3-45` | FC04 input | x0.1 C | |
| `measure_temperature.total_outlet` | `3-41` | FC04 input | x0.1 C | aanvoer na bijverwarming |
| `measure_temperature.zone2` | `3-47` | FC04 input | x0.1 C | |
| `adlar_high_pressure` | `3-86` | FC04 input | x1 kPa | schaal `@verify` |
| `adlar_low_pressure` | `3-87` | FC04 input | x1 kPa | schaal `@verify` |
| `measure_frequency.compressor_freq` | `3-79` | FC04 input | x1 Hz | UI max typisch `120 Hz` |
| `measure_frequency.comp_target_freq` | `3-78` | FC04 input | x1 Hz | |
| `adlar_fan_speed` | `3-72` | FC04 input | x1 RPM | UI `0-3000` |
| `adlar_eev_step` | `3-70` | FC04 input | x1 steps | UI `0-500` |
| `adlar_evi_step` | `3-71` | FC04 input | x1 steps | UI `0-500`; register beschikbaarheid `@verify` |
| `adlar_pump_pwm` | `3-62` | FC04 input | x1 % | UI `0-100` |
| `measure_water` | `3-64` | FC04 input | x0.1 m3/h intern | getoond in L/min; `adlar_external_flow` heeft voorrang in de COP-berekening |

### Elektrisch

| Capability | Register | FC | Scaling | Bereik / mogelijke waarden |
|---|---:|---|---:|---|
| `measure_power` | afgeleid uit `3-74 * 3-75` | FC04 input | V x1, A x0.1 | altijd de Modbuswaarde; `adlar_external_power` wordt apart gebruikt voor COP en energie |
| `measure_voltage` | `3-74` | FC04 input | x1 V | geeft op sommige firmware altijd 0 |
| `measure_current` | `3-75` | FC04 input | x0.1 A | geeft op sommige firmware altijd 0; kalibratie `@verify` |
| `measure_current.comp_phase` | `3-77` | FC04 input | x0.1 A | |

Blijven `3-74`/`3-75` op 0 staan terwijl de compressor draait, dan logt de app dat eenmalig (na ~30 fast polls) en geeft de COP-snapshot als reden dat een externe vermogensmeting nodig is.

## Registers zonder directe capability

Deze registers worden gelezen en zijn zichtbaar in de dashboards, maar hebben geen eigen Homey capability:

| Snapshotveld / register | Register | FC | Scaling | Opmerking |
|---|---:|---|---:|---|
| `roomTemp` | `3-40` | FC04 input | x0.1 C | |
| aanvraag externe warmtebron (hybride) | `3-39` | FC04 input | bitveld | bit 0 = aanvraag tijdens vorstbeveiliging, bit 1 = aanvraag tijdens ontdooien; niet gedecodeerd |
| limieten | `3-10..3-31` | FC04 input | x0.1 C | `3-14/15` en `3-30/31` begrenzen schrijfacties op `4-2105` en `4-2114` |
| stooklijn-setpoints | `3-66..3-69` | FC04 input | x0.1 C | volgen de buitentemperatuur; `3-67` staat in de officiële map als x1 (`@verify`) |
| `pumpPwmFeedback` | `3-63` | FC04 input | x0.1 m³/h | officiële map: x10, m³/h (titel zegt "percentage"; `@verify`); niet opgenomen in `SENSOR_DESCRIPTORS` |
| `currentTargetOpMode` | `3-102` | FC04 input | bitveld | B3-B0 zone 1, B7-B4 zone 2 (0 standby, 1 koelen, 2 verwarmen), B11-B8 tapwater (0 standby, 8 tapwater); niet gedecodeerd |
| `actualOpMode` | `3-103` | FC04 input | bitveld | zelfde indeling als `3-102`, maar de werkelijke modus; niet gedecodeerd |
| `zone1AutoHeatingSetTemp` | `4-2109` | FC03/FC06 holding | vermoedelijk x0.1 C | schrijven expliciet geblokkeerd wegens schaalrisico |

## Flowkaarten voor bediening

| Kaart | Type | Capability |
|---|---|---|
| `set_silent_mode` | actie | `adlar_silent_mode` |
| `set_dhw_function` | actie | `adlar_dhw_enabled` |
| `set_backup_heater` | actie | `adlar_backup_heater_forced` |
| `silent_mode_is` | conditie | `adlar_silent_mode` |
| `dhw_heating_active` | conditie | `adlar_dhw_active` |
| `fault_detected` | trigger | code uit `adlar_fault_active`, bijv. `E03` |

## Dashboards

- **Interactief dashboard** (`/interactive`): setpoints via `POST /api/write` (whitelist in `WRITABLE_REGISTERS`), functies via `POST /api/control`. Die laatste route accepteert alleen `onoff`, `adlar_dhw_enabled`, `adlar_backup_heater_forced` en `adlar_silent_mode`, en loopt via de capability listeners. Daardoor gelden de read-modify-write op `4-2103` en de vergrendeling van aan/uit ook vanuit het dashboard. Het tapwaterveld toont `control.dhwSetpointRange`.
- **Expertdashboard** (`/expert`): beschrijvingen en bittabellen komen uit `adlar3-modbus-registers.ts` (`registerBitTable()`: `3-9`, `3-38`, `3-39`, `3-90..3-101`, `4-2103`).
- **Pollgroepen** in het hoofd-, expert- en changelog-dashboard komen uit `ADLAR3_POLL_GROUP_DEFINITIONS` via `pollGroupsForAddress()`; sensoren in de snapshot dragen hun groep in `pollGroup`. Er is geen aparte kopie meer in de dashboards.

## Externe capabilities zonder directe Modbus-register mapping

| Capabilitygroep | Voorbeelden | Bron |
|---|---|---|
| Externe meetwaarden | `adlar_external_power`, `adlar_external_flow`, `adlar_external_ambient`, `adlar_external_solar_power`, `adlar_external_solar_radiation`, `adlar_external_wind_speed`, `adlar_external_indoor_temperature` | flow cards / weer- en externe sensorservices |
| Laatst ontvangen externe waarden | `adlar_last_*_received`, `adlar_openmeteo_last_fetch` | flow cards / Open-Meteo service |
| COP/SCOP en energie | `adlar_cop`, `adlar_cop_daily`, `adlar_cop_weekly`, `adlar_cop_monthly`, `adlar_scop`, `adlar_energy_cost_*`, `adlar_external_energy_*` | COP-, SCOP- en energy-tracking services |
| Prijsoptimalisatie | `adlar_energy_price_*`, `adlar_price_forecast_*`, `adlar_cheapest_block_start`, `adlar_price_savings_potential`, `energy_prices_data` | energy price optimizer |
| Adaptieve regeling en gebouwmodel | `adlar_simulated_target`, `adaptive_control_diagnostics`, `cop_optimizer_diagnostics`, `adlar_building_*`, `building_*` | adaptive/building services |
| Defrost-statistiek | `adlar_defrost_count_24h`, `adlar_defrost_minutes_24h`, `defrost_active_power` | defrost learner / flow-card service |
| Verbinding/status | `adlar_connection_status`, `adlar_connection_active`, `adlar_daily_disconnect_count` | service coordinator |

## Aandachtspunten

- **Aan/uit via `4-2101` is experimenteel.** Schrijven gebeurt alleen als de apparaatinstelling "Aan/uit via zonebesturing (experimenteel)" aan staat. Tapwater (`4-2102`) wordt apart geschakeld. Zie `VERIFICATION_TASKS` voor de hardwaretest.
- **`4-2107` wordt overschreven door de eigen regeling.** Zolang de weersafhankelijke regeling (stooklijn) van de warmtepompregelaar (JAN-module) actief is, overschrijft die `4-2107`. Schrijfacties vanuit Homey hebben dan geen blijvend effect.
- **`4-2114` werkt mogelijk niet zonder ruimtethermostaat** (`3-1 = 0`).
- **`3-101` is P81..P96** volgens de officiële map; de HA-YAML die daar de doelmodus leest, zit ernaast. De doelmodus staat in `3-102`.
- **Stille modus niveau 2** is volgens de officiële map alleen voor R290-warmtepompen. De app weigert niveau 2 zolang `3-7` niet R290 (`1`) meldt.
- **Waterflow `3-64`** heeft in de registermetadata unit `m3/h` met schaal x0.1; de Homey capability toont `L/min`. Thermisch vermogen telt alleen bij draaiende compressor, geen ontdooiing en een flow van minimaal `0.3 m3/h`.
- **Geen native input-power register.** `measure_power` wordt afgeleid uit spanning en stroom; voor COP en energie heeft `adlar_external_power` voorrang.
