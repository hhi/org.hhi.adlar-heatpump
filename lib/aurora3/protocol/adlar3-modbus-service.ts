/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Adlar Castra Aurora III — Modbus Service
 *
 * Aurora III uses FC04 input registers for sensors/status and FC03/FC06
 * holding registers for writable setpoints. This service deliberately blocks
 * writes marked as hardware-verification risks in the register draft.
 */

import { EventEmitter } from 'events';

import {
  ModbusTcpConfig, ModbusTcpService, PollBlock, PollGroup, RegisterChangeEntry, RegisterChangeLogMode, TimerProvider,
} from './modbus-tcp-service';
import {
  CONFIG_REGISTERS,
  CONTROL_REGISTERS,
  EFFECTIVE_MODE_BITS,
  FUNCTION_A_BITS,
  HvacMode,
  LIMIT_REGISTERS,
  REFRIGERANT_R290,
  SENSOR_REGISTERS,
  STATUS_BITS,
  SilentMode,
  ZoneControl,
  decodeCodeBits,
  decodeS16,
  decodeSilentMode,
  encodeSilentMode,
  setBitFlag,
  statusBitSet,
} from './adlar3-modbus-registers';
import { DeviceFeature } from './modbus-runtime-service';

type TemperatureRegisterScale = 'x10';

interface CalibrationPoint {
  raw: number;
  actual: number;
}

interface NumericRegisterDefinition {
  address: number;
  name: string;
  unit?: string;
  multiply?: number;
  min?: number;
  max?: number;
  dataType?: 'U16' | 'S16';
  calibrationCurve?: ReadonlyArray<CalibrationPoint>;
}

export interface RegisterPollGroupDefinition {
  name: string;
  interval: number;
  reads: readonly PollBlock[];
}

interface SensorDescriptor {
  key: string;
  def: NumericRegisterDefinition;
  signed?: boolean;
}

const TEMP_MULTIPLY = 0.1;
const MIN_COP_POWER_KW = 0.10;
const MIN_COP_DELTA_T_C = 0.5;
/** Below this flow the ΔT-based thermal power is not meaningful (extended HA YAML: 0.3 m³/h). */
const MIN_THERMAL_FLOW_M3H = 0.3;
/** Plausibility window for limit registers 10-31 before they are used to bound a write. */
const LIMIT_PLAUSIBLE_MIN_C = -30;
const LIMIT_PLAUSIBLE_MAX_C = 100;
const MAX_VALID_COP = 15.0;

const ADLAR3_POLL_SUPERFAST_DEF: RegisterPollGroupDefinition = {
  name: 'superfast',
  interval: 5_000,
  reads: [
    { start: 38, count: 2, label: 'AIII status 3-38..3-39', fc: 'input' },
    { start: 42, count: 2, label: 'AIII return/supply temps 3-42..3-43', fc: 'input' },
    { start: 64, count: 1, label: 'AIII water flow 3-64', fc: 'input' },
    { start: 79, count: 1, label: 'AIII compressor actual freq 3-79', fc: 'input' },
  ],
};

const ADLAR3_POLL_FAST_DEF: RegisterPollGroupDefinition = {
  name: 'fast',
  interval: 10_000,
  reads: [
    { start: 40, count: 17, label: 'AIII temperatures 3-40..3-56', fc: 'input' },
    { start: 62, count: 3, label: 'AIII pump/flow 3-62..3-64', fc: 'input' },
    { start: 70, count: 10, label: 'AIII compressor/electric 3-70..3-79', fc: 'input' },
    { start: 80, count: 2, label: 'AIII outputs 3-80..3-81', fc: 'input' },
  ],
};

const ADLAR3_POLL_MEDIUM_DEF: RegisterPollGroupDefinition = {
  name: 'medium',
  interval: 30_000,
  reads: [
    { start: 9, count: 1, label: 'AIII effective mode 3-9', fc: 'input', optional: true },
    { start: 60, count: 2, label: 'AIII pressures 3-60..3-61', fc: 'input', optional: true },
    { start: 86, count: 18, label: 'AIII pressure/fault/opmode 3-86..3-103', fc: 'input', optional: true },
    { start: 2100, count: 15, label: 'AIII controls 4-2100..4-2114', fc: 'holding' },
  ],
};

const ADLAR3_POLL_SLOW_DEF: RegisterPollGroupDefinition = {
  name: 'slow',
  interval: 300_000,
  reads: [
    { start: 10, count: 22, label: 'AIII limits 3-10..3-31', fc: 'input', optional: true },
    // Climate-curve setpoints follow the outdoor temperature, so they are re-read here.
    { start: 66, count: 4, label: 'AIII climate curve outputs 3-66..3-69', fc: 'input', optional: true },
  ],
};

const ADLAR3_POLL_ONCE_DEF: RegisterPollGroupDefinition = {
  name: 'once',
  interval: 0,
  reads: [
    { start: 0,  count: 10, label: 'AIII config 3-0..3-9',                   fc: 'input' },
    { start: 34, count: 4,  label: 'AIII zone terminal types 3-34..3-37',     fc: 'input' },
  ],
};

const SENSOR_DESCRIPTORS: readonly SensorDescriptor[] = [
  { key: 'roomTemp', def: SENSOR_REGISTERS.roomTemperature, signed: true },
  { key: 'totalOutlet', def: SENSOR_REGISTERS.totalLeavingWaterTemp, signed: true },
  { key: 'retourTE1', def: SENSOR_REGISTERS.inletWaterTemp, signed: true },
  { key: 'aanvoerTA', def: SENSOR_REGISTERS.outletWaterTemp, signed: true },
  { key: 'bufferTankTemp', def: SENSOR_REGISTERS.bufferTankLowerTemp, signed: true },
  { key: 'dhwTankTemp', def: SENSOR_REGISTERS.dhwTankTemp, signed: true },
  { key: 'zone2Temp', def: SENSOR_REGISTERS.zone2MixingInletTemp, signed: true },
  { key: 'outerCoilT3', def: SENSOR_REGISTERS.outdoorCoilTemp, signed: true },
  { key: 'ambientT4', def: SENSOR_REGISTERS.ambientTemp, signed: true },
  { key: 'suctionTH', def: SENSOR_REGISTERS.suctionTemp, signed: true },
  { key: 'dischargeTP', def: SENSOR_REGISTERS.dischargeTemp, signed: true },
  { key: 'pumpPwm', def: SENSOR_REGISTERS.pumpPwmOutput },
  { key: 'waterFlow', def: SENSOR_REGISTERS.waterFlow },
  { key: 'eevStep', def: SENSOR_REGISTERS.mainEevOpenDegree },
  { key: 'eviStep', def: SENSOR_REGISTERS.auxEevOpenDegree },
  { key: 'fanSpeed', def: SENSOR_REGISTERS.fanSpeed },
  { key: 'acVoltage', def: SENSOR_REGISTERS.acInputVoltage },
  { key: 'acCurrent', def: SENSOR_REGISTERS.acInputCurrent },
  { key: 'compPhaseI', def: SENSOR_REGISTERS.compressorCurrent },
  { key: 'compTargetFreq', def: SENSOR_REGISTERS.compressorTargetFreq },
  { key: 'compRunningFreq', def: SENSOR_REGISTERS.compressorRunningFreq },
  { key: 'highPressure', def: SENSOR_REGISTERS.highPressure },
  { key: 'lowPressure', def: SENSOR_REGISTERS.lowPressure },
];

export interface SensorValue {
  address: number;
  raw: number;
  value: number;
  unit: string;
  label: string;
  /** Fastest poll group that reads this register, e.g. 'fast'. */
  pollGroup: string;
}

export interface StatusSnapshot {
  running: boolean;
  waiting: boolean;
  defrosting: boolean;
  antifreeze: boolean;
  sterilization: boolean;
  compressorOn: boolean;
  /** Reg 9 bit 2: the unit is heating domestic hot water right now. */
  dhwActive: boolean;
  activeFaults: string[];
}

export interface ControlSnapshot {
  /** Space heating/cooling on: Reg 2101 ≠ 0 (falls back to Reg 2100 ≠ 0 before 2101 is read). */
  on: boolean;
  /** Raw Reg 2101 value, see ZoneControl. */
  zoneControl: number;
  mode: number;
  modeName: string;
  heatingSetpointC: number;
  coolingSetpointC: number;
  dhwSetpointC: number;
  /** Allowed DHW setpoint range: active limits Reg 15..14 when plausible, else the static range. */
  dhwSetpointRange: { min: number; max: number };
  floorSetpointC: number;
  /** Reg 2102 = 1. */
  dhwEnabled: boolean;
  /** Reg 2103 bits 4-5, see SilentMode. */
  silentMode: number;
  /** Silent level 2 is only for R290 units (Reg 7); false while Reg 7 is unknown. */
  silentLevel2Allowed: boolean;
  /** Reg 2103 bit 3. */
  backupHeaterForced: boolean;
  /** Reg 2103 bit 6. */
  disinfectionEnabled: boolean;
}

export interface PowerSnapshot {
  inputCurrentA: number;
  inputVoltageV: number;
  derivedPowerKw: number;
}

export interface CopSnapshot {
  /** Delivered heating or cooling power; 0 while idle, defrosting or at too low flow. */
  thermalPowerKw: number;
  thermalMode: 'heating' | 'cooling' | 'idle';
  electricalPowerKw: number;
  cop: number;
  deltaTc: number;
  flowLpm: number;
  ambientTempC: number;
  valid: boolean;
  reason?: string;
}


export interface DiyHeatingCurve {
  active: boolean;
  slopeK: number;
  interceptB: number;
  calcSetpoint(ambientC: number): number;
}

export interface DiagnosticsSnapshot {
  connectionQuality: 'online' | 'degraded' | 'offline';
  consecutiveFastPollFailures: number;
  consecutiveSuperfastPollFailures: number;
  lastSuccessfulFastPollAt: number | null;
  lastErrorContext: string | null;
}

export interface DataSnapshot {
  ts: number;
  sourcePollGroup?: 'superfast' | 'fast' | 'medium' | 'slow' | 'once' | 'manual';
  status: StatusSnapshot;
  control: ControlSnapshot;
  power: PowerSnapshot;
  cop: CopSnapshot;
  sensors: Record<string, SensorValue>;
  diy?: DiyHeatingCurve;
  diagnostics?: DiagnosticsSnapshot;
}

export interface Adlar3ModbusConfig {
  transport: Partial<ModbusTcpConfig> & { host: string };
  timerProvider?: TimerProvider;
}

type SetpointType = 'heating' | 'cooling' | 'dhw' | 'floor' | 'indoor';

const SETPOINT_DEFINITIONS: Partial<Record<SetpointType, NumericRegisterDefinition>> = {
  heating: CONTROL_REGISTERS.zone1HeatingSetTemp,
  cooling: CONTROL_REGISTERS.zone1CoolingSetTemp,
  dhw: CONTROL_REGISTERS.dhwSetTemp,
  indoor: CONTROL_REGISTERS.roomTempSetTemp,
};

/** All poll groups, fastest first. Single source for the runtime and the dashboards. */
export const ADLAR3_POLL_GROUP_DEFINITIONS: readonly RegisterPollGroupDefinition[] = [
  ADLAR3_POLL_SUPERFAST_DEF,
  ADLAR3_POLL_FAST_DEF,
  ADLAR3_POLL_MEDIUM_DEF,
  ADLAR3_POLL_SLOW_DEF,
  ADLAR3_POLL_ONCE_DEF,
];

/** Names of the poll groups that read `address` with function code `fc`, fastest first. */
export function pollGroupsForAddress(address: number, fc: 'input' | 'holding'): string[] {
  return ADLAR3_POLL_GROUP_DEFINITIONS
    .filter((group) => group.reads.some((read) => (read.fc ?? 'holding') === fc
      && address >= read.start && address < read.start + read.count))
    .map((group) => group.name);
}

/** Setpoint types whose write range follows the controller's active limit registers. */
const DYNAMIC_LIMITS: Partial<Record<SetpointType, { upper: number; lower: number }>> = {
  dhw: { upper: LIMIT_REGISTERS.dhwUpperLimit.address, lower: LIMIT_REGISTERS.dhwLowerLimit.address },
  indoor: { upper: LIMIT_REGISTERS.roomTempUpperLimit.address, lower: LIMIT_REGISTERS.roomTempLowerLimit.address },
};

function toRuntimePollGroup(
  def: RegisterPollGroupDefinition,
  extraBlocks: readonly PollBlock[] = [],
): PollGroup {
  return {
    name: def.name,
    intervalMs: def.interval,
    blocks: [
      ...extraBlocks.map((block) => ({ ...block })),
      ...def.reads.map((block) => ({ ...block })),
    ],
  };
}

const ADLAR3_POLL_SUPERFAST = toRuntimePollGroup(ADLAR3_POLL_SUPERFAST_DEF);
const ADLAR3_POLL_FAST = toRuntimePollGroup(ADLAR3_POLL_FAST_DEF);
const ADLAR3_POLL_MEDIUM = toRuntimePollGroup(ADLAR3_POLL_MEDIUM_DEF);
const ADLAR3_POLL_SLOW = toRuntimePollGroup(ADLAR3_POLL_SLOW_DEF);
const ADLAR3_POLL_ONCE = toRuntimePollGroup(ADLAR3_POLL_ONCE_DEF);

function modeName(mode: number): string {
  switch (mode) {
    case HvacMode.Off: return 'Off';
    case HvacMode.Cool: return 'Cool';
    case HvacMode.Heat: return 'Heat';
    case HvacMode.Auto: return 'Auto';
    default: return `Mode(${mode})`;
  }
}

function assertRange(def: NumericRegisterDefinition, value: number): void {
  if (def.min !== undefined && value < def.min) {
    throw new Error(`${def.name} ${value}${def.unit ?? ''} buiten bereik >= ${def.min}${def.unit ?? ''}`);
  }
  if (def.max !== undefined && value > def.max) {
    throw new Error(`${def.name} ${value}${def.unit ?? ''} buiten bereik <= ${def.max}${def.unit ?? ''}`);
  }
}

function encodeTemperatureRaw(tempC: number): number {
  return Math.round(tempC * 10);
}

function clonePollGroup(group: PollGroup, intervalMs: number): PollGroup {
  return {
    name: group.name,
    intervalMs,
    blocks: group.blocks.map((block) => ({ ...block })),
  };
}

const ERROR_CODE_REGISTERS = [
  SENSOR_REGISTERS.errorCodes_E01_E16,
  SENSOR_REGISTERS.errorCodes_E17_E32,
  SENSOR_REGISTERS.errorCodes_E33_E48,
  SENSOR_REGISTERS.errorCodes_E49_E64,
  SENSOR_REGISTERS.errorCodes_E65_E80,
  SENSOR_REGISTERS.errorCodes_E81_E96,
];

const PROTECTION_CODE_REGISTERS = [
  SENSOR_REGISTERS.protectionCodes_P01_P16,
  SENSOR_REGISTERS.protectionCodes_P17_P32,
  SENSOR_REGISTERS.protectionCodes_P33_P48,
  SENSOR_REGISTERS.protectionCodes_P49_P64,
  SENSOR_REGISTERS.protectionCodes_P65_P80,
  SENSOR_REGISTERS.protectionCodes_P81_P96,
];

export class Adlar3ModbusService extends EventEmitter {
  private readonly tcp: ModbusTcpService;
  private externalFlowLpm: number | null = null;
  private lastFaults: string[] = [];
  private hasBaseSnapshot = false;
  /** Last non-zero Reg 2101 value, restored when switching on again. */
  private lastZoneControlOn: number | null = null;

  constructor(config: Adlar3ModbusConfig) {
    super();
    this.tcp = new ModbusTcpService({ ...config.transport, timerProvider: config.timerProvider });

    this.tcp.on('disconnected', (reason) => this.emit('disconnected', reason));
    this.tcp.on('reconnecting', (attempt, delayMs) => this.emit('reconnecting', attempt, delayMs));
    this.tcp.on('error', (err, ctx) => this.emit('error', err, ctx));
    this.tcp.on('connected', () => this.emit('connected'));

    this.tcp.on('poll-complete', (groupName) => {
      if (groupName === ADLAR3_POLL_FAST.name) {
        this.hasBaseSnapshot = true;
        const snapshot = this.buildSnapshot('fast');
        this.emit('data', snapshot);
        this.checkFaults(snapshot.status.activeFaults);
      } else if (groupName === ADLAR3_POLL_SUPERFAST.name) {
        if (this.hasBaseSnapshot) {
          const snapshot = this.buildSnapshot('superfast');
          this.emit('data', snapshot);
          this.checkFaults(snapshot.status.activeFaults);
        }
      } else {
        this.emit('poll-group-succeeded', groupName);
        this.emitMediumSnapshot(groupName);
      }
    });

    this.tcp.on('poll-partial', (groupName) => {
      if (groupName !== ADLAR3_POLL_FAST.name) {
        this.emit('poll-group-succeeded', groupName);
        this.emitMediumSnapshot(groupName);
      }
    });
  }

  /**
   * Controls (4-2100..2114), faults (3-90..101) and effective mode (3-9) are only read by the
   * medium group. Emit a 'medium' snapshot so the device can apply those values.
   */
  private emitMediumSnapshot(groupName: string): void {
    if (groupName !== ADLAR3_POLL_MEDIUM.name || !this.hasBaseSnapshot) return;
    const snapshot = this.buildSnapshot('medium');
    this.emit('data', snapshot);
    this.checkFaults(snapshot.status.activeFaults);
  }

  get connected(): boolean {
    return this.tcp.connected;
  }

  get stats() {
    return this.tcp.stats;
  }

  get activeTemperatureScale(): TemperatureRegisterScale {
    return 'x10';
  }

  async connect(): Promise<void> {
    await this.tcp.connect();
  }

  startPolling(ms?: {
    superfast?: number;
    superfastAdaptive?: boolean;
    superfastAdaptiveMs?: number;
    fast?: number;
    medium?: number;
    slow?: number;
    staggerMs?: number;
  }): void {
    this.hasBaseSnapshot = false;
    const superfastInterval = ms?.superfast ?? ADLAR3_POLL_SUPERFAST.intervalMs;
    this.tcp.startPolling([
      clonePollGroup(ADLAR3_POLL_ONCE, ADLAR3_POLL_ONCE.intervalMs),
      {
        ...clonePollGroup(ADLAR3_POLL_SUPERFAST, superfastInterval),
        adaptive: {
          enabled: ms?.superfastAdaptive ?? true,
          activeIntervalMs: ms?.superfastAdaptiveMs ?? 2_000,
          idleIntervalMs: superfastInterval,
        },
      },
      clonePollGroup(ADLAR3_POLL_FAST, ms?.fast ?? ADLAR3_POLL_FAST.intervalMs),
      clonePollGroup(ADLAR3_POLL_MEDIUM, ms?.medium ?? ADLAR3_POLL_MEDIUM.intervalMs),
      clonePollGroup(ADLAR3_POLL_SLOW, ms?.slow ?? ADLAR3_POLL_SLOW.intervalMs),
    ], ms?.staggerMs ?? 0);
  }

  stopPolling(): void {
    this.tcp.stopPolling();
  }

  async disconnect(): Promise<void> {
    await this.tcp.disconnect();
  }

  async destroy(): Promise<void> {
    this.removeAllListeners();
    await this.tcp.destroy();
  }

  getSnapshot(): DataSnapshot {
    return this.buildSnapshot('manual');
  }

  getRegisterCache(): Map<number, number> {
    return this.tcp.getRegisterCache();
  }

  async readRegister(addr: number): Promise<number> {
    await this.tcp.readHoldingRegisters(addr, 1, 'expert-read');
    return this.tcp.s16(addr);
  }

  async readInputRegister(addr: number): Promise<number> {
    await this.tcp.readInputRegisters(addr, 1, 'expert-read');
    return this.tcp.s16(addr);
  }

  async readCoil(): Promise<number> {
    throw new Error('Aurora III ondersteunt geen bekende coil-acties in deze app.');
  }

  async writeRegister(addr: number, value: number): Promise<void> {
    if (addr === CONTROL_REGISTERS.zone1AutoHeatingSetTemp.address) {
      throw new Error('Schrijven naar Aurora III register 2109 is geblokkeerd: schaalfactor is nog niet hardware-bevestigd.');
    }
    for (const [type, def] of Object.entries(SETPOINT_DEFINITIONS) as Array<[SetpointType, NumericRegisterDefinition]>) {
      if (def.address === addr && DYNAMIC_LIMITS[type]) {
        this.assertSetpointAllowed(type, def, decodeS16(value & 0xFFFF) * TEMP_MULTIPLY);
      }
    }
    await this.tcp.writeSingleRegister(addr, value);
  }

  async writeCoil(): Promise<void> {
    throw new Error('Aurora III ondersteunt geen bekende coil-acties in deze app.');
  }

  /**
   * Space heating/cooling on/off via zone control Reg 2101.
   * Off writes 0; on restores the last non-zero value, or zone 1 / both zones depending on Reg 2.
   * The device layer only calls this when the experimental_zone_onoff setting is enabled.
   */
  async setMainSwitch(value: boolean): Promise<void> {
    const addr = CONTROL_REGISTERS.hvacZoneControlMode.address;
    if (!value) {
      await this.tcp.writeSingleRegister(addr, ZoneControl.AllOff);
      return;
    }
    const twoZones = this.tcp.u16(CONFIG_REGISTERS.zoneControlModeWithoutThermostat.address) === 1;
    const onValue = this.lastZoneControlOn ?? (twoZones ? ZoneControl.AllOn : ZoneControl.Zone1On);
    await this.tcp.writeSingleRegister(addr, onValue);
  }

  async setFeature(feature: DeviceFeature, value: number): Promise<void> {
    switch (feature) {
      case 'dhw_enabled':
        await this.tcp.writeSingleRegister(CONTROL_REGISTERS.dhwOnOff.address, value ? 1 : 0);
        return;
      case 'silent_mode':
        if (![SilentMode.Off, SilentMode.Level1, SilentMode.Level2].includes(value)) {
          throw new Error(`Aurora III stille modus ${value} is niet vrijgegeven voor schrijven.`);
        }
        if (value === SilentMode.Level2 && !this.isR290()) {
          throw new Error('Stille modus niveau 2 is alleen beschikbaar voor R290-warmtepompen (register 3-7).');
        }
        await this.updateFunctionA((raw) => encodeSilentMode(raw, value as SilentMode));
        return;
      case 'backup_heater_forced':
        await this.updateFunctionA((raw) => setBitFlag(raw, FUNCTION_A_BITS.FORCED_BACKUP_HEATER, value !== 0));
        return;
      default:
        throw new Error(`Onbekende Aurora III functie: ${String(feature)}`);
    }
  }

  /** Reg 7 reports R290 refrigerant. Unknown (not yet read) counts as not R290. */
  private isR290(): boolean {
    const addr = CONFIG_REGISTERS.refrigerantType.address;
    return this.tcp.has(addr) && this.tcp.u16(addr) === REFRIGERANT_R290;
  }

  /** Read-modify-write of Reg 2103: always re-read first so bits changed on the unit are kept. */
  private async updateFunctionA(update: (raw: number) => number): Promise<void> {
    const addr = CONTROL_REGISTERS.additionalFunctionA.address;
    await this.tcp.readHoldingRegisters(addr, 1, 'expert-read');
    const current = this.tcp.u16(addr);
    const next = update(current);
    if (next !== current) {
      await this.tcp.writeSingleRegister(addr, next);
    }
  }

  async setMode(mode: number): Promise<void> {
    if (![HvacMode.Cool, HvacMode.Heat, HvacMode.Auto].includes(mode)) {
      throw new Error(`Aurora III mode ${mode} is niet vrijgegeven voor schrijven.`);
    }
    await this.tcp.writeSingleRegister(CONTROL_REGISTERS.hvacMode.address, mode);
  }

  async setTemperature(type: SetpointType, tempC: number): Promise<void> {
    const def = SETPOINT_DEFINITIONS[type];
    if (!def) {
      throw new Error(`Aurora III setpoint '${type}' is niet beschikbaar of niet veilig vrijgegeven.`);
    }
    this.assertSetpointAllowed(type, def, tempC);
    await this.tcp.writeSingleRegister(def.address, encodeTemperatureRaw(tempC));
  }

  /**
   * Bound a setpoint write by the controller's active limits (Reg 14/15 for DHW, 30/31 for room)
   * when they have been read and look plausible; otherwise by the static register range.
   */
  private assertSetpointAllowed(type: SetpointType, def: NumericRegisterDefinition, tempC: number): void {
    const limits = this.activeLimits(type);
    if (!limits) {
      assertRange(def, tempC);
      return;
    }
    if (tempC < limits.min || tempC > limits.max) {
      throw new Error(
        `${def.name} ${tempC}${def.unit ?? ''} buiten actief bereik ${limits.min}–${limits.max}${def.unit ?? ''} (limietregisters warmtepomp)`,
      );
    }
  }

  private activeLimits(type: SetpointType): { min: number; max: number } | null {
    const regs = DYNAMIC_LIMITS[type];
    if (!regs || !this.tcp.has(regs.upper) || !this.tcp.has(regs.lower)) return null;
    const max = decodeS16(this.tcp.u16(regs.upper)) * TEMP_MULTIPLY;
    const min = decodeS16(this.tcp.u16(regs.lower)) * TEMP_MULTIPLY;
    const plausible = min < max && min >= LIMIT_PLAUSIBLE_MIN_C && max <= LIMIT_PLAUSIBLE_MAX_C;
    return plausible ? { min: +min.toFixed(1), max: +max.toFixed(1) } : null;
  }

  setExternalFlow(lpm: number | null): void {
    this.externalFlowLpm = lpm;
  }

  getChangeLog(mode?: RegisterChangeLogMode): Map<number, RegisterChangeEntry> {
    return this.tcp.getChangeLog(mode);
  }

  private buildSnapshot(sourcePollGroup?: DataSnapshot['sourcePollGroup']): DataSnapshot {
    return {
      ts: Date.now(),
      sourcePollGroup,
      status: this.buildStatus(),
      control: this.buildControl(),
      power: this.buildPower(),
      cop: this.buildCop(),
      sensors: this.buildSensors(),
    };
  }

  private buildStatus(): StatusSnapshot {
    const reg38 = this.tcp.u16(SENSOR_REGISTERS.systemStatus.address);
    const compFreq = this.readScaledValue(SENSOR_REGISTERS.compressorRunningFreq);
    const activeFaults = this.decodeFaults();

    return {
      running: compFreq > 0 || this.tcp.u16(SENSOR_REGISTERS.mainPumpStatus.address) === 1,
      waiting: compFreq === 0 && this.tcp.has(SENSOR_REGISTERS.systemStatus.address),
      defrosting: statusBitSet(reg38, STATUS_BITS.DEFROST),
      antifreeze: statusBitSet(reg38, STATUS_BITS.ANTI_FREEZING),
      sterilization: statusBitSet(reg38, STATUS_BITS.DISINFECTION),
      compressorOn: compFreq > 0,
      dhwActive: (this.tcp.u16(CONFIG_REGISTERS.effectiveMode.address) & EFFECTIVE_MODE_BITS.DHW) !== 0,
      activeFaults,
    };
  }

  private buildControl(): ControlSnapshot {
    const mode = this.tcp.u16(CONTROL_REGISTERS.hvacMode.address);
    const zoneAddr = CONTROL_REGISTERS.hvacZoneControlMode.address;
    const zoneControl = this.tcp.u16(zoneAddr);
    if (zoneControl !== ZoneControl.AllOff) this.lastZoneControlOn = zoneControl;
    const functionA = this.tcp.u16(CONTROL_REGISTERS.additionalFunctionA.address);
    return {
      on: this.tcp.has(zoneAddr) ? zoneControl !== ZoneControl.AllOff : mode !== HvacMode.Off,
      zoneControl,
      mode,
      modeName: modeName(mode),
      heatingSetpointC: this.readScaledValue(CONTROL_REGISTERS.zone1HeatingSetTemp, true),
      coolingSetpointC: this.readScaledValue(CONTROL_REGISTERS.zone1CoolingSetTemp, true),
      dhwSetpointC: this.readScaledValue(CONTROL_REGISTERS.dhwSetTemp, true),
      dhwSetpointRange: this.activeLimits('dhw') ?? {
        min: CONTROL_REGISTERS.dhwSetTemp.min ?? 0,
        max: CONTROL_REGISTERS.dhwSetTemp.max ?? 0,
      },
      floorSetpointC: this.readScaledValue(CONTROL_REGISTERS.roomTempSetTemp, true),
      dhwEnabled: this.tcp.u16(CONTROL_REGISTERS.dhwOnOff.address) === 1,
      silentMode: decodeSilentMode(functionA),
      silentLevel2Allowed: this.isR290(),
      backupHeaterForced: (functionA & FUNCTION_A_BITS.FORCED_BACKUP_HEATER) !== 0,
      disinfectionEnabled: (functionA & FUNCTION_A_BITS.DISINFECTION_ENABLED) !== 0,
    };
  }

  private buildPower(): PowerSnapshot {
    const inputVoltageV = this.readScaledValue(SENSOR_REGISTERS.acInputVoltage);
    const inputCurrentA = this.readScaledValue(SENSOR_REGISTERS.acInputCurrent);
    const derivedPowerKw = (inputVoltageV * inputCurrentA) / 1000;

    return {
      inputCurrentA,
      inputVoltageV,
      derivedPowerKw,
    };
  }

  private buildCop(): CopSnapshot {
    const aanvoerTemp = this.readScaledValue(SENSOR_REGISTERS.outletWaterTemp, true);
    const retourTemp = this.readScaledValue(SENSOR_REGISTERS.inletWaterTemp, true);
    const ambientTemp = this.readScaledValue(SENSOR_REGISTERS.ambientTemp, true);
    const deltaT = aanvoerTemp - retourTemp;
    const internalFlowM3h = this.readScaledValue(SENSOR_REGISTERS.waterFlow);
    const flowM3h = this.externalFlowLpm !== null && this.externalFlowLpm > 0
      ? (this.externalFlowLpm * 60) / 1000
      : internalFlowM3h;
    const compressorOn = this.readScaledValue(SENSOR_REGISTERS.compressorRunningFreq) > 0;
    const defrosting = statusBitSet(this.tcp.u16(SENSOR_REGISTERS.systemStatus.address), STATUS_BITS.DEFROST);
    const exchanging = compressorOn && !defrosting && flowM3h >= MIN_THERMAL_FLOW_M3H;
    let thermalMode: CopSnapshot['thermalMode'] = 'idle';
    if (exchanging && deltaT >= MIN_COP_DELTA_T_C) thermalMode = 'heating';
    else if (exchanging && deltaT <= -MIN_COP_DELTA_T_C) thermalMode = 'cooling';
    const thermalPowerKw = thermalMode === 'idle' ? 0 : Math.abs(deltaT) * flowM3h * 1.163;
    const power = this.buildPower();
    const electricalPowerKw = power.derivedPowerKw;

    const base = {
      thermalPowerKw: +thermalPowerKw.toFixed(3),
      thermalMode,
      electricalPowerKw: +electricalPowerKw.toFixed(3),
      deltaTc: +deltaT.toFixed(1),
      flowLpm: +((flowM3h * 1000) / 60).toFixed(2),
      ambientTempC: ambientTemp,
    };

    if (compressorOn && (power.inputVoltageV === 0 || power.inputCurrentA === 0)) {
      return {
        ...base,
        cop: 0,
        valid: false,
        reason: 'Registers 74/75 (AC-spanning/-stroom) geven 0 terwijl de compressor draait; gebruik een externe vermogensmeting.',
      };
    }

    if (electricalPowerKw < MIN_COP_POWER_KW) {
      return { ...base, cop: 0, valid: false, reason: 'Elektrisch vermogen niet beschikbaar of te laag.' };
    }

    if (defrosting) {
      return { ...base, cop: 0, valid: false, reason: 'Ontdooicyclus actief.' };
    }

    if (flowM3h < MIN_THERMAL_FLOW_M3H) {
      return { ...base, cop: 0, valid: false, reason: `Flow ${flowM3h.toFixed(2)} m³/h < ${MIN_THERMAL_FLOW_M3H} m³/h.` };
    }

    if (thermalMode !== 'heating') {
      return { ...base, cop: 0, valid: false, reason: `ΔT=${deltaT.toFixed(1)}°C < ${MIN_COP_DELTA_T_C}°C.` };
    }

    return {
      ...base,
      cop: +(Math.min(thermalPowerKw / electricalPowerKw, MAX_VALID_COP)).toFixed(2),
      valid: true,
    };
  }



  private buildSensors(): Record<string, SensorValue> {
    const sensors: Record<string, SensorValue> = {};
    for (const descriptor of SENSOR_DESCRIPTORS) {
      if (!this.tcp.has(descriptor.def.address)) continue;
      const raw = this.readRawValue(descriptor.def, descriptor.signed ?? false);
      sensors[descriptor.key] = {
        address: descriptor.def.address,
        raw,
        value: this.readScaledValue(descriptor.def, descriptor.signed ?? false),
        unit: descriptor.def.unit ?? '',
        label: descriptor.def.name,
        pollGroup: pollGroupsForAddress(descriptor.def.address, 'input')[0] ?? 'manual',
      };
    }
    return sensors;
  }

  /** Fault/protection registers are bit fields: bit n of the k-th register is code k*16+n+1. */
  private decodeFaults(): string[] {
    const words = (defs: ReadonlyArray<{ address: number }>) => defs.map((def) => this.tcp.u16(def.address));
    return [
      ...decodeCodeBits('E', words(ERROR_CODE_REGISTERS)),
      ...decodeCodeBits('P', words(PROTECTION_CODE_REGISTERS)),
    ];
  }

  private checkFaults(currentFaults: string[]): void {
    const previousFaults = new Set(this.lastFaults);
    const newlyActiveFaults = currentFaults.filter((fault) => !previousFaults.has(fault));
    if (newlyActiveFaults.length > 0) {
      this.emit('fault', currentFaults);
    } else if (this.lastFaults.length > 0 && currentFaults.length === 0) {
      this.emit('fault-cleared');
    }
    this.lastFaults = currentFaults;
  }

  private readRawValue(def: NumericRegisterDefinition, signed = false): number {
    const raw = this.tcp.u16(def.address);
    return signed || def.dataType === 'S16' ? decodeS16(raw) : raw;
  }

  private readScaledValue(def: NumericRegisterDefinition, signed = false): number {
    const raw = this.readRawValue(def, signed);
    return raw * (def.multiply ?? (def.unit === '°C' ? TEMP_MULTIPLY : 1));
  }
}
