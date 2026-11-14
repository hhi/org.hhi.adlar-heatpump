/**
 * Generic Modbus TCP Service — jsmodbus transport layer
 *
 * Pad: Homey → Elfin EW11A (RS485-to-TCP bridge, poort 502) → WP Modbus RTU
 *
 * Protocol-agnostische Modbus TCP client:
 *   - Socket lifecycle (connect, reconnect met backoff, destroy)
 *   - FC03 (readHoldingRegisters), FC06 (writeSingleRegister), FC05 (writeSingleCoil)
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
  | 'unsupported' // Illegal Data Address (Modbus exception 0x02)
  | 'protocol' // Illegal Data Value (Modbus exception 0x03)
  | 'timeout' // Request timeout
  | 'disconnect' // Socket-level close/reset
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
  if (msg.includes('illegal data value')) return 'protocol';
  if (msg.includes('timeout')) return 'timeout';
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
  optional?: true; // Afwezig = required
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

// ============================================================================
// RECONNECT CONSTANTEN
// ============================================================================

const BACKOFF_BASE = 2_000;
const BACKOFF_MAX = 60_000;

type BatchDelayResolver = () => void;

// ============================================================================
// MODBUS TCP SERVICE
// ============================================================================

export type RegisterChangeSource = 'poll' | 'expert-read' | 'expert-write';
export type RegisterChangeLogMode = 'poll' | 'cache';

export interface RegisterChangeEntry {
  firstSeen: number;
  lastChanged: number;
  changeCount: number;
  pollChangeCount: number;
  actionChangeCount: number;
  cacheChangeCount: number;
  /** Laatste 50 tussenpozen tussen wijzigingen in ms */
  intervals: number[];
  lastValue: number;
  previousValue: number | null;
  previousChangedAt: number | null;
  lastSource: RegisterChangeSource;
}

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

  /** Per-register poll-wijzigingsstatistieken (in-memory, reset bij herstart) */
  private readonly changeLog = new Map<number, RegisterChangeEntry>();
  /** Per-register cache-observaties (in-memory, reset bij herstart) */
  private readonly cacheChangeLog = new Map<number, RegisterChangeEntry>();

  private _connected = false;
  private _destroyed = false;
  private _stopped = false;
  private _sessionGeneration = 0;
  private _connecting?: Promise<void>;
  private _closing?: Promise<void>;
  private readonly _batchTimers = new Map<ReturnType<typeof setTimeout>, BatchDelayResolver>();
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
    const { socket } = this;
    const current = () => socket === this.socket && !this._stopped && !this._destroyed;
    socket.on('connect', () => {
      if (!current() || socket.destroyed) return;
      this._connected = true;
      this._reconnectN = 0;
      this.stats.lastPollMs = Date.now();
      this._log(`Connected to ${this.cfg.host}:${this.cfg.port} (unit ${this.cfg.unitId})`);
      this.emit('connected');
    });

    socket.on('close', (hadError: boolean) => {
      if (!current() || !this._connected) return;
      this._connected = false;
      this._sessionGeneration++;
      this._stopPolling();
      this._cancelBatchDelays();
      this._log(`Disconnected (hadError=${hadError})`);
      this.emit('disconnected', hadError ? 'socket error' : 'remote closed');
      if (!this._destroyed) this._scheduleReconnect();
    });

    socket.on('error', (err: Error) => {
      // Keep a socket error listener through close, including after service cleanup.
      if (!current()) return;
      this._log(`Socket error: ${err.message}`);
      this.emit('error', err, 'socket');
    });

    socket.on('timeout', () => {
      if (!current()) return;
      this._log('Socket timeout');
      this.emit('error', new Error('Socket timeout'), 'socket:timeout');
      // destroy(err) zorgt dat 'error' event geëmit wordt → connect() promise rejectt
      socket.destroy(new Error('Connection timeout'));
    });
  }

  // ── Verbindingsbeheer ──────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this._destroyed) throw new Error('Service destroyed');
    if (this._closing) await this._closing;
    if (this._destroyed) throw new Error('Service destroyed');
    if (this._connecting) {
      await this._connecting;
      return;
    }
    this._stopped = false;
    if (this._connected) return;
    this._clearBackoff();
    if (this.socket.destroyed) {
      this.socket = new net.Socket();
      this.client = new Modbus.client.TCP(this.socket, this.cfg.unitId, this.cfg.timeoutMs);
      this._wireSocketEvents();
    }
    const { socket } = this;

    this._log(`Connecting to ${this.cfg.host}:${this.cfg.port}...`);

    const connecting = new Promise<void>((resolve, reject) => {
      let onConnect: () => void;
      let onError: (err: Error) => void;
      let onClose: () => void;

      const cleanup = () => {
        socket.removeListener('connect', onConnect);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
      };

      onConnect = () => {
        cleanup();
        if (!this._isActive(socket)) {
          reject(new Error('Modbus session closed'));
          return;
        }
        socket.setTimeout(0); // Clear idle timeout so we don't drop TCP when WP is quiet
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

      socket.once('connect', onConnect);
      socket.once('error', onError);
      socket.once('close', onClose);

      // Enable TCP Keep-Alive so we detect silent WiFi drops of the Elfin
      socket.setKeepAlive(true, 10000);
      socket.setTimeout(this.cfg.timeoutMs);
      socket.connect({ host: this.cfg.host, port: this.cfg.port });
    });
    this._connecting = connecting;
    try {
      await connecting;
    } finally {
      if (this._connecting === connecting) this._connecting = undefined;
    }
  }

  async disconnect(): Promise<void> {
    const wasConnected = this._connected;
    this._stopped = true;
    this._sessionGeneration++;
    this._connected = false;
    this._stopPolling();
    this._clearBackoff();
    this._cancelBatchDelays();
    const closing = this._closeSocket();
    if (wasConnected && !this._destroyed) this.emit('disconnected', 'manual');
    await closing;
  }

  async destroy(): Promise<void> {
    this._destroyed = true;
    await this.disconnect();
    this.removeAllListeners();
  }

  private async _closeSocket(): Promise<void> {
    if (this._closing) {
      await this._closing;
      return;
    }
    const { socket } = this;
    if (socket.closed) return;
    // Never end() with jsmodbus requests pending: its timeout can flush the queue
    // into an ended stream. destroy() closes both sides; jsmodbus handles close
    // first, rejects its pending requests and clears the active request timeout.
    const closing = new Promise<void>((resolve) => {
      socket.once('close', resolve);
      socket.destroy();
    });
    this._closing = closing;
    try {
      await closing;
    } finally {
      if (this._closing === closing) this._closing = undefined;
    }
  }

  private _isActive(socket: net.Socket): boolean {
    return socket === this.socket && this._connected && !this._stopped
      && !this._destroyed && !socket.destroyed && !socket.writableEnded;
  }

  private _assertActive(socket: net.Socket): void {
    if (!this._isActive(socket)) throw new Error('Modbus session closed');
  }

  private _scheduleReconnect(): void {
    if (this._destroyed || this._stopped || this._reconnectTm) return;
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

    if (this._destroyed || this._stopped) return;

    const generation = this._sessionGeneration;
    const { socket } = this;
    const timer = this._timers.setTimeout(() => {
      if (this._reconnectTm !== timer) return;
      this._reconnectTm = undefined;
      if (generation !== this._sessionGeneration || socket !== this.socket
        || this._destroyed || this._stopped || this._connected) return;
      this._attemptReconnect().catch(() => {});
    }, ms);
    this._reconnectTm = timer;
  }

  private _clearBackoff(): void {
    if (this._reconnectTm) {
      this._timers.clearTimeout(this._reconnectTm);
      this._reconnectTm = undefined;
    }
  }

  private async _attemptReconnect(): Promise<void> {
    if (this._destroyed || this._stopped || this._connected) return;
    try {
      await this.connect();
      if (this._isActive(this.socket) && this._pollGroups.length > 0) {
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
    if (this._destroyed) throw new Error('Service destroyed');
    if (this._stopped) throw new Error('Modbus session closed');
    if (this._isActive(this.socket)) return;
    this._clearBackoff();
    await this.connect();
    this._assertActive(this.socket);
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
    const { socket } = this;
    this._assertActive(socket);

    const addrHex = `0x${startAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC03 READ  ${addrHex} count=${count}`);

    try {
      const resp = await this.client.readHoldingRegisters(startAddr, count);
      this._assertActive(socket);
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

  /** Read a diagnostic block over the existing session, respecting bridge delay. */
  async readHoldingRegisterValues(start: number, count: number): Promise<number[]> {
    const { socket } = this;
    await this.readHoldingRegisters(start, count);
    this._assertActive(socket);
    const values = Array.from({ length: count }, (_, index) => this.u16(start + index));
    await this._batchDelay();
    this._assertActive(socket);
    return values;
  }

  private async _readHoldingRegistersAndDetectChange(startAddr: number, count: number): Promise<boolean> {
    const { socket } = this;
    await this.readHoldingRegisters(startAddr, count, 'poll');
    this._assertActive(socket);

    const now = Date.now();
    let anyChanged = false;

    for (let i = 0; i < count; i++) {
      const addr = startAddr + i;
      const newVal = this.cache.get(addr)!;

      let entry = this.changeLog.get(addr);
      if (!entry) {
        entry = this._createChangeEntry(now, newVal, 'poll');
        this.changeLog.set(addr, entry);
      } else if (entry.lastValue !== newVal) {
        // Vergelijk tegen entry.lastValue (laatste poll-waarde), niet de cache-snapshot.
        // De cache kan tussentijds zijn bijgewerkt door een expert-read, waardoor een
        // cache-snapshot vóór de poll de echte delta zou missen.
        if (entry.lastSource === 'poll') {
          const interval = now - entry.lastChanged;
          entry.intervals.push(interval);
          if (entry.intervals.length > 50) entry.intervals.shift();
        }
        entry.previousValue = entry.lastValue;
        entry.previousChangedAt = entry.lastChanged;
        entry.changeCount++;
        entry.pollChangeCount++;
        entry.lastChanged = now;
        entry.lastValue = newVal;
        entry.lastSource = 'poll';
        anyChanged = true;
      }
    }

    return anyChanged;
  }

  getChangeLog(mode: RegisterChangeLogMode = 'poll'): Map<number, RegisterChangeEntry> {
    return mode === 'cache' ? this.cacheChangeLog : this.changeLog;
  }

  /** Invalidate cached diagnostics without discarding operational register values. */
  clearRegisterCache(start: number, count: number): void {
    for (let address = start; address < start + count; address++) this.cache.delete(address);
  }

  getRegisterCache(): Map<number, number> {
    return new Map(this.cache);
  }

  /**
   * FC06 — Write Single Register.
   * Cache wordt synchroon bijgewerkt na succesvolle write.
   */
  async writeSingleRegister(addr: number, value: number): Promise<void> {
    const session = this._sessionGeneration;
    await this._ensureConnected();
    const { socket } = this;
    this._assertActive(socket);
    if (session !== this._sessionGeneration) throw new Error('Modbus session closed');
    const raw = value & 0xFFFF;
    const addrHex = `0x${addr.toString(16).padStart(4, '0')}`;
    this._log(`FC06 WRITE ${addrHex} = ${raw}`);

    try {
      await this.client.writeSingleRegister(addr, raw);
      this._assertActive(socket);
      const previous = this.cache.get(addr);
      this.cache.set(addr, raw);
      this._recordCacheObservation(addr, previous, raw, 'expert-write');
      this._recordExpertWrite(addr, previous, raw);
      this._log('  → OK');
      await this._batchDelay();
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC06 ${addrHex}: ${(err as Error).message}`);
      if (this._isActive(socket)) this.emit('error', err as Error, `fc06:${addrHex}`);
      throw err;
    }
  }

  /**
   * FC01 — Read Single Coil.
   * Retourneert 1 als de coil actief is, 0 anders.
   */
  async readSingleCoil(coilAddr: number, source?: RegisterChangeSource): Promise<number> {
    const { socket } = this;
    this._assertActive(socket);
    const addrHex = `0x${coilAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC01 COIL  ${addrHex} lezen`);

    try {
      const resp = await this.client.readCoils(coilAddr, 1);
      this._assertActive(socket);
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
    const session = this._sessionGeneration;
    await this._ensureConnected();
    const { socket } = this;
    this._assertActive(socket);
    if (session !== this._sessionGeneration) throw new Error('Modbus session closed');
    const addrHex = `0x${coilAddr.toString(16).padStart(4, '0')}`;
    this._log(`FC05 COIL  ${addrHex} = ${state ? 'ON' : 'OFF'}`);

    try {
      await this.client.writeSingleCoil(coilAddr, state);
      this._assertActive(socket);
      const raw = state ? 1 : 0;
      const previous = this.cacheChangeLog.get(coilAddr)?.lastValue;
      this._recordCacheObservation(coilAddr, previous, raw, 'expert-write');
      this._recordExpertWrite(coilAddr, previous, raw);
      this._log('  → OK');
      await this._batchDelay();
    } catch (err) {
      this.stats.errors++;
      this._log(`  ✗ FC05 ${addrHex}: ${(err as Error).message}`);
      if (this._isActive(socket)) this.emit('error', err as Error, `fc05:${addrHex}`);
      throw err;
    }
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
      lastValue: value,
      previousValue: null,
      previousChangedAt: null,
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
    entry.changeCount++;
    if (source === 'poll') entry.pollChangeCount++;
    else if (source === 'expert-write') entry.actionChangeCount++;
    else entry.cacheChangeCount++;
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
    entry.changeCount++;
    entry.actionChangeCount++;
    entry.lastChanged = now;
    entry.lastValue = newVal;
  }

  private _batchDelay(): Promise<void> {
    return new Promise((resolve) => {
      const timer = this._timers.setTimeout(() => {
        this._batchTimers.delete(timer);
        resolve();
      }, this.cfg.batchDelayMs);
      this._batchTimers.set(timer, resolve);
    });
  }

  private _cancelBatchDelays(): void {
    for (const [timer, resolve] of this._batchTimers) {
      this._timers.clearTimeout(timer);
      resolve();
    }
    this._batchTimers.clear();
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

  // ── Poll-engine ────────────────────────────────────────────────────────────

  /**
   * Start multi-tier polling.
   * Poll-groepen worden opgeslagen zodat ze na reconnect
   * automatisch herstart worden met dezelfde intervallen.
   */
  startPolling(groups: PollGroup[], staggerMs = 0): void {
    this._stopPolling();
    this._pollGroups = groups;
    if (!this._isActive(this.socket)) return;
    const pollGeneration = this._pollGeneration;

    let staggerIndex = 0;
    for (const group of groups) {
      if (group.intervalMs <= 0) {
        // Eenmalig uitvoeren (bijv. versie-info)
        this._runPollGroup(group, pollGeneration).catch(() => {});
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
      this._runPollGroup(group, pollGeneration)
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

  private async _runPollGroup(group: PollGroup, pollGeneration = this._pollGeneration): Promise<boolean> {
    const { socket } = this;
    const active = () => this._isActive(socket) && pollGeneration === this._pollGeneration;
    if (!active()) return false;
    let requiredFailed = false;
    let optionalFailed = false;
    let changed = false;

    for (const blk of group.blocks) {
      if (!active()) return changed;
      try {
        changed = (await this._readHoldingRegistersAndDetectChange(blk.start, blk.count)) || changed;
        if (!active()) return changed;
        await this._batchDelay();
      } catch (e) {
        if (!active()) return changed;
        const blockError = new ModbusBlockError(
          (e as Error).message,
          classifyError(e as Error),
          blk.start,
          group.name,
          blk.optional ?? false,
        );
        this.emit('error', blockError, `poll:${group.name}:block:0x${blk.start.toString(16)}`);

        if (blk.optional) {
          optionalFailed = true;
        } else {
          requiredFailed = true;
        }
      }
    }

    if (!active()) return changed;
    if (requiredFailed) return changed; // Geen poll-complete — ModbusBlockError is al geëmit

    this.stats.polls++;
    this.stats.lastPollMs = Date.now();
    this.emit(optionalFailed ? 'poll-partial' : 'poll-complete', group.name);
    return changed;
  }
}
