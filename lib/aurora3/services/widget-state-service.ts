/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { DataSnapshot } from '../protocol/adlar3-modbus-service';

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
  };
  temperatures: {
    outletC: number | null;
    inletC: number | null;
    ambientC: number | null;
    dhwC: number | null;
    bufferC: number | null;
    setpointC: number | null;
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
  const source = value ?? snapshot?.control.modeName ?? '';
  const normalized = source.trim();
  switch (normalized) {
    case '0': return 'Off';
    case '1': return 'Cool';
    case '2': return 'Heat';
    case '3': return 'Auto';
    default: return normalized || 'Unknown';
  }
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
  const copFlow = numberOrNull(snapshot?.cop.flowLpm);
  if (copFlow !== null) return copFlow;

  const sensorFlow = numberOrNull(snapshot?.sensors.waterFlow?.value);
  if (sensorFlow === null) return null;

  if (snapshot?.sensors.waterFlow?.unit === 'm³/h') {
    return (sensorFlow * 1000) / 60;
  }

  return sensorFlow;
}

function electricalPowerKw(
  externalPowerW: number | null,
  capabilityPowerW: number | null,
  snapshotPowerKw: number | null,
): number | null {
  if (externalPowerW !== null) return externalPowerW / 1000;
  if (capabilityPowerW !== null) return capabilityPowerW / 1000;
  return snapshotPowerKw;
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

  const outletC = capNumber(device, 'measure_temperature.outlet') ?? sensorValue(snapshot, 'aanvoerTA');
  const inletC = capNumber(device, 'measure_temperature.inlet') ?? sensorValue(snapshot, 'retourTE1');
  const ambientC = capNumber(device, 'measure_temperature.ambient') ?? sensorValue(snapshot, 'ambientT4');
  const dhwC = capNumber(device, 'measure_temperature.dhw') ?? sensorValue(snapshot, 'dhwTankTemp');
  const bufferC = capNumber(device, 'measure_temperature.buffer_tank') ?? sensorValue(snapshot, 'bufferTankTemp');

  const externalFlow = externalNumber(device, 'adlar_external_flow', isExternalCapabilityFresh);
  const capabilityFlow = capNumber(device, 'measure_water');
  const snapshotFlow = snapshotFlowLpm(snapshot);
  const flowLpm = externalFlow ?? capabilityFlow ?? snapshotFlow;

  const externalPowerW = externalNumber(device, 'adlar_external_power', isExternalCapabilityFresh);
  const capabilityPowerW = capNumber(device, 'measure_power');
  const snapshotPowerKw = numberOrNull(snapshot?.power.derivedPowerKw);
  const inputPowerKw = electricalPowerKw(externalPowerW, capabilityPowerW, snapshotPowerKw);

  const compressorHz = capNumber(device, 'measure_frequency.compressor_freq')
    ?? sensorValue(snapshot, 'compRunningFreq');
  const running = capBoolean(device, 'adlar_running')
    ?? snapshot?.status.running
    ?? false;
  const compressorOn = capBoolean(device, 'adlar_compressor_on')
    ?? snapshot?.status.compressorOn
    ?? false;
  const defrosting = capBoolean(device, 'adlar_defrosting')
    ?? snapshot?.status.defrosting
    ?? false;

  const deltaTC = outletC !== null && inletC !== null ? outletC - inletC : null;
  // During defrost or with the compressor off, ΔT does not represent delivered heat.
  const exchanging = compressorOn && !defrosting;
  let thermalPowerKw: number | null = null;
  if (flowLpm !== null && deltaTC !== null) {
    thermalPowerKw = exchanging ? Math.abs(flowLpm * deltaTC * THERMAL_POWER_FACTOR_KW_PER_LPM_PER_C) : 0;
  }
  const liveCopEstimate = thermalPowerKw !== null
    && exchanging
    && inputPowerKw !== null
    && inputPowerKw >= MIN_ELECTRICAL_POWER_KW
    ? thermalPowerKw / inputPowerKw
    : null;
  const faultActive = capString(device, 'adlar_fault_active')
    ?? snapshot?.status.activeFaults.join('; ')
    ?? '';
  const connectionStatus = capString(device, 'adlar_connection_status')
    ?? snapshot?.diagnostics?.connectionQuality
    ?? 'unknown';
  const timestamp = snapshot?.ts ?? null;
  const ageMs = timestamp !== null ? Date.now() - timestamp : null;
  const freshness = dataFreshness(ageMs);

  return {
    ok: true,
    device: {
      name: device.getName(),
    },
    status: {
      running,
      compressorOn,
      defrosting,
      mode: modeLabel(capString(device, 'adlar_mode_aurora3'), snapshot),
      faultActive,
      connectionStatus,
    },
    temperatures: {
      outletC: round(outletC, 1),
      inletC: round(inletC, 1),
      ambientC: round(ambientC, 1),
      dhwC: round(dhwC, 1),
      bufferC: round(bufferC, 1),
      setpointC: round(
        capNumber(device, 'target_temperature') ?? snapshot?.control.heatingSetpointC ?? null,
        1,
      ),
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
        { value: snapshotPowerKw, source: 'snapshot' },
      ], 'none'),
    },
    data: {
      timestamp,
      ageMs,
      freshness,
      sourcePollGroup: snapshot?.sourcePollGroup ?? null,
    },
  };
}
