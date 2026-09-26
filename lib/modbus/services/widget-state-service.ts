/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { DataSnapshot } from '../protocol/adlar2-modbus-service';
import { MODE_OPTIONS } from '../protocol/adlar-modbus-registers';

const THERMAL_POWER_FACTOR_KW_PER_LPM_PER_C = 0.0698;
const DATA_FRESH_MS = 60_000;
const MIN_ELECTRICAL_POWER_KW = 0.05;

export interface CapabilityReader {
  getCapabilityValue(capabilityId: string): unknown;
  hasCapability(capabilityId: string): boolean;
  getName(): string;
}

export interface WidgetStateContext {
  device: CapabilityReader;
  snapshot: DataSnapshot | null;
  isExternalCapabilityFresh?: (capabilityId: string) => boolean;
}

export interface LiveOperationWidgetState {
  ok: boolean;
  message?: string;
  device: {
    name: string;
  };
  status: {
    running: boolean;
    compressorOn: boolean;
    defrosting: boolean;
    mode: string;
    faultActive: string;
    connectionStatus: string;
    connectionLabel: string;
  };
  temperatures: {
    outletC: number | null;
    inletC: number | null;
    ambientC: number | null;
    dhwC: number | null;
    bufferC: number | null;
  };
  process: {
    deltaTC: number | null;
    flowLpm: number | null;
    electricalPowerKw: number | null;
    thermalPowerKw: number | null;
    compressorHz: number | null;
    liveCopEstimate: number | null;
    capabilityCop: number | null;
    flowSource: 'external' | 'capability' | 'snapshot' | 'none';
    powerSource: 'external' | 'capability' | 'snapshot' | 'none';
  };
  regulation: {
    mode: string;
    sensor: string;
    hysteresisC: number | null;
    hysteresisSource: string;
    hysteresisText: string;
    activeSetpointC: number | null;
    activeSetpointText: string;
    setpointDeviationC: number | null;
    summary: string;
  };
  data: {
    timestamp: number | null;
    ageMs: number | null;
    freshness: 'fresh' | 'stale' | 'no_data';
    sourcePollGroup: string | null;
  };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return null;
}

function capNumber(device: CapabilityReader, capabilityId: string): number | null {
  if (!device.hasCapability(capabilityId)) return null;
  return numberOrNull(device.getCapabilityValue(capabilityId));
}

function capBoolean(device: CapabilityReader, capabilityId: string): boolean | null {
  if (!device.hasCapability(capabilityId)) return null;
  return booleanOrNull(device.getCapabilityValue(capabilityId));
}

function capString(device: CapabilityReader, capabilityId: string): string | null {
  if (!device.hasCapability(capabilityId)) return null;
  const value = device.getCapabilityValue(capabilityId);
  if (value === null || value === undefined) return null;
  return String(value);
}

function sensorValue(snapshot: DataSnapshot | null, sensorKey: string): number | null {
  return numberOrNull(snapshot?.sensors[sensorKey]?.value);
}

function round(value: number | null, decimals: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function modeLabel(value: string | null, snapshot: DataSnapshot | null): string {
  const capabilityMode = numberOrNull(value);
  if (capabilityMode !== null) {
    const label = MODE_OPTIONS[capabilityMode as keyof typeof MODE_OPTIONS];
    if (label) return label;
  }
  const source = value ?? snapshot?.control.modeName ?? '';
  const normalized = source.trim();
  if (normalized === '') return 'Unknown';
  return normalized;
}

function connectionLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized.startsWith('connected')) return 'Online';
  if (normalized.startsWith('disconnected')) return 'Offline';
  if (normalized === 'online') return 'Online';
  if (normalized === 'offline') return 'Offline';
  if (normalized === 'degraded') return 'Degraded';
  if (normalized === '') return 'Unknown';
  return status;
}

function regulationSensorLabel(tempControlMode: number | null | undefined): string {
  if (tempControlMode === 0) return 'retour T6';
  if (tempControlMode === 1) return 'aanvoer T7';
  return 'regelbron onbekend';
}

function activeHysteresis(snapshot: DataSnapshot | null): {
  value: number | null;
  source: string;
} {
  const mode = snapshot?.control.mode;
  if (mode === 2) {
    return { value: numberOrNull(snapshot?.control.dhwReturnDiffC), source: 'P96' };
  }
  if (mode === 3 || mode === 7) {
    return { value: numberOrNull(snapshot?.control.floorReturnDiffC), source: 'P27' };
  }
  if (mode === 0 || mode === 1 || mode === 4 || mode === 5) {
    return { value: numberOrNull(snapshot?.control.acReturnDiffC), source: 'P26' };
  }
  return { value: null, source: '-' };
}

function activeSetpoint(snapshot: DataSnapshot | null): number | null {
  const mode = snapshot?.control.mode;
  if (mode === 0) return numberOrNull(snapshot?.control.coolingSetpointC);
  if (mode === 1 || mode === 5) return numberOrNull(snapshot?.control.heatingSetpointC);
  if (mode === 2 || mode === 4) return numberOrNull(snapshot?.control.dhwSetpointC);
  if (mode === 3 || mode === 7) return numberOrNull(snapshot?.control.floorSetpointC);
  return null;
}

function regulatedTemperature(
  tempControlMode: number | null | undefined,
  inletC: number | null,
  outletC: number | null,
): number | null {
  if (tempControlMode === 0) return inletC;
  if (tempControlMode === 1) return outletC;
  return null;
}

function regulationSummary(mode: string, sensor: string, hysteresis: { value: number | null; source: string }): string {
  return `${mode} op ${sensor}`;
}

function hysteresisText(hysteresis: { value: number | null; source: string }): string {
  if (hysteresis.source === '-') return 'Hysterese onbekend';
  if (hysteresis.value === null) return `${hysteresis.source} nog niet gelezen`;
  return `${hysteresis.source} hysterese ${hysteresis.value.toFixed(1)}C`;
}

function activeSetpointText(setpointC: number | null): string {
  if (setpointC === null) return 'Setpoint onbekend';
  return `Setpoint ${setpointC.toFixed(1)}C`;
}

function externalNumber(
  device: CapabilityReader,
  capabilityId: string,
  isFresh?: (capabilityId: string) => boolean,
): number | null {
  if (!isFresh?.(capabilityId)) return null;
  return capNumber(device, capabilityId);
}

function snapshotFlowLpm(snapshot: DataSnapshot | null): number | null {
  return numberOrNull(snapshot?.sensors.waterFlow?.value)
    ?? numberOrNull(snapshot?.cop.flowLpm);
}

function electricalPowerKw(
  externalPowerW: number | null,
  capabilityPowerW: number | null,
  snapshotInputPowerKw: number | null,
  snapshotDerivedPowerKw: number | null,
): number | null {
  if (externalPowerW !== null) return externalPowerW / 1000;
  if (capabilityPowerW !== null) return capabilityPowerW / 1000;
  if (snapshotInputPowerKw !== null) return snapshotInputPowerKw;
  return snapshotDerivedPowerKw;
}

function dataFreshness(ageMs: number | null): LiveOperationWidgetState['data']['freshness'] {
  if (ageMs === null) return 'no_data';
  if (ageMs > DATA_FRESH_MS) return 'stale';
  return 'fresh';
}

function dataSource<T extends string>(
  sources: Array<{ value: number | null; source: T }>,
  fallback: T,
): T {
  const found = sources.find((source) => source.value !== null);
  return found?.source ?? fallback;
}

export function buildLiveOperationWidgetState(context: WidgetStateContext): LiveOperationWidgetState {
  const { device, snapshot, isExternalCapabilityFresh } = context;

  const outletC = capNumber(device, 'measure_temperature.outlet') ?? sensorValue(snapshot, 'outletT7');
  const inletC = capNumber(device, 'measure_temperature.inlet') ?? sensorValue(snapshot, 'inletT6');
  const ambientC = capNumber(device, 'measure_temperature.ambient') ?? sensorValue(snapshot, 'ambientT1');
  const dhwC = capNumber(device, 'measure_temperature.dhw') ?? sensorValue(snapshot, 'dhwTankTemp');
  const bufferC = capNumber(device, 'measure_temperature.buffer_tank') ?? sensorValue(snapshot, 'bufferTankTemp');

  const externalFlow = externalNumber(device, 'adlar_external_flow', isExternalCapabilityFresh);
  const capabilityFlow = capNumber(device, 'measure_water');
  const snapshotFlow = snapshotFlowLpm(snapshot);
  const flowLpm = externalFlow ?? capabilityFlow ?? snapshotFlow;

  const externalPowerW = externalNumber(device, 'adlar_external_power', isExternalCapabilityFresh);
  const capabilityPowerW = capNumber(device, 'measure_power');
  const snapshotInputPowerKw = numberOrNull(snapshot?.power.inputPowerKw);
  const snapshotDerivedPowerKw = numberOrNull(snapshot?.power.derivedPowerKw);
  const inputPowerKw = electricalPowerKw(
    externalPowerW,
    capabilityPowerW,
    snapshotInputPowerKw,
    snapshotDerivedPowerKw,
  );

  const compressorHz = capNumber(device, 'measure_frequency.compressor_freq')
    ?? sensorValue(snapshot, 'compRunningFreq');
  const deltaTC = outletC !== null && inletC !== null ? outletC - inletC : null;
  const thermalPowerKw = flowLpm !== null && deltaTC !== null
    ? Math.abs(flowLpm * deltaTC * THERMAL_POWER_FACTOR_KW_PER_LPM_PER_C)
    : null;
  const liveCopEstimate = thermalPowerKw !== null
    && inputPowerKw !== null
    && inputPowerKw >= MIN_ELECTRICAL_POWER_KW
    ? thermalPowerKw / inputPowerKw
    : null;

  const running = capBoolean(device, 'adlar_running')
    ?? snapshot?.status.running
    ?? false;
  const compressorOn = capBoolean(device, 'adlar_state_compressor_state')
    ?? snapshot?.status.compressorOn
    ?? false;
  const defrosting = capBoolean(device, 'adlar_defrosting')
    ?? snapshot?.status.defrosting
    ?? false;
  const faultActive = capString(device, 'adlar_fault_active')
    ?? snapshot?.status.activeFaults.join('; ')
    ?? '';
  const connectionStatus = capString(device, 'adlar_connection_status')
    ?? snapshot?.diagnostics?.connectionQuality
    ?? 'unknown';
  const shortConnectionStatus = connectionLabel(connectionStatus);
  const timestamp = snapshot?.ts ?? null;
  const ageMs = timestamp !== null ? Date.now() - timestamp : null;
  const freshness = dataFreshness(ageMs);
  const mode = modeLabel(capString(device, 'adlar_mode'), snapshot);
  const regulationSensor = regulationSensorLabel(snapshot?.control.tempControlMode);
  const hysteresis = activeHysteresis(snapshot);
  const setpointC = activeSetpoint(snapshot);
  const regulatedTempC = regulatedTemperature(snapshot?.control.tempControlMode, inletC, outletC);
  const setpointDeviationC = regulatedTempC !== null && setpointC !== null
    ? regulatedTempC - setpointC
    : null;

  return {
    ok: true,
    device: {
      name: device.getName(),
    },
    status: {
      running,
      compressorOn,
      defrosting,
      mode,
      faultActive,
      connectionStatus,
      connectionLabel: shortConnectionStatus,
    },
    temperatures: {
      outletC: round(outletC, 1),
      inletC: round(inletC, 1),
      ambientC: round(ambientC, 1),
      dhwC: round(dhwC, 1),
      bufferC: round(bufferC, 1),
    },
    process: {
      deltaTC: round(deltaTC, 1),
      flowLpm: round(flowLpm, 1),
      electricalPowerKw: round(inputPowerKw, 2),
      thermalPowerKw: round(thermalPowerKw, 2),
      compressorHz: round(compressorHz, 0),
      liveCopEstimate: round(liveCopEstimate, 1),
      capabilityCop: round(capNumber(device, 'adlar_cop'), 1),
      flowSource: dataSource([
        { value: externalFlow, source: 'external' },
        { value: capabilityFlow, source: 'capability' },
        { value: snapshotFlow, source: 'snapshot' },
      ], 'none'),
      powerSource: dataSource([
        { value: externalPowerW, source: 'external' },
        { value: capabilityPowerW, source: 'capability' },
        { value: snapshotInputPowerKw ?? snapshotDerivedPowerKw, source: 'snapshot' },
      ], 'none'),
    },
    regulation: {
      mode,
      sensor: regulationSensor,
      hysteresisC: round(hysteresis.value, 1),
      hysteresisSource: hysteresis.source,
      hysteresisText: hysteresisText(hysteresis),
      activeSetpointC: round(setpointC, 1),
      activeSetpointText: activeSetpointText(setpointC),
      setpointDeviationC: round(setpointDeviationC, 1),
      summary: regulationSummary(mode, regulationSensor, hysteresis),
    },
    data: {
      timestamp,
      ageMs,
      freshness,
      sourcePollGroup: snapshot?.sourcePollGroup ?? null,
    },
  };
}
