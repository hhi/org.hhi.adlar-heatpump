/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-unresolved */
/* eslint-disable node/no-missing-import */
/* eslint-disable import/extensions */
/* eslint-disable no-use-before-define -- de helperfuncties (buildRegisterBlocks,
   _pollGroupsForAddress, _serializeBits, _scaleMultiplyForDef, _isTemperatureDef,
   _parameterIdFromKey) staan bewust onderaan het bestand: de HTTP-routes bovenaan
   lezen dan als inhoudsopgave. Function declarations worden gehoist, dus dit is
   correct. Herschikken zou een bestand van 1100 regels omgooien zonder winst. */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { DataSnapshot } from '../protocol/adlar2-modbus-service';
import { RegisterChangeEntry, RegisterChangeLogMode } from '../protocol/modbus-tcp-service';
import {
  STATUS_REGISTER_MAP,
  SENSOR_REGISTERS,
  CONTROL_REGISTERS,
  P_PARAMETERS,
  P_PARAMETERS_EXTRA,
  P_WORKING_CONDITIONS,
  L_PARAMETERS,
  COIL_ADDRESSES,
  USER_COMMANDS_REGISTERS,
  VERSION_REGISTERS,
  POLL_GROUP_SUPERFAST,
  POLL_GROUP_FAST,
  POLL_GROUP_MEDIUM,
  POLL_GROUP_SLOW,
  POLL_GROUP_ONCE,
  STATUS_1_BITS,
  STATUS_2_BITS,
  FAULT_1_BITS,
  FAULT_2_BITS,
  FAULT_3_BITS,
  SYS1_FAULT_1_BITS,
  SYS1_FAULT_2_BITS,
  SYS1_DRIVE_FAULT_1_BITS,
  SYS1_DRIVE_FAULT_2_BITS,
  SYS1_DRIVE_FAULT_3_BITS,
  RELAY_1_BITS,
  RELAY_2_BITS,
  RELAY_3_BITS,
  RELAY_4_BITS,
  SWITCH_1_BITS,
  SWITCH_2_BITS,
  SWITCH_3_BITS,
  TemperatureRegisterScale,
  encodeTemperatureRaw,
  isAdlar2TemperatureRegister,
  scaleRegisterValue,
} from '../protocol/adlar-modbus-registers';

// ── Whitelist voor ADR-044 interactief dashboard ───────────────────────────────

const DASHBOARD_API_BUILD = '2026-08-04-json-errors-v2';

interface WritableRegisterMeta {
  address: number;
  min: number;
  max: number;
  multiply: number;
  name: string;
  capability?: string;
  temperature?: boolean;
}

const WRITABLE_REGISTERS: Record<string, WritableRegisterMeta> = {
  tempSetHeating: {
    address: CONTROL_REGISTERS.tempSetHeating.address, min: 15, max: 60, multiply: 0.1, name: 'Verwarming setpoint', capability: 'target_temperature', temperature: true,
  },
  tempSetHotWater: {
    address: CONTROL_REGISTERS.tempSetHotWater.address, min: 20, max: 75, multiply: 0.1, name: 'Tapwater setpoint', capability: 'target_temperature.dhw', temperature: true,
  },
  tempSetCooling: {
    address: CONTROL_REGISTERS.tempSetCooling.address, min: 7, max: 25, multiply: 0.1, name: 'Koeling setpoint', capability: 'target_temperature.cooling', temperature: true,
  },
  mainSwitch: {
    address: CONTROL_REGISTERS.mainSwitch.address, min: 0, max: 1, multiply: 1, name: 'Hoofdschakelaar (0=uit, 1=aan)',
  },
  runningMode: {
    address: CONTROL_REGISTERS.runningMode.address, min: 0, max: 2, multiply: 1, name: 'Gebruikersmodus (0=Standaard, 1=Krachtig, 2=Stil)',
  },
};

// ── Registermetadata types voor ADR-046 expertdashboard ───────────────────────

interface RegisterMeta {
  key: string;
  registerId?: string;
  address: number;
  name: string;
  unit?: string;
  multiply?: number;
  scaleMultiply?: number;
  isTemperatureRegister?: boolean;
  min?: number;
  max?: number;
  default?: number;
  desc?: string;
  isCoil?: boolean;
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
  /** __dirname van app.ts — basis voor het pad naar public/ */
  appDir: string;
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
 *   GET /expert                → public/dashboard-expert.html   (ADR-046)
 *   GET /expert.html           → zelfde
 *   GET /api/registers         → alle registerblokken als JSON  (ADR-046)
 *   GET /api/register-cache    → bekende registerwaarden uit cache
 *   POST /api/expert/read      → lees één register live        (ADR-046)
 *   POST /api/expert/write     → schrijf één register/coil     (ADR-046)
 *   GET /heating-curve         → public/heating_curve_line.html (ADR-049)
 *   GET /heating-curve.html    → zelfde
 *   POST /api/set-diy-curve    → schrijf L27/L28/L29           (ADR-049)
 *   GET /live                  → public/dashboard-live.html    (ADR-051)
 *   GET /live.html             → zelfde
 *   GET /api/capabilities      → alle capability waarden + metadata als JSON
 *   GET /assets/*              → SVG-iconen uit de assets/ directory
 *   *                          → 404
 */
export class DashboardService {
  private snapshot: DataSnapshot | null = null;
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly publicDir: string;
  private readonly logger: (msg: string, ...args: unknown[]) => void;

  // Callbacks — worden laat gebonden vanuit device.ts
  private onWriteRegister: ((address: number, rawValue: number) => Promise<void>) | null = null;
  private onCapabilityWrite: ((capability: string, value: number) => Promise<void>) | null = null;
  private onReadRegister: ((address: number, isCoil: boolean) => Promise<number>) | null = null;
  private onWriteExpert: ((address: number, rawValue: number, isCoil: boolean) => Promise<void>) | null = null;
  private onSetDiyHeatingCurve: ((k: number, b: number) => Promise<void>) | null = null;
  private getTemperatureScale: (() => TemperatureRegisterScale) | null = null;
  private getChangeLog: ((mode?: RegisterChangeLogMode) => Map<number, RegisterChangeEntry>) | null = null;
  private getSnapshot: (() => DataSnapshot | null) | null = null;
  private getRegisterCache: (() => Map<number, number>) | null = null;

  private readonly appDir: string;
  private capabilityMeta: Map<string, { title: string; unit: string; icon: string; type: string }> | null = null;
  private getCapabilityValues: (() => Record<string, unknown>) | null = null;

  constructor(options: DashboardServiceOptions) {
    this.port = options.port ?? 8090;
    this.appDir = options.appDir;
    this.publicDir = path.join(options.appDir, 'public');
    this.logger = options.logger;
  }

  // ── Publieke setters voor laat binden van callbacks ──────────────────────────

  setWriteRegisterCallback(fn: (address: number, rawValue: number) => Promise<void>): void {
    this.onWriteRegister = fn;
  }

  setCapabilityWriteCallback(fn: (capability: string, value: number) => Promise<void>): void {
    this.onCapabilityWrite = fn;
  }

  setReadRegisterCallback(fn: (address: number, isCoil: boolean) => Promise<number>): void {
    this.onReadRegister = fn;
  }

  setWriteExpertCallback(fn: (address: number, rawValue: number, isCoil: boolean) => Promise<void>): void {
    this.onWriteExpert = fn;
  }

  setDiyHeatingCurveCallback(fn: (k: number, b: number) => Promise<void>): void {
    this.onSetDiyHeatingCurve = fn;
  }

  setGetTemperatureScaleCallback(fn: () => TemperatureRegisterScale): void {
    this.getTemperatureScale = fn;
  }

  setGetChangeLogCallback(fn: (mode?: RegisterChangeLogMode) => Map<number, RegisterChangeEntry>): void {
    this.getChangeLog = fn;
  }

  setGetSnapshotCallback(fn: () => DataSnapshot | null): void {
    this.getSnapshot = fn;
  }

  setGetRegisterCacheCallback(fn: () => Map<number, number>): void {
    this.getRegisterCache = fn;
  }

  setGetCapabilityValuesCallback(fn: () => Record<string, unknown>): void {
    this.getCapabilityValues = fn;
  }

  /** Sla de meest recente snapshot op (overschrijft de vorige). */
  setSnapshot(snapshot: DataSnapshot): void {
    this.snapshot = snapshot;
  }

  /** Start de HTTP-server. */
  start(): void {
    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res).catch((err: Error) => {
        this.logger('DashboardService: Onverwachte fout:', err.stack ?? err.message);
        if (!res.headersSent) {
          this._jsonError(res, 500, err.message || 'Interne serverfout');
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
      this.logger(`DashboardService: Gestart op http://localhost:${this.port}/ (API-fouten retourneren JSON)`);
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

    // ADR-046: expert dashboard
    if (method === 'GET' && (url === '/expert' || url === '/expert.html')) {
      await this._serveFile(res, 'dashboard-expert.html');
      return;
    }
    if (method === 'GET' && url === '/api/registers') {
      const tempScale = this._getTemperatureScale();
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

    // Capabilities API + assets
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

    // ADR-049: DIY stooklijn
    if (method === 'GET' && (url === '/heating-curve' || url === '/heating-curve.html')) {
      await this._serveFile(res, 'heating_curve_line.html');
      return;
    }
    if (method === 'POST' && url === '/api/set-diy-curve') {
      await this._handleSetDiyCurve(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  // ── Register change log ───────────────────────────────────────────────────────

  private _serveChangeLog(res: http.ServerResponse, requestedMode: string | null): void {
    if (!this.getChangeLog) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not connected' }));
      return;
    }

    const tempScale = this._getTemperatureScale();
    const pollGroupMap = this._buildPollGroupMap();
    const nameMap = this._buildNameMap();
    const metaMap = this._buildRegisterMetaMap(tempScale);
    const writableAddresses = this._buildWritableAddressSet();
    const mode: RegisterChangeLogMode = requestedMode === 'cache' ? 'cache' : 'poll';
    const log = this.getChangeLog(mode);
    const entries: object[] = [];

    const decodeRaw = (addr: number, raw: number | null): number | null => {
      if (raw === null) return null;
      return Math.round(scaleRegisterValue(addr, raw, tempScale) * 1000) / 1000;
    };

    for (const [addr, entry] of log) {
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
        pollGroup: pollGroupMap.get(addr) ?? 'manual',
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

  private _serveRegisterCache(res: http.ServerResponse): void {
    if (!this.getRegisterCache) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not connected' }));
      return;
    }

    const tempScale = this._getTemperatureScale();
    const registerMeta = this._buildRegisterMetaMap(tempScale);
    const changeLog = this.getChangeLog?.() ?? new Map();
    const entries: object[] = [];

    for (const [address, wireRawValue] of this.getRegisterCache()) {
      const meta = registerMeta.get(address);
      const multiply = meta?.multiply ?? 1;
      const isSigned = meta?.isTemperatureRegister === true || (meta?.min !== undefined && meta.min < 0);
      const rawValue = isSigned && wireRawValue > 0x7FFF ? wireRawValue - 0x10000 : wireRawValue;
      const scaledValue = meta?.isCoil
        ? null
        : Math.round(scaleRegisterValue(address, rawValue, tempScale, multiply) * 10) / 10;
      const change = changeLog.get(address);

      entries.push({
        address,
        wireRawValue,
        rawValue,
        scaledValue,
        isCoil: meta?.isCoil ?? false,
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

  // ── Capabilities API ──────────────────────────────────────────────────────────

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
        id, title: m.title, unit: m.unit, icon: m.icon, type: m.type, value,
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(entries));
  }

  private _serveAsset(res: http.ServerResponse, filename: string): void {
    // Saniteer bestandsnaam — geen padtraversal
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

  private _getCapabilityMeta(): Map<string, { title: string; unit: string; icon: string; type: string }> {
    if (this.capabilityMeta) return this.capabilityMeta;

    const map = new Map<string, { title: string; unit: string; icon: string; type: string }>();

    // Lees uit app.json — aanwezig in zowel development (.homeybuild/) als productie
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
        map.set(id, {
          title, unit, icon, type,
        });
      }

      // Verrijk met capabilitiesOptions uit de driverdefinitie (titel/eenheid-overrides)
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

    // Standaard Homey-capabilities zonder eigen compose-bestand
    const HOMEY_DEFAULTS: Record<string, { title: string; unit: string; type: string }> = {
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
      'measure_temperature.outlet': { title: 'Water Outlet Temp (T7)', unit: '°C', type: 'number' },
      'measure_temperature.inlet': { title: 'Water Inlet Temp (T6)', unit: '°C', type: 'number' },
      'measure_temperature.ambient': { title: 'Ambient Temp (T1)', unit: '°C', type: 'number' },
    };
    for (const [id, def] of Object.entries(HOMEY_DEFAULTS)) {
      if (!map.has(id)) map.set(id, { icon: '', ...def });
    }

    // Vervang resterende ID-fallbacks door leesbare tekst
    for (const [id, meta] of map.entries()) {
      if (meta.title === id) {
        const readable = id.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        map.set(id, { ...meta, title: readable });
      }
    }

    this.capabilityMeta = map;
    return map;
  }

  private _buildNameMap(): Map<number, string> {
    const map = new Map<number, string>();
    type WithAddress = { address: number };
    type WithName = { name: string };

    for (const [key, def] of Object.entries(STATUS_REGISTER_MAP)) {
      map.set((def as WithAddress).address, key);
    }
    const named = [
      ...Object.values(SENSOR_REGISTERS),
      ...Object.values(CONTROL_REGISTERS),
      ...Object.values(P_PARAMETERS),
      ...Object.values(P_PARAMETERS_EXTRA),
      ...Object.values(P_WORKING_CONDITIONS),
      ...Object.values(L_PARAMETERS),
      ...Object.values(USER_COMMANDS_REGISTERS),
      ...Object.values(VERSION_REGISTERS),
    ];
    for (const def of named) {
      const d = def as WithAddress & Partial<WithName>;
      if (d.address !== undefined && d.name) map.set(d.address, d.name);
    }
    return map;
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

  private _buildWritableAddressSet(): Set<number> {
    const writable = new Set<number>();
    for (const block of buildRegisterBlocks()) {
      if (!block.readOnly) {
        for (const reg of block.registers) {
          writable.add(reg.address);
        }
      }
    }
    return writable;
  }

  private _buildPollGroupMap(): Map<number, string> {
    const map = new Map<number, string>();
    const groups = [
      { name: 'superfast', reads: POLL_GROUP_SUPERFAST.reads },
      { name: 'fast', reads: POLL_GROUP_FAST.reads },
      { name: 'medium', reads: POLL_GROUP_MEDIUM.reads },
      { name: 'slow', reads: POLL_GROUP_SLOW.reads },
      { name: 'once', reads: POLL_GROUP_ONCE.reads },
    ];
    for (const group of groups) {
      for (const block of group.reads) {
        for (let i = 0; i < block.count; i++) {
          const addr = block.start + i;
          if (!map.has(addr)) map.set(addr, group.name);
        }
      }
    }
    return map;
  }

  private _recommendPollGroup(avgMs: number | null): string {
    if (avgMs === null) return '?';
    if (avgMs < 10_000) return 'superfast';
    if (avgMs < 30_000) return 'fast';
    if (avgMs < 300_000) return 'medium';
    if (avgMs < 1_800_000) return 'slow';
    return 'once';
  }

  /**
   * Dashboard metadata must remain available while a device is reconnecting.
   * The active scale only affects how temperature registers are displayed, so
   * use the protocol default if the late-bound device callback is unavailable.
   */
  private _getTemperatureScale(): TemperatureRegisterScale {
    try {
      return this.getTemperatureScale?.() ?? 'x1';
    } catch (error) {
      this.logger(
        'DashboardService: temperatuursschaal niet beschikbaar; x1 wordt gebruikt:',
        (error as Error).message,
      );
      return 'x1';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _setCors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Adlar-Dashboard-Build', DASHBOARD_API_BUILD);
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
    const snapshot = this.snapshot ?? this.getSnapshot?.() ?? null;
    if (!snapshot) {
      res.writeHead(204);
      res.end();
      return;
    }
    this.snapshot = snapshot;
    // ADR-041b: JSON-replacer om floating point-getallen af te ronden.
    // Dit voorkomt weergaveproblemen zoals 1.2000000000000002 op het dashboard.
    const replacer = (_key: string, value: unknown): unknown => {
      if (typeof value === 'number' && !Number.isInteger(value)) {
        // Rond af op 4 decimalen om onnodige precisie te verwijderen.
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

    const tempScale = this._getTemperatureScale();
    const rawValue = meta.temperature
      ? encodeTemperatureRaw(value, tempScale)
      : Math.round(value / meta.multiply);

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

    const { address, isCoil, multiply } = body as Record<string, unknown>;
    if (typeof address !== 'number' || address < 0 || address > 0xFFFF) {
      this._jsonError(res, 400, 'Verplicht veld: address (number 0–65535)');
      return;
    }

    const coil = isCoil === true;
    const multiplyFactor = typeof multiply === 'number' ? multiply : 1;
    const tempScale = this._getTemperatureScale();

    try {
      const rawValue = await this.onReadRegister(address, coil);
      const scaledValue = Math.round(scaleRegisterValue(address, rawValue, tempScale, multiplyFactor) * 10) / 10;
      this._jsonOk(res, { ok: true, rawValue, scaledValue });
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

  // ── ADR-049: POST /api/set-diy-curve ─────────────────────────────────────────

  private async _handleSetDiyCurve(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.onSetDiyHeatingCurve) {
      this._jsonError(res, 503, 'DIY stooklijn callback niet beschikbaar');
      return;
    }

    let body: unknown;
    try {
      body = await this._readBody(req);
    } catch {
      this._jsonError(res, 400, 'Ongeldige JSON body');
      return;
    }

    const { slope, intercept } = body as Record<string, unknown>;
    if (typeof slope !== 'number' || !Number.isFinite(slope)) {
      this._jsonError(res, 400, 'Verplicht veld: slope (number, bijv. -0.5)');
      return;
    }
    if (typeof intercept !== 'number' || !Number.isFinite(intercept)) {
      this._jsonError(res, 400, 'Verplicht veld: intercept (number, bijv. 55)');
      return;
    }
    if (slope < -5.0 || slope > 0.0) {
      this._jsonError(res, 400, 'slope buiten bereik: min=-5.0, max=0.0');
      return;
    }
    if (intercept < 30 || intercept > 80) {
      this._jsonError(res, 400, 'intercept buiten bereik: min=30, max=80');
      return;
    }

    try {
      await this.onSetDiyHeatingCurve(slope, intercept);
      this._jsonOk(res);
    } catch (err) {
      this._jsonError(res, 500, (err as Error).message);
    }
  }
}

// ── Registermetadata builder voor /api/registers ─────────────────────────────

function buildRegisterBlocks(tempScale: TemperatureRegisterScale = 'x1'): RegisterBlock[] {
  return [
    {
      id: 'blok1_status',
      label: 'Blok 1 — Status & Fault (0x0000–0x0028)',
      readOnly: true,
      registers: Object.entries(STATUS_REGISTER_MAP).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name?: string }).name ?? key,
        unit: (def as { unit?: string }).unit,
        readOnly: true,
        bits: _serializeBits(def),
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok2_sensors',
      label: 'Blok 2 — Sensoren (0x0040–0x00FF)',
      readOnly: true,
      registers: Object.entries(SENSOR_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        readOnly: true,
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok3_control',
      label: 'Blok 3 — User Control (0x0300–0x0319)',
      readOnly: false,
      registers: Object.entries(CONTROL_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        min: (def as { min?: number }).min,
        max: (def as { max?: number }).max,
        default: (def as { default?: number }).default,
        desc: (def as { desc?: string }).desc,
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok4_pparams',
      label: 'Blok 4 — P-Parameters (0x0100–0x020B)',
      readOnly: false,
      registers: [...Object.entries(P_PARAMETERS), ...Object.entries(P_PARAMETERS_EXTRA)]
        .map(([key, def]) => ({
          key,
          registerId: _parameterIdFromKey(key),
          address: (def as { address: number }).address,
          name: (def as { name: string }).name,
          unit: (def as { unit?: string }).unit,
          multiply: (def as { multiply?: number }).multiply,
          scaleMultiply: _scaleMultiplyForDef(def, tempScale),
          isTemperatureRegister: _isTemperatureDef(def),
          min: (def as { min?: number }).min,
          max: (def as { max?: number }).max,
          default: (def as { default?: number }).default,
          desc: (def as { desc?: string }).desc,
          serviceOnly: (def as { serviceOnly?: boolean }).serviceOnly,
          pollGroups: _pollGroupsForAddress((def as { address: number }).address),
        }))
        .sort((a, b) => a.address - b.address),
    },
    {
      id: 'blok5_lparams',
      label: 'Blok 5 — L-Parameters (0x0800–0x0819)',
      readOnly: false,
      registers: Object.entries(L_PARAMETERS).map(([key, def]) => ({
        key,
        registerId: _parameterIdFromKey(key),
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        min: (def as { min?: number }).min,
        max: (def as { max?: number }).max,
        default: (def as { default?: number }).default,
        desc: (def as { desc?: string }).desc,
        serviceOnly: (def as { serviceOnly?: boolean }).serviceOnly,
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok6_coils',
      label: 'Blok 6 — Coils (0x1000–0x1023)',
      readOnly: false,
      registers: Object.entries(COIL_ADDRESSES).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        isCoil: true,
        serviceOnly: (def as { serviceOnly?: boolean }).serviceOnly,
        pollGroups: [],
      })),
    },
    {
      id: 'blok7_commands',
      label: 'Blok 7 — User Commands (0x0330–0x0345)',
      readOnly: false,
      registers: Object.entries(USER_COMMANDS_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        min: (def as { min?: number }).min,
        max: (def as { max?: number }).max,
        desc: (def as { desc?: string }).desc,
        serviceOnly: (def as { serviceOnly?: boolean }).serviceOnly,
        bits: _serializeBits(def),
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok8_version',
      label: 'Blok 8 — Versie Info (0x0360–0x0363)',
      readOnly: true,
      registers: Object.entries(VERSION_REGISTERS).map(([key, def]) => ({
        key,
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        desc: (def as { desc?: string }).desc,
        readOnly: true,
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok9_workingcond',
      label: 'Blok 9 — Working Condition P-registers (0x01B8–0x01FD)',
      readOnly: false,
      registers: Object.entries(P_WORKING_CONDITIONS).map(([key, def]) => ({
        key,
        registerId: _parameterIdFromKey(key),
        address: (def as { address: number }).address,
        name: (def as { name: string }).name,
        unit: (def as { unit?: string }).unit,
        multiply: (def as { multiply?: number }).multiply,
        scaleMultiply: _scaleMultiplyForDef(def, tempScale),
        isTemperatureRegister: _isTemperatureDef(def),
        min: (def as { min?: number }).min,
        max: (def as { max?: number }).max,
        default: (def as { default?: number }).default,
        desc: (def as { desc?: string }).desc,
        pollGroups: _pollGroupsForAddress((def as { address: number }).address),
      })),
    },
    {
      id: 'blok10_p_uncharted',
      label: 'Blok 10 — P-registers ongedocumenteerd (0x0207–0x0235)',
      readOnly: true,
      registers: Array.from({ length: 47 }, (_, i) => {
        const addr = 0x0207 + i;
        const label = `P${263 + i}`;
        return {
          key: `${label}_unknown`,
          registerId: label,
          address: addr,
          name: `${label} (ongedocumenteerd)`,
          unit: undefined as string | undefined,
          multiply: undefined as number | undefined,
          scaleMultiply: 1,
          isTemperatureRegister: false,
          min: undefined as number | undefined,
          max: undefined as number | undefined,
          default: undefined as number | undefined,
          desc: undefined as string | undefined,
          pollGroups: _pollGroupsForAddress(addr),
        };
      }),
    },
    {
      id: 'blok11_l_uncharted',
      label: 'Blok 11 — L-registers ongedocumenteerd (0x081A–0x0831)',
      readOnly: true,
      registers: Array.from({ length: 24 }, (_, i) => {
        const addr = 0x081A + i;
        const label = `L${37 + i}`;
        return {
          key: `${label}_unknown`,
          registerId: label,
          address: addr,
          name: `${label} (ongedocumenteerd)`,
          unit: undefined as string | undefined,
          multiply: undefined as number | undefined,
          scaleMultiply: 1,
          isTemperatureRegister: false,
          min: undefined as number | undefined,
          max: undefined as number | undefined,
          default: undefined as number | undefined,
          desc: undefined as string | undefined,
          pollGroups: _pollGroupsForAddress(addr),
        };
      }),
    },
  ];
}

function _pollGroupsForAddress(address: number): string[] {
  const groups = [
    POLL_GROUP_SUPERFAST,
    POLL_GROUP_FAST,
    POLL_GROUP_MEDIUM,
    POLL_GROUP_SLOW,
    POLL_GROUP_ONCE,
  ];

  return groups
    .filter((group) => group.reads.some((read) => address >= read.start && address < read.start + read.count))
    .map((group) => group.name);
}

function _parameterIdFromKey(key: string): string | undefined {
  const match = key.match(/^([PL]\d+)_/);
  return match?.[1];
}

function _serializeBits(def: unknown): Record<string, number> | undefined {
  const { bits } = def as { bits?: Record<string, number> };
  if (!bits) return undefined;
  return Object.fromEntries(
    Object.entries(bits).map(([k, v]) => [k, Number(v)]),
  );
}

function _isTemperatureDef(def: unknown): boolean {
  const register = def as { address: number; unit?: string };
  return isAdlar2TemperatureRegister(register.address, register);
}

function _scaleMultiplyForDef(def: unknown, tempScale: TemperatureRegisterScale): number {
  const register = def as { multiply?: number };
  if (_isTemperatureDef(def)) {
    return tempScale === 'x10' ? 0.1 : 1;
  }
  return register.multiply ?? 1;
}

// Bits-constanten worden geïmporteerd zodat de compiler ze als gebruikt beschouwt
// (ze zijn indirect gebruikt via STATUS_REGISTER_MAP en USER_COMMANDS_REGISTERS)
// eslint-disable-next-line no-void -- bewuste no-op om de imports als 'gebruikt' te markeren
void [
  STATUS_1_BITS, STATUS_2_BITS, FAULT_1_BITS, FAULT_2_BITS, FAULT_3_BITS,
  SYS1_FAULT_1_BITS, SYS1_FAULT_2_BITS, SYS1_DRIVE_FAULT_1_BITS,
  SYS1_DRIVE_FAULT_2_BITS, SYS1_DRIVE_FAULT_3_BITS,
  RELAY_1_BITS, RELAY_2_BITS, RELAY_3_BITS, RELAY_4_BITS,
  SWITCH_1_BITS, SWITCH_2_BITS, SWITCH_3_BITS,
];
