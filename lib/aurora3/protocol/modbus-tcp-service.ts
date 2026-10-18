/**
 * Generic Modbus TCP Service — jsmodbus transport layer
 *
 * Pad: Homey → Elfin EW11A (RS485-to-TCP bridge, poort 502) → WP Modbus RTU
 *
 * Protocol-agnostische Modbus TCP client:
 *   - Socket lifecycle (connect, reconnect met backoff, destroy)
 *   - FC03 (readHoldingRegisters), FC04 (readInputRegisters),
 *     FC06 (writeSingleRegister), FC05 (writeSingleCoil)
 *   - Register cache (Map<address, uint16>)
 *   - Configurable multi-tier polling engine
 *   - Batch delay tussen requests (voor trage bridges)
 *
 * Bevat GEEN device-specifieke logica (registers, schaalfactoren, snapshots).
 *
 * @requires jsmodbus ^5.x.x
 */

import * as Modbus from 'jsmodbus';
import * as net from 'net';
import { EventEmitter } from 'events';

// ============================================================================
// MODBUS BLOCK ERROR — ADR-043
// ============================================================================

export type ModbusErrorCode =
  | 'unsupported'   // Illegal Data Address (Modbus exception 0x02)
  | 'protocol'      // Illegal Data Value (Modbus exception 0x03)
  | 'timeout'       // Request timeout
  | 'disconnect'    // Socket-level close/reset
  | 'unknown';

export class ModbusBlockError extends Error {
  constructor(
    message: string,
    public readonly code: ModbusErrorCode,
    public readonly blockStart: number,
    public readonly groupName: string,
    public readonly optional: boolean,
  ) {
    super(message);
    this.name = 'ModbusBlockError';
  }
}

function classifyError(err: Error): ModbusErrorCode {
  const msg = err.message.toLowerCase();
  if (msg.includes('illegal data address')) return 'unsupported';
  if (msg.includes('illegal data value'))   return 'protocol';
  if (msg.includes('timeout'))              return 'timeout';
  if (msg.includes('connection closed') || msg.includes('econnreset')) return 'disconnect';
  return 'unknown';
}

// ============================================================================
// TIMER FACADE
// ============================================================================

/**
 * Injecteerbare timer-facade.
 *
 * In Homey-context: geef `this.homey.setTimeout` / `this.homey.setInterval` mee
 * zodat Homey de timers beheert en automatisch opruimt bij app-restarts.
 *
 * In CLI / test-context: laat leeg — de standaard global timers worden gebruikt.
 */
export interface TimerProvider {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  setInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearTimeout: (handle: ReturnType<typeof setTimeout> | undefined) => void;
  clearInterval: (handle: ReturnType<typeof setInterval> | undefined) => void;
}

const GLOBAL_TIMER_PROVIDER: TimerProvider = {
  // eslint-disable-next-line homey-app/global-timers
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  // eslint-disable-next-line homey-app/global-timers
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearTimeout: (h) => {
    if (h !== undefined) clearTimeout(h);
  },
  clearInterval: (h) => {
    if (h !== undefined) clearInterval(h);
  },
};

// ============================================================================
// CONFIGURATIE
// ============================================================================

export interface ModbusTcpConfig {
  /** IP-adres van de Modbus TCP gateway (bijv. Elfin EW11A) */
  host: string;
  /** TCP-poort. Elfin EW11A Modbus TCP mode: 502 (of 1502). */
  port: number;
  /** Modbus Unit ID — in de MBAP-header meegestuurd. Default = 1. */
  unitId: number;
  /** Request timeout in ms — jsmodbus geeft een Timeout-error na deze periode */
  timeoutMs: number;
  /**
   * Extra delay tussen FC03/FC06/FC05 operaties (ms).
   * Nodig voor RS485 bridges die rust nodig hebben. 80–100 ms is veilig.
   */
  batchDelayMs: number;
  /** Max reconnect pogingen (0 = onbeperkt) */
  maxReconnects: number;
  /**
   * Optionele timer-facade voor Homey-compatibele timerbeheer.
   * Laat leeg voor CLI/test gebruik (global timers als fallback).
   */
  timerProvider?: TimerProvider;
}

const DEFAULT_CONFIG: Omit<ModbusTcpConfig, 'host'> = {
  port: 502,
  unitId: 1,
  timeoutMs: 5_000,
  batchDelayMs: 90,
  maxReconnects: 0,
};

// ============================================================================
// POLL GROUP DEFINITIE
// ============================================================================

export interface PollBlock {
  start: number;
  count: number;
  label: string;
  fc?: 'holding' | 'input';
  optional?: true;   // Afwezig = required
}

export interface PollGroup {
  name: string;
  intervalMs: number;
  blocks: readonly PollBlock[];
  adaptive?: {
    enabled: boolean;
    activeIntervalMs: number;
    idleIntervalMs: number;
  };
}

export type RegisterChangeSource = 'poll' | 'expert-read' | 'expert-write';
export type RegisterChangeLogMode = 'poll' | 'cache';

export interface RegisterChangeEntry {
  firstSeen: number;
  lastChanged: number;
  changeCount: number;
  pollChangeCount: number;
  actionChangeCount: number;
  cacheChangeCount: number;
  /** Laatste 100 tussenpozen tussen wijzigingen in ms */
  intervals: number[];
  previousValue: number | null;
  previousChangedAt: number | null;
  lastValue: number;
  lastSource: RegisterChangeSource;
}

// ============================================================================
// RECONNECT CONSTANTEN
// ============================================================================

const BACKOFF_BASE = 2_000;
const BACKOFF_MAX = 60_000;

// ============================================================================
// MODBUS TCP SERVICE
// ============================================================================

/**
 * Events:
 *   'connected'                     — TCP verbinding succesvol
 *   'disconnected' (reason: string) — verbinding verbroken
 *   'reconnecting' (attempt: number, delayMs: number)
 *   'error' (err: Error, ctx: string)
 *   'poll-complete' (groupName: string) — alle blokken in poll-groep geslaagd
 *   'poll-partial'  (groupName: string) — required blokken OK, ≥1 optional blok gefaald
 */
export class ModbusTcpService extends EventEmitter {

  private readonly cfg: ModbusTcpConfig;
  private readonly _timers: TimerProvider;
  private _debug = false;

  private socket: net.Socket;
  private client: InstanceType<typeof Modbus.client.TCP>;

  /** Holding register cache: adres → unsigned 16-bit */
  private readonly cache = new Map<number, number>();
  private readonly changeLog = new Map<number, RegisterChangeEntry>();
  private readonly cacheChangeLog = new Map<number, RegisterChangeEntry>();

  private _connected = false;
  private _destroyed = false;
  private _reconnectN = 0;
  private _reconnectTm?: ReturnType<typeof setTimeout>;
  private _pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private _pollGroups: PollGroup[] = [];
  private _pollGeneration = 0;

  readonly stats = {
    polls: 0, errors: 0, reconnects: 0, lastPollMs: 0,
  };

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(cfg: Partial<ModbusTcpConfig> & { host: string }) {
    super();
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this._timers = cfg.timerProvider ?? GLOBAL_TIMER_PROVIDER;
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket, this.cfg.unitId, this.cfg.timeoutMs);
    this._wireSocketEvents();
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Schakel debug logging in/uit */
  setDebug(on: boolean): void {
    this._debug = on;
  }

  private _log(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    if (this._debug) console.log('[ModbusTCP]', ...args);
  }

  // ── Socket event wiring ────────────────────────────────────────────────────

  private _wireSocketEvents(): void {
    this.socket.on('connect', () => {
      this._connected = true;
      this._reconnectN = 0;
      this.stats.lastPollMs = Date.now();
      this._log(`Connected to ${this.cfg.host}:${this.cfg.port} (unit ${this.cfg.unitId})`);
      this.emit('connected');
    });

    this.socket.on('close', (hadError: boolean) => {
      if (!this._connected) return;
      this._connected = false;
      this._log(`Disconnected (hadError=${hadError})`);
      this.emit('disconnected', hadError ? 'socket error' : 'remote closed');
      if (!this._destroyed) this._scheduleReconnect();
    });

    this.socket.on('error', (err: Error) => {
      this._log(`Socket error: ${err.message}`);
      this.emit('error', err, 'socket');
    });

    this.socket.on('timeout', () => {
      this._log('Socket timeout');
      this.emit('error', new Error('Socket timeout'), 'socket:timeout');
      // destroy(err) zorgt dat 'error' event geëmit wordt → connect() promise rejectt
      this.socket.destroy(new Error('Connection timeout'));
    });
  }

  // ── Verbindingsbeheer ──────────────────────────────────────────────────────

  connect(): Promise<void> {
    if (this._connected) return Promise.resolve();
    if (this._destroyed) return Promise.reject(new Error('Service destroyed'));

    this._log(`Connecting to ${this.cfg.host}:${this.cfg.port}...`);

    return new Promise((resolve, reject) => {
      let onConnect: () => void;
      let onError: (err: Error) => void;
      let onClose: () => void;

      const cleanup = () => {
        this.socket.removeListener('connect', onConnect);
        this.socket.removeListener('error', onError);
        this.socket.removeListener('close', onClose);
      };

      onConnect = () => {
        cleanup();
        this.socket.setTimeout(0); // Clear idle timeout so we don't drop TCP when WP is quiet
        resolve();
      };

      onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      onClose = () => {
        cleanup();
        reject(new Error('Socket closed during connect'));
      };

      this.socket.once('connect', onConnect);
      this.socket.once('error', onError);
      this.socket.once('close', onClose);

      // Enable TCP Keep-Alive so we detect silent WiFi drops of the Elfin
      this.socket.setKeepAlive(true, 10000);
      this.socket.connect({ host: this.cfg.host, port: this.cfg.port });
      this.socket.setTimeout(this.cfg.timeoutMs);
    });
  }

  async disconnect(): Promise<void> {
    this._stopPolling();
    this._clearBackoff();
    this._destroyed = false;
    if (this._connected) {
      this._connected = false;
      this._gracefulClose();
      this.emit('disconnected', 'manual');
    }
  }

  async destroy(): Promise<void> {
    this._destroyed = true;
    this._stopPolling();
    this._clearBackoff();
    if (this._connected) {
      this._connected = false;
      this._gracefulClose();
    } else {
      this.socket.destroy();
    }
    this.removeAllListeners();
  }

  private _gracefulClose(): void {
    // socket.end() stuurt FIN zodat Modbus bridges de sessie netjes kunnen opruimen.
    // Na 1s alsnog destroy() als de remote niet antwoordt.
    try {
      const socket = this.socket;
      socket.end();
      this._timers.setTimeout(() => socket.destroy(), 1_000);
    } catch {
      this.socket.destroy();
    }
  }

  private _scheduleReconnect(): void {
    if (this._destroyed) return;
    this._reconnectN++;
    this.stats.reconnects++;

    const max = this.cfg.maxReconnects;
    if (max > 0 && this._reconnectN > max) {
      this.emit('error', new Error(`Max reconnects (${max}) bereikt`), 'reconnect');
      return;
    }

    const ms = Math.min(BACKOFF_BASE * 2 ** (this._reconnectN - 1), BACKOFF_MAX);
    this._log(`Reconnect #${this._reconnectN} in ${ms}ms`);
    this.emit('reconnecting', this._reconnectN, ms);

    this._reconnectTm = this._timers.setTimeout(() => {
      this._attemptReconnect().catch(() => {});
    }, ms);
  }

  private _clearBackoff(): void {
    if (this._reconnectTm) {
      this._timers.clearTimeout(this._reconnectTm);
      this._reconnectTm = undefined;
    }
  }

  private async _attemptReconnect(): Promise<void> {
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket, this.cfg.unitId, this.cfg.timeoutMs);
    this._wireSocketEvents();

    try {
      await this.connect();
      if (this._pollGroups.length > 0) {
        this.startPolling(this._pollGroups);
      }
    } catch {
      this._scheduleReconnect();
    }
  }

  /**
   * Zorgt dat er een actieve verbinding is voor een schrijfoperatie.
   * Als er geen verbinding is, wordt de geplande backoff geannuleerd en
   * direct een herverbindingspoging gedaan — zonder backoff-vertraging.
   */
  private async _ensureConnected(): Promise<void> {
    if (this._connected) return;
    if (this._destroyed) throw new Error('Service destroyed');
    this._clearBackoff();
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket, this.cfg.unitId, this.cfg.timeoutMs);
    this._wireSocketEvents();
    await this.connect();
    if (this._pollGroups.length > 0) {
      this.startPolling(this._pollGroups);
    }
  }

  // ── Modbus TCP operaties ──────────────────────────────────────────────────

  /**
   * FC03 — Read Holding Registers.
   * Resultaten worden opgeslagen in de interne cache.
   *
   * jsmodbus response.body.values kan zowel Buffer als number[] zijn,
   * afhankelijk van de jsmodbus versie.
   */
  async readHoldingRegisters(startAddr: number, count: number, source?: RegisterChangeSource): Promise<void> {
    if (!this._connected) throw new Error('Niet verbonden');

    const addrHex = `0x${startAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC03 READ  ${addrHex} count=${count}`);

    try {
      const resp = await this.client.readHoldingRegisters(startAddr, count);
      const { values } = resp.response.body;

      for (let i = 0; i < count; i++) {
        let val: number;
        if (Buffer.isBuffer(values)) {
          // jsmodbus v4: Buffer met big-endian uint16 pairs
          val = values.readUInt16BE(i * 2);
        } else if (Array.isArray(values)) {
          // jsmodbus v5: number[] array
          val = values[i] & 0xFFFF;
        } else {
          throw new Error(`Onverwacht response type: ${typeof values}`);
        }
        const addr = startAddr + i;
        const previous = this.cache.get(addr);
        this.cache.set(addr, val);
        if (source) this._recordCacheObservation(addr, previous, val, source);
      }

      if (this._debug) {
        const preview = Array.from({ length: Math.min(count, 8) }, (_, i) => {
          const a = startAddr + i;
          const v = this.cache.get(a)!;
          return `0x${a.toString(16).padStart(4, '0')}=${v}`;
        }).join(', ');
        this._log(`  → ${preview}${count > 8 ? ` ... (+${count - 8} meer)` : ''}`);
      }
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC03 ${addrHex}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * FC04 — Read Input Registers.
   * Resultaten worden opgeslagen in dezelfde interne cache als holding registers.
   * Aurora III gebruikt input registers voor vrijwel alle sensor- en statusdata.
   */
  async readInputRegisters(startAddr: number, count: number, source?: RegisterChangeSource): Promise<void> {
    if (!this._connected) throw new Error('Niet verbonden');

    const addrHex = `0x${startAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC04 READ  ${addrHex} count=${count}`);

    try {
      const resp = await this.client.readInputRegisters(startAddr, count);
      const { values } = resp.response.body;

      for (let i = 0; i < count; i++) {
        let val: number;
        if (Buffer.isBuffer(values)) {
          val = values.readUInt16BE(i * 2);
        } else if (Array.isArray(values)) {
          val = values[i] & 0xFFFF;
        } else {
          throw new Error(`Onverwacht response type: ${typeof values}`);
        }
        const addr = startAddr + i;
        const previous = this.cache.get(addr);
        this.cache.set(addr, val);
        if (source) this._recordCacheObservation(addr, previous, val, source);
      }

      if (this._debug) {
        const preview = Array.from({ length: Math.min(count, 8) }, (_, i) => {
          const a = startAddr + i;
          const v = this.cache.get(a)!;
          return `0x${a.toString(16).padStart(4, '0')}=${v}`;
        }).join(', ');
        this._log(`  → ${preview}${count > 8 ? ` ... (+${count - 8} meer)` : ''}`);
      }
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC04 ${addrHex}: ${(err as Error).message}`);
      throw err;
    }
  }

  private async _readHoldingRegistersAndDetectChange(startAddr: number, count: number): Promise<boolean> {
    await this.readHoldingRegisters(startAddr, count, 'poll');

    return this._detectPolledChanges(startAddr, count);
  }

  private async _readInputRegistersAndDetectChange(startAddr: number, count: number): Promise<boolean> {
    await this.readInputRegisters(startAddr, count, 'poll');

    return this._detectPolledChanges(startAddr, count);
  }

  /**
   * FC06 — Write Single Register.
   * Cache wordt synchroon bijgewerkt na succesvolle write.
   */
  async writeSingleRegister(addr: number, value: number): Promise<void> {
    await this._ensureConnected();
    const raw = value & 0xFFFF;
    const addrHex = `0x${addr.toString(16).padStart(4, '0')}`;
    this._log(`FC06 WRITE ${addrHex} = ${raw}`);

    try {
      await this.client.writeSingleRegister(addr, raw);
      const previous = this.cache.get(addr);
      this.cache.set(addr, raw);
      this._recordCacheObservation(addr, previous, raw, 'expert-write');
      this._recordExpertWrite(addr, previous, raw);
      this._log('  → OK');
      await this._batchDelay();
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC06 ${addrHex}: ${(err as Error).message}`);
      this.emit('error', err as Error, `fc06:${addrHex}`);
      throw err;
    }
  }

  /**
   * FC01 — Read Single Coil.
   * Retourneert 1 als de coil actief is, 0 anders.
   */
  async readSingleCoil(coilAddr: number, source?: RegisterChangeSource): Promise<number> {
    if (!this._connected) throw new Error('Niet verbonden');
    const addrHex = `0x${coilAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC01 COIL  ${addrHex} lezen`);

    try {
      const resp = await this.client.readCoils(coilAddr, 1);
      const { values } = resp.response.body;
      let result: number;
      if (Array.isArray(values)) {
        result = values[0] ? 1 : 0;
      } else if (Buffer.isBuffer(values)) {
        result = (values[0] & 0x01) ? 1 : 0;
      } else {
        throw new Error(`Onverwacht coil response type: ${typeof values}`);
      }
      if (source) {
        const previous = this.cacheChangeLog.get(coilAddr)?.lastValue;
        this._recordCacheObservation(coilAddr, previous, result, source);
      }
      this._log(`  → ${result}`);
      return result;
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC01 ${addrHex}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * FC05 — Write Single Coil.
   */
  async writeSingleCoil(coilAddr: number, state: boolean): Promise<void> {
    await this._ensureConnected();
    const addrHex = `0x${coilAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC05 COIL  ${addrHex} = ${state ? 'ON' : 'OFF'}`);

    try {
      await this.client.writeSingleCoil(coilAddr, state);
      const raw = state ? 1 : 0;
      const previous = this.cacheChangeLog.get(coilAddr)?.lastValue;
      this._recordCacheObservation(coilAddr, previous, raw, 'expert-write');
      this._recordExpertWrite(coilAddr, previous, raw);
      this._log('  → OK');
      await this._batchDelay();
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC05 ${addrHex}: ${(err as Error).message}`);
      this.emit('error', err as Error, `fc05:${addrHex}`);
      throw err;
    }
  }

  private _batchDelay(): Promise<void> {
    return new Promise((r) => this._timers.setTimeout(r, this.cfg.batchDelayMs));
  }

  // ── Cache helpers ──────────────────────────────────────────────────────────

  /** Unsigned 16-bit uit cache */
  u16(addr: number, dflt = 0): number {
    return this.cache.get(addr) ?? dflt;
  }

  /** Signed 16-bit (two's complement) */
  s16(addr: number, dflt = 0): number {
    const v = this.cache.get(addr);
    if (v === undefined) return dflt;
    return v > 0x7FFF ? v - 0x10000 : v;
  }

  /** Signed 16-bit met schaalfactor */
  scaled(addr: number, scale: number, dflt = 0): number {
    const v = this.cache.get(addr);
    if (v === undefined) return dflt;
    return (v > 0x7FFF ? v - 0x10000 : v) * scale;
  }

  /** Heeft de cache een waarde voor dit adres? */
  has(addr: number): boolean {
    return this.cache.has(addr);
  }

  getChangeLog(mode: RegisterChangeLogMode = 'poll'): Map<number, RegisterChangeEntry> {
    return mode === 'cache' ? this.cacheChangeLog : this.changeLog;
  }

  getRegisterCache(): Map<number, number> {
    return this.cache;
  }

  private _detectPolledChanges(startAddr: number, count: number): boolean {
    const now = Date.now();
    let anyChanged = false;

    for (let i = 0; i < count; i++) {
      const addr = startAddr + i;
      const value = this.cache.get(addr)!;
      let entry = this.changeLog.get(addr);
      if (!entry) {
        entry = this._createChangeEntry(now, value, 'poll');
        this.changeLog.set(addr, entry);
        continue;
      }

      if (entry.lastValue !== value) {
        if (entry.lastSource === 'poll') {
          entry.intervals.push(now - entry.lastChanged);
          if (entry.intervals.length > 100) entry.intervals.shift();
        }
        entry.previousValue = entry.lastValue;
        entry.previousChangedAt = entry.lastChanged;
        entry.lastValue = value;
        entry.changeCount += 1;
        entry.pollChangeCount += 1;
        entry.lastChanged = now;
        entry.lastSource = 'poll';
        anyChanged = true;
      }
    }

    return anyChanged;
  }

  private _createChangeEntry(now: number, value: number, source: RegisterChangeSource): RegisterChangeEntry {
    return {
      firstSeen: now,
      lastChanged: now,
      changeCount: 0,
      pollChangeCount: 0,
      actionChangeCount: 0,
      cacheChangeCount: 0,
      intervals: [],
      previousValue: null,
      previousChangedAt: null,
      lastValue: value,
      lastSource: source,
    };
  }

  private _recordCacheObservation(addr: number, previous: number | undefined, newVal: number, source: RegisterChangeSource): void {
    const now = Date.now();
    let entry = this.cacheChangeLog.get(addr);
    if (!entry) {
      entry = this._createChangeEntry(now, newVal, source);
      if (source === 'expert-write') {
        entry.changeCount = 1;
        entry.actionChangeCount = 1;
      }
      this.cacheChangeLog.set(addr, entry);
      return;
    }

    if (entry.lastValue === newVal) return;

    entry.lastSource = source;
    entry.previousValue = previous ?? entry.lastValue;
    entry.previousChangedAt = entry.lastChanged;
    entry.changeCount += 1;
    if (source === 'poll') entry.pollChangeCount += 1;
    else if (source === 'expert-write') entry.actionChangeCount += 1;
    else entry.cacheChangeCount += 1;
    entry.lastChanged = now;
    entry.lastValue = newVal;
  }

  private _recordExpertWrite(addr: number, previous: number | undefined, newVal: number): void {
    const now = Date.now();
    let entry = this.changeLog.get(addr);
    if (!entry) {
      entry = this._createChangeEntry(now, newVal, 'expert-write');
      entry.changeCount = 1;
      entry.actionChangeCount = 1;
      this.changeLog.set(addr, entry);
      return;
    }

    entry.lastSource = 'expert-write';
    if (entry.lastValue === newVal) return;

    entry.previousValue = previous ?? entry.lastValue;
    entry.previousChangedAt = entry.lastChanged;
    entry.changeCount += 1;
    entry.actionChangeCount += 1;
    entry.lastChanged = now;
    entry.lastValue = newVal;
  }

  // ── Poll-engine ────────────────────────────────────────────────────────────

  /**
   * Start multi-tier polling.
   * Poll-groepen worden opgeslagen zodat ze na reconnect
   * automatisch herstart worden met dezelfde intervallen.
   */
  startPolling(groups: PollGroup[], staggerMs = 0): void {
    this._stopPolling();
    this._pollGroups = groups;
    const pollGeneration = this._pollGeneration;

    let staggerIndex = 0;
    for (const group of groups) {
      if (group.intervalMs <= 0) {
        // Eenmalig uitvoeren (bijv. versie-info)
        this._runPollGroup(group).catch(() => {});
        continue;
      }

      this._schedulePollGroup(group, staggerIndex * staggerMs, pollGeneration);
      staggerIndex++;
    }
  }

  stopPolling(): void {
    this._stopPolling();
  }

  private _stopPolling(): void {
    this._pollGeneration++;
    for (const t of this._pollTimers.values()) this._timers.clearTimeout(t);
    this._pollTimers.clear();
  }

  private _schedulePollGroup(group: PollGroup, delayMs: number, pollGeneration: number): void {
    const timer = this._timers.setTimeout(() => {
      if (pollGeneration !== this._pollGeneration) {
        return;
      }

      this._pollTimers.delete(group.name);
      this._runPollGroup(group)
        .then((changed) => {
          if (
            this._destroyed
            || pollGeneration !== this._pollGeneration
            || !this._pollGroups.some((pollGroup) => pollGroup.name === group.name)
          ) {
            return;
          }

          const nextDelay = group.adaptive?.enabled
            ? (changed ? group.adaptive.activeIntervalMs : group.adaptive.idleIntervalMs)
            : group.intervalMs;
          this._schedulePollGroup(group, nextDelay, pollGeneration);
        })
        .catch(() => {
          if (
            this._destroyed
            || pollGeneration !== this._pollGeneration
            || !this._pollGroups.some((pollGroup) => pollGroup.name === group.name)
          ) {
            return;
          }
          this._schedulePollGroup(group, group.intervalMs, pollGeneration);
        });
    }, delayMs);

    this._pollTimers.set(group.name, timer);
  }

  private async _runPollGroup(group: PollGroup): Promise<boolean> {
    if (!this._connected) return false;
    let requiredFailed = false;
    let optionalFailed = false;
    let changed = false;

    for (const blk of group.blocks) {
      try {
        const blockChanged = blk.fc === 'input'
          ? await this._readInputRegistersAndDetectChange(blk.start, blk.count)
          : await this._readHoldingRegistersAndDetectChange(blk.start, blk.count);
        changed = blockChanged || changed;
        await this._batchDelay();
      } catch (e) {
        const blockError = new ModbusBlockError(
          (e as Error).message,
          classifyError(e as Error),
          blk.start,
          group.name,
          blk.optional ?? false,
        );
        this.emit('error', blockError, `poll:${group.name}:block:0x${blk.start.toString(16)}`);

        if (blk.optional) { optionalFailed = true; }
        else               { requiredFailed = true; }
      }
    }

    if (requiredFailed) return changed; // Geen poll-complete — ModbusBlockError is al geëmit

    this.stats.polls++;
    this.stats.lastPollMs = Date.now();
    this.emit(optionalFailed ? 'poll-partial' : 'poll-complete', group.name);
    return changed;
  }
}
