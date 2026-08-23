/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import { EventEmitter } from 'events';
import Homey from 'homey';
import { DataSnapshot } from '../protocol/adlar2-modbus-service';
import { TemperatureRegisterScale } from '../protocol/adlar-modbus-registers';
import { RegisterChangeEntry, RegisterChangeLogMode, TimerProvider } from '../protocol/modbus-tcp-service';
import { ModbusRuntimeService } from '../protocol/modbus-runtime-service';

export interface ModbusConnectionConfig {
  host: string;
  port?: number;
  unitId?: number;
  pollSuperfastMs?: number;
  pollSuperfastAdaptive?: boolean;
  pollSuperfastAdaptiveMs?: number;
  pollFastMs?: number;
  pollMediumMs?: number;
  pollSlowMs?: number;
}

export interface ModbusConnectionOptions<TSnapshot = DataSnapshot> {
  device: Homey.Device;
  logger?: (message: string, ...args: unknown[]) => void;
  createService: (args: {
    config: ModbusConnectionConfig;
    timerProvider: TimerProvider;
  }) => ModbusRuntimeService<TSnapshot>;
  onData: (snapshot: TSnapshot) => void;
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onError: (err: Error, context: string) => void;
  onPollGroupSucceeded?: (groupName: string) => void;
}

/**
 * ModbusConnectionService wraps a ModbusRuntimeService and exposes a clean
 * interface to the ServiceCoordinator. The concrete service implementation is
 * injected via the createService factory — ModbusConnectionService has no
 * direct dependency on Adlar2ModbusService or any other concrete class.
 *
 * ADR-031: ModbusConnectionService ontkoppelen van Adlar-registerset.
 */
export class ModbusConnectionService<TSnapshot = DataSnapshot> extends EventEmitter {
  private device: Homey.Device;
  private logger: (message: string, ...args: unknown[]) => void;
  private service: ModbusRuntimeService<TSnapshot> | null = null;
  private connected = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastConfig: ModbusConnectionConfig | null = null;
  private reconnecting = false;

  private readonly createService: ModbusConnectionOptions<TSnapshot>['createService'];
  private readonly onData: (snapshot: TSnapshot) => void;
  private readonly onConnected: () => void;
  private readonly onDisconnected: (reason: string) => void;
  private readonly onError: (err: Error, context: string) => void;
  private readonly onPollGroupSucceeded?: (groupName: string) => void;
  private _firstConnect = true;
  private _initialDelayDone = false;

  constructor(options: ModbusConnectionOptions<TSnapshot>) {
    super();
    this.device = options.device;
    this.logger = options.logger || (() => {});
    this.createService = options.createService;
    this.onData = options.onData;
    this.onConnected = options.onConnected;
    this.onDisconnected = options.onDisconnected;
    this.onError = options.onError;
    this.onPollGroupSucceeded = options.onPollGroupSucceeded;
  }

  /**
   * Connect to the Modbus device using the provided config.
   */
  async connect(config: ModbusConnectionConfig): Promise<void> {
    this.lastConfig = config;
    this.logger('ModbusConnectionService: Connecting to', config.host);

    if (this.retryTimer) {
      this.device.homey.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.service) {
      const oldService = this.service;
      this.service = null;
      this.connected = false;
      await oldService.destroy().catch((err: Error) => {
        this.logger('ModbusConnectionService: Error destroying previous service before reconnect:', err.message);
      });
    }

    const timerProvider: TimerProvider = {
      setTimeout: this.device.homey.setTimeout.bind(this.device.homey),
      setInterval: this.device.homey.setInterval.bind(this.device.homey),
      clearTimeout: this.device.homey.clearTimeout.bind(this.device.homey),
      clearInterval: this.device.homey.clearInterval.bind(this.device.homey),
    };

    const service = this.createService({ config, timerProvider });
    this.service = service;

    service.on('connected', () => {
      if (this.service !== service) return;
      this.connected = true;
      this.logger('ModbusConnectionService: Connected');
      const superfast = config.pollSuperfastMs ?? 5_000;
      const superfastAdaptive = config.pollSuperfastAdaptive ?? true;
      const superfastAdaptiveMs = config.pollSuperfastAdaptiveMs ?? 2_000;
      const fast = config.pollFastMs ?? 10_000;
      const medium = config.pollMediumMs ?? 30_000;
      const slow = config.pollSlowMs ?? 300_000;
      const staggerMs = this._firstConnect ? 300 : 0;
      this._firstConnect = false;
      service.startPolling({
        superfast,
        superfastAdaptive,
        superfastAdaptiveMs,
        fast,
        medium,
        slow,
        staggerMs,
      });
      this.onConnected();
    });

    service.on('disconnected', (reason: string) => {
      if (this.service !== service) return;
      this.connected = false;
      this.logger('ModbusConnectionService: Disconnected:', reason);
      this.onDisconnected(reason);
    });

    service.on('reconnecting', (attempt: number, delayMs: number) => {
      if (this.service !== service) return;
      this.logger(`ModbusConnectionService: Reconnect attempt #${attempt} in ${delayMs}ms`);
    });

    service.on('data', (snapshot: TSnapshot) => {
      if (this.service !== service) return;
      this.onData(snapshot);
    });

    service.on('error', (err: Error, ctx: string) => {
      if (this.service !== service) return;
      this.logger(`ModbusConnectionService: Error [${ctx}]:`, err.message);
      this.onError(err, ctx);
    });

    service.on('poll-group-succeeded', (groupName: string) => {
      if (this.service !== service) return;
      this.onPollGroupSucceeded?.(groupName);
    });

    if (!this._initialDelayDone) {
      this._initialDelayDone = true;
      this.logger('ModbusConnectionService: Wachten 5s voor initiële verbinding...');
      await new Promise<void>((resolve) => this.device.homey.setTimeout(resolve, 5_000));
    }

    try {
      await service.connect();
    } catch (err) {
      this.logger('ModbusConnectionService: Initial connect failed, will retry in 30s:', (err as Error).message);
      if (this.service === service) {
        this.service = null;
        this.connected = false;
      }
      await service.destroy().catch((destroyErr: Error) => {
        this.logger('ModbusConnectionService: Error destroying failed service:', destroyErr.message);
      });
      this.retryTimer = this.device.homey.setTimeout(async () => {
        this.retryTimer = null;
        await this.connect(config);
      }, 30_000);
    }
  }

  async forceReconnect(reason: string): Promise<void> {
    if (!this.lastConfig) {
      this.logger('ModbusConnectionService: Cannot force reconnect without previous config');
      return;
    }
    if (this.reconnecting) {
      this.logger('ModbusConnectionService: Force reconnect already in progress');
      return;
    }

    this.reconnecting = true;
    this.logger(`ModbusConnectionService: Force reconnect (${reason})`);

    if (this.retryTimer) {
      this.device.homey.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const oldService = this.service;
    this.service = null;
    this.connected = false;

    try {
      if (oldService) {
        await oldService.destroy();
      }
      await this.connect(this.lastConfig);
    } finally {
      this.reconnecting = false;
    }
  }

  /**
   * Write a setpoint to the device.
   */
  async setTemperature(type: 'heating' | 'cooling' | 'dhw' | 'floor' | 'indoor', value: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setTemperature(type, value);
  }

  /**
   * Write the on/off switch to the device.
   */
  async setMainSwitch(value: boolean): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setMainSwitch(value);
  }

  /**
   * Write the operating mode to the device.
   */
  async setMode(mode: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setMode(mode);
  }

  /**
   * Write the heating curve to the device.
   */
  async setHeatingCurve(curve: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setHeatingCurve(curve);
  }

  /**
   * Write the hot water curve to the device.
   */
  async setHotWaterCurve(curve: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setHotWaterCurve(curve);
  }

  /**
   * Write the cooling curve to the device.
   */
  async setCoolingCurve(curve: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setCoolingCurve(curve);
  }

  /**
   * Write the floor heating curve to the device.
   */
  async setFloorHeatingCurve(curve: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setFloorHeatingCurve(curve);
  }

  async setDiyHeatingCurve(k: number, b: number): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setDiyHeatingCurve(k, b);
  }

  /**
   * Write the user mode to the device.
   */
  async setUserMode(mode: 0 | 1 | 2): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    await this.service.setUserMode(mode);
  }

  /**
   * Returns whether the device is currently connected.
   */
  isDeviceConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns diagnostic information.
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      connected: this.connected,
      hasService: !!this.service,
      hasRetryTimer: !!this.retryTimer,
    };
  }

  getSnapshot(): TSnapshot | null {
    return this.service?.getSnapshot() ?? null;
  }

  /**
   * Update the external flow rate used for COP calculations.
   */
  setExternalFlow(lpm: number | null): void {
    this.service?.setExternalFlow(lpm);
  }

  getTemperatureScale(): TemperatureRegisterScale {
    return (this.service as unknown as { activeTemperatureScale: TemperatureRegisterScale } | null)?.activeTemperatureScale ?? 'x1';
  }

  getChangeLog(mode?: RegisterChangeLogMode): Map<number, RegisterChangeEntry> {
    return (this.service as unknown as { getChangeLog(m?: RegisterChangeLogMode): Map<number, RegisterChangeEntry> } | null)?.getChangeLog(mode) ?? new Map();
  }

  getRegisterCache(): Map<number, number> {
    return this.service?.getRegisterCache() ?? new Map();
  }

  /** FC03 — lees één holding register; retourneert de ruwe unsigned waarde. */
  async readRegister(addr: number): Promise<number> {
    if (!this.service) throw new Error('Niet verbonden');
    return (this.service as unknown as { readRegister(a: number): Promise<number> }).readRegister(addr);
  }

  /** FC01 — lees één coil; retourneert 1 (aan) of 0 (uit). */
  async readCoil(addr: number): Promise<number> {
    if (!this.service) throw new Error('Niet verbonden');
    return (this.service as unknown as { readCoil(a: number): Promise<number> }).readCoil(addr);
  }

  /** FC06 of FC05 — schrijf één register of coil met de ruwe waarde. */
  async writeRaw(addr: number, rawValue: number, isCoil: boolean): Promise<void> {
    if (!this.service) throw new Error('Niet verbonden');
    if (isCoil) {
      return (this.service as unknown as { writeCoil(a: number, s: boolean): Promise<void> }).writeCoil(addr, rawValue === 1);
    }
    return (this.service as unknown as { writeRegister(a: number, v: number): Promise<void> }).writeRegister(addr, rawValue);
  }

  /**
   * Destroy the service and clean up all resources.
   */
  async destroy(): Promise<void> {
    this.logger('ModbusConnectionService: Destroying');

    if (this.retryTimer) {
      this.device.homey.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.service) {
      await this.service.destroy();
      this.service = null;
    }

    this.connected = false;
    this.removeAllListeners();
    this.logger('ModbusConnectionService: Destroyed');
  }
}
