/* eslint-disable import/no-unresolved, node/no-missing-import, import/extensions */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { DASHBOARD_PAGE_STYLES } from '../../shared/dashboard-styles';
import { DashboardError } from './dashboard-error';
import {
  CapabilityMeta, DashboardAdapter, DashboardTimers, TuyaDashboardDevice,
} from './dashboard-device';

interface Options {
  appDir: string;
  timers: DashboardTimers;
  logger: (message: string, ...args: unknown[]) => void;
}

/** A separate HTTP listener, sharing the driver's existing connection and command handlers. */
export class TuyaDashboardService {
  private server: http.Server | null = null;
  private devices = new Map<string, TuyaDashboardDevice>();
  private metadata: Record<string, CapabilityMeta>;
  private port = 8092;
  private operation: Promise<void> = Promise.resolve();
  private texts: Record<string, unknown>;

  constructor(private readonly options: Options) {
    const manifest = JSON.parse(fs.readFileSync(path.join(options.appDir, 'app.json'), 'utf8'));
    const driver = manifest.drivers.find((item: { id: string }) => item.id === 'intelligent-heat-pump');
    this.metadata = { ...manifest.capabilities };
    Object.entries(driver?.capabilitiesOptions ?? {}).forEach(([id, meta]) => {
      this.metadata[id] = { ...this.metadata[id], ...meta as CapabilityMeta };
    });
    const builtinUnits: Record<string, string> = {
      measure_temperature: '°C',
      target_temperature: '°C',
      measure_power: 'W',
      meter_power: 'kWh',
      measure_voltage: 'V',
      measure_current: 'A',
      measure_frequency: 'Hz',
      measure_water: 'L/min',
    };
    for (const id of driver?.capabilities ?? []) {
      const units = builtinUnits[id.split('.')[0]];
      if (units) this.metadata[id] = { type: 'number', units, ...this.metadata[id] };
    }
    this.texts = Object.fromEntries(['en', 'nl'].map((language) => [language,
      JSON.parse(fs.readFileSync(path.join(options.appDir, 'locales', `${language}.json`), 'utf8')).tuya_dashboard,
    ]));
  }

  get listeningPort(): number | null {
    const address = this.server?.address();
    return address && typeof address !== 'string' ? address.port : null;
  }

  register(id: string, adapter: DashboardAdapter): TuyaDashboardDevice {
    this.devices.get(id)?.destroy();
    const state = new TuyaDashboardDevice(adapter, this.metadata, this.options.timers, this.options.logger);
    this.devices.set(id, state);
    return state;
  }

  async unregister(id: string): Promise<void> {
    this.devices.get(id)?.destroy();
    this.devices.delete(id);
    await this.enqueue(async () => {
      if (!this.devices.size) await this.stop();
    });
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const next = this.operation.then(action);
    this.operation = next.catch(() => {});
    return next;
  }

  start(port = 8092): Promise<void> {
    return this.enqueue(async () => {
      if (this.server?.listening && this.port === port) return;
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((error: unknown) => {
          if (res.headersSent) {
            res.end(); return;
          }
          const known = error instanceof DashboardError;
          if (!known) this.options.logger('Tuya dashboard request failed', error);
          this.json(res, known ? error.status : 500, { error: known ? error.code : 'server_error' });
        });
      });
      server.requestTimeout = 10_000;
      server.headersTimeout = 10_000;
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (error: Error) => reject(error);
          server.once('error', onError);
          server.listen(port, () => {
            server.removeListener('error', onError); resolve();
          });
        });
        await this.stop();
        this.server = server;
        this.port = port;
        server.on('error', (error) => this.options.logger('Tuya dashboard server error', error));
        this.options.logger(`Tuya dashboard listening on port ${this.listeningPort}`);
      } catch (error) {
        server.close();
        throw error;
      }
    });
  }

  private async stop(): Promise<void> {
    const { server } = this;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  async destroy(): Promise<void> {
    this.devices.forEach((device) => device.destroy());
    this.devices.clear();
    await this.enqueue(() => this.stop());
  }

  private json(res: http.ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }

  private async body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new DashboardError(415, 'invalid_request');
    const { origin } = req.headers;
    if (origin && origin !== `http://${req.headers.host}`) throw new DashboardError(403, 'invalid_request');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 4096) throw new DashboardError(413, 'invalid_request');
      chunks.push(buffer);
    }
    try {
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      throw new DashboardError(400, 'invalid_request');
    }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = url.pathname;
    const method = req.method ?? 'GET';
    if (method === 'GET' && route === '/api/texts') {
      this.json(res, 200, this.texts); return;
    }
    if (method === 'GET' && route === '/api/devices') {
      this.json(res, 200, [...this.devices].map(([id, device]) => ({ id, name: device.adapter.name() })));
      return;
    }
    const match = route.match(/^\/api\/devices\/([^/]+)\/(snapshot|capabilities|dps|changes|events|heating-curve|commands)(?:\/([^/]+))?$/);
    if (match) {
      const [, id, resource, commandId] = match;
      const device = this.devices.get(id);
      if (!device) throw new DashboardError(404, 'device_not_found');
      if (method === 'POST' && resource === 'commands' && !commandId) {
        const body = await this.body(req);
        this.json(res, 202, device.command(body.capability, body.value)); return;
      }
      if (method !== 'GET') throw new DashboardError(405, 'invalid_request');
      if (resource === 'commands' && commandId) {
        const command = device.getCommand(commandId);
        if (!command) throw new DashboardError(404, 'not_found');
        this.json(res, 200, command); return;
      }
      if (commandId) throw new DashboardError(404, 'not_found');
      const readers: Record<string, () => unknown> = {
        snapshot: () => device.snapshot(),
        capabilities: () => device.capabilities(),
        dps: () => device.datapoints(),
        changes: () => device.changeOverview(),
        events: () => device.getEvents(),
        'heating-curve': () => device.heatingCurve(),
      };
      if (!readers[resource]) throw new DashboardError(404, 'not_found');
      this.json(res, 200, readers[resource]()); return;
    }
    const pages = Object.keys(DASHBOARD_PAGE_STYLES);
    const sharedStyle = Object.values(DASHBOARD_PAGE_STYLES).find((name) => route === `/styles/${name}`);
    if (method === 'GET' && sharedStyle) {
      const css = await fs.promises.readFile(path.join(this.options.appDir, 'public', 'styles', sharedStyle));
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(css);
      return;
    }
    const file = pages.includes(route) ? 'index.html' : ({
      '/dashboard.js': 'dashboard.js', '/dashboard.css': 'dashboard.css',
    } as Record<string, string>)[route];
    if (method !== 'GET' || !file) throw new DashboardError(404, 'not_found');
    const content = await fs.promises.readFile(path.join(this.options.appDir, 'public', 'tuya', file));
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)];
    res.writeHead(200, {
      'Content-Type': `${type}; charset=utf-8`,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(file === 'index.html' ? content.toString('utf8')
      .replace('<!-- PAGE_STYLE -->', `<link rel="stylesheet" href="/styles/${DASHBOARD_PAGE_STYLES[route]}">`)
      .replace('data-page="dashboard"', `data-page="${route.slice(1) || 'dashboard'}"`) : content);
  }
}

export interface TuyaDashboardHost {
  tuyaDashboard: TuyaDashboardService;
  setTuyaDashboardPort(port: number): Promise<void>;
}
