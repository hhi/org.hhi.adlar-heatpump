/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { DataSnapshot, pollGroupsForAddress } from '../protocol/adlar3-modbus-service';
import { RegisterChangeEntry, RegisterChangeLogMode } from '../protocol/modbus-tcp-service';
import {
  ALL_HOLDING_REGISTERS,
  ALL_INPUT_REGISTERS,
  CONTROL_REGISTERS,
  SENSOR_REGISTERS,
  registerBitTable,
} from '../protocol/adlar3-modbus-registers';

type TemperatureRegisterScale = 'x1' | 'x10';

// ── Whitelist voor ADR-044 interactief dashboard ───────────────────────────────

interface WritableRegisterMeta {
  address: number;
  min: number;
  max: number;
  multiply: number;
  name: string;
  capability?: string;
}

const WRITABLE_REGISTERS: Record<string, WritableRegisterMeta> = {
  zone1HeatingSetTemp: {
    address: CONTROL_REGISTERS.zone1HeatingSetTemp.address, min: 18, max: 50, multiply: 0.1, name: 'Zone 1 verwarming setpoint', capability: 'target_temperature',
  },
  zone1CoolingSetTemp: {
    address: CONTROL_REGISTERS.zone1CoolingSetTemp.address, min: 7, max: 25, multiply: 0.1, name: 'Zone 1 koeling setpoint', capability: 'target_temperature.cooling',
  },
  dhwSetTemp: {
    address: CONTROL_REGISTERS.dhwSetTemp.address, min: 20, max: 75, multiply: 0.1, name: 'Tapwater setpoint', capability: 'target_temperature.dhw',
  },
  roomTempSetTemp: {
    address: CONTROL_REGISTERS.roomTempSetTemp.address, min: 16, max: 28, multiply: 0.1, name: 'Ruimtetemperatuur setpoint', capability: 'target_temperature.floor',
  },
};

// ── Whitelist voor bediening via capability listeners (/api/control) ──────────
// Deze schrijfacties lopen via de capability listeners van het device, zodat de
// read-modify-write op 4-2103 en de experimentele vergrendeling van aan/uit gelden.

type ControlValueKind = 'boolean' | readonly string[];

const CONTROL_CAPABILITIES: Record<string, ControlValueKind> = {
  onoff: 'boolean',
  adlar_dhw_enabled: 'boolean',
  adlar_backup_heater_forced: 'boolean',
  adlar_silent_mode: ['0', '1', '2'],
};

interface CapabilityMeta {
  title: string;
  unit: string;
  icon: string;
  type: string;
  /** Enum capabilities: value id → display title. */
  values?: Record<string, string>;
}

/** Map an enum capability's `values` array to { id: title } (English first, like the titles). */
function _enumValueTitles(values: unknown): Record<string, string> | undefined {
  if (!Array.isArray(values)) return undefined;
  const result: Record<string, string> = {};
  for (const entry of values as Array<{ id?: unknown; title?: Record<string, string> }>) {
    if (typeof entry.id !== 'string') continue;
    result[entry.id] = entry.title?.en || entry.title?.nl || entry.id;
  }
  return result;
}

// ── Registermetadata types voor ADR-046 expertdashboard ───────────────────────

interface RegisterMeta {
  key: string;
  registerId?: string;
  address: number;
  name: string;
  unit?: string;
  dataType?: 'U16' | 'S16';
  multiply?: number;
  scaleMultiply?: number;
  isTemperatureRegister?: boolean;
  min?: number;
  max?: number;
  default?: number;
  desc?: string;
  isCoil?: boolean;
  fc?: 'input' | 'holding';
  serviceOnly?: boolean;
  readOnly?: boolean;
  bits?: Record<string, number>;
  pollGroups?: string[];
}

interface RegisterBlock {
  id: string;
  label: string;
  readOnly: boolean;
  registers: RegisterMeta[];
}

// ── DashboardService opties ────────────────────────────────────────────────────

export interface DashboardServiceOptions {
  /** __dirname van app.ts — basis voor app.json (capability-metadata) en assets/ */
  appDir: string;
  /**
   * Map met de dashboardpagina's; standaard `<appDir>/public`. In de gecombineerde app
   * staan de Aurora III-pagina's in `public/aurora3/` (ADR-004 §5).
   */
  publicDir?: string;
  logger: (msg: string, ...args: unknown[]) => void;
  /** default 8090 */
  port?: number;
}

/**
 * ADR-041a / ADR-044 / ADR-046: Lokale HTTP-server die drie dashboards serveert.
 *
 * Routes:
 *   GET /                      → public/dashboard.html          (read-only)
 *   GET /dashboard.html        → public/dashboard.html
 *   GET /api/snapshot          → laatste DataSnapshot als JSON
 *   GET /interactive           → public/dashboard-interactive.html (ADR-044)
 *   GET /interactive.html      → zelfde
 *   POST /api/write            → schrijf één whitelisted register (ADR-044)
 *   POST /api/control          → bedien één whitelisted capability via zijn listener
 *   GET /expert                → public/dashboard-expert.html   (ADR-046)
 *   GET /expert.html           → zelfde
 *   GET /api/registers         → alle registerblokken als JSON  (ADR-046)
 *   POST /api/expert/read      → lees één register live        (ADR-046)
 *   POST /api/expert/write     → schrijf één register/coil     (ADR-046)
 *   *                          → 404
 */
export class DashboardService {
  private snapshot: DataSnapshot | null = null;
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly appDir: string;
  private readonly publicDir: string;
  private readonly logger: (msg: string, ...args: unknown[]) => void;
  private capabilityMeta: Map<string, CapabilityMeta> | null = null;

  // Callbacks — worden laat gebonden vanuit device.ts
  private onWriteRegister: ((address: number, rawValue: number) => Promise<void>) | null = null;
  private onCapabilityWrite: ((capability: string, value: number) => Promise<void>) | null = null;
  private onCapabilityTrigger: ((capability: string, value: boolean | string) => Promise<void>) | null = null;
  private onReadRegister: ((address: number, isCoil: boolean, isInput: boolean) => Promise<number>) | null = null;
  private onWriteExpert: ((address: number, rawValue: number, isCoil: boolean) => Promise<void>) | null = null;
  private getTemperatureScale: (() => TemperatureRegisterScale) | null = null;
  private getChangeLog: ((mode?: RegisterChangeLogMode) => Map<number, RegisterChangeEntry>) | null = null;
  private getCapabilityValues: (() => Record<string, unknown>) | null = null;
  private getSnapshotCallback: (() => DataSnapshot | null) | null = null;
  private getRegisterCache: (() => Map<number, number>) | null = null;

  constructor(options: DashboardServiceOptions) {
    this.port = options.port ?? 8090;
    this.appDir = options.appDir;
    this.publicDir = options.publicDir ?? path.join(options.appDir, 'public');
    this.logger = options.logger;
  }

  // ── Publieke setters voor laat binden van callbacks ──────────────────────────

  setWriteRegisterCallback(fn: (address: number, rawValue: number) => Promise<void>): void {
    this.onWriteRegister = fn;
  }

  setCapabilityWriteCallback(fn: (capability: string, value: number) => Promise<void>): void {
    this.onCapabilityWrite = fn;
  }

  setCapabilityTriggerCallback(fn: (capability: string, value: boolean | string) => Promise<void>): void {
    this.onCapabilityTrigger = fn;
  }

  setReadRegisterCallback(fn: (address: number, isCoil: boolean, isInput: boolean) => Promise<number>): void {
    this.onReadRegister = fn;
  }

  setWriteExpertCallback(fn: (address: number, rawValue: number, isCoil: boolean) => Promise<void>): void {
    this.onWriteExpert = fn;
  }

  setGetTemperatureScaleCallback(fn: () => TemperatureRegisterScale): void {
    this.getTemperatureScale = fn;
  }

  setGetChangeLogCallback(fn: (mode?: RegisterChangeLogMode) => Map<number, RegisterChangeEntry>): void {
    this.getChangeLog = fn;
  }

  setGetCapabilityValuesCallback(fn: () => Record<string, unknown>): void {
    this.getCapabilityValues = fn;
  }

  setGetSnapshotCallback(fn: () => DataSnapshot | null): void {
    this.getSnapshotCallback = fn;
  }

  setGetRegisterCacheCallback(fn: () => Map<number, number>): void {
    this.getRegisterCache = fn;
  }

  /** Sla de meest recente snapshot op (overschrijft de vorige). */
  setSnapshot(snapshot: DataSnapshot): void {
    this.snapshot = snapshot;
  }

  /** Start de HTTP-server. */
  start(): void {
    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res).catch((err: Error) => {
        this.logger('DashboardService: Onverwachte fout:', err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      });
    });

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        this.logger(`DashboardService: Poort ${this.port} is al in gebruik — dashboard niet beschikbaar`);
      } else {
        this.logger('DashboardService: Server fout:', err.message);
      }
    });

    this.server.listen(this.port, () => {
      this.logger(`DashboardService: Gestart op http://localhost:${this.port}/`);
    });
  }

  /** Sluit de server en ruimt resources op. */
  destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        this.logger('DashboardService: Gestopt');
        resolve();
      });
    });
  }

  // ── Request dispatcher ────────────────────────────────────────────────────────

  private async _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    const url = parsedUrl.pathname;
    const method = (req.method ?? 'GET').toUpperCase();

    this._setCors(res);

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ADR-041: read-only dashboard
    if (method === 'GET' && (url === '/' || url === '/dashboard.html')) {
      await this._serveFile(res, 'dashboard.html');
      return;
    }
    if (method === 'GET' && url === '/api/snapshot') {
      this._serveSnapshot(res);
      return;
    }

    // ADR-044: interactief dashboard
    if (method === 'GET' && (url === '/interactive' || url === '/interactive.html')) {
      await this._serveFile(res, 'dashboard-interactive.html');
      return;
    }
    if (method === 'POST' && url === '/api/write') {
      await this._handleWrite(req, res);
      return;
    }
    if (method === 'POST' && url === '/api/control') {
      await this._handleControl(req, res);
      return;
    }

    // ADR-046: expert dashboard
    if (method === 'GET' && (url === '/expert' || url === '/expert.html')) {
      await this._serveFile(res, 'dashboard-expert.html');
      return;
    }
    if (method === 'GET' && url === '/api/registers') {
      const tempScale = this.getTemperatureScale?.() ?? 'x1';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(buildRegisterBlocks(tempScale)));
      return;
    }
    if (method === 'GET' && url === '/api/register-cache') {
      this._serveRegisterCache(res);
      return;
    }
    if (method === 'POST' && url === '/api/expert/read') {
      await this._handleExpertRead(req, res);
      return;
    }
    if (method === 'POST' && url === '/api/expert/write') {
      await this._handleExpertWrite(req, res);
      return;
    }

    // ADR-051: visueel live dashboard
    if (method === 'GET' && (url === '/live' || url === '/live.html')) {
      await this._serveFile(res, 'dashboard-live.html');
      return;
    }
    if (method === 'GET' && url === '/api/capabilities') {
      this._serveCapabilities(res);
      return;
    }
    if (method === 'GET' && url.startsWith('/assets/')) {
      this._serveAsset(res, url.slice('/assets/'.length));
      return;
    }

    // Register change log
    if (method === 'GET' && (url === '/changelog' || url === '/changelog.html')) {
      await this._serveFile(res, 'dashboard-changelog.html');
      return;
    }
    if (method === 'GET' && url === '/api/register-changelog') {
      this._serveChangeLog(res, parsedUrl.searchParams.get('mode'));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _setCors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  private _serveFile(res: http.ServerResponse, filename: string): Promise<void> {
    return new Promise((resolve) => {
      const filePath = path.join(this.publicDir, filename);
      fs.readFile(filePath, (err, content) => {
        if (err) {
          this.logger(`DashboardService: Fout bij laden ${filename}:`, err.message);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Error loading ${filename}`);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
        resolve();
      });
    });
  }

  private _serveSnapshot(res: http.ServerResponse): void {
    const snapshot = this.snapshot ?? this.getSnapshotCallback?.() ?? null;
    if (!snapshot) {
      res.writeHead(204);
      res.end();
      return;
    }
    this.snapshot = snapshot;
    // ADR-041b: JSON-replacer om floating point-getallen af te ronden.
    // Dit voorkomt weergaveproblemen zoals 1.2000000000000002 op het dashboard.
    const replacer = (key: string, value: unknown): unknown => {
      if (typeof value === 'number' && !Number.isInteger(value)) {
        return Math.round(value * 10000) / 10000;
      }
      return value;
    };
    const json = JSON.stringify({ ...snapshot, serverNowMs: Date.now() }, replacer);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(json);
  }

  private _readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Ongeldige JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  private _jsonOk(res: http.ServerResponse, data?: unknown): void {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data ?? { ok: true }));
  }

  private _jsonError(res: http.ServerResponse, status: number, message: string): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  }

  private _serveCapabilities(res: http.ServerResponse): void {
    if (!this.getCapabilityValues) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not connected' }));
      return;
    }

    const meta = this._getCapabilityMeta();
    const values = this.getCapabilityValues();
    const entries: object[] = [];

    for (const [id, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      const m = meta.get(id) ?? {
        title: id, unit: '', icon: '', type: 'string',
      };
      entries.push({
        id, title: m.title, unit: m.unit, icon: m.icon, type: m.type, values: m.values, value,
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(entries));
  }

  private _serveAsset(res: http.ServerResponse, filename: string): void {
    const safe = path.basename(filename);
    const filePath = path.join(this.appDir, 'assets', safe);
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      res.end(content);
    });
  }

  private _getCapabilityMeta(): Map<string, CapabilityMeta> {
    if (this.capabilityMeta) return this.capabilityMeta;

    const map = new Map<string, CapabilityMeta>();
    const appJsonPath = path.join(this.appDir, 'app.json');

    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8')) as Record<string, unknown>;
      const caps = (appJson.capabilities ?? {}) as Record<string, Record<string, unknown>>;
      for (const [id, def] of Object.entries(caps)) {
        const title = (def.title as Record<string, string>)?.en
          || (def.title as Record<string, string>)?.nl
          || id;
        const unit = (def.units as Record<string, string>)?.en
          || (def.units as Record<string, string>)?.nl
          || '';
        const icon = (def.icon as string) || '';
        const type = (def.type as string) || 'string';
        const values = _enumValueTitles(def.values);
        map.set(id, values ? {
          title, unit, icon, type, values,
        } : {
          title, unit, icon, type,
        });
      }

      const drivers = (appJson.drivers ?? []) as Array<Record<string, unknown>>;
      for (const driver of drivers) {
        const opts = (driver.capabilitiesOptions ?? {}) as Record<string, Record<string, unknown>>;
        for (const [id, opt] of Object.entries(opts)) {
          const existing = map.get(id) ?? {
            title: id, unit: '', icon: '', type: 'number',
          };
          const title = (opt.title as Record<string, string>)?.en
            || (opt.title as Record<string, string>)?.nl
            || existing.title;
          const unit = (opt.units as Record<string, string>)?.en
            || (opt.units as Record<string, string>)?.nl
            || existing.unit;
          map.set(id, { ...existing, title, unit });
        }
      }
    } catch { /* app.json niet beschikbaar */ }

    const defaults: Record<string, { title: string; unit: string; type: string }> = {
      onoff: { title: 'On/Off', unit: '', type: 'boolean' },
      alarm_generic: { title: 'Alarm', unit: '', type: 'boolean' },
      measure_power: { title: 'Power', unit: 'W', type: 'number' },
      measure_voltage: { title: 'Voltage', unit: 'V', type: 'number' },
      measure_current: { title: 'Current', unit: 'A', type: 'number' },
      meter_power: { title: 'Energy', unit: 'kWh', type: 'number' },
      measure_water: { title: 'Water Flow', unit: 'L/min', type: 'number' },
      target_temperature: { title: 'Heating Setpoint', unit: '°C', type: 'number' },
      'target_temperature.cooling': { title: 'Cooling Setpoint', unit: '°C', type: 'number' },
      'target_temperature.dhw': { title: 'DHW Setpoint', unit: '°C', type: 'number' },
      'target_temperature.floor': { title: 'Floor Heating Setpoint', unit: '°C', type: 'number' },
      'target_temperature.indoor': { title: 'Desired Indoor Temp', unit: '°C', type: 'number' },
      'measure_temperature.outlet': { title: 'Supply Water Temp (TA)', unit: '°C', type: 'number' },
      'measure_temperature.inlet': { title: 'Return Water Temp (TE1)', unit: '°C', type: 'number' },
      'measure_temperature.ambient': { title: 'Ambient Temp (T1)', unit: '°C', type: 'number' },
    };
    for (const [id, def] of Object.entries(defaults)) {
      const existing = map.get(id);
      if (!existing) map.set(id, { icon: '', ...def });
      else if (existing.title === id) map.set(id, { ...existing, title: def.title, unit: existing.unit || def.unit });
    }

    for (const [id, meta] of map.entries()) {
      if (meta.title === id) {
        const readable = id.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        map.set(id, { ...meta, title: readable });
      }
    }

    this.capabilityMeta = map;
    return map;
  }

  private _serveRegisterCache(res: http.ServerResponse): void {
    if (!this.getRegisterCache) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not connected' }));
      return;
    }

    const tempScale = this.getTemperatureScale?.() ?? 'x10';
    const registerMeta = this._buildRegisterMetaMap(tempScale);
    const changeLog = this.getChangeLog?.() ?? new Map();
    const entries: object[] = [];

    for (const [address, wireRawValue] of this.getRegisterCache()) {
      const meta = registerMeta.get(address);
      const rawValue = decodeRegisterRawValue(wireRawValue, meta);
      const scaledValue = scaleRegisterValue(rawValue, meta);
      const change = changeLog.get(address);

      entries.push({
        address,
        wireRawValue,
        rawValue,
        scaledValue,
        isCoil: meta?.isCoil ?? false,
        fc: meta?.fc ?? 'holding',
        unit: meta?.unit ?? '',
        lastChanged: change?.lastChanged ?? null,
        firstSeen: change?.firstSeen ?? null,
        changeCount: change?.changeCount ?? null,
        source: 'cache',
      });
    }

    entries.sort((a, b) => (a as { address: number }).address - (b as { address: number }).address);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(entries));
  }

  private _buildRegisterMetaMap(tempScale: TemperatureRegisterScale): Map<number, RegisterMeta> {
    const map = new Map<number, RegisterMeta>();
    for (const block of buildRegisterBlocks(tempScale)) {
      for (const register of block.registers) {
        if (!map.has(register.address)) {
          map.set(register.address, register);
        }
      }
    }
    return map;
  }

  private _serveChangeLog(res: http.ServerResponse, requestedMode: string | null): void {
    if (!this.getChangeLog) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not connected' }));
      return;
    }

    const nameMap = this._buildNameMap();
    const tempScale = this.getTemperatureScale?.() ?? 'x10';
    const metaMap = this._buildRegisterMetaMap(tempScale);
    const writableAddresses = new Set(
      Object.values(ALL_HOLDING_REGISTERS).map((r) => (r as { address: number }).address),
    );
    const mode: RegisterChangeLogMode = requestedMode === 'cache' ? 'cache' : 'poll';
    const entries: object[] = [];

    const decodeRaw = (addr: number, raw: number | null): number | null => {
      if (raw === null) return null;
      const meta = metaMap.get(addr);
      const rawValue = decodeRegisterRawValue(raw, meta);
      const scaledValue = scaleRegisterValue(rawValue, meta);
      return scaledValue === null ? null : Math.round(scaledValue * 1000) / 1000;
    };

    for (const [addr, entry] of this.getChangeLog(mode)) {
      const { intervals } = entry;
      const avgInterval = intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : null;
      const minInterval = intervals.length > 0 ? Math.min(...intervals) : null;
      const maxInterval = intervals.length > 0 ? Math.max(...intervals) : null;
      const meta = metaMap.get(addr);

      entries.push({
        address: addr,
        addressHex: `0x${addr.toString(16).toUpperCase().padStart(4, '0')}`,
        name: nameMap.get(addr) ?? meta?.name ?? '',
        unit: meta?.unit ?? '',
        pollGroup: pollGroupsForAddress(addr, 'input')[0] ?? pollGroupsForAddress(addr, 'holding')[0] ?? 'manual',
        mode,
        writable: writableAddresses.has(addr),
        firstSeen: entry.firstSeen,
        lastChanged: entry.lastChanged,
        previousChangedAt: entry.previousChangedAt,
        changeCount: entry.changeCount,
        pollChangeCount: entry.pollChangeCount,
        actionChangeCount: entry.actionChangeCount,
        cacheChangeCount: entry.cacheChangeCount,
        lastSource: entry.lastSource,
        avgInterval,
        minInterval,
        maxInterval,
        recommendedGroup: this._recommendPollGroup(avgInterval),
        lastValue: entry.lastValue,
        previousValue: entry.previousValue,
        lastValueDecoded: decodeRaw(addr, entry.lastValue),
        previousValueDecoded: decodeRaw(addr, entry.previousValue),
      });
    }

    entries.sort((a, b) => (a as { address: number }).address - (b as { address: number }).address);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(entries));
  }

  private _buildNameMap(): Map<number, string> {
    const map = new Map<number, string>();
    const named = [
      ...Object.values(SENSOR_REGISTERS),
      ...Object.values(CONTROL_REGISTERS),
      ...Object.values(ALL_HOLDING_REGISTERS),
      ...Object.values(ALL_INPUT_REGISTERS),
    ];
    for (const def of named) {
      const d = def as { address?: number; name?: string };
      if (d.address !== undefined && d.name) map.set(d.address, d.name);
    }
    return map;
  }

  private _recommendPollGroup(avgInterval: number | null): string {
    if (avgInterval === null) return '?';
    if (avgInterval <= 5_000) return 'superfast';
    if (avgInterval <= 15_000) return 'fast';
    if (avgInterval <= 60_000) return 'medium';
    if (avgInterval <= 600_000) return 'slow';
    return 'once';
  }

  // ── ADR-044: POST /api/write ──────────────────────────────────────────────────

  private async _handleWrite(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.onWriteRegister) {
      this._jsonError(res, 503, 'Schrijf-callback niet beschikbaar');
      return;
    }

    let body: unknown;
    try {
      body = await this._readBody(req);
    } catch {
      this._jsonError(res, 400, 'Ongeldige JSON body');
      return;
    }

    const { key, value } = body as Record<string, unknown>;
    if (typeof key !== 'string' || typeof value !== 'number') {
      this._jsonError(res, 400, 'Verplichte velden: key (string), value (number)');
      return;
    }

    const meta = WRITABLE_REGISTERS[key];
    if (!meta) {
      this._jsonError(res, 400, `Onbekende registersleutel: "${key}"`);
      return;
    }

    const scaledMin = meta.min;
    const scaledMax = meta.max;
    if (value < scaledMin || value > scaledMax) {
      this._jsonError(res, 400, `Waarde buiten toegestaan bereik: min=${scaledMin}, max=${scaledMax}`);
      return;
    }

    const rawValue = Math.round(value / meta.multiply);

    try {
      await this.onWriteRegister(meta.address, rawValue);
      if (meta.capability && this.onCapabilityWrite) {
        await this.onCapabilityWrite(meta.capability, value).catch(() => {});
      }
      this._jsonOk(res);
    } catch (err) {
      this._jsonError(res, 500, (err as Error).message);
    }
  }

  // ── POST /api/control ────────────────────────────────────────────────────────

  private async _handleControl(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.onCapabilityTrigger) {
      this._jsonError(res, 503, 'Bedien-callback niet beschikbaar');
      return;
    }

    let body: unknown;
    try {
      body = await this._readBody(req);
    } catch {
      this._jsonError(res, 400, 'Ongeldige JSON body');
      return;
    }

    const { capability, value } = body as Record<string, unknown>;
    const kind = typeof capability === 'string' ? CONTROL_CAPABILITIES[capability] : undefined;
    if (typeof capability !== 'string' || kind === undefined) {
      this._jsonError(res, 400, `Onbekende of niet toegestane capability: "${String(capability)}"`);
      return;
    }
    const valid = kind === 'boolean'
      ? typeof value === 'boolean'
      : typeof value === 'string' && kind.includes(value);
    if (!valid) {
      this._jsonError(res, 400, `Ongeldige waarde voor ${capability}: ${JSON.stringify(value)}`);
      return;
    }

    try {
      await this.onCapabilityTrigger(capability, value as boolean | string);
      this._jsonOk(res);
    } catch (err) {
      this._jsonError(res, 500, (err as Error).message);
    }
  }

  // ── ADR-046: POST /api/expert/read ───────────────────────────────────────────

  private async _handleExpertRead(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.onReadRegister) {
      this._jsonError(res, 503, 'Lees-callback niet beschikbaar');
      return;
    }

    let body: unknown;
    try {
      body = await this._readBody(req);
    } catch {
      this._jsonError(res, 400, 'Ongeldige JSON body');
      return;
    }

    const {
      address, isCoil, isInput, fc,
    } = body as Record<string, unknown>;
    if (typeof address !== 'number' || address < 0 || address > 0xFFFF) {
      this._jsonError(res, 400, 'Verplicht veld: address (number 0–65535)');
      return;
    }

    const coil = isCoil === true;
    const input = isInput === true || fc === 'input';
    const tempScale = this.getTemperatureScale?.() ?? 'x10';
    const registerMeta = this._buildRegisterMetaMap(tempScale);
    const meta = registerMeta.get(address);

    try {
      const wireRawValue = await this.onReadRegister(address, coil, input);
      const rawValue = decodeRegisterRawValue(wireRawValue, meta);
      const scaledValue = scaleRegisterValue(rawValue, meta);
      this._jsonOk(res, {
        ok: true, wireRawValue, rawValue, scaledValue,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg === 'Niet verbonden' ? 503 : 500;
      this._jsonError(res, status, msg);
    }
  }

  // ── ADR-046: POST /api/expert/write ──────────────────────────────────────────

  private async _handleExpertWrite(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.onWriteExpert) {
      this._jsonError(res, 503, 'Expert schrijf-callback niet beschikbaar');
      return;
    }

    let body: unknown;
    try {
      body = await this._readBody(req);
    } catch {
      this._jsonError(res, 400, 'Ongeldige JSON body');
      return;
    }

    const { address, rawValue, isCoil } = body as Record<string, unknown>;
    if (typeof address !== 'number' || address < 0 || address > 0xFFFF) {
      this._jsonError(res, 400, 'Verplicht veld: address (number 0–65535)');
      return;
    }
    if (typeof rawValue !== 'number') {
      this._jsonError(res, 400, 'Verplicht veld: rawValue (number)');
      return;
    }
    const coil = isCoil === true;
    const clampedRaw = Math.round(rawValue) & 0xFFFF;

    if (coil && clampedRaw > 1) {
      this._jsonError(res, 400, 'Coil waarde moet 0 of 1 zijn');
      return;
    }

    try {
      await this.onWriteExpert(address, clampedRaw, coil);
      this._jsonOk(res);
    } catch (err) {
      this._jsonError(res, 500, (err as Error).message);
    }
  }

}

// ── Registermetadata builder voor /api/registers ─────────────────────────────

function buildRegisterBlocks(tempScale: TemperatureRegisterScale = 'x10'): RegisterBlock[] {
  return [
    {
      id: 'blok1_input',
      label: 'Aurora III — Input registers (FC04 / 3-NNNN)',
      readOnly: true,
      registers: Object.entries(ALL_INPUT_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        dataType: (def as { dataType?: 'U16' | 'S16' }).dataType,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        desc: (def as { desc?: string }).desc,
        readOnly: true,
        fc: 'input' as const,
        bits: registerBitTable((def as { address: number }).address, 'input'),
        pollGroups: (def as { name: string }).name === 'Reserved'
          ? []
          : pollGroupsForAddress((def as { address: number }).address, 'input'),
      })).sort((a, b) => a.address - b.address),
    },
    {
      id: 'blok2_control',
      label: 'Aurora III — Holding registers (FC03/FC06 / 4-NNNN)',
      readOnly: false,
      registers: Object.entries(ALL_HOLDING_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        dataType: (def as { dataType?: 'U16' | 'S16' }).dataType,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        min: (def as { min?: number }).min,
        max: (def as { max?: number }).max,
        default: (def as { default?: number }).default,
        desc: (def as { desc?: string }).desc,
        readOnly: key === 'zone1AutoHeatingSetTemp' || (def as { readOnly?: boolean }).readOnly === true,
        fc: 'holding',
        bits: registerBitTable((def as { address: number }).address, 'holding'),
        pollGroups: pollGroupsForAddress((def as { address: number }).address, 'holding'),
      })),
    },
  ];
}

function _isTemperatureDef(def: unknown): boolean {
  const register = def as { unit?: string };
  return register.unit === '°C';
}

function decodeRegisterRawValue(wireRawValue: number, meta?: RegisterMeta): number {
  const uint16 = Math.round(wireRawValue) & 0xFFFF;
  if (meta?.dataType === 'S16') {
    return uint16 > 0x7FFF ? uint16 - 0x10000 : uint16;
  }
  return uint16;
}

function scaleRegisterValue(rawValue: number, meta?: RegisterMeta): number | null {
  if (meta?.isCoil) return null;
  const scaleMultiply = meta?.scaleMultiply ?? (meta?.multiply ?? 1);
  return Math.round(rawValue * scaleMultiply * 10) / 10;
}

function _scaleMultiplyForDef(def: unknown, tempScale: TemperatureRegisterScale): number {
  const register = def as { multiply?: number };
  if (_isTemperatureDef(def)) {
    return tempScale === 'x10' ? 0.1 : 1;
  }
  return register.multiply ?? 1;
}
