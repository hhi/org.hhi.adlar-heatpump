/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/**
 * Adlar Castra Aurora II — Modbus Service v3
 *
 * Runtime service bovenop ModbusTcpService.
 * Registermetadata, schaalfactoren, ranges, poll-groepen en decode-helpers
 * komen uit adlar-modbus-registers.ts.
 */

import { EventEmitter } from 'events';

import {
  ModbusTcpConfig, ModbusTcpService, PollBlock, PollGroup, RegisterChangeEntry, TimerProvider,
} from './modbus-tcp-service';
import {
  COIL_ADDRESSES,
  CONTROL_REGISTERS,
  L_PARAMETERS,
  MODE_OPTIONS,
  P_PARAMETERS,
  POLL_GROUP_FAST,
  POLL_GROUP_MEDIUM,
  POLL_GROUP_ONCE,
  POLL_GROUP_SLOW,
  POLL_GROUP_SUPERFAST,
  SENSOR_REGISTERS,
  STATUS_1_BITS,
  STATUS_2_BITS,
  STATUS_REGISTER_MAP,
  VERSION_REGISTERS,
  TemperatureRegisterScale,
  calculateDIYCurveTemp,
  decodeFaults,
  encodeTemperatureRaw,
  interpolateCalibration,
  protocolSupportsCoils,
  refrigerantToTemperatureScale,
  scaleRegisterValue,
  validateRefrigerant,
} from './adlar-modbus-registers';

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
  calibrationCurve?: ReadonlyArray<CalibrationPoint>;
}

interface RegisterPollGroupDefinition {
  name: string;
  interval: number;
  reads: readonly PollBlock[];
}

interface SensorDescriptor {
  key: string;
  def: NumericRegisterDefinition;
  signed?: boolean;
}

const WATER_THERMAL_FACTOR = 4.186 / 60;
const MIN_COP_POWER_KW = 0.10;
const MIN_COP_DELTA_T_C = 0.5;
const MAX_VALID_COP = 15.0;

const COMP_TARGET_FREQ_DEF: NumericRegisterDefinition = {
  address: STATUS_REGISTER_MAP.compressorTargetFreq1.address,
  name: 'Compressor Target Frequency',
  unit: 'Hz',
  multiply: 1,
};

const SENSOR_DESCRIPTORS: readonly SensorDescriptor[] = [
  { key: 'compRunningFreq', def: SENSOR_REGISTERS.compressorRunningFreq },
  { key: 'compTargetFreq', def: COMP_TARGET_FREQ_DEF },
  { key: 'fanSpeed', def: SENSOR_REGISTERS.fanRunningSpeed },
  { key: 'eevStep', def: SENSOR_REGISTERS.eevOpenStep },
  { key: 'eviStep', def: SENSOR_REGISTERS.eviValveOpenStep },
  { key: 'pumpPwm', def: SENSOR_REGISTERS.waterPumpSpeedPWM },
  { key: 'waterFlow', def: SENSOR_REGISTERS.waterFlow },
  { key: 'acVoltage', def: SENSOR_REGISTERS.acInputVoltage },
  { key: 'acCurrent', def: SENSOR_REGISTERS.acInputCurrent },
  { key: 'compPhaseI', def: SENSOR_REGISTERS.compressorPhaseCurrent },
  { key: 'unitVoltage', def: SENSOR_REGISTERS.deviceInputVoltage },
  { key: 'unitCurrent', def: SENSOR_REGISTERS.deviceInputCurrent },
  { key: 'unitPower', def: SENSOR_REGISTERS.deviceInputPower },
  { key: 'totalEnergy', def: SENSOR_REGISTERS.totalEnergyConsumption },
  { key: 'ipmTemp', def: SENSOR_REGISTERS.compressorIpmTemp, signed: true },
  { key: 'hpSatTemp', def: SENSOR_REGISTERS.highPressureSatTemp, signed: true },
  { key: 'lpSatTemp', def: SENSOR_REGISTERS.lowPressureSatTemp, signed: true },
  { key: 'ambientT1', def: SENSOR_REGISTERS.ambientTempT1, signed: true },
  { key: 'outerCoilT2', def: SENSOR_REGISTERS.outerCoilTempT2, signed: true },
  { key: 'innerCoilT3', def: SENSOR_REGISTERS.innerCoilTempT3, signed: true },
  { key: 'suctionT4', def: SENSOR_REGISTERS.suctionTempT4, signed: true },
  { key: 'exhaustT5', def: SENSOR_REGISTERS.exhaustTempT5, signed: true },
  { key: 'inletT6', def: SENSOR_REGISTERS.waterInletTempT6, signed: true },
  { key: 'outletT7', def: SENSOR_REGISTERS.waterOutletTempT7, signed: true },
  { key: 'econInT8', def: SENSOR_REGISTERS.economizerInletT8, signed: true },
  { key: 'econOutT9', def: SENSOR_REGISTERS.economizerOutletT9, signed: true },
  { key: 'dhwTankTemp', def: SENSOR_REGISTERS.waterTankTemp, signed: true },
  { key: 'plateHxTemp', def: SENSOR_REGISTERS.plateHxExhaustTemp, signed: true },
  { key: 'dhwReturnTemp', def: SENSOR_REGISTERS.dhwReturnWaterTemp, signed: true },
  { key: 'bufferTankTemp', def: SENSOR_REGISTERS.bufferTankTemp, signed: true },
  { key: 'totalOutlet', def: SENSOR_REGISTERS.totalWaterOutletTemp, signed: true },
  { key: 'zone1MixTemp', def: SENSOR_REGISTERS.zone1MixingTemp, signed: true },
  { key: 'zone2Temp', def: SENSOR_REGISTERS.zone2Temp, signed: true },
  { key: 'bPhaseVoltage', def: SENSOR_REGISTERS.bPhaseVoltage },
  { key: 'bPhaseCurrent', def: SENSOR_REGISTERS.bPhaseCurrent },
  { key: 'cPhaseVoltage', def: SENSOR_REGISTERS.cPhaseVoltage },
  { key: 'cPhaseCurrent', def: SENSOR_REGISTERS.cPhaseCurrent },
];

export interface SensorValue {
  address: number;
  raw: number;
  value: number;
  unit: string;
  label: string;
}

export interface StatusSnapshot {
  running: boolean;
  waiting: boolean;
  defrosting: boolean;
  antifreeze: boolean;
  sterilization: boolean;
  compressorOn: boolean;
  faultAlarm: boolean;
  faultShutdown: boolean;
  activeFaults: string[];
}

export interface ControlSnapshot {
  on: boolean;
  mode: number;
  modeName: string;
  userMode: number;
  heatingSetpointC: number;
  coolingSetpointC: number;
  dhwSetpointC: number;
  floorSetpointC: number;
  heatingCurve: number;
  hotWaterCurve: number;
  backwaterMode: number;
  protocolVersion: number;
  coilsAvailable: boolean;
  tempControlMode: number | null;
  acReturnDiffC: number | null;
  floorReturnDiffC: number | null;
  dhwReturnDiffC: number | null;
  hotWaterHeatSourceReturnDiffC: number | null;
  heatingHeatSourceReturnDiffC: number | null;
}

export type PowerSource = 'unit-direct' | 'unit-derived' | 'ac-derived' | 'none';

export interface PowerSnapshot {
  inputPowerKw: number;
  inputCurrentA: number;
  inputVoltageV: number;
  totalEnergyKwh: number;
  derivedPowerKw: number;
  /** Ruwe backupwaarden van de AC-sensoren (0x0044 / 0x0045) */
  acVoltageV: number;
  acCurrentA: number;
  powerSource: PowerSource;
}

export interface CopSnapshot {
  thermalPowerKw: number;
  electricalPowerKw: number;
  cop: number;
  deltaTc: number;
  flowLpm: number;
  ambientTempC: number;
  valid: boolean;
  reason?: string;
}

export interface VersionSnapshot {
  programVersionRaw: number | null;
  programVersion: string | null;
  deviceToolingNo: number | null;
  productType: number | null;
  productTypeId: number | null;
  protocolVersion: number | null;
  protocolVersionFormatted: string | null;
}

export interface DiyHeatingCurve {
  active: boolean;
  slopeK: number;
  interceptB: number;
  calcSetpoint(ambientC: number): number;
}

/** ADR-042: diagnostics toegevoegd door ServiceCoordinator na snapshot-aanmaak */
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
  version: VersionSnapshot;
  sensors: Record<string, SensorValue>;
  diy?: DiyHeatingCurve;
  diagnostics?: DiagnosticsSnapshot; // ADR-042
}

type SetpointType = 'heating' | 'cooling' | 'dhw' | 'floor';
type FreqZone = 'above0' | 'neg7to0' | 'below7';

const SETPOINT_DEFINITIONS: Record<SetpointType, NumericRegisterDefinition> = {
  heating: CONTROL_REGISTERS.tempSetHeating,
  cooling: CONTROL_REGISTERS.tempSetCooling,
  dhw: CONTROL_REGISTERS.tempSetHotWater,
  floor: CONTROL_REGISTERS.tempSetFloorHeating,
};

const HEATING_MIN_FREQ_DEFINITIONS: Record<FreqZone, NumericRegisterDefinition> = {
  above0: P_PARAMETERS.P57_heatingMinFreq_above0,
  neg7to0: P_PARAMETERS.P58_heatingMinFreq_neg10to0,
  below7: P_PARAMETERS.P59_heatingMinFreq_below10,
};

export interface Adlar2ModbusConfig {
  transport: Partial<ModbusTcpConfig> & { host: string };
  /**
   * Optionele timer-facade — geef `this.homey` timers mee vanuit het Homey device.
   * Laat leeg voor CLI/test gebruik.
   */
  timerProvider?: TimerProvider;
  /** ADR-050: schaalfactor voor temperatuurregisters. Default: 'x1'. */
  temperatureRegisterScale?: TemperatureRegisterScale;
}

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

const ADLAR2_POLL_SUPERFAST = toRuntimePollGroup(POLL_GROUP_SUPERFAST);
const ADLAR2_POLL_FAST = toRuntimePollGroup(POLL_GROUP_FAST);
const ADLAR2_POLL_MEDIUM = toRuntimePollGroup(POLL_GROUP_MEDIUM);
const ADLAR2_POLL_SLOW = toRuntimePollGroup(POLL_GROUP_SLOW);
const ADLAR2_POLL_ONCE = toRuntimePollGroup(POLL_GROUP_ONCE);

function modeName(mode: number): string {
  for (const [rawMode, label] of Object.entries(MODE_OPTIONS)) {
    if (Number(rawMode) === mode) {
      return label;
    }
  }

  return `Mode(${mode})`;
}

function isKnownMode(mode: number): boolean {
  return modeName(mode) !== `Mode(${mode})`;
}

function rangeText(def: NumericRegisterDefinition): string {
  const unit = def.unit ?? '';

  if (def.min !== undefined && def.max !== undefined) {
    return `[${def.min}–${def.max}]${unit}`;
  }

  if (def.min !== undefined) {
    return `>= ${def.min}${unit}`;
  }

  if (def.max !== undefined) {
    return `<= ${def.max}${unit}`;
  }

  return '';
}

function assertRange(def: NumericRegisterDefinition, value: number): void {
  if (def.min !== undefined && value < def.min) {
    throw new Error(`${def.name} ${value}${def.unit ?? ''} buiten bereik ${rangeText(def)}`);
  }

  if (def.max !== undefined && value > def.max) {
    throw new Error(`${def.name} ${value}${def.unit ?? ''} buiten bereik ${rangeText(def)}`);
  }
}

function clonePollGroup(group: PollGroup, intervalMs: number): PollGroup {
  return {
    name: group.name,
    intervalMs,
    blocks: group.blocks.map((block) => ({ ...block })),
  };
}

function formatPackedVersion(raw: number | null): string | null {
  if (raw === null || raw <= 0) {
    return null;
  }

  const major = Math.trunc(raw / 100);
  const minor = Math.trunc((raw % 100) / 10);
  const patch = raw % 10;

  return `v${major}.${minor}.${patch}`;
}

export class Adlar2ModbusService extends EventEmitter {

  private readonly tcp: ModbusTcpService;
  private temperatureRegisterScale: TemperatureRegisterScale;
  private externalFlowLpm: number | null = null;
  private lastFaults: string[] = [];
  private hasBaseSnapshot = false;

  constructor(config: Adlar2ModbusConfig) {
    super();

    this.temperatureRegisterScale = config.temperatureRegisterScale ?? 'x1';
    this.tcp = new ModbusTcpService({ ...config.transport, timerProvider: config.timerProvider });

    this.tcp.on('disconnected', (reason) => this.emit('disconnected', reason));
    this.tcp.on('reconnecting', (attempt, delayMs) => this.emit('reconnecting', attempt, delayMs));
    this.tcp.on('error', (err, ctx) => this.emit('error', err, ctx));

    this.tcp.on('connected', () => {
      this.runInitValidation()
        .then(() => {
          this.emit('connected');
        })
        .catch((err) => {
          this.emit('error', err as Error, 'init-validation');
        });
    });

    this.tcp.on('poll-complete', (groupName) => {
      if (groupName === ADLAR2_POLL_FAST.name) {
        this.hasBaseSnapshot = true;
        const snapshot = this.buildSnapshot(groupName);
        this.emit('data', snapshot);
        this.checkFaults(snapshot.status.activeFaults);
      } else if (groupName === ADLAR2_POLL_SUPERFAST.name) {
        if (this.hasBaseSnapshot) {
          const snapshot = this.buildSnapshot(groupName);
          this.emit('data', snapshot);
          this.checkFaults(snapshot.status.activeFaults);
        }
      } else {
        const snapshot = this.buildSnapshot(groupName);
        this.emit('data', snapshot);
        this.checkFaults(snapshot.status.activeFaults);
        this.emit('poll-group-succeeded', groupName);
      }
    });

    this.tcp.on('poll-partial', (groupName) => {
      // FAST heeft geen optional blokken — poll-partial kan hier nooit geëmit worden.
      // Non-fast: required blokken OK, optional gefaald → telt als succes voor quality.
      if (groupName !== ADLAR2_POLL_FAST.name) {
        const snapshot = this.buildSnapshot(groupName);
        this.emit('data', snapshot);
        this.checkFaults(snapshot.status.activeFaults);
        this.emit('poll-group-succeeded', groupName);
      }
    });
  }

  get connected(): boolean {
    return this.tcp.connected;
  }

  get stats() {
    return this.tcp.stats;
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
    const superfastInterval = ms?.superfast ?? ADLAR2_POLL_SUPERFAST.intervalMs;
    const groups: PollGroup[] = [
      clonePollGroup(ADLAR2_POLL_ONCE, ADLAR2_POLL_ONCE.intervalMs),
      {
        ...clonePollGroup(ADLAR2_POLL_SUPERFAST, superfastInterval),
        adaptive: {
          enabled: ms?.superfastAdaptive ?? true,
          activeIntervalMs: ms?.superfastAdaptiveMs ?? 2_000,
          idleIntervalMs: superfastInterval,
        },
      },
      clonePollGroup(ADLAR2_POLL_FAST, ms?.fast ?? ADLAR2_POLL_FAST.intervalMs),
      clonePollGroup(ADLAR2_POLL_MEDIUM, ms?.medium ?? ADLAR2_POLL_MEDIUM.intervalMs),
      clonePollGroup(ADLAR2_POLL_SLOW, ms?.slow ?? ADLAR2_POLL_SLOW.intervalMs),
    ];

    this.tcp.startPolling(groups, ms?.staggerMs ?? 0);
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

  getChangeLog(mode?: import('./modbus-tcp-service').RegisterChangeLogMode): Map<number, RegisterChangeEntry> {
    return this.tcp.getChangeLog(mode);
  }

  getRegisterCache(): Map<number, number> {
    return this.tcp.getRegisterCache();
  }

  getSnapshot(): DataSnapshot {
    return this.buildSnapshot('manual');
  }

  async validateRefrigerant(): Promise<{ valid: boolean; type: number; name: string }> {
    await this.tcp.readHoldingRegisters(P_PARAMETERS.P119_refrigerantType.address, 1);
    const result = validateRefrigerant(this.tcp.u16(P_PARAMETERS.P119_refrigerantType.address));

    return {
      valid: result.valid,
      type: result.type,
      name: result.name,
    };
  }

  async getProtocolVersion(): Promise<number> {
    await this.tcp.readHoldingRegisters(VERSION_REGISTERS.protocolVersion.address, 1);
    return this.tcp.u16(VERSION_REGISTERS.protocolVersion.address);
  }

  async readRegister(addr: number): Promise<number> {
    await this.tcp.readHoldingRegisters(addr, 1, 'expert-read');
    return this.tcp.s16(addr);
  }

  async writeRegister(addr: number, value: number): Promise<void> {
    await this.tcp.writeSingleRegister(addr, value);
  }

  async writeCoil(addr: number, state: boolean): Promise<void> {
    await this.tcp.writeSingleCoil(addr, state);
  }

  /** FC01 — lees één coil; retourneert 1 (aan) of 0 (uit). */
  async readCoil(addr: number): Promise<number> {
    return this.tcp.readSingleCoil(addr, 'expert-read');
  }

  async setMainSwitch(on: boolean): Promise<void> {
    await this.tcp.writeSingleRegister(CONTROL_REGISTERS.mainSwitch.address, on ? 1 : 0);
  }

  async setMode(mode: number): Promise<void> {
    if (!isKnownMode(mode)) {
      throw new Error(`Ongeldige mode ${mode}`);
    }

    await this.tcp.writeSingleRegister(CONTROL_REGISTERS.mode.address, mode);
  }

  async setTemperature(type: SetpointType, tempC: number): Promise<void> {
    const def = SETPOINT_DEFINITIONS[type];
    assertRange(def, tempC);
    await this.tcp.writeSingleRegister(def.address, encodeTemperatureRaw(tempC, this.temperatureRegisterScale));
  }

  async setHeatingCurve(curve: number): Promise<void> {
    const def = CONTROL_REGISTERS.heatingCurve;
    assertRange(def, curve);
    await this.tcp.writeSingleRegister(def.address, curve);
  }

  async setHotWaterCurve(curve: number): Promise<void> {
    const def = CONTROL_REGISTERS.hotWaterCurve;
    assertRange(def, curve);
    await this.tcp.writeSingleRegister(def.address, curve);
  }

  async setCoolingCurve(curve: number): Promise<void> {
    const def = CONTROL_REGISTERS.coolingCurve;
    assertRange(def, curve);
    await this.tcp.writeSingleRegister(def.address, curve);
  }

  async setFloorHeatingCurve(curve: number): Promise<void> {
    const def = CONTROL_REGISTERS.floorHeatingCurve;
    assertRange(def, curve);
    await this.tcp.writeSingleRegister(def.address, curve);
  }

  async setUserMode(mode: 0 | 1 | 2): Promise<void> {
    await this.tcp.writeSingleRegister(CONTROL_REGISTERS.runningMode.address, mode);
  }

  async setPowerfulMode(on: boolean): Promise<void> {
    await this.writeNamedCoil(COIL_ADDRESSES.powerfulMode, on);
  }

  async setSilentMode(on: boolean): Promise<void> {
    await this.writeNamedCoil(COIL_ADDRESSES.silentMode, on);
  }

  async forceDefrost(): Promise<void> {
    await this.writeNamedCoil(COIL_ADDRESSES.forceDefrost, true);
  }

  async forceSterilization(): Promise<void> {
    await this.writeNamedCoil(COIL_ADDRESSES.forceSterilization, true);
  }

  async setHeatingMinFreq(zone: FreqZone, hz: number): Promise<void> {
    const def = HEATING_MIN_FREQ_DEFINITIONS[zone];
    assertRange(def, hz);
    await this.tcp.writeSingleRegister(def.address, hz);
  }

  async setDhwMinFreq(hz: number): Promise<void> {
    const def = P_PARAMETERS.P63_hotWaterMinFreq_above0;
    assertRange(def, hz);
    await this.tcp.writeSingleRegister(def.address, hz);
  }

  async setPumpSpeeds(maxPct: number, constPct: number): Promise<void> {
    assertRange(P_PARAMETERS.P260_pumpMaxSpeed, maxPct);
    assertRange(P_PARAMETERS.P261_pumpConstTempSpeed, constPct);

    await this.tcp.writeSingleRegister(P_PARAMETERS.P260_pumpMaxSpeed.address, maxPct);
    await this.tcp.writeSingleRegister(P_PARAMETERS.P261_pumpConstTempSpeed.address, constPct);
  }

  async setDiyHeatingCurve(k: number, b: number): Promise<void> {
    const rawK = Math.round(k * 10);
    assertRange(L_PARAMETERS.L28_heatingCurveCoeffK, rawK);
    assertRange(L_PARAMETERS.L29_heatingCurveConstantB, b);

    await this.tcp.writeSingleRegister(L_PARAMETERS.L27_heatingLowTempCurveDIY.address, 0);
    await this.tcp.writeSingleRegister(L_PARAMETERS.L28_heatingCurveCoeffK.address, Math.round(k * 10));
    await this.tcp.writeSingleRegister(L_PARAMETERS.L29_heatingCurveConstantB.address, Math.round(b));
  }

  async disableDiyHeatingCurve(): Promise<void> {
    await this.tcp.writeSingleRegister(L_PARAMETERS.L27_heatingLowTempCurveDIY.address, 1);
  }

  calcDiySetpoint(k: number, b: number, ambientC: number): number {
    return calculateDIYCurveTemp(k, b, ambientC);
  }

  async setFlowRate(lpm: number): Promise<void> {
    assertRange(L_PARAMETERS.L31_externalPumpFlowRate, lpm);
    await this.tcp.writeSingleRegister(L_PARAMETERS.L31_externalPumpFlowRate.address, lpm);
  }

  setExternalFlow(lpm: number | null): void {
    this.externalFlowLpm = lpm;
  }

  private async runInitValidation(): Promise<void> {
    for (const block of ADLAR2_POLL_ONCE.blocks) {
      try {
        await this.tcp.readHoldingRegisters(block.start, block.count);
      } catch {
        // Non-fatal: init leest zo veel mogelijk metadata vooraf in.
      }
    }

    const refrigerant = await this.validateRefrigerant();
    this.temperatureRegisterScale = refrigerantToTemperatureScale(refrigerant.type);
    if (!refrigerant.valid) {
      this.emit(
        'error',
        new Error(`P119=${refrigerant.type} — onverwacht koelmiddel (verwacht 2=R32)`),
        'validate:refrigerant',
      );
    }
  }

  private buildSnapshot(sourcePollGroup?: DataSnapshot['sourcePollGroup']): DataSnapshot {
    return {
      ts: Date.now(),
      sourcePollGroup,
      status: this.buildStatus(),
      control: this.buildControl(),
      power: this.buildPower(),
      cop: this.buildCop(),
      version: this.buildVersion(),
      sensors: this.buildSensors(),
      diy: this.buildDiy(),
    };
  }

  private buildStatus(): StatusSnapshot {
    const status1 = this.tcp.u16(STATUS_REGISTER_MAP.runningStatus1.address);
    const status2 = this.tcp.u16(STATUS_REGISTER_MAP.runningStatus2.address);
    const compFreq = this.readScaledValue(SENSOR_REGISTERS.compressorRunningFreq);

    return {
      running: !!(status1 & STATUS_1_BITS.MACHINE_RUN),
      waiting: !!(status1 & STATUS_1_BITS.MACHINE_WAIT),
      defrosting: !!(status1 & STATUS_1_BITS.SYSTEM_DEFROST),
      antifreeze: !!(status1 & STATUS_1_BITS.PRIMARY_ANTIFREEZE) || !!(status1 & STATUS_1_BITS.SECONDARY_ANTIFREEZE),
      sterilization: !!(status2 & STATUS_2_BITS.HIGH_TEMP_STERILIZATION),
      compressorOn: compFreq > 0,
      faultAlarm: !!(status1 & STATUS_1_BITS.FAULT_ALARM),
      faultShutdown: !!(status1 & STATUS_1_BITS.FAULT_SHUTDOWN),
      activeFaults: decodeFaults(
        this.tcp.u16(STATUS_REGISTER_MAP.faultState1.address),
        this.tcp.u16(STATUS_REGISTER_MAP.faultState2.address),
        this.tcp.u16(STATUS_REGISTER_MAP.faultState3.address),
      ),
    };
  }

  private buildControl(): ControlSnapshot {
    const mode = this.tcp.u16(CONTROL_REGISTERS.mode.address);
    // ADR-043 Fase 4a: terugvallen op null totdat ONCE-blok gelezen is
    const protocolVersion = this.tcp.has(VERSION_REGISTERS.protocolVersion.address)
      ? this.tcp.u16(VERSION_REGISTERS.protocolVersion.address)
      : null;
    const optionalScaled = (def: NumericRegisterDefinition): number | null => (
      this.tcp.has(def.address) ? this.readScaledValue(def) : null
    );
    const optionalU16 = (address: number): number | null => (
      this.tcp.has(address) ? this.tcp.u16(address) : null
    );

    return {
      on: this.tcp.u16(CONTROL_REGISTERS.mainSwitch.address) === 1,
      mode,
      modeName: modeName(mode),
      userMode: this.tcp.u16(CONTROL_REGISTERS.runningMode.address),
      heatingSetpointC: this.readScaledValue(CONTROL_REGISTERS.tempSetHeating),
      coolingSetpointC: this.readScaledValue(CONTROL_REGISTERS.tempSetCooling),
      dhwSetpointC: this.readScaledValue(CONTROL_REGISTERS.tempSetHotWater),
      floorSetpointC: this.readScaledValue(CONTROL_REGISTERS.tempSetFloorHeating),
      heatingCurve: this.tcp.u16(CONTROL_REGISTERS.heatingCurve.address),
      hotWaterCurve: this.tcp.u16(CONTROL_REGISTERS.hotWaterCurve.address),
      backwaterMode: this.tcp.has(L_PARAMETERS.L22_backwaterMode.address)
        ? this.tcp.u16(L_PARAMETERS.L22_backwaterMode.address)
        : 0,
      protocolVersion: protocolVersion ?? 0,
      coilsAvailable: protocolVersion !== null && protocolSupportsCoils(protocolVersion),
      tempControlMode: optionalU16(P_PARAMETERS.P116_tempControlMode.address),
      acReturnDiffC: optionalScaled(P_PARAMETERS.P26_acReturnDiff),
      floorReturnDiffC: optionalScaled(P_PARAMETERS.P27_floorReturnDiff),
      dhwReturnDiffC: optionalScaled(P_PARAMETERS.P96_hotWaterReturnDiff),
      hotWaterHeatSourceReturnDiffC: optionalScaled(P_PARAMETERS.P151_returnDiffHwSource),
      heatingHeatSourceReturnDiffC: optionalScaled(P_PARAMETERS.P152_returnDiffHeatSource),
    };
  }

  private buildPower(): PowerSnapshot {
    const unitVoltageV = this.readScaledValue(SENSOR_REGISTERS.deviceInputVoltage);
    const unitCurrentA = this.readScaledValue(SENSOR_REGISTERS.deviceInputCurrent);
    const unitPowerKw = this.readScaledValue(SENSOR_REGISTERS.deviceInputPower);
    const acVoltageV = this.readScaledValue(SENSOR_REGISTERS.acInputVoltage);
    const acCurrentA = this.readScaledValue(SENSOR_REGISTERS.acInputCurrent); // kalibratie al toegepast

    let inputPowerKw: number;
    let inputVoltageV: number;
    let inputCurrentA: number;
    let derivedPowerKw: number;
    let powerSource: PowerSource;

    if (unitPowerKw > 0) {
      powerSource = 'unit-direct';
      inputPowerKw = unitPowerKw;
      inputVoltageV = unitVoltageV > 0 ? unitVoltageV : acVoltageV;
      inputCurrentA = unitCurrentA > 0 ? unitCurrentA : acCurrentA;
      derivedPowerKw = unitPowerKw;
    } else if (unitVoltageV > 0 && unitCurrentA > 0) {
      powerSource = 'unit-derived';
      inputVoltageV = unitVoltageV;
      inputCurrentA = unitCurrentA;
      derivedPowerKw = (unitVoltageV * unitCurrentA) / 1000;
      inputPowerKw = derivedPowerKw;
    } else if (acVoltageV > 0 && acCurrentA > 0) {
      powerSource = 'ac-derived';
      inputVoltageV = acVoltageV;
      inputCurrentA = acCurrentA;
      derivedPowerKw = (acVoltageV * acCurrentA) / 1000;
      inputPowerKw = derivedPowerKw;
    } else {
      powerSource = 'none';
      inputPowerKw = 0;
      inputVoltageV = 0;
      inputCurrentA = 0;
      derivedPowerKw = 0;
    }

    return {
      inputPowerKw: +inputPowerKw.toFixed(3),
      inputCurrentA: +inputCurrentA.toFixed(2),
      inputVoltageV: +inputVoltageV.toFixed(1),
      totalEnergyKwh: this.tcp.u16(SENSOR_REGISTERS.totalEnergyConsumption.address),
      derivedPowerKw: +derivedPowerKw.toFixed(3),
      acVoltageV: +acVoltageV.toFixed(1),
      acCurrentA: +acCurrentA.toFixed(2),
      powerSource,
    };
  }

  private firstPositive(...values: number[]): number {
    return values.find((value) => Number.isFinite(value) && value > 0) ?? 0;
  }

  private buildCop(): CopSnapshot {
    const inletTemp = this.readScaledValue(SENSOR_REGISTERS.waterInletTempT6, true);
    const outletTemp = this.readScaledValue(SENSOR_REGISTERS.waterOutletTempT7, true);
    const ambientTemp = this.readScaledValue(SENSOR_REGISTERS.ambientTempT1, true);
    const deltaT = outletTemp - inletTemp;

    const rawFlow = this.tcp.u16(SENSOR_REGISTERS.waterFlow.address);
    const flow = (this.externalFlowLpm !== null && this.externalFlowLpm > 0)
      ? this.externalFlowLpm
      : (rawFlow > 0 ? rawFlow : 0);
    const thermalPowerKw = Math.abs(deltaT) * flow * WATER_THERMAL_FACTOR;

    const power = this.buildPower();
    let electricalPowerKw = 0;
    if (power.inputPowerKw > MIN_COP_POWER_KW) {
      electricalPowerKw = power.inputPowerKw;
    } else if (power.derivedPowerKw > MIN_COP_POWER_KW) {
      electricalPowerKw = power.derivedPowerKw;
    }

    const base = {
      thermalPowerKw: +thermalPowerKw.toFixed(3),
      electricalPowerKw: +electricalPowerKw.toFixed(3),
      deltaTc: +deltaT.toFixed(1),
      flowLpm: flow,
      ambientTempC: ambientTemp,
    };

    if (electricalPowerKw < MIN_COP_POWER_KW) {
      return {
        ...base,
        cop: 0,
        valid: false,
        reason: 'Elektrisch vermogen niet beschikbaar (0x005C=0). Externe kWh meter aanbevolen.',
      };
    }

    if (deltaT < MIN_COP_DELTA_T_C) {
      return {
        ...base,
        cop: 0,
        valid: false,
        reason: `ΔT=${deltaT.toFixed(1)}°C < ${MIN_COP_DELTA_T_C}°C — compressor inactief.`,
      };
    }

    return {
      ...base,
      cop: +(Math.min(thermalPowerKw / electricalPowerKw, MAX_VALID_COP)).toFixed(2),
      valid: true,
    };
  }

  private buildVersion(): VersionSnapshot {
    const programVersionRaw = this.tcp.has(VERSION_REGISTERS.programVersion.address)
      ? this.tcp.u16(VERSION_REGISTERS.programVersion.address)
      : null;

    return {
      programVersionRaw,
      programVersion: formatPackedVersion(programVersionRaw),
      deviceToolingNo: this.tcp.has(SENSOR_REGISTERS.deviceToolingNo.address)
        ? this.tcp.u16(SENSOR_REGISTERS.deviceToolingNo.address)
        : null,
      productType: this.tcp.has(VERSION_REGISTERS.productType.address)
        ? this.tcp.u16(VERSION_REGISTERS.productType.address)
        : null,
      productTypeId: this.tcp.has(VERSION_REGISTERS.productTypeId.address)
        ? this.tcp.u16(VERSION_REGISTERS.productTypeId.address)
        : null,
      protocolVersion: this.tcp.has(VERSION_REGISTERS.protocolVersion.address)
        ? this.tcp.u16(VERSION_REGISTERS.protocolVersion.address)
        : null,
      protocolVersionFormatted: this.tcp.has(VERSION_REGISTERS.protocolVersion.address)
        ? formatPackedVersion(this.tcp.u16(VERSION_REGISTERS.protocolVersion.address))
        : null,
    };
  }

  private buildSensors(): Record<string, SensorValue> {
    const sensors: Record<string, SensorValue> = {};

    for (const descriptor of SENSOR_DESCRIPTORS) {
      if (!this.tcp.has(descriptor.def.address)) {
        continue;
      }

      const raw = this.readRawValue(descriptor.def, descriptor.signed ?? false);
      sensors[descriptor.key] = {
        address: descriptor.def.address,
        raw,
        value: this.readScaledValue(descriptor.def, descriptor.signed ?? false),
        unit: descriptor.def.unit ?? '',
        label: descriptor.def.name,
      };
    }

    return sensors;
  }

  private buildDiy(): DiyHeatingCurve | undefined {
    if (!this.tcp.has(L_PARAMETERS.L27_heatingLowTempCurveDIY.address)) {
      return undefined;
    }

    const active = this.tcp.u16(L_PARAMETERS.L27_heatingLowTempCurveDIY.address) === 0;
    const slopeK = this.tcp.s16(L_PARAMETERS.L28_heatingCurveCoeffK.address) / 10;
    const interceptB = this.tcp.u16(L_PARAMETERS.L29_heatingCurveConstantB.address);

    return {
      active,
      slopeK,
      interceptB,
      calcSetpoint: (ambientC: number) => calculateDIYCurveTemp(slopeK, interceptB, ambientC),
    };
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
    return signed ? this.tcp.s16(def.address) : this.tcp.u16(def.address);
  }

  get activeTemperatureScale(): TemperatureRegisterScale {
    return this.temperatureRegisterScale;
  }

  private readScaledValue(def: NumericRegisterDefinition, signed = false): number {
    const raw = this.readRawValue(def, signed);
    let value = scaleRegisterValue(def.address, raw, this.temperatureRegisterScale, def.multiply);

    if (def.calibrationCurve) {
      value = interpolateCalibration(value, Array.from(def.calibrationCurve));
    }

    return value;
  }

  private async writeNamedCoil(
    def: { address: number; name: string },
    state: boolean,
  ): Promise<void> {
    // ADR-043 Fase 4b: expliciet weigeren als ONCE-blok nog niet gelezen is
    if (!this.tcp.has(VERSION_REGISTERS.protocolVersion.address)) {
      throw new Error(
        'Coil write geweigerd: protocol version nog niet gelezen (ONCE-blok ontbreekt).',
      );
    }
    const protocolVersion = this.tcp.u16(VERSION_REGISTERS.protocolVersion.address);
    if (!protocolSupportsCoils(protocolVersion)) {
      throw new Error(
        `FC05 coil vereist protocol >= 130, huidig: ${protocolVersion}.`,
      );
    }

    await this.tcp.writeSingleCoil(def.address, state);
  }
}
