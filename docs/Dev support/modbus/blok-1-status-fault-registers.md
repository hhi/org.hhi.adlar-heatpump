# Blok 1 — Status & Fault Registers (0x0000–0x0028)

**Toegang:** Read-Only
**Bron:** `lib/modbus/adlar-modbus-registers.ts`
**Type:** 16-bit registers, grotendeels bitmaskers

Elk register is een 16-bit waarde. Bij de bitmasker-registers is elke bit een afzonderlijke status- of foutindicator. Een gezette bit (1) betekent dat de betreffende conditie actief is.

---

## Registeroverzicht

| Adres | Register | Type | Beschrijving |
|-------|----------|------|--------------|
| 0x0000 | Running Status 1 | Bitmask | Bedrijfsstatus unit |
| 0x0001 | Running Status 2 | Bitmask | Sterilisatie / controller status |
| 0x0002 | Fault State 1 | Bitmask | Systeem- en sensorstoringen |
| 0x0003 | Fault State 2 | Bitmask | Beveiligingen en pompstoringen |
| 0x0004 | Fault State 3 | Bitmask | Communicatie- en sensorstoringen |
| 0x0005 | Sys 1 Fault State 1 | Bitmask | Compressor/druk-storingen systeem 1 |
| 0x0006 | Sys 1 Fault State 2 | Bitmask | Druksensor-storingen systeem 1 |
| 0x0007 | Sys 1 Drive Fault 1 | Bitmask | Drive/omvormer-storingen systeem 1 |
| 0x0008 | Sys 1 Drive Fault 2 | Bitmask | Drive-storingen systeem 1 (v2.2) |
| 0x0009 | Sys 1 Drive Fault 3 | Bitmask | Drive-storingen systeem 1 (v2.2) |
| 0x000A–0x0018 | Sys 2–4 Faults | Bitmask | Identieke structuur, +5 offset per systeem |
| 0x0019 | Relay Output Status 1 | Bitmask | Relaisuitgangen (verwarming, ventilator, pompen) |
| 0x001A | Relay Output Status 2 | Bitmask | Relaisuitgangen (compressors, kleppen) |
| 0x001B | Relay Output Status 3 | Bitmask | Relaisuitgangen (v2.2) |
| 0x001C | Relay Output Status 4 | Bitmask | Relaisuitgangen pijp/pomp (v2.2) |
| 0x001D | Switch Port State 1 | Bitmask | Schakelaaringangen |
| 0x001E | Switch Port State 2 | Bitmask | Drukschakelaars (v2.2) |
| 0x001F | Switch Port State 3 | Bitmask | Buffervat AHS-koppeling (v2.2) |
| 0x0027 | Compressor Target Frequency 1 | Waarde (Hz) | Doelfrequentie compressor 1 |
| 0x0028 | Compressor Target Frequency 2 | Waarde (Hz) | Doelfrequentie compressor 2 |

---

## 0x0000 — Running Status 1

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | REFRIGERANT_RECOVERY | Koudemiddel terugwinning |
| 1 | 0x0002 | PRIMARY_ANTIFREEZE | Primaire antivries |
| 2 | 0x0004 | SECONDARY_ANTIFREEZE | Secundaire antivries |
| 3 | 0x0008 | FAULT_ALARM | Storingsalarm |
| 4 | 0x0010 | SYSTEM_OIL_RETURN | Systeem olie terugvoer |
| 8 | 0x0100 | SYSTEM_DEFROST | Ontdooiing actief |
| 12 | 0x1000 | CONST_TEMP_SHUTDOWN | Constante temp bereikt, compressor uit |
| 13 | 0x2000 | FAULT_SHUTDOWN | Uitgeschakeld na storing |
| 14 | 0x4000 | MACHINE_RUN | Unit in bedrijf |
| 15 | 0x8000 | MACHINE_WAIT | Unit wacht op operatie |

## 0x0001 — Running Status 2

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | HIGH_TEMP_STERILIZATION | Legionella cyclus actief |
| 1 | 0x0002 | HIGH_TEMP_STERIL_PRESERVE | Sterilisatie warmhouden |
| 10 | 0x0400 | CONTROLLER_ON_OFF | Controller aan/uit |

## 0x0002 — Fault State 1

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | WRONG_PHASE | Verkeerde fase |
| 1 | 0x0002 | LACK_OF_PHASE | Fase ontbreekt |
| 2 | 0x0004 | WATER_FLOW | Waterstroom fout |
| 3 | 0x0008 | COMMUNICATION | Communicatie fout |
| 4 | 0x0010 | EMERGENCY | Noodstop |
| 5 | 0x0020 | USE_TIME_EXPIRED | Gebruikstijd verlopen |
| 6 | 0x0040 | WATER_TANK_TEMP | Boiler temp sensor fout |
| 7 | 0x0080 | WATER_INLET_TEMP | Inlaat temp sensor fout |
| 8 | 0x0100 | INDOOR_TEMP | Binnentemp sensor fout |
| 9 | 0x0200 | ENVIRONMENTAL_TEMP | Buitentemp sensor fout |
| 10 | 0x0400 | USER_BACKWATER_TEMP | Retour temp sensor fout |
| 11 | 0x0800 | COOLING_OUTLET_LOW | Koeluitlaat te laag |
| 12 | 0x1000 | WATER_LEVEL_SWITCH | Waterstand schakelaar fout |
| 13 | 0x2000 | WATER_OUTLET_TEMP | Uitlaat temp sensor fout |
| 14 | 0x4000 | HEATING_OUTLET_HIGH | Verwarmingsuitlaat te hoog |
| 15 | 0x8000 | EXCESSIVE_TEMP_DIFF | Te groot temp verschil in/uit |

## 0x0003 — Fault State 2

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | ENV_LOW_TEMP_PROTECT | Lage buitentemp beveiliging |
| 6 | 0x0040 | INDOOR_HUMIDITY | Luchtvochtigheid sensor fout |
| 11 | 0x0800 | PHASE_ORDER_DIAL | Fase-volgorde DIP fout |
| 13 | 0x2000 | WATER_PUMP_1_FEEDBACK | Waterpomp 1 terugkoppeling fout |
| 14 | 0x4000 | WATER_PUMP_2_FEEDBACK | Waterpomp 2 terugkoppeling fout |
| 15 | 0x8000 | LOW_WATER_FLOW | Te lage waterstroom |

## 0x0004 — Fault State 3

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | PHASE_SEQ_DISCONNECT | Fase-volgorde verbroken |
| 1 | 0x0002 | EXPANSION_BOARD_COMM | Uitbreidingsboard communicatie |
| 2 | 0x0004 | PLATE_HX_TEMP | Platenwisselaar temp fout |
| 3 | 0x0008 | FAN_MOTOR_1_COMM | Ventilatormotor 1 communicatie |
| 4 | 0x0010 | FAN_MOTOR_2_COMM | Ventilatormotor 2 communicatie |
| 5 | 0x0020 | ONLINE_MODEL_MISMATCH | Model niet overeenkomend |
| 6 | 0x0040 | SOLAR_HW_SENSOR | Solar warm water sensor fout *(v2.2: was "AUX_HW_SENSOR")* |
| 7 | 0x0080 | AHS_TEMP_SENSOR | AHS temp sensor fout *(v2.2: naam verduidelijkt)* |
| 8 | 0x0100 | BUFFER_TANK | Buffervat temp sensor fout |
| 9 | 0x0200 | MAIN_OUTLET_TEMP | Hoofd uitlaat temp fout |
| 12 | 0x1000 | ZONE_1_TEMP_SENSOR | Zone 1 temp sensor fout *(v2.2)* |

---

## Systeem 1 Compressor/Drive Faults (0x0005–0x0009)

> Systemen 2–4 hebben dezelfde structuur op adressen 0x000A–0x0018 (+5 offset per systeem).

### 0x0005 — Sys 1 Fault State 1

| Bit | Masker | Naam | Opmerking |
|-----|--------|------|-----------|
| 0 | 0x0001 | HIGH_PRESSURE_SWITCH | |
| 1 | 0x0002 | LOW_PRESSURE_SWITCH | |
| 2 | 0x0004 | HIGH_PRESSURE_OVER | |
| 3 | 0x0008 | LOW_PRESSURE_OVER | R290: "High Pressure Too Low" = drukval |
| 4 | 0x0010 | EXHAUST_OVER | |
| 5 | 0x0020 | CURRENT_PROTECTION | |
| 6 | 0x0040 | COIL_PRESSURE_HIGH | v2.2: was "COIL_TEMP_OVER"; R290 "Coil Pressure Too High" |
| 7 | 0x0080 | COIL_TEMP_FAULT | |
| 8 | 0x0100 | RETURN_AIR_TEMP_FAULT | Suction temp sensor |
| 9 | 0x0200 | EXHAUST_TEMP_FAULT | |
| 10 | 0x0400 | ECONOMIZER_INLET_FAULT | |
| 11 | 0x0800 | ECONOMIZER_OUTLET_FAULT | |
| 12 | 0x1000 | FAN_DRIVE_COMM | |
| 13 | 0x2000 | DC_FAN_FAULT | |
| 14 | 0x4000 | REFRIG_COIL_TEMP_FAULT | Cooling coil temp sensor |

### 0x0006 — Sys 1 Fault State 2

| Bit | Masker | Naam |
|-----|--------|------|
| 0 | 0x0001 | HIGH_PRESSURE_SENSOR |
| 1 | 0x0002 | LOW_PRESSURE_SENSOR |
| 2 | 0x0004 | MIDDLE_PRESSURE_SWITCH |
| 3 | 0x0008 | COIL_TEMP_OVER_HIGH |
| 4 | 0x0010 | COMP_DRIVE_BOARD_COMM |

### 0x0007 — Sys 1 Drive Fault 1

| Bit | Masker | Naam | Opmerking |
|-----|--------|------|-----------|
| 0 | 0x0001 | IPM_OVERCURRENT | |
| 1 | 0x0002 | COMPRESSOR_DRIVE | |
| 2 | 0x0004 | COMPRESSOR_OVERCURRENT | |
| 3 | 0x0008 | INPUT_VOLTAGE_LOSS | |
| 4 | 0x0010 | IPM_CURRENT_SAMPLING | |
| 5 | 0x0020 | POWER_COMP_OVERHEAT | |
| 6 | 0x0040 | PRECHARGE_FAILED | |
| 7 | 0x0080 | DC_BUS_OVERVOLTAGE | |
| 8 | 0x0100 | DC_BUS_UNDERVOLTAGE | |
| 9 | 0x0200 | AC_INPUT_UNDERVOLTAGE | |
| 10 | 0x0400 | AC_INPUT_OVERVOLTAGE | v2.2: was "OVERCURRENT"; R290 "Overvoltage" |
| 11 | 0x0800 | INPUT_VOLT_SAMPLING | |
| 12 | 0x1000 | DSP_PFC_COMM | |
| 13 | 0x2000 | RADIATOR_TEMP_SENSOR | |
| 14 | 0x4000 | DSP_COMM_BOARD | |
| 15 | 0x8000 | MAIN_CONTROL_BOARD | |

### 0x0008 — Sys 1 Drive Fault 2 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 0 | 0x0001 | COMPRESSOR_OVERCURRENT_ALARM |
| 1 | 0x0002 | WEAK_MAGNETIC_PROTECTION |
| 2 | 0x0004 | PIM_OVERHEAT |
| 3 | 0x0008 | PFC_OVERHEAT |
| 4 | 0x0010 | AC_INPUT_OVERCURRENT |
| 5 | 0x0020 | EEPROM_ERROR |
| 7 | 0x0080 | EEPROM_REFRESH_COMPLETE |
| 8 | 0x0100 | TEMP_SENSING_LIMIT |
| 9 | 0x0200 | AC_UNDERVOLT_FREQ_LIMIT |

### 0x0009 — Sys 1 Drive Fault 3 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 0 | 0x0001 | IPM_OVERHEAT_SHUTDOWN |
| 1 | 0x0002 | COMPRESSOR_MISSING_PHASE |
| 2 | 0x0004 | COMPRESSOR_OVERLOAD |
| 3 | 0x0008 | INPUT_CURRENT_SAMPLING |
| 4 | 0x0010 | PIM_SUPPLY_VOLTAGE |
| 5 | 0x0020 | PRECHARGE_VOLTAGE |
| 6 | 0x0040 | EEPROM_FAILURE |
| 7 | 0x0080 | AC_INPUT_OVERVOLTAGE |
| 8 | 0x0100 | MICROELECTRONICS |
| 9 | 0x0200 | COMPRESSOR_TYPE_CODE |
| 10 | 0x0400 | CURRENT_SAMPLING_OVERCURRENT |

---

## Relaisuitgangen (0x0019–0x001C)

### 0x0019 — Relay Output Status 1

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | HOT_WATER_EHEATING | Warm water elektrische bijverwarming |
| 1 | 0x0002 | FAN_HIGH_WIND | Ventilator hoog toerental |
| 3 | 0x0008 | FAN_LOW_WIND | Ventilator laag toerental |
| 4 | 0x0010 | AC_EHEATING | Airco elektrische bijverwarming |
| 5 | 0x0020 | FLOOR_EHEATING | Vloer elektrische bijverwarming |
| 6 | 0x0040 | MAIN_CIRCULATING_PUMP | Hoofdcirculatiepomp |
| 9 | 0x0200 | ELEC_CRANKSHAFT_HEATING | Krukas verwarming |
| 10 | 0x0400 | CHASSIS_EHEATING | Chassis verwarming |
| 11 | 0x0800 | RETURN_VALVE_PUMP | Retourklep pomp |
| 14 | 0x4000 | AC_SOLENOID_3WAY | Airco 3-weg magneetklep |
| 15 | 0x8000 | FLOOR_SOLENOID_3WAY | Vloer 3-weg magneetklep |

### 0x001A — Relay Output Status 2

| Bit | Masker | Naam | Opmerking |
|-----|--------|------|-----------|
| 0 | 0x0001 | COMPRESSOR_1 | |
| 1 | 0x0002 | LIQUID_INJECTION_1 | |
| 2 | 0x0004 | EVI_EEV_1 | v2.2: was "ENTHALPY_SOLENOID_1" |
| 3 | 0x0008 | FOUR_WAY_VALVE_1 | |
| 4 | 0x0010 | BYPASS_VALVE_1 | v2.2: was "THROTTLE_BYPASS_1" |
| 5 | 0x0020 | FAN_MOTOR_1 | |
| 8 | 0x0100 | AUX_HEATING_PUMP | R290: "Secondary heating pumps" |
| 10 | 0x0400 | COMPRESSOR_2 | |
| 11 | 0x0800 | LIQUID_INJECTION_2 | |
| 12 | 0x1000 | EVI_EEV_2 | |
| 13 | 0x2000 | FOUR_WAY_VALVE_2 | v2.2: was op 0x4000 |

### 0x001B — Relay Output Status 3 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 6 | 0x0040 | EXPANSION_TANK_EHEATING |
| 7 | 0x0080 | HW_HEAT_SOURCE_PUMP |
| 8 | 0x0100 | HEATING_HEAT_SOURCE_PUMP |
| 9 | 0x0200 | AHS_SIGNAL_OUTPUT |

### 0x001C — Relay Output Status 4 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 0 | 0x0001 | PIPE_EHEATING_1 |
| 1 | 0x0002 | PIPE_EHEATING_2 |
| 2 | 0x0004 | AUX_WATER_PUMP |
| 3 | 0x0008 | ZONE_2_WATER_PUMP |
| 4 | 0x0010 | ZONE_1_WATER_PUMP |

---

## Schakelaaringangen (0x001D–0x001F)

### 0x001D — Switch Port State 1

| Bit | Masker | Naam | Beschrijving |
|-----|--------|------|--------------|
| 0 | 0x0001 | SW1 | |
| 1 | 0x0002 | SW2 | |
| 2 | 0x0004 | SW3 | |
| 3 | 0x0008 | SW4 | |
| 4 | 0x0010 | SW5 | |
| 5 | 0x0020 | SW6 | |
| 6 | 0x0040 | SW7 | |
| 7 | 0x0080 | SW8 | |
| 8 | 0x0100 | WATER_FLOW_SWITCH | Waterstroomschakelaar |
| 10 | 0x0400 | HOUSE_HEATING_LINKAGE | Kamerthermostaat |
| 11 | 0x0800 | AUX_HW_LINKAGE | DHW AHS |
| 12 | 0x1000 | LINKAGE_SWITCH | Koppelschakelaar |
| 13 | 0x2000 | EMERGENCY_SWITCH | Noodschakelaar |

### 0x001E — Switch Port State 2 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 7 | 0x0080 | HIGH_PRESSURE_SWITCH_1 |
| 8 | 0x0100 | LOW_PRESSURE_SWITCH_1 |
| 9 | 0x0200 | MIDDLE_PRESSURE_SWITCH_1 |
| 10 | 0x0400 | HIGH_PRESSURE_SWITCH_2 |
| 11 | 0x0800 | LOW_PRESSURE_SWITCH_2 |
| 12 | 0x1000 | MIDDLE_PRESSURE_SWITCH_2 |

### 0x001F — Switch Port State 3 *(v2.2)*

| Bit | Masker | Naam |
|-----|--------|------|
| 5 | 0x0020 | BUFFER_TANK_AHS_LINKAGE |

---

## Compressor doelfrequenties

| Adres | Naam | Eenheid |
|-------|------|---------|
| 0x0027 | Compressor target frequency 1 | Hz |
| 0x0028 | Compressor target frequency 2 | Hz |
