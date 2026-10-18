/**
 * adlar3-modbus-registers.ts
 *
 * Modbus register definitions for the Adlar Castra Aurora III series heat pump.
 *
 * SCOPE: best-effort definitions derived from:
 *   1. The Aurora III official register map spreadsheet (125 registers, "Register Map" tab)
 *   2. The earlier Home Assistant package adlar_heatpump.yaml (12 registers used) and
 *   3. its successor adlar_warmtepomp.yaml (both from OnnoTimmermans/HA-modbus-Adlar-aurora-Pro-III
 *      on GitHub, 2026) — practical use of Reg 2101/2102/2103 on hardware
 *   4. Cross-mapping against legacy Aurora II semantics where useful
 *
 *   The official register map (source 1) is leading. The HA packages are only used where the map
 *   is silent or demonstrably contradicted by working installations; such cases keep an @verify.
 *
 * NOTATION:
 *   - Aurora III uses Modbus Modicon-style addressing:
 *       3-NNNN  = Input Register   (FC04, read-only sensor data, address range 0–109)
 *       4-NNNN  = Holding Register (FC03/06, read/write setpoints, address range 2100–2114)
 *   - The numeric `address` field is the bare register number (e.g. 50, 2107) — that is what
 *     the Modbus PDU carries. The function code is selected via `fc` ('input' | 'holding').
 *   - Aurora II addresses (when referenced in comments) are real hex (0x004A = 74 decimal).
 *
 * VERIFICATION STATUS:
 *   Many fields are flagged with @verify markers. These are best-effort values that should be
 *   confirmed against hardware before relying on them in production. See VERIFICATION_TASKS
 *   at the bottom of this file for the consolidated list.
 *
 * IMPORTANT DIFFERENCES FROM AURORA II (READ THESE BEFORE WRITING DRIVER CODE):
 *   - System status bitmap (STATUS_BITS) uses ENTIRELY DIFFERENT bit positions from Aurora II.
 *   - Water flow unit is m³/h on III, L/min on II (factor 60).
 *   - III has no native power register — power must be derived (V × I) or sourced externally.
 *   - III lacks a dedicated main on/off switch — space heating is switched per zone via Reg 2101
 *     and DHW via Reg 2102 (verify 2101 on hardware).
 *   - III pressure sensors report kPa directly; Aurora II only had saturation temperature.
 *
 * Version: 0.1.0-draft (best-effort, pre-hardware-verification)
 */

// ============================================================================
// BLOCK 1: TYPES & CONSTANTS
// ============================================================================

/** Modbus function code group. */
export type ModbusFC = 'input' | 'holding';
//   'input'   → FC04 (Read Input Register)              — Modicon "3-NNNN"
//   'holding' → FC03 (Read), FC06/16 (Write)             — Modicon "4-NNNN"

/** Standard scale factor used by all temperature registers. raw = degC * 10. */
export const TEMP_MULTIPLY = 0.1;

/** Default Modbus unit-id used by the YAML reference (slave 1). */
export const DEFAULT_UNIT_ID = 1;

/** Standard scan interval used by the YAML reference (seconds). */
export const DEFAULT_SCAN_INTERVAL_S = 30;

/**
 * Map a register definition to a Modicon-style reference string for logging/UI.
 * Examples: refOf({ address: 50, fc: 'input' })   → '3-50'
 *           refOf({ address: 2107, fc: 'holding' }) → '4-2107'
 */
export function refOf(reg: { address: number; fc: ModbusFC }): string {
  return `${reg.fc === 'input' ? '3' : '4'}-${reg.address}`;
}

/** Decode a raw register value to its physical value using a scale factor. */
export function scaleRegisterValue(raw: number, multiply: number): number {
  return raw * multiply;
}

/**
 * Aurora III sign convention: spec marks registers as either U16 (unsigned) or S16 (signed).
 * For S16 registers a 16-bit raw must be sign-extended before scaling.
 */
export function decodeS16(raw: number): number {
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

// ============================================================================
// BLOCK 2: SYSTEM STATUS BITS (Reg 38)
// ============================================================================
//
// Reg 38 (3-38) is a 16-bit bitmask that consolidates multiple status flags into a single
// register. Aurora II splits the same information across two registers (0x0000 + 0x0001) with
// fully named bits — Aurora III packs everything into one register with a different bit layout.
//
// VERIFIED bits (from adlar_heatpump.yaml reference implementation):
//
//   Bit 0  → Oil return active
//   Bit 1  → Defrost active
//   Bit 2  → Anti-freezing active
//   Bit 4  → Disinfection (sterilization) active
//   Bit 11 → Outdoor temperature too low (compressor blocked)
//
// The remaining 11 bits are UNDOCUMENTED. The names below marked `// @verify` are educated
// guesses based on Aurora II's STATUS_1_BITS / STATUS_2_BITS — they MUST be confirmed by
// logging Reg 38 across a full operational cycle (idle → start → run → defrost → fault → ...).
//
// ============================================================================

export const STATUS_BITS = {
  /** Bit 0: Oil-return cycle active. VERIFIED. */
  OIL_RETURN: 0x0001,
  /** Bit 1: Defrost cycle active. VERIFIED. */
  DEFROST: 0x0002,
  /** Bit 2: Anti-freezing cycle active. VERIFIED. */
  ANTI_FREEZING: 0x0004,
  /** Bit 3: UNKNOWN — possibly fault alarm (II maps Bit3 to FAULT_ALARM). @verify */
  RESERVED_BIT_3: 0x0008,
  /** Bit 4: Disinfection / sterilization cycle. VERIFIED. */
  DISINFECTION: 0x0010,
  /** Bits 5–10: UNKNOWN. @verify */
  RESERVED_BIT_5: 0x0020,
  RESERVED_BIT_6: 0x0040,
  RESERVED_BIT_7: 0x0080,
  RESERVED_BIT_8: 0x0100,
  RESERVED_BIT_9: 0x0200,
  RESERVED_BIT_10: 0x0400,
  /** Bit 11: Outdoor temperature too low — compressor blocked. VERIFIED. */
  OUTDOOR_TEMP_TOO_LOW: 0x0800,
  /** Bits 12–15: UNKNOWN. @verify */
  RESERVED_BIT_12: 0x1000,
  RESERVED_BIT_13: 0x2000,
  RESERVED_BIT_14: 0x4000,
  RESERVED_BIT_15: 0x8000,
} as const;

/** Helper: test whether a status bit is set in a Reg 38 raw value. */
export function statusBitSet(reg38Raw: number, bit: number): boolean {
  return (reg38Raw & bit) !== 0;
}

// ============================================================================
// BLOCK 3: ADDITIONAL FUNCTION A BIT-FIELD (Reg 2103)
// ============================================================================
//
// Reg 2103 is "Additional function A" — a writable holding register that packs multiple
// configuration flags into one word. Layout per the official register map:
//
//   Bit 3     → Forced electrical heater
//   Bits 4–5  → Silent mode level 0/1/2 (mask 0x0030, shifted right by 4); level 2 only for R290 units
//   Bit 6     → Disinfection mode (read-only in this app, as in the HA package)
//   Bits 0–2, 7–15 → Reserved
//
// Reserved bits are PRESERVED on writes via read-modify-write.
// Aurora II exposes silent mode via a dedicated enum register (0x0307 runningMode) which also
// supports a "Powerful" boost mode — Aurora III appears to lack the boost option.
//
// ============================================================================

export const FUNCTION_A_BITS = {
  /** Bit 3: forced electric backup heater. */
  FORCED_BACKUP_HEATER: 0x0008,
  /** Bit 6: disinfection function enabled. Read-only in this app. */
  DISINFECTION_ENABLED: 0x0040,
} as const;

/** Return `raw` with `mask` set or cleared; all other bits are preserved. */
export function setBitFlag(raw: number, mask: number, on: boolean): number {
  return (on ? (raw | mask) : (raw & ~mask)) & 0xFFFF;
}

export const SILENT_MODE_MASK = 0x0030;     // bits 4-5
export const SILENT_MODE_SHIFT = 4;

export enum SilentMode {
  Off = 0,
  Level1 = 1,
  /** Official map: only for R290 heat pumps (Reg 7 = REFRIGERANT_R290). */
  Level2 = 2,
  // Level 3 reserved by encoding but not documented in the official map
}

/** Reg 7 value for R290 units (0 = R32). */
export const REFRIGERANT_R290 = 1;

/** Decode silent-mode level from raw Reg 2103 value. */
export function decodeSilentMode(reg2103Raw: number): SilentMode {
  return ((reg2103Raw & SILENT_MODE_MASK) >> SILENT_MODE_SHIFT) as SilentMode;
}

/** Encode a new silent-mode level while preserving the other 14 bits. */
export function encodeSilentMode(currentReg2103Raw: number, newLevel: SilentMode): number {
  const cleared = currentReg2103Raw & ~SILENT_MODE_MASK;
  return cleared | (newLevel << SILENT_MODE_SHIFT);
}

// ============================================================================
// BLOCK 4: HVAC MODE ENUM (Reg 2100)
// ============================================================================
//
// Reg 2100 controls the HVAC mode. The YAML references verify three values (1/2/4). Value 0 is
// never written by this app: on/off goes through the zone control register 2101 (Block 4b).
//
// ============================================================================

export enum HvacMode {
  /** @verify  Hypothesized OFF state — Aurora III has no dedicated on/off register. */
  Off = 0,
  /** Cooling mode. VERIFIED. */
  Cool = 1,
  /** Heating mode. VERIFIED. */
  Heat = 2,
  /** @verify  Mode value 3 is unmapped — possibly DHW or dehumidify. */
  Reserved3 = 3,
  /** Auto mode. VERIFIED. */
  Auto = 4,
}

// ============================================================================
// BLOCK 4b: ZONE CONTROL (Reg 2101) & EFFECTIVE MODE (Reg 9)
// ============================================================================
//
// Reg 2101 switches space heating/cooling per zone (extended HA YAML reference). DHW is
// switched separately via Reg 2102 (0 = off, 1 = on). Writing 2101 from this app is the
// on/off mechanism; it is guarded by the `experimental_zone_onoff` device setting until
// hardware tests confirm it.
//
// Reg 9 reports which functions are effectively active right now.
//
// ============================================================================

export enum ZoneControl {
  AllOff = 0,
  Zone1On = 1,
  Zone2On = 2,
  AllOn = 3,
}

export const EFFECTIVE_MODE_BITS = {
  COOLING: 0x0001,
  HEATING: 0x0002,
  DHW: 0x0004,
} as const;

/** Reg 39: request for an external heating source (hybrid systems), per the official map. */
export const EXTERNAL_HEAT_SOURCE_REQUEST_BITS = {
  /** B0: request external heating source during anti-freezing mode. */
  AHS_REQUEST_ANTI_FREEZING: 0x0001,
  /** B1: request external heating source during defrosting mode. */
  AHS_REQUEST_DEFROSTING: 0x0002,
} as const;

// ============================================================================
// BLOCK 4c: FAULT & PROTECTION CODE BIT-FIELDS (Reg 90-101)
// ============================================================================
//
// Each register covers 16 codes: bit n of the k-th register (k = 0..5) is code k*16 + n + 1.
// Example: Reg 90 = 0x0004 → E03; Reg 97 = 0x0001 → P17.
//
// ============================================================================

const ERROR_CODE_BASE_ADDRESS = 90;
const PROTECTION_CODE_BASE_ADDRESS = 96;
const CODE_REGISTER_COUNT = 6;

/**
 * Bit table for registers that are bit fields, as name → single-bit mask (for dashboards).
 * Multi-bit fields are listed per bit, e.g. silent mode bits 4-5 as two entries.
 */
export function registerBitTable(address: number, fc: ModbusFC): Record<string, number> | undefined {
  if (fc === 'holding') {
    if (address !== 2103) return undefined;
    return {
      FORCED_BACKUP_HEATER: FUNCTION_A_BITS.FORCED_BACKUP_HEATER,
      SILENT_MODE_BIT4: 0x0010,
      SILENT_MODE_BIT5: 0x0020,
      DISINFECTION_ENABLED: FUNCTION_A_BITS.DISINFECTION_ENABLED,
    };
  }
  if (address === 38) return { ...STATUS_BITS };
  if (address === 39) return { ...EXTERNAL_HEAT_SOURCE_REQUEST_BITS };
  if (address === 9) return { ...EFFECTIVE_MODE_BITS };
  for (const [prefix, base] of [['E', ERROR_CODE_BASE_ADDRESS], ['P', PROTECTION_CODE_BASE_ADDRESS]] as const) {
    const index = address - base;
    if (index >= 0 && index < CODE_REGISTER_COUNT) {
      const bits: Record<string, number> = {};
      for (let bit = 0; bit < 16; bit++) {
        bits[`${prefix}${String(index * 16 + bit + 1).padStart(2, '0')}`] = 1 << bit;
      }
      return bits;
    }
  }
  return undefined;
}

/** Decode consecutive code-bitfield registers into codes like "E03" or "P17". */
export function decodeCodeBits(prefix: string, words: readonly number[]): string[] {
  const codes: string[] = [];
  words.forEach((word, wordIndex) => {
    for (let bit = 0; bit < 16; bit++) {
      if ((word & (1 << bit)) !== 0) {
        codes.push(`${prefix}${String(wordIndex * 16 + bit + 1).padStart(2, '0')}`);
      }
    }
  });
  return codes;
}

// ============================================================================
// BLOCK 5: SENSOR REGISTERS (Input Registers, FC04)
// All addresses below are READ-ONLY input registers. Modicon ref: 3-NNNN.
// ============================================================================
//
// Calibration notes (carried over from Aurora II — applicability to Aurora III @verify):
//   - acInputCurrent (Reg 75) is likely the SAME non-linear sensor used on Aurora II.
//     Without correction, derived power readings are 18–38% too low at part load.
//     The Aurora II calibrationCurve should be tried as a default until disproven.
//   - acInputVoltage (Reg 74) likely reads ~1% high (Aurora II empirical finding).
//
// ============================================================================

export interface InputRegister {
  address: number;
  fc: 'input';
  dataType: 'U16' | 'S16';
  unit?: string;
  multiply?: number;   // physical value = raw * multiply (after sign-extension if S16)
  name: string;
  desc?: string;
}

export const SENSOR_REGISTERS: Record<string, InputRegister> = {
  // --- Room / Indoor ---
  roomTemperature: {
    address: 40, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Room Temperature (Tldr)',
    desc: 'Indoor room temperature. Aurora II has no equivalent (only setpoint).',
  },

  // --- Hydraulic Temperatures ---
  totalLeavingWaterTemp: {
    address: 41, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Total Leaving Water Temperature (TC)',
    desc: 'Total outlet temperature after auxiliary heat source. II ≈ 0x0075.',
  },
  inletWaterTemp: {
    address: 42, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Retour Water Temperature (TE1)',
    desc: 'Return water from installation. II ≈ 0x004F.',
  },
  outletWaterTemp: {
    address: 43, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Aanvoer Water Temperature (TA)',
    desc: 'Supply water to installation (Temperatuur Aanvoer). II ≈ 0x0050. Used as climate.current_temperature.',
  },
  bufferTankUpperTemp: {
    address: 44, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Buffer Tank Upper Part Temperature (TE2)',
    desc: 'Spec marks RESERVED — verify presence on actual hardware.',
  },
  bufferTankLowerTemp: {
    address: 45, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Buffer Tank Lower Part Temperature (TW)',
    desc: 'II has only one buffer sensor (0x0074); III splits upper/lower.',
  },
  dhwTankTemp: {
    address: 46, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'DHW Water Tank Temperature (TZ2)',
    desc: 'II ≈ 0x0054.',
  },
  zone2MixingInletTemp: {
    address: 47, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Mixing Station Inlet Water Temperature (Tso)',
  },
  solarHeatingTemp: {
    address: 48, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Solar Water Heating Temperature (T3-solar)',
    desc: 'Caveat: Aurora III spec uses label "T3" for both Reg 48 (solar) and Reg 49 (coil).',
  },
  outdoorCoilTemp: {
    address: 49, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Outdoor Unit Coil Temperature (T3)',
    desc: 'II ≈ 0x004B (T2).',
  },

  // --- Ambient & Refrigerant ---
  ambientTemp: {
    address: 50, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Ambient Temperature (T4)',
    desc: 'Outdoor ambient. II ≈ 0x004A (T1).',
  },
  exvOutletTemp: {
    address: 51, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'EXV Valve Outlet Temperature (T5)',
    desc: 'II has two economizer sensors (0x0051, 0x0052); III has only this one.',
  },
  dischargeTemp: {
    address: 52, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Compressor Discharge Temperature (TP)',
    desc: 'II ≈ 0x004E (called "Exhaust Temp T5").',
  },
  suctionTemp: {
    address: 53, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Compressor Suction Temperature (TH)',
    desc: 'II ≈ 0x004D (T4).',
  },

  // --- Setpoints (read-only; controller-computed) ---
  targetOutletTemp: {
    address: 56, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Target Outlet Setting Temperature (TOut)',
    desc: 'Controller-computed setpoint after curve+modulation. Compare with Reg 43 to assess control performance.',
  },

  // --- Hydraulic ---
  inletWaterPressure: {
    address: 60, fc: 'input', dataType: 'U16', unit: 'Bar', /* @verify scale */ multiply: 0.1,
    name: 'Inlet Water Pressure',
    desc: 'Spec marks RESERVED — may not be populated on all units. @verify',
  },
  outletWaterPressure: {
    address: 61, fc: 'input', dataType: 'U16', unit: 'Bar', /* @verify scale */ multiply: 0.1,
    name: 'Outlet Water Pressure',
    desc: 'YAML uses scale 0.1; spec does not declare scale. @verify',
  },
  pumpPwmOutput: {
    address: 62, fc: 'input', dataType: 'U16', unit: '%', multiply: 1,
    name: 'PWM Percentage of DC Water Pump',
    desc: 'II ≈ 0x0057.',
  },
  pumpPwmFeedback: {
    address: 63, fc: 'input', dataType: 'U16', unit: 'm³/h', /* @verify */ multiply: 0.1,
    name: 'PWM Feedback DC Water Pump',
    desc: 'Official map: scale x10, unit m³/h ("123 means 12.3 m³/h"), although the title says "percentage". '
        + 'The extended HA YAML reads it as % x1. @verify on hardware. Not used for capabilities.',
  },
  waterFlow: {
    address: 64, fc: 'input', dataType: 'U16', unit: 'm³/h', /* @verify scale */ multiply: 0.1,
    name: 'Actual Water Flow of DC Pump',
    desc: '⚠️ UNIT DIFFERS FROM AURORA II (II=L/min, III=m³/h, factor 60). YAML uses scale 0.1.',
  },

  // --- Climate Curve Outputs (read-only computed setpoints) ---
  zone1CurveCoolingSetTemp: {
    address: 66, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 1 Climate Curve Cooling Set Temperature',
  },
  zone1CurveHeatingSetTemp: {
    address: 67, fc: 'input', dataType: 'S16', unit: '°C',
    /* @verify — official map says scale x1; both HA YAML references use x10 like all other °C registers. */
    multiply: TEMP_MULTIPLY,
    name: 'Zone 1 Climate Curve Heating Set Temperature',
    desc: 'Follows outdoor temperature — polled in the slow group. Scale conflict: official map x1, HA x10. @verify',
  },
  zone2CurveCoolingSetTemp: {
    address: 68, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Climate Curve Cooling Set Temperature',
  },
  zone2CurveHeatingSetTemp: {
    address: 69, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Climate Curve Heating Set Temperature',
  },

  // --- Compressor / Fan / EEV ---
  mainEevOpenDegree: {
    address: 70, fc: 'input', dataType: 'U16', unit: 'P', multiply: 1,
    name: 'Main EEV Open Degree',
    desc: 'Steps. II ≈ 0x0042.',
  },
  auxEevOpenDegree: {
    address: 71, fc: 'input', dataType: 'U16', unit: 'P', multiply: 1,
    name: 'Auxiliary EEV Open Degree',
    desc: 'Spec marks RESERVED but likely returns useful values. II ≈ 0x0043 (EVI valve). @verify',
  },
  fanSpeed: {
    address: 72, fc: 'input', dataType: 'U16', unit: 'RPM', multiply: 1,
    name: 'Speed of No.1 DC Fan',
    desc: 'II ≈ 0x0041.',
  },

  // --- Electrical ---
  acInputVoltage: {
    address: 74, fc: 'input', dataType: 'U16', unit: 'V', multiply: 1,
    name: 'AC Input Voltage',
    desc: 'Reads 0 on some firmware (extended HA YAML). '
        + 'Aurora II applies 0.99 calibration factor (~1% sensor offset). Likely also applies here. @verify',
  },
  acInputCurrent: {
    address: 75, fc: 'input', dataType: 'U16', unit: 'A', multiply: 0.1,
    name: 'AC Input Current',
    desc: 'Reads 0 on some firmware (extended HA YAML). '
        + '⚠️ Aurora II documents non-linear sensor (38% error @4A → 18% @10A). '
        + 'III likely uses same sensor architecture. Apply calibration curve before deriving power. @verify',
  },
  dcBusVoltage: {
    address: 76, fc: 'input', dataType: 'U16', unit: 'V', multiply: 1,
    name: 'DC Bus Voltage',
    desc: 'III-only continuous reading. II only reports DC bus over/undervoltage as fault bits.',
  },
  compressorCurrent: {
    address: 77, fc: 'input', dataType: 'U16', unit: 'A', multiply: 0.1,
    name: 'Compressor Phase Current',
    desc: 'II ≈ 0x0046.',
  },
  compressorTargetFreq: {
    address: 78, fc: 'input', dataType: 'U16', unit: 'Hz', multiply: 1,
    name: 'Compressor Target Frequency',
    desc: 'II ≈ 0x0027 (in STATUS_REGISTER_MAP).',
  },
  compressorRunningFreq: {
    address: 79, fc: 'input', dataType: 'U16', unit: 'Hz', multiply: 1,
    name: 'Compressor Actual Frequency',
    desc: 'II ≈ 0x0040.',
  },

  // --- Status / Control Outputs ---
  systemStatus: {
    address: 38, fc: 'input', dataType: 'U16',
    name: 'System Status (16-bit bitmask)',
    desc: 'Decode using STATUS_BITS. See Block 2 for verified bit definitions.',
  },
  ahsRequest: {
    address: 39, fc: 'input', dataType: 'U16',
    name: 'Request External Heating Source (Hybrid)',
    desc: 'Only for hybrid systems. B0 = request external heating source during anti-freezing mode, '
        + 'B1 = request external heating source during defrosting mode (official map). Not decoded into capabilities.',
  },
  mainPumpStatus: {
    address: 80, fc: 'input', dataType: 'U16',
    name: 'Main Water Pump On/Off',
    desc: 'II ≈ 0x0019 bit 6 (RELAY_1.MAIN_CIRCULATING_PUMP).',
  },
  fourWayValveStatus: {
    address: 81, fc: 'input', dataType: 'U16',
    name: 'Four Way Valve On/Off',
    desc: '0 = heating cycle, 1 = cooling or defrost cycle. II ≈ 0x001A bit 3 (RELAY_2.FOUR_WAY_VALVE_1).',
  },

  // --- Refrigerant Pressure (III-only direct readings) ---
  highPressure: {
    address: 86, fc: 'input', dataType: 'U16', unit: 'kPa', /* @verify scale */ multiply: 1,
    name: 'High Pressure',
    desc: 'III-only direct kPa reading. II only had saturation-temperature derivative.',
  },
  lowPressure: {
    address: 87, fc: 'input', dataType: 'U16', unit: 'kPa', multiply: 1,
    name: 'Low Pressure',
    desc: 'Same as highPressure. @verify scale',
  },

  // --- Fault & Protection Codes ---
  errorCodes_E01_E16: {
    address: 90, fc: 'input', dataType: 'U16',
    name: 'Error Codes E01-E16',
    desc: 'Bit field (official map: "bit by bit operation"): bit n = code E(n+1). Same layout for Reg 91-101 '
        + '(Reg 96-101 = P01-P96). Decode with decodeCodeBits().',
  },
  errorCodes_E17_E32: { address: 91, fc: 'input', dataType: 'U16', name: 'Error Codes E17-E32' },
  errorCodes_E33_E48: { address: 92, fc: 'input', dataType: 'U16', name: 'Error Codes E33-E48' },
  errorCodes_E49_E64: { address: 93, fc: 'input', dataType: 'U16', name: 'Error Codes E49-E64' },
  errorCodes_E65_E80: { address: 94, fc: 'input', dataType: 'U16', name: 'Error Codes E65-E80' },
  errorCodes_E81_E96: { address: 95, fc: 'input', dataType: 'U16', name: 'Error Codes E81-E96' },

  protectionCodes_P01_P16: {
    address: 96, fc: 'input', dataType: 'U16',
    name: 'Protection Codes P01-P16',
  },
  protectionCodes_P17_P32: { address: 97, fc: 'input', dataType: 'U16', name: 'Protection Codes P17-P32' },
  protectionCodes_P33_P48: { address: 98, fc: 'input', dataType: 'U16', name: 'Protection Codes P33-P48' },
  protectionCodes_P49_P64: { address: 99, fc: 'input', dataType: 'U16', name: 'Protection Codes P49-P64' },
  protectionCodes_P65_P80: { address: 100, fc: 'input', dataType: 'U16', name: 'Protection Codes P65-P80' },
  protectionCodes_P81_P96: { address: 101, fc: 'input', dataType: 'U16', name: 'Protection Codes P81-P96' },

  // --- Operation Mode Readback ---
  currentTargetOpMode: {
    address: 102, fc: 'input', dataType: 'U16',
    name: 'Current Target Operation Mode',
    desc: 'Official map: B3-B0 zone 1 (or single zone) target mode, B7-B4 zone 2 target mode '
        + '(0x0 standby, 0x1 cooling, 0x2 heating); B11-B8 DHW target mode (0x0 standby, 0x8 DHW); '
        + 'upper bits: auto target mode (map text is ambiguous). Not decoded into capabilities.',
  },
  actualOpMode: {
    address: 103, fc: 'input', dataType: 'U16',
    name: 'Actual Operation Mode',
    desc: 'Official map: B3-B0 zone 1 (or single zone) operation mode, B7-B4 zone 2 operation mode '
        + '(0x0 standby, 0x1 cooling, 0x2 heating); B11-B8 DHW operation mode (0x0 standby, 0x8 DHW). '
        + 'Not decoded into capabilities.',
  },
} as const;

// ============================================================================
// BLOCK 6: CONTROL REGISTERS (Holding Registers, FC03/06)
// All addresses below are READ/WRITE holding registers. Modicon ref: 4-NNNN.
// ============================================================================

export interface HoldingRegister {
  address: number;
  fc: 'holding';
  dataType: 'U16' | 'S16';
  unit?: string;
  multiply?: number;
  min?: number;
  max?: number;
  name: string;
  desc?: string;
  readOnly?: boolean;
}

export const CONTROL_REGISTERS: Record<string, HoldingRegister> = {
  // --- HVAC Mode ---
  hvacMode: {
    address: 2100, fc: 'holding', dataType: 'U16',
    name: 'Air Conditioning Modes',
    desc: 'See HvacMode enum. Verified: 1=Cool, 2=Heat, 4=Auto. On/off is Reg 2101, not value 0.',
  },
  hvacZoneControlMode: {
    address: 2101, fc: 'holding', dataType: 'U16',
    name: 'Air Conditioning Modes (Zone Control)',
    desc: 'See ZoneControl enum: 0=all off, 1=zone 1 on, 2=zone 2 on, 3=all on (extended HA YAML). '
        + 'Drives onoff; writes require the experimental_zone_onoff setting. @verify on hardware.',
  },

  // --- DHW On/Off ---
  dhwOnOff: {
    address: 2102, fc: 'holding', dataType: 'U16',
    name: 'DHW Mode On/Off',
    desc: '0 = off, 1 = on (extended HA YAML). Aurora II uses 0x0305 mainSwitch + 0x0304 mode for the same purpose.',
  },

  // --- Additional Function A (bit field, see Block 3) ---
  additionalFunctionA: {
    address: 2103, fc: 'holding', dataType: 'U16',
    name: 'Additional Function A (backup heater bit 3, silent mode bits 4-5, disinfection bit 6)',
    desc: 'Use FUNCTION_A_BITS and the silent-mode helpers. Unknown bits are preserved via RMW.',
  },
  additionalFunctionB: {
    address: 2104, fc: 'holding', dataType: 'U16',
    name: 'Additional Function B (Reserved)',
    desc: 'Reserved additional-function register. Keep at 0 unless verified on hardware.',
    readOnly: true,
  },

  // --- Setpoints ---
  dhwSetTemp: {
    address: 2105, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    min: 20, max: 75, /* @verify ranges — taken from Aurora II */
    name: 'DHW Mode Water Temperature Setting',
    desc: 'II ≈ 0x0302. Active limits in Reg 14/15.',
  },
  zone1CoolingSetTemp: {
    address: 2106, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    min: 7, max: 25, /* @verify */
    name: 'Zone 1 Cooling Mode Temperature Setting',
    desc: 'II ≈ 0x0300. Active limits in Reg 10/11.',
  },
  zone1HeatingSetTemp: {
    address: 2107, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    min: 18, max: 50, /* From YAML number platform definition */
    name: 'Zone 1 Heating Mode Temperature Setting',
    desc: 'II ≈ 0x0301. Used as climate.target_temperature in YAML.',
  },
  zone1AutoCoolingSetTemp: {
    address: 2108, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 1 Auto Mode Cooling Temperature Setting',
    desc: 'III-only. Aurora II has no auto-mode subdivision per zone.',
  },
  zone1AutoHeatingSetTemp: {
    address: 2109, fc: 'holding', dataType: 'S16', unit: '°C',
    /* @verify — spec lists scale x1, almost certainly a typo (other °C registers are x10).
       This is a WRITABLE register — verify BEFORE writing or risk a 10× setpoint error. */
    multiply: TEMP_MULTIPLY,
    name: 'Zone 1 Auto Mode Heating Temperature Setting',
    desc: '⚠️ SPEC SCALE TYPO RISK. Confirm before write.',
  },
  zone2CoolingSetTemp: {
    address: 2110, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Cooling Mode Temperature Setting',
  },
  zone2HeatingSetTemp: {
    address: 2111, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Heating Mode Temperature Setting',
  },
  zone2AutoCoolingSetTemp: {
    address: 2112, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Auto Mode Cooling Temperature Setting',
  },
  zone2AutoHeatingSetTemp: {
    address: 2113, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Zone 2 Auto Mode Heating Temperature Setting',
  },
  roomTempSetTemp: {
    address: 2114, fc: 'holding', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    min: 16, max: 28, /* From extended HA YAML; active limits in Reg 30/31 take precedence */
    name: 'Room Temperature Setting',
    desc: 'II ≈ 0x0306 indoorTempSetpoint. May have no effect without a room thermostat (Reg 1 = 0).',
  },
} as const;

// ============================================================================
// BLOCK 7: STATIC LIMIT REGISTERS (Reg 10-31, read-only U16)
// ============================================================================
//
// These registers hold the configured upper/lower limits per zone × mode. They are static
// (configured once) — Aurora II has runtime-computed active limits at 0x00FA-0x00FF instead.
// Useful at startup to populate min/max on UI capabilities.
//
// All scales TEMP_MULTIPLY (x10). The four "x1" entries in the spec for Reg 16, 27, 67, 2109
// are flagged as suspected typos (see VERIFICATION_TASKS).
//
// ============================================================================

export const LIMIT_REGISTERS: Record<string, InputRegister> = {
  zone1CoolingUpperLimit: { address: 10, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Cooling Upper Limit' },
  zone1CoolingLowerLimit: { address: 11, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Cooling Lower Limit' },
  zone1HeatingUpperLimit: { address: 12, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Heating Upper Limit' },
  zone1HeatingLowerLimit: { address: 13, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Heating Lower Limit' },
  dhwUpperLimit:          { address: 14, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'DHW Upper Limit' },
  dhwLowerLimit:          { address: 15, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'DHW Lower Limit' },
  zone1AutoCoolingUpperLimit: {
    address: 16, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Z1 Auto Cooling Upper Limit',
    desc: '@verify — spec lists scale x1, almost certainly typo.',
  },
  zone1AutoCoolingLowerLimit: { address: 17, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Auto Cooling Lower Limit' },
  zone1AutoHeatingUpperLimit: { address: 18, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Auto Heating Upper Limit' },
  zone1AutoHeatingLowerLimit: { address: 19, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z1 Auto Heating Lower Limit' },
  zone2CoolingUpperLimit: { address: 20, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Cooling Upper Limit' },
  zone2CoolingLowerLimit: { address: 21, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Cooling Lower Limit' },
  zone2HeatingUpperLimit: { address: 22, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Heating Upper Limit' },
  zone2HeatingLowerLimit: { address: 23, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Heating Lower Limit' },
  zone2AutoCoolingUpperLimit: { address: 26, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Auto Cooling Upper Limit' },
  zone2AutoCoolingLowerLimit: {
    address: 27, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY,
    name: 'Z2 Auto Cooling Lower Limit',
    desc: '@verify — spec lists scale x1, almost certainly typo.',
  },
  zone2AutoHeatingUpperLimit: { address: 28, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Auto Heating Upper Limit' },
  zone2AutoHeatingLowerLimit: { address: 29, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Z2 Auto Heating Lower Limit' },
  roomTempUpperLimit: { address: 30, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Room Temperature Upper Limit' },
  roomTempLowerLimit: { address: 31, fc: 'input', dataType: 'S16', unit: '°C', multiply: TEMP_MULTIPLY, name: 'Room Temperature Lower Limit' },
} as const;

export const CONFIG_REGISTERS: Record<string, InputRegister> = {
  totalRegisterCount: {
    address: 0, fc: 'input', dataType: 'U16',
    name: 'Total Number of Modbus Registers',
    desc: 'Total register count in the Aurora III map: 110 input registers plus 15 holding registers.',
  },
  thermostatControllerType: {
    address: 1, fc: 'input', dataType: 'U16',
    name: 'Third Party Thermostat Controller Type',
    desc: '0=none, 1=single zone on/off + mode, 2=single zone on/off, 3=two zones.',
  },
  zoneControlModeWithoutThermostat: {
    address: 2, fc: 'input', dataType: 'U16',
    name: 'Single Zone or Two Zones Control Without Third Party Thermostat',
    desc: '0=single zone, 1=two zones.',
  },
  singleZoneControlWithoutThermostat: { address: 3, fc: 'input', dataType: 'U16', name: 'Single Zone Control Without Third Party Thermostat' },
  twoZonesControlWithoutThermostat: { address: 4, fc: 'input', dataType: 'U16', name: 'Two Zones Control Without Third Party Thermostat' },
  singleZoneControlWithThermostat: { address: 5, fc: 'input', dataType: 'U16', name: 'Single Zone Control With Thermostat' },
  twoZonesControlWithThermostat: { address: 6, fc: 'input', dataType: 'U16', name: 'Two Zones Control With Thermostat' },
  refrigerantType: {
    address: 7, fc: 'input', dataType: 'U16',
    name: 'Refrigerant Type',
    desc: '0=R32, 1=R290.',
  },
  unitType: {
    address: 8, fc: 'input', dataType: 'U16',
    name: 'Unit Type',
    desc: 'Bit field. Exact model mapping is not documented in the public register sheet. @verify.',
  },
  effectiveMode: {
    address: 9, fc: 'input', dataType: 'U16',
    name: 'Effective Mode',
    desc: 'Bit field (EFFECTIVE_MODE_BITS): bit0=cooling, bit1=heating, bit2=DHW. Dynamic — polled in the medium group.',
  },
  zone1TerminalCooling: {
    address: 34, fc: 'input', dataType: 'U16',
    name: 'Zone 1 Terminal Type for Cooling',
    desc: '0=FCU, 1=radiator, 2=floor heating circuit.',
  },
  zone1TerminalHeating: {
    address: 35, fc: 'input', dataType: 'U16',
    name: 'Zone 1 Terminal Type for Heating',
    desc: '0=FCU, 1=radiator, 2=floor heating circuit.',
  },
  zone2TerminalCooling: {
    address: 36, fc: 'input', dataType: 'U16',
    name: 'Zone 2 Terminal Type for Cooling',
    desc: '0=FCU, 1=radiator, 2=floor heating circuit.',
  },
  zone2TerminalHeating: {
    address: 37, fc: 'input', dataType: 'U16',
    name: 'Zone 2 Terminal Type for Heating',
    desc: '0=FCU, 1=radiator, 2=floor heating circuit.',
  },
} as const;

export const RESERVED_INPUT_REGISTERS: Record<string, InputRegister> = {
  reserved24: { address: 24, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved25: { address: 25, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved32: { address: 32, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved33: { address: 33, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved54: { address: 54, fc: 'input', dataType: 'S16', name: 'Reserved' },
  reserved55: { address: 55, fc: 'input', dataType: 'S16', name: 'Reserved' },
  reserved57: { address: 57, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved58: { address: 58, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved59: { address: 59, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved65: { address: 65, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved73: { address: 73, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved82: { address: 82, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved83: { address: 83, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved84: { address: 84, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved85: { address: 85, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved88: { address: 88, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved89: { address: 89, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved104: { address: 104, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved105: { address: 105, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved106: { address: 106, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved107: { address: 107, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved108: { address: 108, fc: 'input', dataType: 'U16', name: 'Reserved' },
  reserved109: { address: 109, fc: 'input', dataType: 'U16', name: 'Reserved' },
} as const;

// ============================================================================
// BLOCK 8: AGGREGATED REGISTER MAP (for driver iteration)
// ============================================================================

/** All registers grouped by function code, for batched polling. */
export const ALL_INPUT_REGISTERS = {
  ...CONFIG_REGISTERS,
  ...LIMIT_REGISTERS,
  ...SENSOR_REGISTERS,
  ...RESERVED_INPUT_REGISTERS,
} as const;
export const ALL_HOLDING_REGISTERS = CONTROL_REGISTERS;

// ============================================================================
// BLOCK 9: DERIVED CALCULATIONS (HA YAML helpers, transcribed to TS)
// ============================================================================

/** ΔT across the heat exchanger (supply − return), in °C. */
export function deltaT(outletTempC: number, inletTempC: number): number {
  return outletTempC - inletTempC;
}

/**
 * Thermal power in kW.
 *   Q = c_p × ρ × V̇ × ΔT
 * Constant 1.163 = c_p × ρ for water in (kW × h) / (m³ × K).
 * NOTE: requires waterFlow already in m³/h (i.e. Reg 64 already scaled).
 */
export function thermalPowerKw(flowM3h: number, deltaTC: number): number {
  return 1.163 * flowM3h * deltaTC;
}

/**
 * COP. Returns null if input power is too low (< 50 W) or thermal power is non-positive.
 * Mirrors the YAML logic: avoids divide-by-zero and meaningless ratios at idle.
 */
export function cop(thermalKw: number, electricalW: number): number | null {
  if (electricalW <= 50 || thermalKw <= 0) return null;
  return thermalKw / (electricalW / 1000);
}

// ============================================================================
// BLOCK 10: VERIFICATION TASKS
// ============================================================================
//
// Items below MUST be confirmed against hardware before trusting the related register
// definitions. Listed in priority order.
//
// ============================================================================

export const VERIFICATION_TASKS = [
  {
    priority: 'critical',
    item: 'AC current sensor non-linearity',
    affects: ['SENSOR_REGISTERS.acInputCurrent', 'derived measure_power'],
    issue: 'Aurora II documents 38% error @4A → 18% @10A. Unknown if III shares the sensor.',
    action: 'Compare Reg 75 readings against external ammeter across 2-15A range.',
  },
  {
    priority: 'critical',
    item: 'Reg 2109 scale factor (writable)',
    affects: ['CONTROL_REGISTERS.zone1AutoHeatingSetTemp'],
    issue: 'Spec lists x1 while peer registers are x10. Writable → typo causes 10× setpoint.',
    action: 'Read register, compare with UI display. DO NOT WRITE before confirmation.',
  },
  {
    priority: 'high',
    item: 'On/Off mechanism via Reg 2101 (zone control)',
    affects: ['CONTROL_REGISTERS.hvacZoneControlMode', 'onoff capability', 'setting experimental_zone_onoff'],
    issue: 'Value list 0/1/2/3 comes from the extended HA YAML; never written from Homey before.',
    action: 'Testers: enable experimental_zone_onoff, switch off/on, confirm space heating stops/resumes '
          + 'and DHW (Reg 2102) is unaffected. Check single- and two-zone installations.',
  },
  {
    priority: 'high',
    item: 'Reg 38 full bit mapping',
    affects: ['STATUS_BITS bits 3, 5-10, 12-15'],
    issue: 'Only 5 bits verified (from YAML); 11 bits unmapped.',
    action: 'Log Reg 38 across full operational cycle (idle/start/run/defrost/sterilize/fault).',
  },
  {
    priority: 'high',
    item: 'Error code bit fields (E01-E96, P01-P96)',
    affects: ['SENSOR_REGISTERS.errorCodes_*', 'SENSOR_REGISTERS.protectionCodes_*'],
    issue: 'Bit fields per the official map ("bit by bit operation"). Code-to-description mapping not in the map.',
    action: 'Compare a reported code with the code on the unit display during a real fault.',
  },
  {
    priority: 'medium',
    item: 'Reg 67 scale factor (climate curve heating set temperature)',
    affects: ['SENSOR_REGISTERS.zone1CurveHeatingSetTemp'],
    issue: 'Official map says x1 ("123 means 123 °C"); both HA YAML references read it as x10. Read-only.',
    action: 'Compare the dashboard value with the curve setpoint shown on the unit display.',
  },
  {
    priority: 'low',
    item: 'Reg 63 meaning and scale (PWM feedback DC water pump)',
    affects: ['SENSOR_REGISTERS.pumpPwmFeedback'],
    issue: 'Official map title says percentage, but scale x10 with unit m³/h; HA reads % x1. Not used for capabilities.',
    action: 'Compare Reg 63 with Reg 62 (PWM output) and Reg 64 (flow) during pump operation.',
  },
  {
    priority: 'medium',
    item: 'Water flow unit confirmation',
    affects: ['SENSOR_REGISTERS.waterFlow'],
    issue: 'Spec says m³/h; YAML uses scale 0.1 → could be dL/min OR 0.1 m³/h.',
    action: 'Compare register value to external flow meter reading.',
  },
  {
    priority: 'medium',
    item: 'Reg 71 (auxiliary EEV) availability',
    affects: ['SENSOR_REGISTERS.auxEevOpenDegree'],
    issue: 'Spec marks RESERVED but II equivalent (0x0043) is functional.',
    action: 'Read Reg 71 across operating conditions; if value varies → usable.',
  },
  {
    priority: 'medium',
    item: 'Reg 2103 writes on hardware',
    affects: ['FUNCTION_A_BITS', 'SILENT_MODE_MASK'],
    issue: 'Layout is documented in the official map (bit 3 forced electric heater, bits 4-5 silent, bit 6 '
         + 'disinfection, other bits reserved). Silent level 2 is only for R290 units (Reg 7 = 1).',
    action: 'Testers: switch silent mode and forced heater; confirm the other bits stay unchanged.',
  },
  {
    priority: 'medium',
    item: 'Refrigerant pressure scale (Reg 86, 87)',
    affects: ['SENSOR_REGISTERS.highPressure', 'SENSOR_REGISTERS.lowPressure'],
    issue: 'Reg 87 listed as x1; Reg 86 has no scale. Unit kPa, ranges unknown.',
    action: 'Compare with manometer if available, or theoretical values from saturation tables.',
  },
  {
    priority: 'low',
    item: 'Operation mode enum (Reg 102, 103)',
    affects: ['SENSOR_REGISTERS.currentTargetOpMode', 'SENSOR_REGISTERS.actualOpMode'],
    issue: 'No value-list in spec.',
    action: 'Log both registers during mode transitions.',
  },
] as const;

// ============================================================================
// END OF FILE
// ============================================================================
