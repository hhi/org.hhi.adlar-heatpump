/**
 * Adlar Castra Aurora II Modbus Register Definities v2.2
 *
 * Compleet register model gebaseerd op:
 * - 5 OEM SolarEast Excel bestanden (status/faults, sensors, control, params, L-params)
 * - Parameters toelichting document (91 P-params + 27 L-params)
 * - Cross-validatie en discrepantie-analyse (v2.1)
 * - R290 HBG Trading Modbus manual (volledige controller documentatie) v2.2
 *
 * Changelog v2.2 (t.o.v. v2.1):
 *
 * KRITIEKE BUG FIXES:
 * - 0x005C (Device Input Power): multiply 1 0.01 (raw/100 = kW)
 * - 0x005B (Device Input Current): multiply 1 0.01 (raw/100 = A, NIET /10!)
 * - 0x0077/0x0079 (B/C Phase Current): multiply 1 0.01
 * - ALLE temperaturen: multiply 1 0.1 (raw/10 = °C, bevestigd R290 doc)
 * - ALLE setpoints: multiply 1 0.1 (consistent met sensors)
 * - Command registers: `isCoil: true` flag moeten via 05H (writeCoil), NIET 06H
 *
 * NIEUWE BLOKKEN:
 * - Version Info (0x03600x0363): firmware, product type, protocol versie
 * - User Commands bitmask (0x0330): register-based alternative voor coils
 * - Coil Address mapping (0x10000x1023): volledige lijst
 * - L27L29 (0x08100x0812): Native DIY stooklijn (k (Tamb+15) + b)
 * - L30L36 (0x08130x0819): Energieboekhouding (E-heater/pomp vermogens)
 *
 * NIEUWE PARAMETERS:
 * - P48 (0x0130): Enable DHW tank temp sensor
 * - P109 (0x016D): Hot water set temp lowest
 * - P111 (0x016F): Heating set temp lowest
 * - P113 (0x0171): Cooling set temp lowest
 * - P151 (0x0197): Return diff - hot water heat source
 * - P152 (0x0198): Return diff - heating heat source
 * - P181 (0x01B5): Defrost selection - evaporate side
 * - P182 (0x01B6): Pipe electric heating option
 * - P254 (0x01FE): Heating medium (water/antivries)
 *
 * BEREIK/OPTIE CORRECTIES:
 * - P00: "Reserve" "T1 Ambient Temperature Sensor enable" (0=en/1=dis)
 * - P03: max 1 noot: R290 zegt 1~2, onze R32 is 0/1
 * - P05: max 2 3 (+3=heating thermostat)
 * - P30: max 2 3 (+3=dew point control)
 * - P68/P70: max 60 80 (fan max freq breder)
 * - P120: naam "Cold start limit" "Anti-condensation function"
 * - P139/P140: "gas boiler" "AHS" (Auxiliary Heat Source)
 * - P150: max 2 3 (+3=temperature control)
 *
 * DEFAULT WAARDEN:
 * - Alle bekende defaults toegevoegd per parameter
 *
 * NIEUWE ENUMS & HELPERS:
 * - DEFROST_SELECTION_OPTIONS, PIPE_EHEATING_OPTIONS
 * - HEATING_MEDIUM_OPTIONS
 * - CURVE_OPTIONS uitgebreid met 11-18 (low temp curves)
 * - UNIT_CONTROL_BITS, LOAD_FORCING_BITS (0x0330/0x0331)
 * - decodeTemperature() helper
 * - protocolSupportsCoils() check
 *
 * Changelog v2.1: zie adlar-modbus-registers-v2.1.ts
 * Changelog v2.0: zie adlar-modbus-registers-v2.1.ts
 */

// ============================================================================
// CONSTANTS & VALIDATION
// ============================================================================

/**
 * Verwacht koelmiddel type voor Adlar Castra Aurora II.
 * Gebruik met P119 om te valideren dat we met het juiste apparaat communiceren.
 * 1=R410A, 2=R32, 3=R290 Aurora II is altijd R32.
 */
export const EXPECTED_REFRIGERANT = 2;

/**
 * DC Fan RPM conversieformule (uit P66 documentatie):
 * Speed [RPM] = frequency [Hz] 15
 * Geldig voor P66-P70 fan frequentie parameters.
 */
export const FAN_RPM_MULTIPLIER = 15;

/**
 * Protocol versie die coil commands (01H/05H) en aparte curve registers ondersteunt.
 * Lees 0x0363 en vergelijk: als protocolVersion >= 130 coils + 0x0313-0x0316.
 */
export const MIN_PROTOCOL_COIL_SUPPORT = 130; // v2.2

/**
 * v2.2: Temperatuurschaalfactor.
 * R290 doc bevestigt: "The state temperature and set temperature all X10 processing,
 * such as 255, representing 25.5"
 *
 * VALIDATIE OP HARDWARE NODIG: Als T7 raw waarde ~350-550 geeft /10 bevestigd.
 * Als T7 raw ~35-55 geeft multiply:1 was correct voor R32 model.
 * Tot validatie: we gebruiken 0.1 (R290 documentatie als referentie).
 */
export const TEMP_MULTIPLY = 0.1; // v2.2

// ADR-050: Configureerbare schaalfactor voor temperatuurregisters
export type TemperatureRegisterScale = 'x1' | 'x10';

export const ADLAR2_TEMPERATURE_REGISTER_ADDRESSES = new Set<number>([
  0x0047, 0x0048, 0x0049,
  0x004A, 0x004B, 0x004C, 0x004D, 0x004E, 0x004F, 0x0050, 0x0051, 0x0052,
  0x0054, 0x0055, 0x0059,
  0x0072, 0x0073, 0x0074, 0x0075,
  0x007C,
  0x00FA, 0x00FB, 0x00FC, 0x00FD, 0x00FE, 0x00FF,
  0x0300, 0x0301, 0x0302, 0x0303,
  0x0306,
  0x0317, 0x0319,
]);

export function isAdlar2TemperatureRegister(
  address: number,
  def: { unit?: string },
): boolean {
  return def.unit === '°C' && ADLAR2_TEMPERATURE_REGISTER_ADDRESSES.has(address);
}

export function decodeTemperatureRaw(raw: number, scale: TemperatureRegisterScale): number {
  return scale === 'x10' ? raw * 0.1 : raw;
}

export function encodeTemperatureRaw(tempC: number, scale: TemperatureRegisterScale): number {
  return scale === 'x10' ? Math.round(tempC * 10) : Math.round(tempC);
}

/** Leid de temperatuurschaal af uit het P119 koelmiddel type. R290 = x10, overige = x1. */
export function refrigerantToTemperatureScale(p119: number): TemperatureRegisterScale {
  return p119 === 3 ? 'x10' : 'x1';
}

/**
 * Canonieke scaling functie voor een register-waarde.
 * Temperatuurregisters (adres in ADLAR2_TEMPERATURE_REGISTER_ADDRESSES) worden geschaald
 * via de runtime tempScale; overige registers via de multiply-factor uit de metadata.
 */
export function scaleRegisterValue(
  address: number,
  raw: number,
  tempScale: TemperatureRegisterScale,
  multiply = 1,
): number {
  if (ADLAR2_TEMPERATURE_REGISTER_ADDRESSES.has(address)) {
    return decodeTemperatureRaw(raw, tempScale);
  }
  return raw * multiply;
}

// ============================================================================
// BLOK 1: STATUS & FAULT REGISTERS (0x00000x0028) Read-Only
// ============================================================================

/** 0x0000 Running Status 1 (16-bit bitmask) */
export const STATUS_1_BITS = {
  REFRIGERANT_RECOVERY: 0x0001, // Bit0: Koudemiddel terugwinning
  PRIMARY_ANTIFREEZE: 0x0002, // Bit1: Primaire antivries
  SECONDARY_ANTIFREEZE: 0x0004, // Bit2: Secundaire antivries
  FAULT_ALARM: 0x0008, // Bit3: Storingsalarm
  SYSTEM_OIL_RETURN: 0x0010, // Bit4: Systeem olie terugvoer
  SYSTEM_DEFROST: 0x0100, // Bit8: Ontdooiing actief
  CONST_TEMP_SHUTDOWN: 0x1000, // Bit12: Constant temp bereikt, compressor uit
  FAULT_SHUTDOWN: 0x2000, // Bit13: Uitgeschakeld na storing
  MACHINE_RUN: 0x4000, // Bit14: Unit in bedrijf
  MACHINE_WAIT: 0x8000, // Bit15: Unit wacht op operatie
} as const;

/** 0x0001 Running Status 2 (16-bit bitmask) */
export const STATUS_2_BITS = {
  HIGH_TEMP_STERILIZATION: 0x0001, // Bit0: Legionella cyclus actief
  HIGH_TEMP_STERIL_PRESERVE: 0x0002, // Bit1: Sterilisatie warmhouden
  CONTROLLER_ON_OFF: 0x0400, // Bit10: Controller aan/uit
} as const;

/** 0x0002 Fault State 1 (16-bit bitmask) */
export const FAULT_1_BITS = {
  WRONG_PHASE: 0x0001, // Bit0: Verkeerde fase
  LACK_OF_PHASE: 0x0002, // Bit1: Fase ontbreekt
  WATER_FLOW: 0x0004, // Bit2: Waterstroom fout
  COMMUNICATION: 0x0008, // Bit3: Communicatie fout
  EMERGENCY: 0x0010, // Bit4: Noodstop
  USE_TIME_EXPIRED: 0x0020, // Bit5: Gebruikstijd verlopen
  WATER_TANK_TEMP: 0x0040, // Bit6: Boiler temp sensor fout
  WATER_INLET_TEMP: 0x0080, // Bit7: Inlaat temp sensor fout
  INDOOR_TEMP: 0x0100, // Bit8: Binnentemp sensor fout
  ENVIRONMENTAL_TEMP: 0x0200, // Bit9: Buitentemp sensor fout
  USER_BACKWATER_TEMP: 0x0400, // Bit10: Retour temp sensor fout
  COOLING_OUTLET_LOW: 0x0800, // Bit11: Koeluitlaat te laag
  WATER_LEVEL_SWITCH: 0x1000, // Bit12: Waterstand schakelaar fout
  WATER_OUTLET_TEMP: 0x2000, // Bit13: Uitlaat temp sensor fout
  HEATING_OUTLET_HIGH: 0x4000, // Bit14: Verwarmingsuitlaat te hoog
  EXCESSIVE_TEMP_DIFF: 0x8000, // Bit15: Te groot temp verschil in/uit
} as const;

/** 0x0003 Fault State 2 (16-bit bitmask) */
export const FAULT_2_BITS = {
  ENV_LOW_TEMP_PROTECT: 0x0001, // Bit0: Lage buitentemp beveiliging
  INDOOR_HUMIDITY: 0x0040, // Bit6: Luchtvochtigheid sensor fout
  PHASE_ORDER_DIAL: 0x0800, // Bit11: Fase-volgorde DIP fout
  WATER_PUMP_1_FEEDBACK: 0x2000, // Bit13: Waterpomp 1 terugkoppeling fout
  WATER_PUMP_2_FEEDBACK: 0x4000, // Bit14: Waterpomp 2 terugkoppeling fout
  LOW_WATER_FLOW: 0x8000, // Bit15: Te lage waterstroom
} as const;

/** 0x0004 Fault State 3 (16-bit bitmask) */
export const FAULT_3_BITS = {
  PHASE_SEQ_DISCONNECT: 0x0001, // Bit0: Fase-volgorde verbroken
  EXPANSION_BOARD_COMM: 0x0002, // Bit1: Uitbreidingsboard communicatie
  PLATE_HX_TEMP: 0x0004, // Bit2: Platenwisselaar temp fout
  FAN_MOTOR_1_COMM: 0x0008, // Bit3: Ventilatormotor 1 communicatie
  FAN_MOTOR_2_COMM: 0x0010, // Bit4: Ventilatormotor 2 communicatie
  ONLINE_MODEL_MISMATCH: 0x0020, // Bit5: Model niet overeenkomend
  SOLAR_HW_SENSOR: 0x0040, // Bit6: Solar warm water sensor fout // v2.2: was "AUX_HW_SENSOR"
  AHS_TEMP_SENSOR: 0x0080, // Bit7: AHS temp sensor fout // v2.2: naam verduidelijkt
  BUFFER_TANK: 0x0100, // Bit8: Buffervat temp sensor fout
  MAIN_OUTLET_TEMP: 0x0200, // Bit9: Hoofd uitlaat temp fout
  ZONE_1_TEMP_SENSOR: 0x1000, // Bit12: Zone 1 temp sensor fout // v2.2
} as const;

/** 0x00050x0009 System 1 Compressor/Drive Faults */
export const SYS1_FAULT_1_BITS = {
  HIGH_PRESSURE_SWITCH: 0x0001, // Bit0
  LOW_PRESSURE_SWITCH: 0x0002, // Bit1
  HIGH_PRESSURE_OVER: 0x0004, // Bit2
  LOW_PRESSURE_OVER: 0x0008, // Bit3 R290: "High Pressure Too Low" = drukval
  EXHAUST_OVER: 0x0010, // Bit4
  CURRENT_PROTECTION: 0x0020, // Bit5
  COIL_PRESSURE_HIGH: 0x0040, // Bit6 v2.2: was "COIL_TEMP_OVER" R290 zegt "Coil Pressure Too High"
  COIL_TEMP_FAULT: 0x0080, // Bit7
  RETURN_AIR_TEMP_FAULT: 0x0100, // Bit8 Suction temp sensor
  EXHAUST_TEMP_FAULT: 0x0200, // Bit9
  ECONOMIZER_INLET_FAULT: 0x0400, // Bit10
  ECONOMIZER_OUTLET_FAULT: 0x0800, // Bit11
  FAN_DRIVE_COMM: 0x1000, // Bit12
  DC_FAN_FAULT: 0x2000, // Bit13
  REFRIG_COIL_TEMP_FAULT: 0x4000, // Bit14 Cooling coil temp sensor
} as const;

export const SYS1_FAULT_2_BITS = {
  HIGH_PRESSURE_SENSOR: 0x0001,
  LOW_PRESSURE_SENSOR: 0x0002,
  MIDDLE_PRESSURE_SWITCH: 0x0004,
  COIL_TEMP_OVER_HIGH: 0x0008,
  COMP_DRIVE_BOARD_COMM: 0x0010,
} as const;

export const SYS1_DRIVE_FAULT_1_BITS = {
  IPM_OVERCURRENT: 0x0001,
  COMPRESSOR_DRIVE: 0x0002,
  COMPRESSOR_OVERCURRENT: 0x0004,
  INPUT_VOLTAGE_LOSS: 0x0008,
  IPM_CURRENT_SAMPLING: 0x0010,
  POWER_COMP_OVERHEAT: 0x0020,
  PRECHARGE_FAILED: 0x0040,
  DC_BUS_OVERVOLTAGE: 0x0080,
  DC_BUS_UNDERVOLTAGE: 0x0100,
  AC_INPUT_UNDERVOLTAGE: 0x0200,
  AC_INPUT_OVERVOLTAGE: 0x0400, // v2.2: was "OVERCURRENT" R290 zegt "Overvoltage"
  INPUT_VOLT_SAMPLING: 0x0800,
  DSP_PFC_COMM: 0x1000,
  RADIATOR_TEMP_SENSOR: 0x2000,
  DSP_COMM_BOARD: 0x4000,
  MAIN_CONTROL_BOARD: 0x8000,
} as const;

export const SYS1_DRIVE_FAULT_2_BITS = { // v2.2
  COMPRESSOR_OVERCURRENT_ALARM: 0x0001,
  WEAK_MAGNETIC_PROTECTION: 0x0002,
  PIM_OVERHEAT: 0x0004,
  PFC_OVERHEAT: 0x0008,
  AC_INPUT_OVERCURRENT: 0x0010,
  EEPROM_ERROR: 0x0020,
  EEPROM_REFRESH_COMPLETE: 0x0080,
  TEMP_SENSING_LIMIT: 0x0100,
  AC_UNDERVOLT_FREQ_LIMIT: 0x0200,
} as const;

export const SYS1_DRIVE_FAULT_3_BITS = { // v2.2
  IPM_OVERHEAT_SHUTDOWN: 0x0001,
  COMPRESSOR_MISSING_PHASE: 0x0002,
  COMPRESSOR_OVERLOAD: 0x0004,
  INPUT_CURRENT_SAMPLING: 0x0008,
  PIM_SUPPLY_VOLTAGE: 0x0010,
  PRECHARGE_VOLTAGE: 0x0020,
  EEPROM_FAILURE: 0x0040,
  AC_INPUT_OVERVOLTAGE: 0x0080,
  MICROELECTRONICS: 0x0100,
  COMPRESSOR_TYPE_CODE: 0x0200,
  CURRENT_SAMPLING_OVERCURRENT: 0x0400,
} as const;

/** 0x0019 Relay Output Status 1 */
export const RELAY_1_BITS = {
  HOT_WATER_EHEATING: 0x0001, // Bit0
  FAN_HIGH_WIND: 0x0002, // Bit1
  FAN_LOW_WIND: 0x0008, // Bit3
  AC_EHEATING: 0x0010, // Bit4
  FLOOR_EHEATING: 0x0020, // Bit5
  MAIN_CIRCULATING_PUMP: 0x0040, // Bit6
  ELEC_CRANKSHAFT_HEATING: 0x0200, // Bit9
  CHASSIS_EHEATING: 0x0400, // Bit10
  RETURN_VALVE_PUMP: 0x0800, // Bit11
  AC_SOLENOID_3WAY: 0x4000, // Bit14
  FLOOR_SOLENOID_3WAY: 0x8000, // Bit15
} as const;

/** 0x001A Relay Output Status 2 */
export const RELAY_2_BITS = {
  COMPRESSOR_1: 0x0001, // Bit0
  LIQUID_INJECTION_1: 0x0002, // Bit1
  EVI_EEV_1: 0x0004, // Bit2 v2.2: was "ENTHALPY_SOLENOID_1"
  FOUR_WAY_VALVE_1: 0x0008, // Bit3
  BYPASS_VALVE_1: 0x0010, // Bit4 v2.2: was "THROTTLE_BYPASS_1"
  FAN_MOTOR_1: 0x0020, // Bit5
  AUX_HEATING_PUMP: 0x0100, // Bit8 R290: "Secondary heating pumps"
  COMPRESSOR_2: 0x0400, // Bit10
  LIQUID_INJECTION_2: 0x0800, // Bit11
  EVI_EEV_2: 0x1000, // Bit12
  FOUR_WAY_VALVE_2: 0x2000, // Bit13 v2.2: was at 0x4000
} as const;

/** 0x001B Relay Output Status 3 */
export const RELAY_3_BITS = { // v2.2
  EXPANSION_TANK_EHEATING: 0x0040, // Bit6
  HW_HEAT_SOURCE_PUMP: 0x0080, // Bit7
  HEATING_HEAT_SOURCE_PUMP: 0x0100, // Bit8
  AHS_SIGNAL_OUTPUT: 0x0200, // Bit9
} as const;

/** 0x001C Relay Output Status 4 */
export const RELAY_4_BITS = { // v2.2
  PIPE_EHEATING_1: 0x0001, // Bit0
  PIPE_EHEATING_2: 0x0002, // Bit1
  AUX_WATER_PUMP: 0x0004, // Bit2
  ZONE_2_WATER_PUMP: 0x0008, // Bit3
  ZONE_1_WATER_PUMP: 0x0010, // Bit4
} as const;

/** 0x001D Switch Port State 1 */
export const SWITCH_1_BITS = {
  SW1: 0x0001,
  SW2: 0x0002,
  SW3: 0x0004,
  SW4: 0x0008,
  SW5: 0x0010,
  SW6: 0x0020,
  SW7: 0x0040,
  SW8: 0x0080,
  WATER_FLOW_SWITCH: 0x0100, // Bit8
  HOUSE_HEATING_LINKAGE: 0x0400, // Bit10 Room Thermostat
  AUX_HW_LINKAGE: 0x0800, // Bit11 DHW AHS
  LINKAGE_SWITCH: 0x1000, // Bit12
  EMERGENCY_SWITCH: 0x2000, // Bit13
} as const;

/** 0x001E Switch Port State 2 */
export const SWITCH_2_BITS = { // v2.2
  HIGH_PRESSURE_SWITCH_1: 0x0080, // Bit7
  LOW_PRESSURE_SWITCH_1: 0x0100, // Bit8
  MIDDLE_PRESSURE_SWITCH_1: 0x0200, // Bit9
  HIGH_PRESSURE_SWITCH_2: 0x0400, // Bit10
  LOW_PRESSURE_SWITCH_2: 0x0800, // Bit11
  MIDDLE_PRESSURE_SWITCH_2: 0x1000, // Bit12
} as const;

/** 0x001F Switch Port State 3 */
export const SWITCH_3_BITS = { // v2.2
  BUFFER_TANK_AHS_LINKAGE: 0x0020, // Bit5
} as const;

/**
 * Alle status/fault register adressen voor batched reading
 */
export const STATUS_REGISTER_MAP = {
  runningStatus1: { address: 0x0000, bits: STATUS_1_BITS },
  runningStatus2: { address: 0x0001, bits: STATUS_2_BITS },
  faultState1: { address: 0x0002, bits: FAULT_1_BITS },
  faultState2: { address: 0x0003, bits: FAULT_2_BITS },
  faultState3: { address: 0x0004, bits: FAULT_3_BITS },
  sys1FaultState1: { address: 0x0005, bits: SYS1_FAULT_1_BITS },
  sys1FaultState2: { address: 0x0006, bits: SYS1_FAULT_2_BITS },
  sys1DriveFault1: { address: 0x0007, bits: SYS1_DRIVE_FAULT_1_BITS },
  sys1DriveFault2: { address: 0x0008, bits: SYS1_DRIVE_FAULT_2_BITS }, // v2.2
  sys1DriveFault3: { address: 0x0009, bits: SYS1_DRIVE_FAULT_3_BITS }, // v2.2
  // 0x000A0x0018: Sys 24 faults (identieke structuur, +5 offset per systeem)
  relayOutput1: { address: 0x0019, bits: RELAY_1_BITS },
  relayOutput2: { address: 0x001A, bits: RELAY_2_BITS },
  relayOutput3: { address: 0x001B, bits: RELAY_3_BITS }, // v2.2
  relayOutput4: { address: 0x001C, bits: RELAY_4_BITS }, // v2.2
  switchPortState1: { address: 0x001D, bits: SWITCH_1_BITS },
  switchPortState2: { address: 0x001E, bits: SWITCH_2_BITS }, // v2.2
  switchPortState3: { address: 0x001F, bits: SWITCH_3_BITS }, // v2.2
  compressorTargetFreq1: { address: 0x0027, name: 'Compressor target frequency 1', unit: 'Hz' },
  compressorTargetFreq2: { address: 0x0028, name: 'Compressor target frequency 2', unit: 'Hz' },
} as const;

// ============================================================================
// BLOK 2: SENSOR REGISTERS (0x00400x00FF) Read-Only
//
// v2.2 SCHAALFACTORCORRECTIES:
// - Alle temperaturen: multiply 0.1 (raw 10, bijv. 255 = 25.5°C)
// - 0x005B (Unit Current): multiply 0.01 (raw/100) WAS 1!
// - 0x005C (Unit Power): multiply 0.01 (raw/100) WAS 1!
// - 0x0077/0x0079 (Phase Current): multiply 0.01 WAS 1!
// - 0x0045/0x0046 (Comp Current): multiply 0.1 was al correct
// ============================================================================

export const SENSOR_REGISTERS = {
  // --- Compressor & Ventilator ---
  compressorRunningFreq: {
    address: 0x0040, unit: 'Hz', multiply: 1, name: 'Compressor Running Frequency',
  },
  fanRunningSpeed: {
    address: 0x0041, unit: 'RPM', multiply: 1, name: 'Fan Running Speed',
  },
  eevOpenStep: {
    address: 0x0042, unit: 'P', multiply: 1, name: 'EEV Open Step',
  },
  eviValveOpenStep: {
    address: 0x0043, unit: 'P', multiply: 1, name: 'EVI Valve Open Step',
  },

  // --- Elektrisch (Compressor niveau) ---
  //
  // ⚠️  KALIBRATIE NOTEN (bron: marnie/Tweakers, empirisch gemeten):
  //
  // acInputVoltage (0x0044): de sensor rapporteert ~1% te hoog.
  //   Correctie: multiply 0.99 i.p.v. 1.0 (device-specifiek, valideer per unit).
  //
  // acInputCurrent (0x0045): NON-LINEAIRE sensor — zonder correctie zijn
  //   COP-berekeningen 15-20% te laag bij laag vermogen!
  //   De calibrationCurve hieronder is marnie's empirisch bepaalde curve.
  //   Gebruik interpolatie: zoek het bracket [raw[i], raw[i+1]] en interpoleer.
  //   Voorbeeld implementatie: zie interpolateCalibration() in adlar-modbus-service.ts
  //
  acInputVoltage: {
    address: 0x0044,
    unit: 'V',
    multiply: 0.99,
    name: 'AC Input Voltage',
    desc: 'Kalibratie: 0.99 correctiefactor (marnie). Raw waarde is ~1% te hoog.',
  },
  acInputCurrent: {
    address: 0x0045,
    unit: 'A',
    multiply: 0.1,
    name: 'AC Input Current',
    desc: 'NON-LINEAIRE sensor — gebruik calibrationCurve voor nauwkeurige COP-berekening',
    // Kalibratie datapunten (bron: marnie/Tweakers, raw=na /10 schaling, actual=gemeten)
    // raw → actual (A)    fout zonder correctie
    // 4.0 → 2.9           38%
    // 7.0 → 5.5           27%
    // 10.0 → 8.5          18%
    // Fout neemt af bij hogere stromen (sensor gedraagt zich lineairder >10A)
    calibrationCurve: [
      { raw: 0.0, actual: 0.0 },
      { raw: 1.0, actual: 1.0 },
      { raw: 2.0, actual: 2.0 },
      { raw: 3.0, actual: 2.5 },
      { raw: 4.0, actual: 2.9 },
      { raw: 5.0, actual: 3.4 },
      { raw: 6.0, actual: 4.6 },
      { raw: 7.0, actual: 5.5 },
      { raw: 8.0, actual: 6.8 },
      { raw: 9.0, actual: 7.8 },
      { raw: 10.0, actual: 8.5 },
      { raw: 11.0, actual: 9.0 },
    ] as Array<{ raw: number; actual: number }>,
  },
  compressorPhaseCurrent: {
    address: 0x0046, unit: 'A', multiply: 0.1, name: 'Compressor Phase Current',
  }, // raw/10

  // --- Temperaturen (ALL 10: raw 255 = 25.5°C) ---
  compressorIpmTemp: {
    address: 0x0047, unit: '°C', multiply: 0.1, name: 'Compressor IPM Temp',
  }, // v2.2: was 1
  highPressureSatTemp: {
    address: 0x0048, unit: '°C', multiply: 0.1, name: 'High Pressure Saturation Temp',
  }, // v2.2
  lowPressureSatTemp: {
    address: 0x0049, unit: '°C', multiply: 0.1, name: 'Low Pressure Saturation Temp',
  }, // v2.2
  ambientTempT1: {
    address: 0x004A, unit: '°C', multiply: 0.1, name: 'Ambient Temp (T1)',
  }, // v2.2
  outerCoilTempT2: {
    address: 0x004B, unit: '°C', multiply: 0.1, name: 'Outer Coil Temp (T2)',
  }, // v2.2
  innerCoilTempT3: {
    address: 0x004C, unit: '°C', multiply: 0.1, name: 'Inner Coil Temp (T3)',
  }, // v2.2
  suctionTempT4: {
    address: 0x004D, unit: '°C', multiply: 0.1, name: 'Suction Temp (T4)',
  }, // v2.2
  exhaustTempT5: {
    address: 0x004E, unit: '°C', multiply: 0.1, name: 'Exhaust Temp (T5)',
  }, // v2.2
  waterInletTempT6: {
    address: 0x004F, unit: '°C', multiply: 0.1, name: 'Water Inlet Temp (T6)',
  }, // v2.2
  waterOutletTempT7: {
    address: 0x0050, unit: '°C', multiply: 0.1, name: 'Water Outlet Temp (T7)',
  }, // v2.2
  economizerInletT8: {
    address: 0x0051, unit: '°C', multiply: 0.1, name: 'Economizer Inlet Temp (T8)',
  }, // v2.2
  economizerOutletT9: {
    address: 0x0052, unit: '°C', multiply: 0.1, name: 'Economizer Outlet Temp (T9)',
  }, // v2.2

  // --- Extra sensoren ---
  deviceToolingNo: {
    address: 0x0053,
    unit: '',
    multiply: 1,
    name: 'Device Tooling No',
    desc: 'Query Parameter 20: Machine tool version',
    min: 0,
    max: 120,
  },
  waterTankTemp: {
    address: 0x0054, unit: '°C', multiply: 0.1, name: 'DHW Tank Temperature',
  }, // v2.2: was 1 + naam
  plateHxExhaustTemp: {
    address: 0x0055, unit: '°C', multiply: 0.1, name: 'Plate HX Exhaust Temp',
  }, // v2.2: naam
  driveManufacturer: {
    address: 0x0056, unit: '', multiply: 1, name: 'Drive Manufacturer Code',
  },
  waterPumpSpeedPWM: {
    address: 0x0057, unit: '%', multiply: 1, name: 'Water Pump Speed PWM',
  },
  waterFlow: {
    address: 0x0058, unit: 'L/min', multiply: 1, name: 'Water Flow',
  },
  dhwReturnWaterTemp: {
    address: 0x0059, unit: '°C', multiply: 0.1, name: 'DHW Return Water Temp',
  }, // v2.2: was 1 + naam

  // --- Unit niveau (vs compressor niveau) ---
  deviceInputVoltage: {
    address: 0x005A, unit: 'V', multiply: 1, name: 'Unit Input Voltage',
  },
  deviceInputCurrent: {
    address: 0x005B, unit: 'A', multiply: 0.01, name: 'Unit Input Current',
  }, // v2.2: was 1 0.01
  deviceInputPower: {
    address: 0x005C, unit: 'kW', multiply: 0.01, name: 'Unit Input Power',
  }, // v2.2: was 1 0.01
  totalEnergyConsumption: {
    address: 0x005D, unit: 'kWh', multiply: 1, name: 'Total Energy Consumption',
  },

  // --- Auxiliary & Buffer ---
  solarWaterHeaterTemp: {
    address: 0x0072, unit: '°C', multiply: 0.1, name: 'Solar Water Heater Temp',
  }, // v2.2: naam R290 doc
  zone2Temp: {
    address: 0x0073, unit: '°C', multiply: 0.1, name: 'Zone 2 Temp',
  }, // v2.2: naam R290 doc
  bufferTankTemp: {
    address: 0x0074, unit: '°C', multiply: 0.1, name: 'Buffer Tank Temp',
  }, // v2.2: was 1
  totalWaterOutletTemp: {
    address: 0x0075, unit: '°C', multiply: 0.1, name: 'Total Water Outlet Temp',
  }, // v2.2: was 1

  // --- 3-fase metingen ---
  bPhaseVoltage: {
    address: 0x0076, unit: 'V', multiply: 1, name: 'B Phase Input Voltage',
  },
  bPhaseCurrent: {
    address: 0x0077, unit: 'A', multiply: 0.01, name: 'B Phase Input Current',
  }, // v2.2: was 1 0.01
  cPhaseVoltage: {
    address: 0x0078, unit: 'V', multiply: 1, name: 'C Phase Input Voltage',
  },
  cPhaseCurrent: {
    address: 0x0079, unit: 'A', multiply: 0.01, name: 'C Phase Input Current',
  }, // v2.2: was 1 0.01

  // --- Smart Grid & Zones ---
  smartGridStatus: {
    address: 0x007A, unit: '', multiply: 1, name: 'Smart Grid Status',
  },
  zone2MixingValve: {
    address: 0x007B, unit: '%', multiply: 1, name: 'Zone 2 Mixing Valve Opening',
  },
  zone1MixingTemp: {
    address: 0x007C, unit: '°C', multiply: 0.1, name: 'Zone 1 Mixing Temp',
  }, // v2.2: was 1
  zone1MixingValve: {
    address: 0x007D, unit: '%', multiply: 1, name: 'Zone 1 Mixing Valve Opening',
  },

  // --- Actieve limieten (berekend door controller) ---
  heatingTempUpperLimit: {
    address: 0x00FA, unit: '°C', multiply: 0.1, name: 'Heating Temp Upper Limit',
  }, // v2.2: was 1
  heatingTempLowerLimit: {
    address: 0x00FB, unit: '°C', multiply: 0.1, name: 'Heating Temp Lower Limit',
  }, // v2.2
  hotWaterTempUpperLimit: {
    address: 0x00FC, unit: '°C', multiply: 0.1, name: 'Hot Water Temp Upper Limit',
  }, // v2.2
  hotWaterTempLowerLimit: {
    address: 0x00FD, unit: '°C', multiply: 0.1, name: 'Hot Water Temp Lower Limit',
  }, // v2.2
  coolingTempUpperLimit: {
    address: 0x00FE, unit: '°C', multiply: 0.1, name: 'Cooling Temp Upper Limit',
  }, // v2.2
  coolingTempLowerLimit: {
    address: 0x00FF, unit: '°C', multiply: 0.1, name: 'Cooling Temp Lower Limit',
  }, // v2.2
} as const;

// ============================================================================
// BLOK 3: USER CONTROL REGISTERS (0x03000x0319) Read-Write
//
// v2.2: setpoint multiply 0.1 (temperaturen 10 in registers)
// ============================================================================

export const CONTROL_REGISTERS = {
  // --- Temperatuur setpoints (10 in register) ---
  tempSetCooling: {
    address: 0x0300, unit: '°C', min: 7, max: 25, default: 12, multiply: 0.1, name: 'Cooling Set Temperature',
  }, // v2.2: multiply + default
  tempSetHeating: {
    address: 0x0301, unit: '°C', min: 15, max: 60, default: 55, multiply: 0.1, name: 'Heating Set Temperature',
  }, // v2.2
  tempSetHotWater: {
    address: 0x0302, unit: '°C', min: 20, max: 75, default: 55, multiply: 0.1, name: 'Hot Water Set Temperature',
  }, // v2.2: max 6575 (R290)
  tempSetFloorHeating: {
    address: 0x0303, unit: '°C', min: 20, max: 60, default: 50, multiply: 0.1, name: 'Floor Heating Set Temperature',
  }, // v2.2

  // --- Modus & Bediening ---
  mode: { address: 0x0304, name: 'Set Mode', desc: '0=Cooling, 1=Heating, 2=Hot Water, 3=Floor Heating, 4=Hot Water+Cooling, 5=Hot Water+Heating, 6=Reserve, 7=Hot Water+Floor Heating' },
  mainSwitch: { address: 0x0305, name: 'On/Off', desc: '0=OFF, 1=ON' },
  indoorTempSetpoint: {
    address: 0x0306, unit: '°C', multiply: 0.1, name: 'Indoor Temperature Set Point',
  }, // v2.2: multiply
  runningMode: { address: 0x0307, name: 'User Function Mode', desc: '0=Standard, 1=Powerful, 2=Silent' },

  // --- Stooklijnen (oud formaat: high/low byte pairs) ---
  heatingFloorCurveLegacy: {
    address: 0x030C,
    name: 'Heating/Floor Curve (legacy)',
    desc: 'High byte = floor curve, Low byte = heating curve. Protocol < 130',
  }, // v2.2
  coolingHwCurveLegacy: {
    address: 0x030D,
    name: 'Cooling/HW Curve (legacy)',
    desc: 'High byte = cooling curve, Low byte = hot water curve. Protocol < 130',
  }, // v2.2

  // --- Stooklijnen (nieuw formaat: protocol 130) ---
  coolingCurve: {
    address: 0x0313,
    min: 0,
    max: 18,
    name: 'Cooling Curve Setting',
    desc: '0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130',
  }, // v2.2: max 818
  heatingCurve: {
    address: 0x0314,
    min: 0,
    max: 18,
    name: 'Heating Curve Setting',
    desc: '0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130',
  }, // v2.2
  hotWaterCurve: {
    address: 0x0315,
    min: 0,
    max: 4,
    name: 'Hot Water Curve Setting',
    desc: '0=off, 1-4=curve. Vereist protocol  130',
  },
  floorHeatingCurve: {
    address: 0x0316,
    min: 0,
    max: 18,
    name: 'Floor Heating Curve Setting',
    desc: '0=off, 1-8=high temp, 11-18=low temp. Vereist protocol 130',
  }, // v2.2

  // --- Dual Zone Temperatuur ---
  zone2Temp: {
    address: 0x0317, unit: '°C', multiply: 0.1, name: 'Zone 2 Temperature',
  }, // v2.2
  zone1Temp: {
    address: 0x0319, unit: '°C', multiply: 0.1, name: 'Zone 1 Temperature',
  }, // v2.2
} as const;

// ============================================================================
// BLOK 4: P-PARAMETERS (0x01000x020B) Read-Write
// Adresformule: P(n) 0x0100 + n
//
// v2.2: Default waarden toegevoegd waar bekend (bron: R290 doc + OEM Excel)
// ============================================================================

export const P_PARAMETERS = {

  // -------------------------------------------------------------------------
  // Protection Switches (P00P10)
  // -------------------------------------------------------------------------
  P00_ambientTempSensor: {
    address: 0x0100,
    min: 0,
    max: 1,
    default: 0,
    name: 'T1 Ambient temp sensor',
    desc: '0=enable, 1=disable',
  }, // v2.2: was "Reserve"
  P01_highVoltageSwitch: {
    address: 0x0101, min: 0, max: 1, default: 0, name: 'High voltage switch', desc: '0=enable, 1=disable',
  },
  P02_lowPressureSwitch: {
    address: 0x0102, min: 0, max: 1, default: 0, name: 'Low pressure switch', desc: '0=enable, 1=disable',
  },
  P03_waterFlowSwitch: {
    address: 0x0103,
    min: 0,
    max: 1,
    default: 1,
    name: 'Water flow switch',
    desc: '0=enable, 1=disable. NB: R290 doc zegt range 1~2, Adlar R32 is 0/1',
  }, // v2.2: default
  P04_thermalOverload: {
    address: 0x0104, min: 0, max: 1, default: 0, name: 'Thermal overload protection', desc: '0=enable, 1=disable',
  },
  P05_linkageSwitch: {
    address: 0x0105,
    min: 0,
    max: 3,
    default: 0,
    name: 'Linkage switch (host)',
    desc: '0=enable, 1=disable, 2=thermostatic, 3=heating thermostat',
  }, // v2.2: max 23
  P06_fanType: {
    address: 0x0106, min: 0, max: 2, default: 1, name: 'Fan type', desc: '0=AC, 1=DC, 2=EC',
  },
  P07_highVoltageLock: {
    address: 0x0107, min: 0, max: 1, default: 0, name: 'High voltage lock', desc: '0=3 locks, 1=no lock',
  },
  P08_lowVoltageLock: {
    address: 0x0108, min: 0, max: 1, default: 0, name: 'Low voltage lock', desc: '0=3 locks, 1=no lock',
  },
  P09_exhaustLock: {
    address: 0x0109, min: 0, max: 1, default: 0, name: 'Exhaust lock', desc: '0=3 locks, 1=no lock',
  },
  P10_waterFlowLock: {
    address: 0x010A, min: 0, max: 1, default: 0, name: 'Water flow lock', desc: '0=3 locks, 1=no lock',
  },

  // -------------------------------------------------------------------------
  // Protection Values (P11P16) Met gekoppelde freq-limit parameters
  // -------------------------------------------------------------------------
  P11_highPressureProtect: {
    address: 0x010B, min: 40, max: 150, unit: '°C', name: 'High pressure protection value',
  },
  P12_highPressureFreqLimit: {
    address: 0x010C, min: 40, max: 150, unit: '°C', name: 'High pressure freq limit', desc: 'Must be P11-5',
  }, // v2.2: max 70150
  P13_lowPressureProtect: {
    address: 0x010D, min: -50, max: -10, unit: '°C', name: 'Low pressure protection value',
  },
  P14_lowPressureFreqLimit: {
    address: 0x010E, min: -50, max: -10, unit: '°C', name: 'Low pressure freq limit',
  },
  P15_exhaustTempProtect: {
    address: 0x010F, min: 100, max: 130, unit: '°C', name: 'Exhaust temp protection',
  },
  P16_exhaustTempFreqLimit: {
    address: 0x0110, min: 90, max: 120, unit: '°C', name: 'Exhaust temp freq limit', desc: 'Must be  P15-10',
  },

  // -------------------------------------------------------------------------
  // Fan Speed Control (P17P20) Snelheidsverhoging/-verlaging per modus
  // -------------------------------------------------------------------------
  P17_coolingFanSpeedIncrease: {
    address: 0x0111, min: 0, max: 60, unit: '°C', name: 'Cooling fan speed-up value',
  },
  P18_coolingFanSpeedReduction: {
    address: 0x0112, min: 0, max: 60, unit: '°C', name: 'Cooling fan speed-down value',
  },
  P19_heatingFanSpeedReduction: {
    address: 0x0113, min: 0, max: 60, unit: '°C', name: 'Heating fan speed-down value',
  },
  P20_heatingFanSpeedIncrease: {
    address: 0x0114, min: 0, max: 60, unit: '°C', name: 'Heating fan speed-up value',
  },

  // -------------------------------------------------------------------------
  // Temperature Compensation & Limits (P21P27)
  // -------------------------------------------------------------------------
  P21_lowTempProhibitStart: {
    address: 0x0115, min: -40, max: -10, default: -15, unit: '°C', name: 'Low temp unit prohibit start',
  },
  P22_eHeatingStartAmb: {
    address: 0x0116,
    min: -15,
    max: 40,
    default: 0,
    unit: '°C',
    name: 'E-heating start ambient',
    desc: 'If Ambient Temp P22 enter defrost. R290 doc noemt dit ook "Unit no starting" (misleidend)',
  }, // v2.2: default + desc
  P23_excessiveTempDiff: {
    address: 0x0117, min: 10, max: 30, default: 20, unit: '°C', name: 'Excessive temp diff alarm',
  },
  P24_returnWaterCompensation: {
    address: 0x0118,
    min: -10,
    max: 10,
    default: 0,
    unit: '°C',
    name: 'Return water compensation',
    desc: 'Sensor offset correctie. Adlar Aurora II: T6 (return/inlet)',
  }, // v2.2: naam
  P25_outletWaterCompensation: {
    address: 0x0119,
    min: -10,
    max: 10,
    default: 0,
    unit: '°C',
    name: 'Outlet water compensation',
    desc: 'Sensor offset correctie. Adlar Aurora II: T7 (outlet/discharge)',
  }, // v2.2: naam
  P26_acReturnDiff: {
    address: 0x011A, min: 0, max: 10, default: 5, unit: '°C', name: 'H&C Hysteresis return differential value',
  }, // v2.2: default
  P27_floorReturnDiff: {
    address: 0x011B, min: 0, max: 10, default: 5, unit: '°C', name: 'Floor heating return differential value',
  }, // v2.2: default

  // -------------------------------------------------------------------------
  // Pump & Antifreeze (P28P29)
  // -------------------------------------------------------------------------
  P28_pumpAtShutdown: {
    address: 0x011C,
    min: 0,
    max: 4,
    default: 0,
    name: 'Pump mode at shutdown',
    desc: '0=keep running, 1=stop, 2=cooling only, 3=AC/heating only, 4=floor only',
  }, // v2.2: default
  P29_antifreezePumpTime: {
    address: 0x011D, min: 0, max: 10, default: 2, unit: 'min', name: 'Antifreeze pump running time',
  }, // v2.2: default

  // -------------------------------------------------------------------------
  // Defrost Parameters (P30P36, P174)
  // -------------------------------------------------------------------------
  P30_defrostMode: {
    address: 0x011E,
    min: 0,
    max: 3,
    default: 0,
    name: 'Defrost mode',
    desc: '0=smart, 1=timing, 2=fast, 3=dew point',
  }, // v2.2: max 23
  P31_defrostAccumThreshold: {
    address: 0x011F, min: 0, max: 120, default: 45, name: 'Defrost accumulated threshold',
  }, // v2.2: default
  P32_defrostEntryCoilTemp: {
    address: 0x0120, min: -30, max: 0, default: -5, unit: '°C', name: 'Defrost entry coil temp',
  }, // v2.2: default
  P33_defrostEntryDiff1: {
    address: 0x0121, min: 0, max: 20, default: 9, unit: '°C', name: 'Defrost entry temp diff 1',
  }, // v2.2: default
  P34_defrostEntryDiff2: {
    address: 0x0122, min: 0, max: 20, default: 7, unit: '°C', name: 'Defrost entry temp diff 2',
  }, // v2.2: default
  P35_defrostMaxTime: {
    address: 0x0123, min: 0, max: 30, default: 10, unit: 'min', name: 'Max defrost time',
  }, // v2.2: default
  P36_defrostExitCoilTemp: {
    address: 0x0124, min: 0, max: 30, default: 12, unit: '°C', name: 'Defrost exit coil temp',
  }, // v2.2: default
  P174_defrostOpening: {
    address: 0x01AE, min: 0, max: 480, default: 450, unit: 'P', name: 'Defrost valve opening',
  }, // v2.2: default

  // -------------------------------------------------------------------------
  // Shutdown Mode (P37)
  // -------------------------------------------------------------------------
  P37_shutdownMode: {
    address: 0x0125,
    min: 0,
    max: 2,
    default: 0,
    name: 'Shutdown mode (aka "Darwin")',
    desc: '0=Smart (unit decides), 1=Direct/Darwin (immediate off at target), 2=Refrig Smart',
  },

  // -------------------------------------------------------------------------
  // Sensor & Communication Settings (P39, P43P45, P48)
  // -------------------------------------------------------------------------
  P39_pressureSensor: {
    address: 0x0127, min: 0, max: 1, default: 0, name: 'Pressure sensor settings', desc: '0=enable, 1=disable',
  },
  P43_mvSwitch: {
    address: 0x012B, min: 0, max: 1, default: 0, name: 'MV switch setting', desc: '0=disable, 1=enable',
  },
  P44_waterFlowFailDetect: {
    address: 0x012C, min: 0, max: 1, default: 0, name: 'Water flow switch failure detect', desc: '0=enable, 1=disable',
  },
  P45_commAddress: {
    address: 0x012D, min: 1, max: 16, default: 1, name: 'Modbus slave address',
  },
  P48_dhwTankTempSensor: {
    address: 0x0130,
    min: 0,
    max: 1,
    default: 0,
    name: 'Enable DHW tank temp sensor',
    desc: '0=disable, 1=enable',
  }, // v2.2

  // -------------------------------------------------------------------------
  // Frequency Control Cooling (P50P53)
  // -------------------------------------------------------------------------
  P50_coolingFreqConstantA: {
    address: 0x0132, min: -100, max: 100, name: 'Cooling target freq constant A',
  }, // v2.2
  P51_coolingMinFreq: {
    address: 0x0133, min: 15, max: 60, unit: 'Hz', name: 'Cooling min freq',
  },
  P52_coolingTargetFreqUpper: {
    address: 0x0134, min: 40, max: 120, unit: 'Hz', name: 'Cooling target freq upper',
  },
  P53_coolingTargetFreqLower: {
    address: 0x0135, min: 15, max: 120, unit: 'Hz', name: 'Cooling target freq lower', desc: 'Must be  P52',
  },

  // -------------------------------------------------------------------------
  // Frequency Control Heating (P54P59)
  //
  // COP-OPTIMALISATIE: P57/P58/P59 bepalen de minimale compressorfrequentie
  // afhankelijk van buitentemperatuur. Lagere min-freq bij hogere buitentemp
  // geeft beter COP. Dit zijn de registers voor adaptieve frequentiesturing.
  // -------------------------------------------------------------------------
  P54_heatingFreqConstantB: {
    address: 0x0136, min: -100, max: 100, name: 'Heating target freq constant B',
  }, // v2.2
  P55_heatingTargetFreqUpper: {
    address: 0x0137, min: 50, max: 120, unit: 'Hz', name: 'Heating target freq upper',
  },
  P56_heatingTargetFreqLower: {
    address: 0x0138, min: 20, max: 120, unit: 'Hz', name: 'Heating target freq lower',
  },
  P57_heatingMinFreq_above0: {
    address: 0x0139,
    min: 15,
    max: 60,
    unit: 'Hz',
    name: 'Heating min freq (ambient > 0°C)',
    desc: ' COP: lagere waarde = beter COP bij mild weer',
  },
  P58_heatingMinFreq_neg10to0: {
    address: 0x013A, min: 15, max: 60, unit: 'Hz', name: 'Heating min freq (-10°C  ambient < 0°C)',
  },
  P59_heatingMinFreq_below10: {
    address: 0x013B, min: 15, max: 60, unit: 'Hz', name: 'Heating min freq (ambient < -10°C)',
  },

  // -------------------------------------------------------------------------
  // Frequency Control Hot Water / DHW (P60P65)
  // -------------------------------------------------------------------------
  P60_hotWaterFreqConstant: {
    address: 0x013C, min: -100, max: 100, name: 'Hot water target freq constant',
  }, // v2.2
  P61_hotWaterFreqUpper: {
    address: 0x013D, min: 50, max: 120, unit: 'Hz', name: 'Hot water target freq upper',
  },
  P62_hotWaterFreqLower: {
    address: 0x013E, min: 15, max: 120, unit: 'Hz', name: 'Hot water target freq lower', desc: 'Must be  P61',
  },
  P63_hotWaterMinFreq_above0: {
    address: 0x013F,
    min: 15,
    max: 60,
    unit: 'Hz',
    name: 'Hot water min freq (ambient > 0°C)',
    desc: ' COP: lagere waarde = beter COP bij mild weer',
  },
  P64_hotWaterMinFreq_neg10to0: {
    address: 0x0140, min: 15, max: 60, unit: 'Hz', name: 'Hot water min freq (-10°C  ambient < 0°C)',
  },
  P65_hotWaterMinFreq_below10: {
    address: 0x0141, min: 15, max: 60, unit: 'Hz', name: 'Hot water min freq (ambient < -10°C)',
  },

  // -------------------------------------------------------------------------
  // Fan Control (P06, P66P70)
  // RPM CONVERSIEFORMULE: Speed [RPM] = frequency [Hz] 15
  // -------------------------------------------------------------------------
  P66_dcFanInitFreq: {
    address: 0x0142,
    min: 20,
    max: 60,
    unit: 'Hz',
    name: 'DC fan initial freq',
    desc: 'RPM = freq  15. Range 300900 RPM',
  },
  P67_dcFanHeatMinFreq: {
    address: 0x0143, min: 20, max: 60, unit: 'Hz', name: 'DC fan heating min freq',
  },
  P68_dcFanHeatMaxFreq: {
    address: 0x0144, min: 20, max: 80, unit: 'Hz', name: 'DC fan heating max freq',
  }, // v2.2: max 6080
  P69_dcFanCoolMinFreq: {
    address: 0x0145, min: 20, max: 60, unit: 'Hz', name: 'DC fan cooling min freq',
  },
  P70_dcFanCoolMaxFreq: {
    address: 0x0146, min: 20, max: 80, unit: 'Hz', name: 'DC fan cooling max freq',
  }, // v2.2: max 6080

  // -------------------------------------------------------------------------
  // Quiet/Silent Mode (P88P89)
  // -------------------------------------------------------------------------
  P88_silentCompressorFreq: {
    address: 0x0158, min: 20, max: 70, unit: 'Hz', name: 'Silent mode compressor freq',
  },
  P89_silentFanFreq: {
    address: 0x0159, min: 20, max: 60, unit: 'Hz', name: 'Silent mode fan freq',
  },

  // -------------------------------------------------------------------------
  // Pump Control (P95, P99P101, P146, P150, P161P163, P260P261)
  // -------------------------------------------------------------------------
  P95_networkPumpMode: {
    address: 0x015F, min: 0, max: 1, name: 'Network pump mode', desc: '0=shared, 1=independent',
  },
  P96_hotWaterReturnDiff: {
    address: 0x0160, min: 0, max: 10, default: 5, unit: '°C', name: 'DHW differential value',
  }, // v2.2: default + naam
  P99_pumpSpeedTempDiff: {
    address: 0x0163, min: 2, max: 10, default: 5, unit: '°C', name: 'Pump speed regulation temp diff',
  }, // v2.2: default
  P100_pumpMinSpeed: {
    address: 0x0164, min: 20, max: 80, unit: '%', name: 'PWM pump minimum speed',
  },
  P101_pumpControlMode: {
    address: 0x0165, min: 0, max: 1, name: 'Pump control mode', desc: '0=AC(on/off), 1=DC(PWM)',
  },
  P146_pumpRangeSetting: {
    address: 0x0192, min: 0, max: 100, unit: 'L/min', name: 'Pump PWM range setting',
  },
  P150_secondaryHeatingPump: {
    address: 0x0196,
    min: 0,
    max: 3,
    default: 2,
    name: 'Secondary heating pump select',
    desc: '0=power on run, 1=power on, 2=linkage demand switch, 3=temperature control',
  }, // v2.2: max 23 + default
  P161_auxPumpSelection: {
    address: 0x01A1,
    min: 0,
    max: 4,
    default: 0,
    name: 'Aux pump selection',
    desc: '0=DHW, 1=AC, 2=floor, 3=AC/floor, 4=all',
  }, // v2.2: default
  P162_antifreezeDHWInterval: {
    address: 0x01A2,
    min: 0,
    max: 360,
    default: 90,
    unit: 'min',
    name: 'Antifreeze DHW pipe interval',
    desc: '0=disabled',
  }, // v2.2: default
  P163_pumpMinSpeedFeedback: {
    address: 0x01A3,
    min: 0,
    max: 70,
    unit: '%',
    name: 'Min pump speed feedback',
    desc: ' FIX v2.0: OEM doc zegt L/min, Excel zegt %. Range 0-70 past bij %  minimum PWM feedback drempel',
  },
  P260_pumpMaxSpeed: {
    address: 0x0204, min: 50, max: 99, unit: '%', name: 'Max DC pump speed',
  },
  P261_pumpConstTempSpeed: {
    address: 0x0205, min: 20, max: 99, unit: '%', name: 'DC pump constant temp speed',
  },

  // -------------------------------------------------------------------------
  // Temperature Limits (P105P113)
  // -------------------------------------------------------------------------
  P105_coolingAmbientLimit: {
    address: 0x0169, min: 10, max: 60, unit: '°C', name: 'Cooling ambient temp limit',
  },
  P106_heatingAmbientLimit: {
    address: 0x016A, min: 10, max: 60, unit: '°C', name: 'Heating ambient temp limit',
  },
  P107_hotWaterAmbientLimit: {
    address: 0x016B, min: 10, max: 60, unit: '°C', name: 'Hot water ambient temp limit',
  },
  P108_hotWaterTempUpper: {
    address: 0x016C, min: 30, max: 80, unit: '°C', name: 'Hot water set temp upper',
  },
  P109_hotWaterTempLower: {
    address: 0x016D, min: 10, max: 30, unit: '°C', name: 'Hot water set temp lowest',
  }, // v2.2
  P110_heatingTempUpper: {
    address: 0x016E, min: 30, max: 80, unit: '°C', name: 'Heating set temp upper',
  },
  P111_heatingTempLower: {
    address: 0x016F, min: 15, max: 30, unit: '°C', name: 'Heating set temp lowest',
  }, // v2.2
  P112_coolingTempUpper: {
    address: 0x0170, min: 20, max: 40, unit: '°C', name: 'Cooling set temp upper',
  },
  P113_coolingTempLower: {
    address: 0x0171, min: 5, max: 20, unit: '°C', name: 'Cooling set temp lowest',
  }, // v2.2

  // -------------------------------------------------------------------------
  // Temperature Control Mode (P116)
  //
  // SENSORVERWIJZING PER MODELVARIANT:
  // Adlar Castra Aurora II: 0=T6 (return/inlet), 1=T7 (outlet/discharge)
  // Cascade/groot model: 0=T8 (return/inlet), 1=T15 (outlet/discharge)
  // -------------------------------------------------------------------------
  P116_tempControlMode: {
    address: 0x0174,
    min: 0,
    max: 1,
    default: 0,
    name: 'Temp control mode',
    desc: 'Adlar Aurora II: 0=inlet T6 (return water), 1=outlet T7 (discharge)',
  }, // v2.2: default

  // -------------------------------------------------------------------------
  // Anti-freeze (P117P118)
  // -------------------------------------------------------------------------
  P117_antifreezeAmbient: {
    address: 0x0175, min: 0, max: 10, default: 5, unit: '°C', name: 'Antifreeze ambient temp',
  }, // v2.2: default
  P118_antifreezeOutlet: {
    address: 0x0176, min: 0, max: 20, default: 3, unit: '°C', name: 'Antifreeze outlet water',
  }, // v2.2: default

  // -------------------------------------------------------------------------
  // System Configuration (P114P115, P119P120)
  // -------------------------------------------------------------------------
  P114_nrCompressors: {
    address: 0x0172, min: 1, max: 2, name: 'Nr of compressors', desc: '1=single, 2=pair',
  },
  P115_modelSelection: {
    address: 0x0173, min: 0, max: 5, name: 'Model selection', desc: '0=double supply, 1=triple, ...',
  },
  P119_refrigerantType: {
    address: 0x0177,
    min: 1,
    max: 3,
    name: 'Refrigerant type',
    desc: '1=R410A, 2=R32 (Adlar Aurora II), 3=R290. Validatie: moet 2 zijn.',
  },
  P120_antiCondensation: {
    address: 0x0178,
    min: 0,
    max: 1,
    default: 0,
    name: 'Anti-condensation function',
    desc: '0=enable, 1=disable',
  }, // v2.2: naam

  // -------------------------------------------------------------------------
  // Electric Heating Options (P139P140)
  // -------------------------------------------------------------------------
  P139_bufferTankEHeating: {
    address: 0x018B,
    min: 0,
    max: 2,
    default: 0,
    name: 'Buffer tank electric heater',
    desc: '0=enable, 1=disable, 2=AHS (Auxiliary Heat Source)',
  }, // v2.2: naam + desc
  P140_dhwEHeating: {
    address: 0x018C,
    min: 0,
    max: 2,
    default: 0,
    name: 'DHW electric heater',
    desc: '0=enable, 1=disable, 2=AHS',
  }, // v2.2: naam + desc

  // -------------------------------------------------------------------------
  // Low Water Flow Protection (P134)
  // -------------------------------------------------------------------------
  P134_lowWaterFlow: {
    address: 0x0186, min: 0, max: 100, unit: 'L/min', name: 'Low water flow protection', desc: '0=disabled',
  },

  // -------------------------------------------------------------------------
  // Additional Parameters (P103, P151P152, P181P182)
  // -------------------------------------------------------------------------
  P103_modeSwitchMinRun: {
    address: 0x0167, min: 0, max: 10, unit: 'min', name: 'Mode switch min run time', desc: '0=unlimited',
  },
  P49_hotWaterFreqPercentage: {
    address: 0x0131, min: 30, max: 100, default: 30, unit: '%', name: 'Hot water freq running percentage',
  }, // v2.2
  P151_returnDiffHwSource: {
    address: 0x0197, min: 0, max: 40, default: 0, unit: '°C', name: 'Return diff - hot water heat source',
  }, // v2.2
  P152_returnDiffHeatSource: {
    address: 0x0198, min: 0, max: 40, default: 0, unit: '°C', name: 'Return diff - heating heat source',
  }, // v2.2
  P181_defrostEvapSide: {
    address: 0x01B5,
    min: 0,
    max: 2,
    default: 0,
    name: 'Defrost selection - evaporate side',
    desc: '0=current mode, 1=heating, 2=DHW',
  }, // v2.2
  P182_pipeEHeatingOption: {
    address: 0x01B6,
    min: 0,
    max: 3,
    name: 'Pipe electric heating option',
    desc: '0=3kW+6kW, 1=3kW, 2=6kW, 3=disabled',
  }, // v2.2

  // -------------------------------------------------------------------------
  // Smart Grid (P255P256)
  // NB: Inverse logica 0=enable, 1=disable
  // -------------------------------------------------------------------------
  P254_heatingMedium: {
    address: 0x01FE,
    min: 0,
    max: 1,
    default: 0,
    name: 'Heating medium',
    desc: '0=water, 1=antifreeze liquid',
  }, // v2.2
  P255_smartGridOptions: {
    address: 0x01FF,
    min: 0,
    max: 1,
    name: 'Smart Grid enable',
    desc: '0=enable, 1=disable (inverse logica!)',
  },
  P256_peakGridRuntime: {
    address: 0x0200, min: 30, max: 999, unit: 'min', name: 'Peak grid runtime',
  },

  // -------------------------------------------------------------------------
  // Energy Level Control (P164)
  // -------------------------------------------------------------------------
  P164_energyLevelControl: {
    address: 0x01A4,
    min: 0,
    max: 3,
    name: 'Energy level control',
    desc: '0=all enable, 1=E-heat disable, 2=compressor disable, 3=all disable',
  },

  // -------------------------------------------------------------------------
  // EEV / ventielregeling (P38, P40–P42, P71–P87)
  // -------------------------------------------------------------------------
  P38_heatingMainValveOpeningConst: {
    address: 0x0126, min: -999, max: 999, name: 'Heating main valve initial opening constant',
  },
  P40_coolingSuperheatCorrection: {
    address: 0x0128, min: -5, max: 10, unit: '°C', name: 'EEV cooling target superheat correction',
  },
  P41_heatingHpFreqLimitCorrection: {
    address: 0x0129, min: -10, max: 10, unit: '°C', name: 'EEV heating HP freq limit correction',
  },
  P42_heatingSuperheatCorrection: {
    address: 0x012A, min: -5, max: 10, unit: '°C', name: 'EEV heating target superheat correction',
  },
  P71_enthalpyOnFreq: {
    address: 0x0147, min: 20, max: 80, unit: 'Hz', name: 'EEV enthalpy control on frequency',
  },
  P72_enthalpyStopFreq: {
    address: 0x0148, min: 20, max: 80, unit: 'Hz', name: 'EEV enthalpy stop increase frequency',
  },
  P73_coolingMainValveOpening1: {
    address: 0x0149, min: 20, max: 480, unit: 'P', name: 'EEV cooling main valve opening 1',
  },
  P74_coolingMainValveOpening2: {
    address: 0x014A, min: 20, max: 480, unit: 'P', name: 'EEV cooling main valve opening 2',
  },
  P75_coolingMainValveOpening3: {
    address: 0x014B, min: 20, max: 480, unit: 'P', name: 'EEV cooling main valve opening 3',
  },
  P76_coolingMainValveMinOpening: {
    address: 0x014C, min: 0, max: 300, unit: 'P', name: 'EEV cooling main valve min opening',
  },
  P77_heatingMainValveMinOpening: {
    address: 0x014D, min: 0, max: 300, unit: 'P', name: 'EEV heating main valve min opening',
  },
  P78_mainValveMaxOpening: {
    address: 0x014E, min: 100, max: 500, unit: 'P', name: 'EEV main valve max opening',
  },
  P79_mainValveOpeningConstC: {
    address: 0x014F, min: 20, max: 300, name: 'EEV main valve initial opening const c',
  },
  P80_mainValveOpeningCoeffA: {
    address: 0x0150, min: -999, max: 999, name: 'EEV main valve initial opening coeff a',
  },
  P81_mainValveOpeningCoeffB: {
    address: 0x0151, min: -999, max: 999, name: 'EEV main valve initial opening coeff b',
  },
  P82_auxValveMaxOpening: {
    address: 0x0152, min: 100, max: 500, unit: 'P', name: 'EEV aux valve max opening',
  },
  P83_auxValveMinOpening: {
    address: 0x0153, min: 50, max: 300, unit: 'P', name: 'EEV aux valve min opening',
  },
  P84_mainValveRegulationPeriod: {
    address: 0x0154, min: 10, max: 120, unit: 's', name: 'EEV main valve regulation period',
  },
  P85_auxValveOpeningConstC: {
    address: 0x0155, min: -200, max: 900, name: 'EEV aux valve initial opening const c',
  },
  P86_auxValveOpeningCoeffA: {
    address: 0x0156, min: -999, max: 999, name: 'EEV aux valve initial opening coeff a',
  },
  P87_auxValveOpeningCoeffB: {
    address: 0x0157, min: -999, max: 999, name: 'EEV aux valve initial opening coeff b',
  },

  // -------------------------------------------------------------------------
  // EVI & vloeistofinjector (P46, P47, P90–P94)
  // -------------------------------------------------------------------------
  P46_liquidInjectionReturnDiff: {
    address: 0x012E, min: 0, max: 15, unit: '°C', name: 'EVI liquid injection valve return diff',
  },
  P47_eviTargetSuperheat: {
    address: 0x012F, min: 0, max: 12, name: 'EVI target superheat constant',
  },
  P90_eviEntryAmbientTemp: {
    address: 0x015A, min: 0, max: 45, unit: '°C', name: 'EVI entry ambient temperature',
  },
  P91_eviForbidEntryTime: {
    address: 0x015B, min: 0, max: 30, unit: 'min', name: 'EVI forbid entry time',
  },
  P92_eviEntryTempDiff: {
    address: 0x015C, min: 0, max: 60, unit: '°C', name: 'EVI entry temperature difference',
  },
  P93_eviCompressorRunTime: {
    address: 0x015D, min: 0, max: 20, unit: 'min', name: 'EVI compressor run time to enter',
  },
  P94_auxValveAdjCycle: {
    address: 0x015E, min: 10, max: 120, unit: 's', name: 'EVI aux valve adjustment cycle',
  },

  // -------------------------------------------------------------------------
  // Watertemperatuur compensatie (P97, P98)
  // -------------------------------------------------------------------------
  P97_tankTempAutoCompensation: {
    address: 0x0161,
    min: 0,
    max: 1,
    name: 'Tank temperature auto compensation',
    desc: '0=enable, 1=disable',
  },
  P98_tankTempManualCompensation: {
    address: 0x0162, min: -10, max: 10, unit: '°C', name: 'Tank temperature manual compensation',
  },

  // -------------------------------------------------------------------------
  // Moduswissel (P104)
  // -------------------------------------------------------------------------
  P104_modeSwitchFreqPct: {
    address: 0x0168, min: 20, max: 100, unit: '%', name: 'Mode switch operating frequency %',
  },

  // -------------------------------------------------------------------------
  // Frequentie-afscherming zones (P121–P132)
  // -------------------------------------------------------------------------
  P121_heatingFreqShield1Low: {
    address: 0x0179, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 1 low',
  },
  P122_heatingFreqShield1High: {
    address: 0x017A, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 1 high',
  },
  P123_heatingFreqShield2Low: {
    address: 0x017B, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 2 low',
  },
  P124_heatingFreqShield2High: {
    address: 0x017C, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 2 high',
  },
  P125_heatingFreqShield3Low: {
    address: 0x017D, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 3 low',
  },
  P126_heatingFreqShield3High: {
    address: 0x017E, min: 0, max: 120, unit: 'Hz', name: 'Heating freq shield zone 3 high',
  },
  P127_coolingFreqShield1Low: {
    address: 0x017F, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 1 low',
  },
  P128_coolingFreqShield1High: {
    address: 0x0180, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 1 high',
  },
  P129_coolingFreqShield2Low: {
    address: 0x0181, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 2 low',
  },
  P130_coolingFreqShield2High: {
    address: 0x0182, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 2 high',
  },
  P131_coolingFreqShield3Low: {
    address: 0x0183, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 3 low',
  },
  P132_coolingFreqShield3High: {
    address: 0x0184, min: 0, max: 120, unit: 'Hz', name: 'Cooling freq shield zone 3 high',
  },

  // -------------------------------------------------------------------------
  // Ontdooiing aanvullend (P135–P138, P141, P142)
  // -------------------------------------------------------------------------
  P135_antiCondensationTempDiff: {
    address: 0x0187, min: 0, max: 50, unit: '°C', name: 'Anti-condensation start temp diff',
  },
  P136_throttleBypassAmbientTemp: {
    address: 0x0188, min: -20, max: 50, unit: '°C', name: 'Throttle bypass valve open ambient temp',
  },
  P137_throttleBypassDelay: {
    address: 0x0189, min: 0, max: 999, unit: 's', name: 'Throttle bypass delay compressor',
  },
  P138_defrostCompressorFreq: {
    address: 0x018A, min: 40, max: 120, unit: 'Hz', name: 'Defrost compressor frequency',
  },
  P141_dewPointDefrostDuration: {
    address: 0x018D, min: 0, max: 60, unit: 'min', name: 'Dew point defrost duration',
  },
  P142_dewPointDefrostConstant: {
    address: 0x018E, min: 0, max: 60, name: 'Dew point defrost constant',
  },

  // -------------------------------------------------------------------------
  // Warmtebron & temperatuurlimieten aanvullend (P155–P160)
  // -------------------------------------------------------------------------
  P155_compressorCode: {
    address: 0x019B, min: 0, max: 9999, name: 'Compressor code (reserved)',
  },
  P156_auxEevSelection: {
    address: 0x019C,
    min: 0,
    max: 1,
    name: 'Aux EEV selection',
    desc: '0=enable, 1=disable',
  },
  P157_auxEevTempDiffReduce: {
    address: 0x019D, min: 0, max: 99, unit: '°C', name: 'Aux EEV temp diff to reduce',
  },
  P158_heatingLimitWaterTempStartAmb: {
    address: 0x019E, min: -45, max: 30, unit: '°C', name: 'Heating limit water temp start ambient',
  },
  P159_limitTempConstant: {
    address: 0x019F, min: 0, max: 150, name: 'Limit temperature constant',
  },
  P160_limitTempCoefficient: {
    address: 0x01A0, min: -500, max: 500, name: 'Limit temperature coefficient',
  },

  // -------------------------------------------------------------------------
  // Load shedding & cascading (P165–P173)
  // -------------------------------------------------------------------------
  P165_loadReturnDiff: {
    address: 0x01A5, min: 1, max: 15, unit: '°C', name: 'Load shedding return difference',
  },
  P166_loadSheddingHysteresis: {
    address: 0x01A6, min: 1, max: 15, unit: '°C', name: 'Load shedding hysteresis',
  },
  P167_emergencyStopReturnDiff: {
    address: 0x01A7, min: 1, max: 15, unit: '°C', name: 'Load shedding emergency stop return diff',
  },
  P168_hotWaterStartRatio: {
    address: 0x01A8, min: 1, max: 100, unit: '%', name: 'Load shedding hot water start ratio',
  },
  P169_nonHotWaterStartRatio: {
    address: 0x01A9, min: 1, max: 100, unit: '%', name: 'Load shedding non-hot water start ratio',
  },
  P170_loadingCycle: {
    address: 0x01AA, min: 3, max: 60, unit: 'min', name: 'Load shedding loading cycle',
  },
  P171_shieldLowVoltageAmbient: {
    address: 0x01AB, min: -50, max: 0, unit: '°C', name: 'Load shedding shield low voltage ambient',
  },
  P172_dcFanTargetFreqConstC: {
    address: 0x01AC, min: 40, max: 70, unit: 'Hz', name: 'DC fan target frequency constant c',
  },
  P173_heatingFanFreqLowerLimit: {
    address: 0x01AD, min: 20, max: 65, unit: 'Hz', name: 'Heating fan target frequency lower limit',
  },

  // -------------------------------------------------------------------------
  // Parameterbeveiliging (P183)
  // -------------------------------------------------------------------------
  P183_parameterPassword: {
    address: 0x01B7,
    min: 0,
    max: 9999,
    name: 'Parameter password',
    desc: '0=disable',
  },

} as const;

// ============================================================================
// BLOK 9: WORKING CONDITION P-REGISTERS (0x01B8–0x01FD)
// Fabrieksijkpunten voor compressor/ventilator/klep bij 35°C en 55°C condities.
// Read-only inzicht voor expert; niet bedoeld voor handmatige aanpassing.
// ============================================================================
export const P_WORKING_CONDITIONS = {

  // -------------------------------------------------------------------------
  // Compressor frequenties (P184–P193)
  // -------------------------------------------------------------------------
  P184_35D_compressorFreq: {
    address: 0x01B8, min: 0, max: 120, unit: 'Hz', name: 'Working cond 35D compressor frequency',
  },
  P185_35C_compressorFreq: {
    address: 0x01B9, min: 0, max: 120, unit: 'Hz', name: 'Working cond 35C compressor frequency',
  },
  P186_35B_compressorFreq: {
    address: 0x01BA, min: 0, max: 120, unit: 'Hz', name: 'Working cond 35B compressor frequency',
  },
  P187_35A_compressorFreq: {
    address: 0x01BB, min: 0, max: 120, unit: 'Hz', name: 'Working cond 35A compressor frequency',
  },
  P188_35E_compressorFreq: {
    address: 0x01BC, min: 0, max: 120, unit: 'Hz', name: 'Working cond 35E compressor frequency',
  },
  P189_55D_compressorFreq: {
    address: 0x01BD, min: 0, max: 120, unit: 'Hz', name: 'Working cond 55D compressor frequency',
  },
  P190_55C_compressorFreq: {
    address: 0x01BE, min: 0, max: 120, unit: 'Hz', name: 'Working cond 55C compressor frequency',
  },
  P191_55B_compressorFreq: {
    address: 0x01BF, min: 0, max: 120, unit: 'Hz', name: 'Working cond 55B compressor frequency',
  },
  P192_55A_compressorFreq: {
    address: 0x01C0, min: 0, max: 120, unit: 'Hz', name: 'Working cond 55A compressor frequency',
  },
  P193_55E_compressorFreq: {
    address: 0x01C1, min: 0, max: 120, unit: 'Hz', name: 'Working cond 55E compressor frequency',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: ventilator frequenties (P194–P203)
  // -------------------------------------------------------------------------
  P194_35D_fanFreq: {
    address: 0x01C2, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35D fan frequency',
  },
  P195_35C_fanFreq: {
    address: 0x01C3, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35C fan frequency',
  },
  P196_35B_fanFreq: {
    address: 0x01C4, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35B fan frequency',
  },
  P197_35A_fanFreq: {
    address: 0x01C5, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35A fan frequency',
  },
  P198_35E_fanFreq: {
    address: 0x01C6, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35E fan frequency',
  },
  P199_55D_fanFreq: {
    address: 0x01C7, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55D fan frequency',
  },
  P200_55C_fanFreq: {
    address: 0x01C8, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55C fan frequency',
  },
  P201_55B_fanFreq: {
    address: 0x01C9, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55B fan frequency',
  },
  P202_55A_fanFreq: {
    address: 0x01CA, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55A fan frequency',
  },
  P203_55E_fanFreq: {
    address: 0x01CB, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55E fan frequency',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: hoofdklep superheat (P204–P213)
  // -------------------------------------------------------------------------
  P204_35D_mainValveSuperheat: {
    address: 0x01CC, min: -10, max: 10, unit: '°C', name: 'Working cond 35D main valve superheat',
  },
  P205_35C_mainValveSuperheat: {
    address: 0x01CD, min: -10, max: 10, unit: '°C', name: 'Working cond 35C main valve superheat',
  },
  P206_35B_mainValveSuperheat: {
    address: 0x01CE, min: -10, max: 10, unit: '°C', name: 'Working cond 35B main valve superheat',
  },
  P207_35A_mainValveSuperheat: {
    address: 0x01CF, min: -10, max: 10, unit: '°C', name: 'Working cond 35A main valve superheat',
  },
  P208_35E_mainValveSuperheat: {
    address: 0x01D0, min: -10, max: 10, unit: '°C', name: 'Working cond 35E main valve superheat',
  },
  P209_55D_mainValveSuperheat: {
    address: 0x01D1, min: -10, max: 10, unit: '°C', name: 'Working cond 55D main valve superheat',
  },
  P210_55C_mainValveSuperheat: {
    address: 0x01D2, min: -10, max: 10, unit: '°C', name: 'Working cond 55C main valve superheat',
  },
  P211_55B_mainValveSuperheat: {
    address: 0x01D3, min: -10, max: 10, unit: '°C', name: 'Working cond 55B main valve superheat',
  },
  P212_55A_mainValveSuperheat: {
    address: 0x01D4, min: -10, max: 10, unit: '°C', name: 'Working cond 55A main valve superheat',
  },
  P213_55E_mainValveSuperheat: {
    address: 0x01D5, min: -10, max: 10, unit: '°C', name: 'Working cond 55E main valve superheat',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: hoofdklep opening (P214–P223)
  // -------------------------------------------------------------------------
  P214_35D_mainValveOpening: {
    address: 0x01D6, min: 0, max: 500, unit: 'P', name: 'Working cond 35D main valve opening',
  },
  P215_35C_mainValveOpening: {
    address: 0x01D7, min: 0, max: 500, unit: 'P', name: 'Working cond 35C main valve opening',
  },
  P216_35B_mainValveOpening: {
    address: 0x01D8, min: 0, max: 500, unit: 'P', name: 'Working cond 35B main valve opening',
  },
  P217_35A_mainValveOpening: {
    address: 0x01D9, min: 0, max: 500, unit: 'P', name: 'Working cond 35A main valve opening',
  },
  P218_35E_mainValveOpening: {
    address: 0x01DA, min: 0, max: 500, unit: 'P', name: 'Working cond 35E main valve opening',
  },
  P219_55D_mainValveOpening: {
    address: 0x01DB, min: 0, max: 500, unit: 'P', name: 'Working cond 55D main valve opening',
  },
  P220_55C_mainValveOpening: {
    address: 0x01DC, min: 0, max: 500, unit: 'P', name: 'Working cond 55C main valve opening',
  },
  P221_55B_mainValveOpening: {
    address: 0x01DD, min: 0, max: 500, unit: 'P', name: 'Working cond 55B main valve opening',
  },
  P222_55A_mainValveOpening: {
    address: 0x01DE, min: 0, max: 500, unit: 'P', name: 'Working cond 55A main valve opening',
  },
  P223_55E_mainValveOpening: {
    address: 0x01DF, min: 0, max: 500, unit: 'P', name: 'Working cond 55E main valve opening',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: hulpklep superheat (P224–P233)
  // -------------------------------------------------------------------------
  P224_35D_auxValveSuperheat: {
    address: 0x01E0, min: -10, max: 10, unit: '°C', name: 'Working cond 35D aux valve superheat',
  },
  P225_35C_auxValveSuperheat: {
    address: 0x01E1, min: -10, max: 10, unit: '°C', name: 'Working cond 35C aux valve superheat',
  },
  P226_35B_auxValveSuperheat: {
    address: 0x01E2, min: -10, max: 10, unit: '°C', name: 'Working cond 35B aux valve superheat',
  },
  P227_35A_auxValveSuperheat: {
    address: 0x01E3, min: -10, max: 10, unit: '°C', name: 'Working cond 35A aux valve superheat',
  },
  P228_35E_auxValveSuperheat: {
    address: 0x01E4, min: -10, max: 10, unit: '°C', name: 'Working cond 35E aux valve superheat',
  },
  P229_55D_auxValveSuperheat: {
    address: 0x01E5, min: -10, max: 10, unit: '°C', name: 'Working cond 55D aux valve superheat',
  },
  P230_55C_auxValveSuperheat: {
    address: 0x01E6, min: -10, max: 10, unit: '°C', name: 'Working cond 55C aux valve superheat',
  },
  P231_55B_auxValveSuperheat: {
    address: 0x01E7, min: -10, max: 10, unit: '°C', name: 'Working cond 55B aux valve superheat',
  },
  P232_55A_auxValveSuperheat: {
    address: 0x01E8, min: -10, max: 10, unit: '°C', name: 'Working cond 55A aux valve superheat',
  },
  P233_55E_auxValveSuperheat: {
    address: 0x01E9, min: -10, max: 10, unit: '°C', name: 'Working cond 55E aux valve superheat',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: hulpklep opening (P234–P243)
  // -------------------------------------------------------------------------
  P234_35D_auxValveOpening: {
    address: 0x01EA, min: 0, max: 500, unit: 'P', name: 'Working cond 35D aux valve opening',
  },
  P235_35C_auxValveOpening: {
    address: 0x01EB, min: 0, max: 500, unit: 'P', name: 'Working cond 35C aux valve opening',
  },
  P236_35B_auxValveOpening: {
    address: 0x01EC, min: 0, max: 500, unit: 'P', name: 'Working cond 35B aux valve opening',
  },
  P237_35A_auxValveOpening: {
    address: 0x01ED, min: 0, max: 500, unit: 'P', name: 'Working cond 35A aux valve opening',
  },
  P238_35E_auxValveOpening: {
    address: 0x01EE, min: 0, max: 500, unit: 'P', name: 'Working cond 35E aux valve opening',
  },
  P239_55D_auxValveOpening: {
    address: 0x01EF, min: 0, max: 500, unit: 'P', name: 'Working cond 55D aux valve opening',
  },
  P240_55C_auxValveOpening: {
    address: 0x01F0, min: 0, max: 500, unit: 'P', name: 'Working cond 55C aux valve opening',
  },
  P241_55B_auxValveOpening: {
    address: 0x01F1, min: 0, max: 500, unit: 'P', name: 'Working cond 55B aux valve opening',
  },
  P242_55A_auxValveOpening: {
    address: 0x01F2, min: 0, max: 500, unit: 'P', name: 'Working cond 55A aux valve opening',
  },
  P243_55E_auxValveOpening: {
    address: 0x01F3, min: 0, max: 500, unit: 'P', name: 'Working cond 55E aux valve opening',
  },

  // -------------------------------------------------------------------------
  // Werkconditie-ijkpunten: waterflow & rated targets (P244–P253)
  // -------------------------------------------------------------------------
  P244_35lowWaterFlow: {
    address: 0x01F4, min: 0, max: 100, unit: 'L/min', name: 'Working cond 35 low water target flow',
  },
  P245_55highWaterFlow: {
    address: 0x01F5, min: 0, max: 100, unit: 'L/min', name: 'Working cond 55 high water target flow',
  },
  P246_35ratedFanFreq: {
    address: 0x01F6, min: 0, max: 60, unit: 'Hz', name: 'Working cond 35 rated fan frequency',
  },
  P247_35ratedMainValveOpening: {
    address: 0x01F7, min: 0, max: 500, unit: 'P', name: 'Working cond 35 rated main valve opening',
  },
  P248_55ratedFanFreq: {
    address: 0x01F8, min: 0, max: 60, unit: 'Hz', name: 'Working cond 55 rated fan frequency',
  },
  P249_55ratedMainValveOpening: {
    address: 0x01F9, min: 0, max: 500, unit: 'P', name: 'Working cond 55 rated main valve opening',
  },
  P250_35ratedMainValveSuperheat: {
    address: 0x01FA, min: -10, max: 10, unit: '°C', name: 'Working cond 35 rated main valve superheat',
  },
  P251_pfcShutdownCurrent: {
    address: 0x01FB, min: 0, max: 50, unit: 'A', name: 'Working cond PFC shutdown current',
  },
  P252_55ratedMainValveSuperheat: {
    address: 0x01FC, min: -10, max: 10, unit: '°C', name: 'Working cond 55 rated main valve superheat',
  },
  P253_pfcTurnOnCurrent: {
    address: 0x01FD, min: 0, max: 50, unit: 'A', name: 'Working cond PFC turn-on current',
  },

} as const;

// ============================================================================
// BLOK 4 (vervolg): P-PARAMETERS — overige groepen
// ============================================================================
export const P_PARAMETERS_EXTRA = {

  // -------------------------------------------------------------------------
  // Vier-weg klep & moduswissel (P102)
  // -------------------------------------------------------------------------
  P102_fourWayValveMode: {
    address: 0x0166,
    min: 0,
    max: 1,
    name: 'Four-way valve control mode',
    desc: '0=cooling power on, 1=heating power on',
  },

  // -------------------------------------------------------------------------
  // Ventilatormodule (P133)
  // -------------------------------------------------------------------------
  P133_fanModule: {
    address: 0x0185,
    min: 0,
    max: 1,
    name: 'Fan module',
    desc: '0=integral module, 1=individual module',
  },

  // -------------------------------------------------------------------------
  // Ontdooiing uitgebreid (P143–P145, P175–P180)
  // -------------------------------------------------------------------------
  P143_waterTempEnterDefrost: {
    address: 0x018F, min: 0, max: 60, unit: '°C', name: 'Water temp to enter defrost',
  },
  P144_ambientTempEnterDefrost: {
    address: 0x0190, min: -20, max: 30, unit: '°C', name: 'Ambient temp to enter defrost',
  },
  P145_outletAntifreezeProtection: {
    address: 0x0191, min: -20, max: 10, unit: '°C', name: 'Outlet water antifreeze protection',
  },
  P175_constTempOperationCycle: {
    address: 0x01AF, min: 0, max: 360, unit: 'min', name: 'Constant temp operation cycle',
  },
  P176_minDefrostTime: {
    address: 0x01B0, min: 0, max: 999, unit: 's', name: 'Minimum defrost time',
  },
  P177_defrostSegmentedWaterTemp: {
    address: 0x01B1, min: 0, max: 80, unit: '°C', name: 'Defrost segmented water temperature',
  },
  P178_highWaterTempDefrostFreq: {
    address: 0x01B2, min: 40, max: 120, unit: 'Hz', name: 'High water temp defrost frequency',
  },
  P179_strongModeFreqIncrease: {
    address: 0x01B3, min: 0, max: 40, unit: 'Hz', name: 'Strong mode frequency increase',
  },
  P180_powerfulModeFreqCap: {
    address: 0x01B4, min: 0, max: 40, unit: 'Hz', name: 'Powerful mode frequency cap',
  },

  // -------------------------------------------------------------------------
  // Koeling antibevriezing (P147–P149)
  // -------------------------------------------------------------------------
  P147_coolingAntifreezeMode: {
    address: 0x0193,
    min: 0,
    max: 2,
    name: 'Cooling antifreeze mode',
    desc: '0=low pressure, 1=temp, 2=low pressure + temp',
  },
  P148_coolingAntifreezeTemp: {
    address: 0x0194, min: -30, max: 10, unit: '°C', name: 'Cooling antifreeze temperature',
  },
  P149_outletHighLimitTemp: {
    address: 0x0195, min: 40, max: 80, unit: '°C', name: 'Outlet water high limit temperature',
  },

  // -------------------------------------------------------------------------
  // Warmtebron temperatuurlimieten (P153–P154)
  // -------------------------------------------------------------------------
  P153_dhwHeatSourceUpperTemp: {
    address: 0x0199, min: 15, max: 80, unit: '°C', name: 'DHW heat source upper temp',
  },
  P154_heatingHeatSourceUpperTemp: {
    address: 0x019A, min: 15, max: 80, unit: '°C', name: 'Heating heat source upper temp',
  },

  // -------------------------------------------------------------------------
  // Dubbele zone & mengklep (P257–P259)
  // -------------------------------------------------------------------------
  P257_dualZoneSelection: {
    address: 0x0201,
    min: 0,
    max: 2,
    name: 'Dual temperature zone selection',
    desc: '0=auto, 1=manual, 2=disable',
  },
  P258_mixingValveCycle: {
    address: 0x0202, min: 5, max: 20, unit: 'min', name: 'Mixing water valve cycle',
  },
  P259_mixingValveFullCycle: {
    address: 0x0203, min: 0, max: 180, unit: 's', name: 'Mixing valve full cycle time',
  },

  // -------------------------------------------------------------------------
  // Vloerverwarming testmodus (P262)
  // -------------------------------------------------------------------------
  P262_floorHeatingTestMode: {
    address: 0x0206,
    min: 0,
    max: 1,
    name: 'Floor heating test mode selection',
    desc: '0=Enable, 1=Disable',
  },

} as const;

// ============================================================================
// BLOK 5: L-PARAMETERS (0x08000x0819) Read-Write
// Adresformule: L(n) 0x0800 + (n - 11) voor L11+
//
// L0L10: HANDMATIGE COMPONENT OVERRIDES NIET IMPLEMENTEREN
// Modbus adressen nu BEKEND via 0x0331 bitmask + 0x0332-0x0345 registers:
// L0/L1: Compressor 0x0331 Bit0 + 0x0332/0x0333 (forced freq)
// L2/L3: Fan 0x0331 Bit3 + 0x033E (forced speed)
// L4/L5: EEV 0x0331 Bit1 + 0x0336/0x0337 (forced open)
// L6/L7: EVI 0x0331 Bit2 + 0x033A/0x033B (forced open)
// L8/L9: DC Pump 0x0343 (mode) + 0x0344 (output %)
// L10: PFC 0x0345 (0=auto, 1=open/close, 2=open)
//
// WAARSCHUWING: Handmatige component-override kan de warmtepomp beschadigen.
// Alleen voor servicemonteurs met meetapparatuur.
// ============================================================================

export const L_PARAMETERS = {
  // --- Pipe Heating (L11) ---
  L11_pipeElecHeatingTime: {
    address: 0x0800, min: 1, max: 300, unit: 'min', name: 'Pipe electricity heating cycle',
  },

  // --- Sterilisatie / Legionella (L12L16) ---
  L12_sterilizationMode: {
    address: 0x0801,
    min: 0,
    max: 2,
    default: 0,
    name: 'Sterilization mode',
    desc: '0=auto, 1=off, 2=manual',
  }, // v2.2: default
  L13_sterilizationInterval: {
    address: 0x0802, min: 5, max: 30, default: 7, unit: 'days', name: 'Days between sterilizations',
  }, // v2.2: default
  L14_sterilizationStartTime: {
    address: 0x0803,
    default: 2300,
    name: 'Sterilization start time',
    desc: 'Format: HHMM (bijv. 2300 = 23:00). Default: 23:00',
  }, // v2.2: default
  L15_sterilizationRunTime: {
    address: 0x0804, min: 0, max: 50, default: 10, unit: 'min', name: 'Sterilization run time',
  }, // v2.2: default
  L16_sterilizationTemp: {
    address: 0x0805, min: 50, max: 80, default: 70, unit: '°C', name: 'Sterilization temperature',
  }, // v2.2: default

  // --- Water Level Control (L17L21) ---
  L17_waterLevelControl: {
    address: 0x0806,
    min: 0,
    max: 2,
    name: 'Water level control',
    desc: '0=Off, 1=Hi/Lo switch, 2=Hi/Hi/Lo switch',
  },
  L18_hydrationControl: {
    address: 0x0807,
    min: 0,
    max: 1,
    name: 'Hydration control',
    desc: '0=level only, 1=temp + level',
  },
  L19_allowWaterTemp: {
    address: 0x0808, min: 0, max: 99, default: 45, unit: '°C', name: 'Allow water temperature',
  },
  L20_hysteresisReplenishment: {
    address: 0x0809, min: 0, max: 20, default: 5, unit: '°C', name: 'Hysteresis replenishment water',
  },
  L21_lowWaterCutoff: {
    address: 0x080A,
    min: 0,
    max: 2,
    name: 'Low water cut-off operation',
    desc: '0=no start, 1=on but no start, 2=start',
  },

  // --- Retourwater Circulatie (L22L26) ---
  L22_backwaterMode: {
    address: 0x080B,
    min: 0,
    max: 3,
    default: 0,
    name: 'DHW return water setting',
    desc: '0=disable, 1=continuous return, 2=cycle return, 3=temperature diff return',
  }, // v2.2: default + desc
  L23_backwaterSetTemp: {
    address: 0x080C, min: 20, max: 65, default: 40, unit: '°C', name: 'Return water temp setting',
  }, // v2.2: default
  L24_backwaterHysteresis: {
    address: 0x080D, min: 1, max: 15, default: 5, unit: '°C', name: 'Return water temp differential',
  }, // v2.2: default
  L25_backwaterCycle: {
    address: 0x080E, min: 3, max: 90, default: 30, unit: 'min', name: 'Return water interval period',
  }, // v2.2: default
  L26_backwaterReturnTime: {
    address: 0x080F, min: 1, max: 30, default: 5, unit: 'min', name: 'Return water running period',
  }, // v2.2: default

  // --- DIY Stooklijn (L27L29) --- // v2.2
  //
  // NATIVE STOOKLIJN FORMULE:
  // Set temperature = k (ambient_temperature + 15) + b
  //
  // Dit is exact de formule die de Tweakers community handmatig berekent.
  // De controller heeft dit ingebouwd! Elimineert potentieel de noodzaak
  // voor een externe stooklijn-algoritme in de Homey app.
  //
  L27_heatingLowTempCurveDIY: {
    address: 0x0810,
    min: 0,
    max: 1,
    default: 0,
    name: 'Heating low temp curve DIY',
    desc: '0=enable DIY curve, 1=disable. Wanneer enabled, gebruikt L28/L29 i.p.v. preset curves',
  },
  L28_heatingCurveCoeffK: {
    address: 0x0811,
    min: -50,
    max: 0,
    name: 'Heating low temp curve coefficient k',
    desc: 'Negatief: dalende lijn. Tset = k  (Tamb + 15) + b. Bijv. k=-1.5 bij stooklijn RC=-1.5',
  },
  L29_heatingCurveConstantB: {
    address: 0x0812,
    min: 30,
    max: 80,
    name: 'Heating low temp curve constant b',
    desc: 'Y-intercept van de stooklijn. Bijv. b=52.5 voor typische VT installatie',
  },

  // --- Energieboekhouding (L30L36) --- // v2.2
  //
  // TOTALE SYSTEEM-COP: Door L31-L36 te configureren kan de controller
  // het totale energieverbruik bijhouden, inclusief E-heaters en pompen.
  //
  L30_heatingCapacityStats: {
    address: 0x0813,
    min: 0,
    max: 1,
    default: 0,
    name: 'Heating capacity statistics',
    desc: '0=enable, 1=disable. Schakelt interne energieboekhouding in.',
  },
  L31_externalPumpFlowRate: {
    address: 0x0814,
    min: 0,
    max: 999,
    unit: 'L/min',
    name: 'External pump flow rate',
    desc: 'Vaste waarde als er geen flowmeter is. Gebruikt voor COP berekening.',
  },
  L32_dhwEHeaterPower: {
    address: 0x0815, min: 0, max: 9999, unit: 'W', name: 'DHW electric heater power',
  },
  L33_pipeEHeater1Power: {
    address: 0x0816, min: 0, max: 9999, unit: 'W', name: 'Pipe electric heater 1 power',
  },
  L34_pipeEHeater2Power: {
    address: 0x0817, min: 0, max: 9999, unit: 'W', name: 'Pipe electric heater 2 power',
  },
  L35_heatingEHeaterPower: {
    address: 0x0818, min: 0, max: 9999, unit: 'W', name: 'Heating electric heater power',
  },
  L36_externalPumpPower: {
    address: 0x0819, min: 0, max: 9999, unit: 'W', name: 'External water pump power',
  },
} as const;

// ============================================================================
// BLOK 6: COMMAND REGISTERS Coils (0x10000x1023)
//
// v2.2: Dit zijn COIL adressen moeten via 05H (writeCoil) geschreven worden!
// NIET via 06H (writeSingleRegister) zoals in v2.0/v2.1.
//
// In modbus-serial:
// await client.writeCoil(address, true); // activeren
// await client.writeCoil(address, false); // deactiveren
// const result = await client.readCoils(address, 1); // lezen
//
// Alternatief: via 0x0330 register bitmask (zie USER_COMMANDS_REGISTERS)
// ============================================================================

export const COIL_ADDRESSES = {
  // --- Mode toggles ---
  powerfulMode: { address: 0x1000, name: 'Powerful Mode', isCoil: true }, // v2.2
  silentMode: { address: 0x1001, name: 'Silent Mode', isCoil: true }, // v2.2

  // --- Action commands ---
  quickHeatMode: { address: 0x1012, name: 'Quick Heat Mode', isCoil: true }, // v2.2: isCoil flag
  forceDefrost: { address: 0x1013, name: 'Force Defrost', isCoil: true }, // v2.2
  systemDrainMode: { address: 0x1014, name: 'System Drain Mode', isCoil: true }, // v2.2
  refrigerantRecovery: { address: 0x1015, name: 'Refrigerant Recovery', isCoil: true }, // v2.2
  forceSterilization: { address: 0x1018, name: 'Force Sterilization', isCoil: true }, // v2.2
  allowWaterReturn: { address: 0x101A, name: 'Allow Water Return', isCoil: true }, // v2.2
  restoreFactorySettings: { address: 0x101D, name: 'Restore Factory Settings', isCoil: true }, // v2.2

  // --- Forced control (SERVICE ONLY) ---
  compressorForcedControl: {
    address: 0x1020, name: 'Compressor Forced Control', isCoil: true, serviceOnly: true,
  }, // v2.2
  eevForcedControl: {
    address: 0x1021, name: 'EEV Forced Control', isCoil: true, serviceOnly: true,
  }, // v2.2
  eviForcedControl: {
    address: 0x1022, name: 'EVI Forced Control', isCoil: true, serviceOnly: true,
  }, // v2.2
  fanForcedControl: {
    address: 0x1023, name: 'Fan Forced Control', isCoil: true, serviceOnly: true,
  }, // v2.2
} as const;

// ============================================================================
// BLOK 7: USER COMMANDS REGISTERS (0x03300x0345) Read-Write
//
// v2.2: Register-based alternative voor coil commands.
// Voordeel: meerdere commando's tegelijk via bitmask in n register write.
// ============================================================================

/** 0x0330 Unit Control bitmask */
export const UNIT_CONTROL_BITS = { // v2.2
  QUICK_HEAT: 1 << 2, // Bit2
  FORCE_DEFROST: 1 << 3, // Bit3
  SYSTEM_DRAIN: 1 << 4, // Bit4
  REFRIGERANT_RECOVERY: 1 << 5, // Bit5
  FORCE_STERILIZATION: 1 << 8, // Bit8
  ALLOW_WATER_RETURN: 1 << 10, // Bit10
  RESTORE_FACTORY: 1 << 13, // Bit13
} as const;

/** 0x0331 Load Forcing Control bitmask */
export const LOAD_FORCING_BITS = { // v2.2
  COMPRESSOR: 1 << 0, // Bit0
  EEV: 1 << 1, // Bit1
  EVI: 1 << 2, // Bit2
  FAN: 1 << 3, // Bit3
} as const;

export const USER_COMMANDS_REGISTERS = { // v2.2
  unitControl: { address: 0x0330, name: 'Unit Control', bits: UNIT_CONTROL_BITS },
  loadForcingControl: {
    address: 0x0331, name: 'Load Forcing Control', bits: LOAD_FORCING_BITS, serviceOnly: true,
  },
  compressor1ForcedFreq: {
    address: 0x0332, min: 0, max: 120, unit: 'Hz', name: 'Compressor 1 forced freq', serviceOnly: true,
  },
  compressor2ForcedFreq: {
    address: 0x0333, min: 0, max: 120, unit: 'Hz', name: 'Compressor 2 forced freq', serviceOnly: true,
  },
  eev1ForcedOpen: {
    address: 0x0336, min: 0, max: 500, unit: 'P', name: 'EEV 1 forced open', serviceOnly: true,
  },
  eev2ForcedOpen: {
    address: 0x0337, min: 0, max: 500, unit: 'P', name: 'EEV 2 forced open', serviceOnly: true,
  },
  evi1ForcedOpen: {
    address: 0x033A, min: 0, max: 500, unit: 'P', name: 'EVI EEV 1 forced open', serviceOnly: true,
  },
  evi2ForcedOpen: {
    address: 0x033B, min: 0, max: 500, unit: 'P', name: 'EVI EEV 2 forced open', serviceOnly: true,
  },
  fanForcedSpeed: {
    address: 0x033E, min: 0, max: 80, unit: 'Hz', name: 'Fan forced speed', serviceOnly: true,
  },
  dcPumpControl: {
    address: 0x0343, min: 0, max: 1, name: 'DC Pump Control', desc: '0=Auto, 1=Manual',
  },
  dcPumpOutput: {
    address: 0x0344, min: 0, max: 100, unit: '%', name: 'DC Pump Output',
  },
  pfcControl: {
    address: 0x0345, min: 0, max: 2, name: 'PFC Control', desc: '0=Auto, 1=Open/Close, 2=Open', serviceOnly: true,
  },
} as const;

// ============================================================================
// BLOK 8: VERSION INFO (0x03600x0363) Read-Only
// ============================================================================

export const VERSION_REGISTERS = { // v2.2
  programVersion: { address: 0x0360, name: 'Program Version', desc: '100 = V1.0.0' },
  productType: {
    address: 0x0361,
    name: 'Product Type',
    desc: '0=Commercial inverter, 1=Domestic ON/OFF, 2=Commercial ON/OFF',
  },
  productTypeId: {
    address: 0x0362,
    name: 'Product Type ID',
    desc: 'Sub-type. 1-domestic: 0=inverter. 0-commercial: 0=2-unit, 1=3-unit',
  },
  protocolVersion: {
    address: 0x0363,
    name: 'Protocol Version',
    desc: '100=V1.0.0. 130 = coil support (01H/05H) + separate curve registers (0x0313-0x0316)',
  },
} as const;

// ============================================================================
// MODE & OPTION ENUMS
// ============================================================================

/** 0x0304 Set Mode 8 opties */
export const MODE_OPTIONS = {
  0: 'Cooling',
  1: 'Heating',
  2: 'Hot Water',
  3: 'Floor Heating',
  4: 'Hot Water + Cooling',
  5: 'Hot Water + Heating',
  6: 'Reserve',
  7: 'Hot Water + Floor Heating',
} as const;

/** 0x0307 Running Mode */
export const RUNNING_MODE_OPTIONS = {
  0: 'Standard',
  1: 'High Power (Boost)',
  2: 'Silent',
} as const;

/** 0x03130x0316 Curve Settings (Protocol 130) */
export const CURVE_OPTIONS = { // v2.2: uitgebreid
  0: 'Off',
  1: 'High Temp Curve 1',
  2: 'High Temp Curve 2',
  3: 'High Temp Curve 3',
  4: 'High Temp Curve 4',
  5: 'High Temp Curve 5',
  6: 'High Temp Curve 6',
  7: 'High Temp Curve 7',
  8: 'High Temp Curve 8',
  11: 'Low Temp Curve 1',
  12: 'Low Temp Curve 2',
  13: 'Low Temp Curve 3',
  14: 'Low Temp Curve 4',
  15: 'Low Temp Curve 5',
  16: 'Low Temp Curve 6',
  17: 'Low Temp Curve 7',
  18: 'Low Temp Curve 8',
} as const;

/** P119 Refrigerant Type */
export const REFRIGERANT_OPTIONS = {
  1: 'R410A',
  2: 'R32', // Adlar Castra Aurora II
  3: 'R290',
} as const;

/** P30 Defrost Mode */
export const DEFROST_MODE_OPTIONS = {
  0: 'Smart',
  1: 'Timing',
  2: 'Fast',
  3: 'Dew Point', // v2.2
} as const;

/** P37 Shutdown Mode (aka "Darwin") */
export const SHUTDOWN_MODE_OPTIONS = {
  0: 'Smart',
  1: 'Direct (Darwin)',
  2: 'Refrig Smart',
} as const;

/** P28 Pump Mode at Shutdown */
export const PUMP_SHUTDOWN_OPTIONS = {
  0: 'Keep Running',
  1: 'Stop',
  2: 'Cooling Only',
  3: 'AC/Heating Only', // v2.2: verduidelijkt
  4: 'Floor Only',
} as const;

/** P06 Fan Type */
export const FAN_TYPE_OPTIONS = {
  0: 'AC',
  1: 'DC',
  2: 'EC',
} as const;

/** P101 Pump Control Mode */
export const PUMP_CONTROL_MODE_OPTIONS = {
  0: 'AC (on/off)',
  1: 'DC (PWM)',
} as const;

/** P150 Secondary Heating Pump */
export const SECONDARY_PUMP_OPTIONS = { // v2.2: uitgebreid
  0: 'Power On Run',
  1: 'Power On',
  2: 'Linkage Demand Switch',
  3: 'Temperature Control', // v2.2
} as const;

/** P161 Auxiliary Pump Selection */
export const AUX_PUMP_OPTIONS = {
  0: 'DHW',
  1: 'AC',
  2: 'Floor',
  3: 'AC + Floor',
  4: 'All',
} as const;

/** P164 Energy Level Control */
export const ENERGY_LEVEL_OPTIONS = {
  0: 'All Enable',
  1: 'E-heating Disable',
  2: 'Compressor Disable',
  3: 'All Disable',
} as const;

/** P139/P140 Electric Heating Options */
export const EHEATING_OPTIONS = {
  0: 'Enable',
  1: 'Disable',
  2: 'AHS', // v2.2: was "Gas Boiler"
} as const;

/** P181 Defrost Selection Evaporate Side */
export const DEFROST_SELECTION_OPTIONS = { // v2.2
  0: 'Current Mode',
  1: 'Heating',
  2: 'DHW',
} as const;

/** P182 Pipe Electric Heating Option */
export const PIPE_EHEATING_OPTIONS = { // v2.2
  0: '3kW + 6kW',
  1: '3kW',
  2: '6kW',
  3: 'Disabled',
} as const;

/** P254 Heating Medium */
export const HEATING_MEDIUM_OPTIONS = { // v2.2
  0: 'Water',
  1: 'Antifreeze Liquid',
} as const;

/** P05 Linkage Switch */
export const LINKAGE_SWITCH_OPTIONS = { // v2.2
  0: 'Enable',
  1: 'Disable',
  2: 'Thermostatic',
  3: 'Heating Thermostat',
} as const;

/** L12 Sterilization Mode */
export const STERILIZATION_MODE_OPTIONS = {
  0: 'Auto',
  1: 'Off',
  2: 'Manual',
} as const;

/** L17 Water Level Control Mode */
export const WATER_LEVEL_OPTIONS = {
  0: 'Off',
  1: 'Hi/Lo Switch',
  2: 'Hi/Hi/Lo Switch',
} as const;

/** L22 DHW Return Water / Backwater Mode */
export const BACKWATER_MODE_OPTIONS = {
  0: 'Disable',
  1: 'Continuous Return',
  2: 'Cycle Return',
  3: 'Temperature Diff Return',
} as const;

/** L21 Low Water Cut-off Operation */
export const LOW_WATER_CUTOFF_OPTIONS = {
  0: 'No Start',
  1: 'On But No Start',
  2: 'Start',
} as const;

/** 0x0361 Product Type */
export const PRODUCT_TYPE_OPTIONS = { // v2.2
  0: 'Commercial Inverter',
  1: 'Domestic ON/OFF',
  2: 'Commercial ON/OFF',
} as const;

// ============================================================================
// BATCHED READ GROUPS Optimale poll strategie
// ============================================================================

/** Poll elke 5s compacte kernregisters; optioneel adaptief naar 2s bij wijziging. */
export const POLL_GROUP_SUPERFAST = {
  name: 'superfast',
  interval: 5_000,
  reads: [
    { start: 0x0000, count: 2, label: 'Status 1+2' },
    { start: 0x0027, count: 2, label: 'Compressor target frequency 1+2' },
    { start: 0x0040, count: 1, label: 'Compressor running frequency' },
    { start: 0x004F, count: 2, label: 'Water inlet T6 + outlet T7' },
    { start: 0x0057, count: 2, label: 'Water pump PWM + water flow' },
    { start: 0x005C, count: 1, label: 'Device input power' },
  ],
} as const;

/** Poll elke 10s Operationele data */
export const POLL_GROUP_FAST = {
  name: 'fast',
  interval: 10_000,
  reads: [
    { start: 0x0000, count: 2, label: 'Status 1+2' },
    { start: 0x0040, count: 19, label: 'WP1 Sensors (0x40–0x52)' },
    { start: 0x0054, count: 10, label: 'WP1 Sensors (0x54–0x5D)' },
  ],
} as const;

/** Poll elke 30s Monitoring */
export const POLL_GROUP_MEDIUM = {
  name: 'medium',
  interval: 30_000,
  reads: [
    { start: 0x0002, count: 8, label: 'Fault State 13 + Sys1 Faults (0x020x09)' }, // v2.2: was 38
    {
      start: 0x0019, count: 8, label: 'Relay 1-4 + Switch 1-4 (0x190x20)', optional: true as const,
    }, // v2.2: was 68
    {
      start: 0x0072, count: 12, label: 'Aux/Buffer/Grid/Zone', optional: true as const,
    },
    { start: 0x0300, count: 14, label: 'Control 0x300–0x30D' },
    { start: 0x0313, count: 7, label: 'Curves & Zone 0x0313–0x0319' }, // verplaatst van SLOW: max 40s feedback na write
    { start: 0x01FF, count: 2, label: 'P255/P256 Smart Grid' }, // verplaatst van SLOW: max 40s feedback na write
    { start: 0x080B, count: 5, label: 'L22L26 backwater circulatie' },
    { start: 0x0810, count: 3, label: 'L27L29 DIY stooklijn' }, // verplaatst van SLOW: max 30s feedback na write (ADR-049)
  ],
} as const;

/**
 * Poll elke 300s Configuratie & COP-relevante parameters
 * Bevat alleen vaste configuratie die niet via flow cards geschreven wordt.
 * Schrijfbare registers (curves, Smart Grid, DIY stooklijn) zitten in POLL_GROUP_MEDIUM.
 */
export const POLL_GROUP_SLOW = {
  name: 'slow',
  interval: 300_000,
  reads: [
    { start: 0x0174, count: 5, label: 'P116P120 (temp ctrl, antifreeze, refrigerant)' },
    { start: 0x011E, count: 1, label: 'P30 defrost mode' },
    { start: 0x0132, count: 10, label: 'P50P59 freq limits (constants+cooling+heating)' }, // v2.2: was 0x0133/9 0x0132/10
    { start: 0x013C, count: 6, label: 'P60P65 freq limits (constants+hot water)' }, // v2.2: was 0x013D/5 0x013C/6
    { start: 0x0158, count: 2, label: 'P88/P89 silent mode freq' },
    { start: 0x0165, count: 1, label: 'P101 pump control mode' },
    { start: 0x011A, count: 1, label: 'P26 H&C Hysteresis return diff' },
    { start: 0x011B, count: 1, label: 'P27 Floor heating Hysteresis return diff' },
    { start: 0x0160, count: 1, label: 'P96 DHW differential value' },
    { start: 0x01A4, count: 1, label: 'P164 energy level control' },
    {
      start: 0x0813, count: 7, label: 'L30L36 energieboekhouding', optional: true as const,
    }, // v2.2
  ],
} as const;

/**
 * Eenmalig bij connect Version info + configuratie die zelden verandert
 */
export const POLL_GROUP_ONCE = { // v2.2
  name: 'once',
  interval: 0, // Eenmalig
  reads: [
    { start: 0x0053, count: 1, label: 'Device Tooling No (0x53)' },
    {
      start: 0x0360, count: 4, label: 'Version Info (0x3600x363)', optional: true as const,
    },
    { start: 0x0100, count: 11, label: 'P00P10 Protection switches' },
    { start: 0x010B, count: 6, label: 'P11–P16 Protection values' },
    { start: 0x0111, count: 9, label: 'P17–P25 Fan speeds & temp protections' },
    { start: 0x011C, count: 2, label: 'P28–P29 Antifreeze pump' },
    { start: 0x011F, count: 7, label: 'P31–P37 Defrost params' },
    { start: 0x0126, count: 1, label: 'P38 Heating main valve opening const' },
    { start: 0x0127, count: 1, label: 'P39 Pressure sensor settings' },
    { start: 0x0128, count: 3, label: 'P40–P42 EEV superheat corrections' },
    { start: 0x012B, count: 3, label: 'P43–P45 MV, water flow switch, Modbus addr' },
    { start: 0x012E, count: 2, label: 'P46–P47 EVI liquid injection & superheat' },
    { start: 0x0130, count: 2, label: 'P48–P49 DHW tank temp sensor & hot water freq' },
    { start: 0x0142, count: 5, label: 'P66–P70 Fan freq limits' },
    { start: 0x0147, count: 17, label: 'P71–P87 EEV enthalpy & valve params' },
    { start: 0x015A, count: 5, label: 'P90–P94 EVI conditions' },
    { start: 0x015F, count: 1, label: 'P95 Network pump mode' },
    { start: 0x0161, count: 2, label: 'P97–P98 Tank temp compensation' },
    { start: 0x0163, count: 2, label: 'P99–P100' },
    { start: 0x0166, count: 1, label: 'P102 Four-way valve mode' },
    { start: 0x0167, count: 1, label: 'P103 Pump running mode' },
    { start: 0x0168, count: 1, label: 'P104 Mode switch freq %' },
    { start: 0x0169, count: 9, label: 'P105–P113 Temp limits (cooling/heating/DHW)' },
    { start: 0x0172, count: 2, label: 'P114–P115 System config' },
    { start: 0x0179, count: 12, label: 'P121–P132 Freq shield zones' },
    { start: 0x0185, count: 1, label: 'P133 Fan module' },
    { start: 0x0186, count: 1, label: 'P134 Fan module type' },
    { start: 0x0187, count: 4, label: 'P135–P138 Anti-condensation & defrost compressor' },
    { start: 0x018B, count: 2, label: 'P139–P140 AHS heating source' },
    { start: 0x018D, count: 2, label: 'P141–P142 Dew point defrost' },
    { start: 0x018F, count: 3, label: 'P143–P145 Defrost & antifreeze' },
    { start: 0x0192, count: 1, label: 'P146 Cooling antifreeze mode' },
    { start: 0x0193, count: 3, label: 'P147–P149 Cooling antifreeze' },
    { start: 0x0196, count: 3, label: 'P150–P152 Control mode & return diff' },
    { start: 0x0199, count: 2, label: 'P153–P154 Heat source temp limits' },
    { start: 0x019B, count: 6, label: 'P155–P160 Aux EEV & limit temps' },
    { start: 0x01A1, count: 3, label: 'P161–P163 Energy level settings' },
    { start: 0x01A5, count: 9, label: 'P165–P173 Load shedding & cascading' },
    { start: 0x01AE, count: 1, label: 'P174 Powerful mode duration' },
    { start: 0x01AF, count: 6, label: 'P175–P180 Defrost timing & powerful mode' },
    { start: 0x01B5, count: 2, label: 'P181–P182 Defrost selection & pipe heating' },
    {
      start: 0x01B7, count: 71, label: 'P183–P253 Werkconditie-ijkpunten', optional: true as const,
    },
    { start: 0x01FE, count: 1, label: 'P254 Heating medium' },
    { start: 0x0201, count: 3, label: 'P257–P259 Dual zone & mixing valve' },
    { start: 0x0204, count: 3, label: 'P260–P262 Dual zone extra params' },
    {
      start: 0x0800, count: 11, label: 'L01–L21 DHW & sterilization settings', optional: true as const,
    },
  ],
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Decode alle actieve faults uit de 3 globale fault registers
 */
export function decodeFaults(fault1: number, fault2: number, fault3: number): string[] {
  const active: string[] = [];

  const check = (value: number, bits: Record<string, number>, prefix: string) => {
    for (const [name, mask] of Object.entries(bits)) {
      if (value & mask) {
        active.push(`${prefix}.${name}`);
      }
    }
  };

  check(fault1, FAULT_1_BITS, 'F1');
  check(fault2, FAULT_2_BITS, 'F2');
  check(fault3, FAULT_3_BITS, 'F3');

  return active;
}

/**
 * Decode relay status naar leesbare actieve componenten
 */
export function decodeRelayStatus(relay1: number, relay2: number, relay3?: number, relay4?: number): string[] {
  const active: string[] = [];

  const check = (value: number, bits: Record<string, number>) => {
    for (const [name, mask] of Object.entries(bits)) {
      if (value & mask) {
        active.push(name.toLowerCase().replace(/_/g, ' '));
      }
    }
  };

  check(relay1, RELAY_1_BITS);
  check(relay2, RELAY_2_BITS);
  if (relay3 !== undefined) check(relay3, RELAY_3_BITS);
  if (relay4 !== undefined) check(relay4, RELAY_4_BITS);

  return active;
}

/**
 * Converteer DC fan frequentie (Hz) naar RPM.
 * Formule uit P66 documentatie: Speed [RPM] = frequency [Hz] 15
 */
export function fanFreqToRpm(frequencyHz: number): number {
  return frequencyHz * FAN_RPM_MULTIPLIER;
}

/**
 * Converteer DC fan RPM naar frequentie (Hz).
 */
export function fanRpmToFreq(rpm: number): number {
  return Math.round(rpm / FAN_RPM_MULTIPLIER);
}

/**
 * Valideer koelmiddel type. Retourneert true als P119 waarde overeenkomt
 * met verwacht type voor Adlar Castra Aurora II (R32 = 2).
 */
export function validateRefrigerant(p119Value: number): {
  valid: boolean;
  type: number;
  name: string;
  expected: string;
} {
  const name = (REFRIGERANT_OPTIONS as Record<number, string>)[p119Value] ?? `Unknown(${p119Value})`;
  return {
    valid: p119Value === EXPECTED_REFRIGERANT,
    type: p119Value,
    name,
    expected: REFRIGERANT_OPTIONS[EXPECTED_REFRIGERANT],
  };
}

/**
 * Bepaal welke minimum frequentie-parameter actief is op basis van buitentemperatuur.
 * Bruikbaar voor COP-optimalisatie monitoring.
 */
export function getActiveMinFreqParam(
  mode: 'heating' | 'hotwater',
  ambientTemp: number,
): string {
  if (mode === 'heating') {
    if (ambientTemp > 0) return 'P57_heatingMinFreq_above0';
    if (ambientTemp >= -10) return 'P58_heatingMinFreq_neg10to0';
    return 'P59_heatingMinFreq_below10';
  }
  if (ambientTemp > 0) return 'P63_hotWaterMinFreq_above0';
  if (ambientTemp >= -10) return 'P64_hotWaterMinFreq_neg10to0';
  return 'P65_hotWaterMinFreq_below10';

}

/**
 * v2.2: Check of het protocol coil commands ondersteunt.
 * Lees 0x0363 en vergelijk met MIN_PROTOCOL_COIL_SUPPORT.
 */
export function protocolSupportsCoils(protocolVersion: number): boolean {
  return protocolVersion >= MIN_PROTOCOL_COIL_SUPPORT;
}

/**
 * v2.2: Bereken stooklijn temperatuur via native DIY formule.
 *
 * @param k L28 cofficint (negatief, bijv. -1.5)
 * @param b L29 constante (bijv. 52.5)
 * @param ambientTemp Buitentemperatuur in °C
 * @returns Berekende aanvoertemperatuur in °C
 */
export function calculateDIYCurveTemp(k: number, b: number, ambientTemp: number): number {
  return k * (ambientTemp + 15) + b;
}

/**
 * v2.2: Encode temperatuur voor register write.
 * Vermenigvuldigt met 10 voor raw register waarde.
 *
 * @param tempCelsius Temperatuur in °C (bijv. 45.0)
 * @returns Raw register waarde (bijv. 450)
 */
export function encodeTemperature(tempCelsius: number): number {
  return Math.round(tempCelsius / TEMP_MULTIPLY);
}

/**
 * v2.2: Decode raw register waarde naar temperatuur in °C.
 *
 * @param rawValue Raw register waarde (bijv. 450)
 * @returns Temperatuur in °C (bijv. 45.0)
 */
export function decodeTemperature(rawValue: number): number {
  return rawValue * TEMP_MULTIPLY;
}

/**
 * Interpoleer een non-lineaire kalibratie curve.
 *
 * Gebruikt voor acInputCurrent (0x0045) die significant afwijkt van lineair,
 * met name bij lage stromen (4A raw → slechts 2.9A werkelijk = 38% overschatting).
 *
 * Zonder correctie zijn COP-berekeningen 15-20% te laag bij deellast!
 *
 * @param rawValue  Waarde NA de multiply-schaling (dus na raw * 0.1 voor current)
 * @param curve     Array van { raw, actual } kalibratie datapunten (gesorteerd op raw)
 * @returns         Gecalibreerde waarde; extrapolatie buiten bereik via lineaire slope
 *
 * @example
 * const rawCurrent = register45Value * 0.1;   // bijv. 70 → 7.0 A
 * const actualCurrent = interpolateCalibration(rawCurrent, SENSOR_REGISTERS.acInputCurrent.calibrationCurve!);
 * // → 5.5 A (gecalibreerd)
 */
export function interpolateCalibration(
  rawValue: number,
  curve: Array<{ raw: number; actual: number }>,
): number {
  if (curve.length === 0) return rawValue;

  // Onder bereik: return eerste actual waarde
  if (rawValue <= curve[0].raw) return curve[0].actual;

  // Boven bereik: extrapoleer via laatste twee punten
  if (rawValue >= curve[curve.length - 1].raw) {
    const last = curve[curve.length - 1];
    const prev = curve[curve.length - 2];
    const slope = (last.actual - prev.actual) / (last.raw - prev.raw);
    return last.actual + slope * (rawValue - last.raw);
  }

  // Lineaire interpolatie binnen bereik
  for (let i = 0; i < curve.length - 1; i++) {
    if (rawValue >= curve[i].raw && rawValue <= curve[i + 1].raw) {
      const t = (rawValue - curve[i].raw) / (curve[i + 1].raw - curve[i].raw);
      return curve[i].actual + t * (curve[i + 1].actual - curve[i].actual);
    }
  }

  return rawValue; // fallback
}
