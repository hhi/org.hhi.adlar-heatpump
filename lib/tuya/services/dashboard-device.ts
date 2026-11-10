/* eslint-disable import/no-unresolved, node/no-missing-import, import/extensions */
import { randomUUID } from 'crypto';
import { DashboardError } from './dashboard-error';
import { AdlarMapping } from '../definitions/adlar-mapping';
import { DeviceConstants } from '../constants';
import { LiveOperationWidgetState } from './widget-state-service';

export type Labels = string | Record<string, string>;
export interface CapabilityMeta {
  title?: Labels;
  type?: string;
  units?: Labels;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  values?: { id: string; title: Labels }[];
}
export interface DashboardAdapter {
  name(): string;
  values(): Record<string, unknown>;
  options(id: string): CapabilityMeta;
  snapshot(): LiveOperationWidgetState;
  adaptiveEnabled(): boolean;
  write(id: string, value: string | number | boolean): Promise<unknown>;
}
export interface DashboardTimers {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
}
export interface DashboardEvent {
  at: number;
  kind: string;
  key: string;
  previous?: unknown;
  value?: unknown;
  commandId?: string;
}
interface DpsValue {
  raw: unknown;
  receivedAt: number;
  changedAt: number;
  firstSeen: number;
  previousRaw: unknown;
  previousChangedAt: number | null;
  changeCount: number;
  intervals: number[];
}
export interface DashboardCommand {
  id: string;
  capability: string;
  dps: number;
  value: string | number | boolean;
  status: 'requested' | 'sent' | 'observed' | 'unconfirmed' | 'failed';
  requestedAt: number;
  observedAt?: number;
}
const WRITABLE = new Set([
  'onoff', 'target_temperature', 'adlar_hotwater', 'adlar_enum_mode',
  'adlar_enum_work_mode', 'adlar_enum_water_mode',
  'adlar_picker_countdown_set', 'adlar_enum_capacity_set',
]);

/** Per-device memory only. Receiving data never opens a connection or writes to Tuya. */
export class TuyaDashboardDevice {
  private cache = new Map<number, DpsValue>();
  private events: DashboardEvent[] = [];
  private commands = new Map<string, DashboardCommand>();
  private timeouts = new Map<string, NodeJS.Timeout>();
  private connected: boolean | null = null;
  private disposed = false;
  private reportedOptionErrors = new Set<string>();

  // TypeScript parameter properties initialize the adapter and dependencies.
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(
    public readonly adapter: DashboardAdapter,
    private readonly metadata: Record<string, CapabilityMeta>,
    private readonly timers: DashboardTimers,
    private readonly logger: (message: string, error: unknown) => void = () => {},
  ) { /* Parameter properties are initialized by TypeScript. */ }

  private record(event: DashboardEvent): void {
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
  }

  receive(dps: Record<number, unknown>, at = Date.now()): void {
    if (this.disposed) return;
    Object.entries(dps).forEach(([key, raw]) => {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1 || id > 255) return;
      const previous = this.cache.get(id);
      const changed = !previous || JSON.stringify(previous.raw) !== JSON.stringify(raw);
      const entry: DpsValue = previous ?? {
        raw,
        receivedAt: at,
        changedAt: at,
        firstSeen: at,
        previousRaw: null,
        previousChangedAt: null,
        changeCount: 0,
        intervals: [],
      };
      if (previous && changed) {
        entry.previousRaw = previous.raw;
        entry.previousChangedAt = previous.changedAt;
        entry.intervals.push(Math.max(0, at - previous.changedAt));
        if (entry.intervals.length > 50) entry.intervals.shift();
        entry.changeCount += 1;
        entry.changedAt = at;
      }
      if (changed) {
        this.record({
          at, kind: previous ? 'dps' : 'initial', key, previous: previous?.raw, value: raw,
        });
      }
      entry.raw = raw;
      entry.receivedAt = at;
      this.cache.set(id, entry);
      this.commands.forEach((command) => {
        if (command.dps !== id || !this.timeouts.has(command.id)) return;
        if (AdlarMapping.transformDpsValue(id, raw) === command.value) {
          command.observedAt = at;
          if (command.status === 'sent') this.finish(command, 'observed');
        }
      });
    });
  }

  connection(value: boolean): void {
    if (this.disposed || value === this.connected) return;
    this.record({
      at: Date.now(), kind: 'connection', key: 'connection', previous: this.connected, value,
    });
    this.connected = value;
  }

  capabilities() {
    return Object.entries(this.adapter.values()).map(([id, value]) => {
      let runtimeOptions: CapabilityMeta = {};
      let optionsUnavailable = false;
      try {
        runtimeOptions = this.adapter.options(id) ?? {};
      } catch (error) {
        optionsUnavailable = true;
        if (!this.reportedOptionErrors.has(id)) {
          this.reportedOptionErrors.add(id);
          this.logger(`Tuya dashboard: capability options unavailable for ${id}; using manifest`, error);
        }
      }
      const meta = { ...this.metadata[id], ...runtimeOptions };
      if (id === 'onoff') meta.type = 'boolean';
      // DPS 10 is a dimensionless 0/1 selector; its legacy capability has unit L.
      if (id === 'adlar_enum_water_mode') {
        meta.unit = ''; meta.units = '';
      }
      if (id === 'target_temperature') {
        Object.assign(meta, {
          type: 'number', min: DeviceConstants.MIN_TARGET_TEMPERATURE, max: DeviceConstants.MAX_TARGET_TEMPERATURE, step: 1,
        });
      }
      if (id === 'adlar_hotwater') {
        Object.assign(meta, {
          min: DeviceConstants.MIN_HOTWATER_TEMPERATURE, max: DeviceConstants.MAX_HOTWATER_TEMPERATURE, step: 1,
        });
      }
      const dps = AdlarMapping.allCapabilities[id]?.[0] ?? null;
      // measure_power can be selected/estimated by the energy service; its age is not DPS 104's age.
      const receivedAt = dps && id !== 'measure_power' ? this.cache.get(dps)?.receivedAt ?? null : null;
      return {
        id,
        value: value ?? null,
        ...meta,
        dps,
        receivedAt,
        writable: WRITABLE.has(id) && dps !== null,
        optionsUnavailable,
      };
    });
  }

  snapshot() {
    const state = this.adapter.snapshot();
    const values = this.adapter.values();
    // The widget defaults unknown booleans to false. Dashboards must retain unknowns.
    const boolean = (id: string) => (typeof values[id] === 'boolean' ? values[id] : null);
    return {
      ...state,
      status: {
        ...state.status,
        running: boolean('onoff'),
        compressorOn: boolean('adlar_state_compressor_state'),
        defrosting: boolean('adlar_state_defrost_state'),
        faultActive: values.adlar_fault ?? null,
      },
      process: {
        ...state.process,
        thermalPowerKw: boolean('adlar_state_compressor_state') === null || boolean('adlar_state_defrost_state') === null ? null : state.process.thermalPowerKw,
        liveCopEstimate: boolean('adlar_state_compressor_state') === null || boolean('adlar_state_defrost_state') === null ? null : state.process.liveCopEstimate,
      },
      adaptiveEnabled: this.adapter.adaptiveEnabled(),
    };
  }

  datapoints() {
    const capabilities = this.capabilities();
    const ids = new Set([...Object.keys(AdlarMapping.dps).map((id) => Number(id.slice(4))), ...this.cache.keys()]);
    return [...ids].sort((a, b) => a - b).map((id) => {
      const entry = this.cache.get(id);
      const definition = AdlarMapping.dps[`dps_${id}`];
      const mapped = capabilities.filter((cap) => cap.dps === id);
      return {
        id,
        name: definition ? { en: definition.name, nl: definition.adlar } : null,
        raw: entry?.raw ?? null,
        value: entry ? AdlarMapping.transformDpsValue(id, entry.raw) : null,
        receivedAt: entry?.receivedAt ?? null,
        changedAt: entry?.changedAt ?? null,
        capabilities: AdlarMapping.dpsToCapabilities[id] ?? [],
        units: mapped[0]?.units ?? mapped[0]?.unit ?? '',
        writable: mapped.filter((cap) => cap.writable).map((cap) => cap.id),
      };
    });
  }

  changeOverview() {
    return this.datapoints().map((dp) => {
      const entry = this.cache.get(dp.id);
      const intervals = entry?.intervals ?? [];
      return {
        ...dp,
        firstSeen: entry?.firstSeen ?? null,
        previousRaw: entry?.previousRaw ?? null,
        previousValue: entry && entry.changeCount > 0 ? AdlarMapping.transformDpsValue(dp.id, entry.previousRaw) : null,
        previousChangedAt: entry?.previousChangedAt ?? null,
        changeCount: entry?.changeCount ?? 0,
        lastChanged: entry && entry.changeCount > 0 ? entry.changedAt : null,
        avgInterval: intervals.length ? Math.round(intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length) : null,
        minInterval: intervals.length ? Math.min(...intervals) : null,
        maxInterval: intervals.length ? Math.max(...intervals) : null,
      };
    });
  }

  heatingCurve() {
    const values = this.adapter.values();
    const slope = values.heating_curve_slope;
    const intercept = values.heating_curve_intercept;
    const valid = typeof slope === 'number' && Number.isFinite(slope)
      && typeof intercept === 'number' && Number.isFinite(intercept);
    return {
      heating: values.adlar_enum_countdown_set ?? null,
      hotWater: values.adlar_sensor_capacity_set ?? null,
      ambient: values['measure_temperature.around_temp'] ?? null,
      setpoint: values.target_temperature ?? null,
      recommendation: values.adlar_simulated_target ?? null,
      adaptiveEnabled: this.adapter.adaptiveEnabled(),
      // These are the app's linear curve parameters, NOT the Tuya H/L preset formulas.
      appCurve: valid ? { slope, intercept } : null,
      presetCurve: null,
    };
  }

  getEvents(): DashboardEvent[] {
    return [...this.events];
  }

  getCommand(id: string): DashboardCommand | undefined {
    return this.commands.get(id);
  }

  command(capability: unknown, value: unknown): DashboardCommand {
    if (this.disposed) throw new DashboardError(503, 'unavailable');
    const meta = this.capabilities().find((cap) => cap.id === capability && cap.writable);
    if (!meta || meta.dps === null) throw new DashboardError(400, 'unsupported');
    const valid = (meta.type === 'boolean' && typeof value === 'boolean')
      || (meta.type === 'enum' && typeof value === 'string' && meta.values?.some((item) => item.id === value))
      || (meta.type === 'number' && typeof value === 'number' && Number.isFinite(value)
        && typeof meta.min === 'number' && typeof meta.max === 'number'
        && value >= meta.min && value <= meta.max
        && (!meta.step || Math.abs((value - meta.min) / meta.step - Math.round((value - meta.min) / meta.step)) < 1e-7));
    if (!valid) throw new DashboardError(400, 'invalid_value');
    if (this.adapter.snapshot().status.connectionState !== 'online') throw new DashboardError(503, 'offline');
    if ([...this.commands.values()].some((cmd) => cmd.dps === meta.dps && this.timeouts.has(cmd.id))) {
      throw new DashboardError(409, 'busy');
    }
    if (this.commands.size >= 100) {
      const oldest = [...this.commands.keys()].find((id) => !this.timeouts.has(id));
      if (!oldest) throw new DashboardError(429, 'busy');
      this.commands.delete(oldest);
    }
    const command: DashboardCommand = {
      id: randomUUID(),
      capability: meta.id,
      dps: meta.dps,
      value: value as string | number | boolean,
      status: 'requested',
      requestedAt: Date.now(),
    };
    this.commands.set(command.id, command);
    this.record({
      at: command.requestedAt, kind: 'requested', key: meta.id, value, commandId: command.id,
    });
    this.timeouts.set(command.id, this.timers.setTimeout(() => this.finish(command, 'unconfirmed'), 30_000));
    // Return immediately; transport completion and physical observation are independent.
    Promise.resolve().then(() => {
      if (this.disposed) return undefined;
      return this.adapter.write(meta.id, command.value);
    }).then(() => {
      if (this.disposed || !this.timeouts.has(command.id)) return;
      command.status = 'sent';
      this.record({
        at: Date.now(), kind: 'sent', key: meta.id, value, commandId: command.id,
      });
      if (command.observedAt !== undefined) this.finish(command, 'observed');
    }).catch(() => {
      if (!this.disposed && this.timeouts.has(command.id)) this.finish(command, 'failed');
    });
    return command;
  }

  private finish(command: DashboardCommand, status: DashboardCommand['status']): void {
    clearTimeout(this.timeouts.get(command.id));
    this.timeouts.delete(command.id);
    command.status = status;
    this.record({
      at: Date.now(), kind: status, key: command.capability, value: command.value, commandId: command.id,
    });
  }

  destroy(): void {
    this.disposed = true;
    this.timeouts.forEach((timer) => clearTimeout(timer));
    this.timeouts.clear();
    this.commands.clear();
    this.events = [];
    this.cache.clear();
    this.reportedOptionErrors.clear();
  }
}
