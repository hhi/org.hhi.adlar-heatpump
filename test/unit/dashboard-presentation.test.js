'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.resolve(__dirname, '../..');
for (const kind of ['modbus', 'aurora3', 'tuya']) {
  const modulePath = path.join(appDir, `.homeybuild/lib/${kind}/services/dashboard-service.js`);
  if (!fs.existsSync(modulePath)) continue;
  const module = require(modulePath);
  const service = kind === 'tuya'
    ? new module.TuyaDashboardService({ appDir, timers: { setTimeout }, logger() {} })
    : new module.DashboardService({
      appDir,
      publicDir: kind === 'aurora3' && fs.existsSync(path.join(appDir, 'public/aurora3')) ? path.join(appDir, 'public/aurora3') : undefined,
      logger() {},
    });
  const request = (url) => new Promise((resolve, reject) => {
    const headers = {};
    let status;
    const response = {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      writeHead(code, values) {
        status = code;
        Object.entries(values ?? {}).forEach(([name, value]) => {
          headers[name.toLowerCase()] = value;
        });
      },
      end(content) {
        resolve({
          status, headers, body: String(content), raw: content,
        });
      },
    };
    const handler = kind === 'tuya' ? service.handle : service._handleRequest;
    Promise.resolve(handler.call(service, { method: 'GET', url }, response)).catch(reject);
  });

  test(`${kind}: process schema has the app favicon and a consistent model/protocol title`, async () => {
    const page = await request('/processchema');
    assert.equal(page.status, 200);
    assert.match(page.body, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon.png">/);
    const title = page.body.match(/<title>(.*?)<\/title>/)?.[1];
    assert.match(title, /\((?:Tuya|Modbus)\) — Processchema$/);
    assert.match(title, kind === 'aurora3' ? /Aurora III/ : /Aurora I\/II|BLN-TB/);
    const icon = await request('/favicon.png');
    assert.equal(icon.status, 200);
    assert.equal(icon.headers['content-type'], 'image/png');
    assert.ok(Buffer.isBuffer(icon.raw));
    assert.deepEqual(icon.raw, fs.readFileSync(path.join(appDir, 'assets/dashboard-favicon.png')));
    const overview = await request('/');
    assert.match(overview.body, /href="\/favicon.png"/);
  });
}
