/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { WidgetConnectionState } from '../../shared/widget-state-common';

/**
 * Live-operation-widget voor de Tuya-driver (v3.3.0).
 *
 * Vult hetzelfde contract als de Aurora III-variant, maar uit Tuya-capabilities
 * in plaats van een Modbus-snapshot. Teksten maakt de widget zelf; hier alleen
 * codes en getallen.
 */

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
  /** Bevestigde verbindingstoestand uit TuyaConnectionService; null zolang onbekend */
  connected: boolean | null;
  /** Tijdstip van de laatste ontvangen data; null als er nog niets binnenkwam */
  lastDataAt: number | null;
}

export interface LiveOperationWidgetState {
  ok: true;
  source: 'tuya';
  device: {
    name: string;
  };
  status: {
    running: boolean;
    compressorOn: boolean;
    defrosting: boolean;
    /** Waarde-id van adlar_enum_mode (bijv. 'heating'); null als onbekend */
    mode: string | null;
    /** Storingscode uit adlar_fault als tekst; leeg zonder storing */
    faultActive: string;
    connectionStatus: string;
    connectionState: WidgetConnectionState;
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
    flowSource: 'external' | 'capability' | 'none';
    powerSource: 'external' | 'capability' | 'none';
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
  const text = String(value).trim();
  return text === '' ? null : text;
}

function round(value: number | null, decimals: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function connectionState(connected: boolean | null): WidgetConnectionState {
  if (connected === null) return 'unknown';
  return connected ? 'online' : 'offline';
}

function faultText(device: CapabilityReader): string {
  const code = capNumber(device, 'adlar_fault');
  return code !== null && code !== 0 ? String(code) : '';
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
  const { device, connected, lastDataAt } = context;

  const outletC = capNumber(device, 'measure_temperature.temp_bottom');
  const inletC = capNumber(device, 'measure_temperature.temp_top');
  const ambientC = capNumber(device, 'measure_temperature.around_temp');
  const dhwC = capNumber(device, 'measure_temperature.around_temp_f');

  // Een flowkaart-waarde (adlar_external_*) gaat voor, net als bij de COP-berekening.
  const externalFlow = capNumber(device, 'adlar_external_flow');
  const capabilityFlow = capNumber(device, 'measure_water');
  const flowLpm = externalFlow ?? capabilityFlow;

  const externalPowerW = capNumber(device, 'adlar_external_power');
  const capabilityPowerW = capNumber(device, 'measure_power');
  const powerW = externalPowerW ?? capabilityPowerW;
  const inputPowerKw = powerW !== null ? powerW / 1000 : null;

  const compressorHz = capNumber(device, 'measure_frequency.compressor_strength');
  const running = capBoolean(device, 'onoff') ?? false;
  const compressorOn = capBoolean(device, 'adlar_state_compressor_state') ?? false;
  const defrosting = capBoolean(device, 'adlar_state_defrost_state') ?? false;

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

  const ageMs = lastDataAt !== null ? Math.max(0, Date.now() - lastDataAt) : null;

  return {
    ok: true,
    source: 'tuya',
    device: {
      name: device.getName(),
    },
    status: {
      running,
      compressorOn,
      defrosting,
      mode: capString(device, 'adlar_enum_mode'),
      faultActive: faultText(device),
      connectionStatus: capString(device, 'adlar_connection_status') ?? 'unknown',
      connectionState: connectionState(connected),
    },
    temperatures: {
      outletC: round(outletC, 1),
      inletC: round(inletC, 1),
      ambientC: round(ambientC, 1),
      dhwC: round(dhwC, 1),
      bufferC: null,
      setpointC: round(capNumber(device, 'target_temperature'), 1),
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
      ], 'none'),
      powerSource: dataSource([
        { value: externalPowerW, source: 'external' },
        { value: capabilityPowerW, source: 'capability' },
      ], 'none'),
    },
    data: {
      timestamp: lastDataAt,
      ageMs,
      freshness: dataFreshness(ageMs),
      sourcePollGroup: null,
    },
  };
}
