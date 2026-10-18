/**
 * Dashboard API: shared poll groups, register metadata (desc/bits), enum titles and the
 * /api/control write path that runs through the capability listeners.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { DashboardService } = require('../../../.homeybuild/lib/aurora3/services/dashboard-service');
const { pollGroupsForAddress, Adlar3ModbusService } = require('../../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-service');
const { registerBitTable } = require('../../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-registers');

const APP_DIR = path.join(__dirname, '..', '..', '..');

/** Start a dashboard on a free port; returns { base, service, close }. */
async function startDashboard(configure) {
  const service = new DashboardService({ appDir: APP_DIR, logger: () => {}, port: 0 });
  configure?.(service);
  service.start();
  await new Promise((resolve) => service.server.once('listening', resolve));
  const { port } = service.server.address();
  return { base: `http://127.0.0.1:${port}`, service, close: () => service.destroy() };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('poll groups come from the runtime definitions, fastest first', () => {
  assert.deepStrictEqual(pollGroupsForAddress(43, 'input'), ['superfast', 'fast']);
  assert.deepStrictEqual(pollGroupsForAddress(9, 'input'), ['medium', 'once']);
  assert.deepStrictEqual(pollGroupsForAddress(66, 'input'), ['slow']);
  assert.deepStrictEqual(pollGroupsForAddress(2101, 'holding'), ['medium']);
  assert.deepStrictEqual(pollGroupsForAddress(2101, 'input'), []);
});

test('snapshot sensors carry their poll group', () => {
  const service = new Adlar3ModbusService({ transport: { host: '127.0.0.1' } });
  const cache = service.getRegisterCache();
  cache.set(43, 350);
  cache.set(52, 600);
  const { sensors } = service.getSnapshot();
  assert.strictEqual(sensors.aanvoerTA.pollGroup, 'superfast');
  assert.strictEqual(sensors.dischargeTP.pollGroup, 'fast');
});

test('bit tables exist for Reg 9, 38, 39, 2103 and the code registers', () => {
  assert.deepStrictEqual(registerBitTable(9, 'input'), { COOLING: 1, HEATING: 2, DHW: 4 });
  assert.ok(registerBitTable(38, 'input').DEFROST);
  assert.deepStrictEqual(Object.keys(registerBitTable(39, 'input')), ['AHS_REQUEST_ANTI_FREEZING', 'AHS_REQUEST_DEFROSTING']);
  assert.deepStrictEqual(registerBitTable(2103, 'holding'), {
    FORCED_BACKUP_HEATER: 0x08, SILENT_MODE_BIT4: 0x10, SILENT_MODE_BIT5: 0x20, DISINFECTION_ENABLED: 0x40,
  });
  const e = registerBitTable(90, 'input');
  assert.strictEqual(e.E01, 1);
  assert.strictEqual(e.E16, 0x8000);
  assert.strictEqual(registerBitTable(101, 'input').P96, 0x8000);
  assert.strictEqual(registerBitTable(40, 'input'), undefined);
  assert.strictEqual(registerBitTable(2103, 'input'), undefined);
});

test('/api/registers sends input descriptions, bit tables and current poll groups', async () => {
  const dash = await startDashboard();
  try {
    const blocks = await (await fetch(`${dash.base}/api/registers`)).json();
    const find = (fc, address) => blocks.flatMap((b) => b.registers).find((r) => r.fc === fc && r.address === address);
    assert.match(find('input', 39).desc, /external heating source during anti-freezing/);
    assert.ok(find('input', 9).bits.DHW);
    assert.ok(find('input', 90).bits.E03);
    assert.ok(find('holding', 2103).bits.SILENT_MODE_BIT4);
    assert.deepStrictEqual(find('input', 67).pollGroups, ['slow']);
    assert.deepStrictEqual(find('input', 9).pollGroups, ['medium', 'once']);
  } finally {
    await dash.close();
  }
});

test('/api/control runs whitelisted capabilities through the trigger callback', async () => {
  const calls = [];
  const dash = await startDashboard((service) => {
    service.setCapabilityTriggerCallback(async (capability, value) => {
      if (capability === 'onoff') throw new Error('gate closed');
      calls.push([capability, value]);
    });
  });
  try {
    assert.deepStrictEqual((await postJson(`${dash.base}/api/control`, { capability: 'adlar_silent_mode', value: '2' })).json, { ok: true });
    assert.deepStrictEqual((await postJson(`${dash.base}/api/control`, { capability: 'adlar_dhw_enabled', value: false })).json, { ok: true });

    const gated = await postJson(`${dash.base}/api/control`, { capability: 'onoff', value: true });
    assert.strictEqual(gated.status, 500);
    assert.strictEqual(gated.json.error, 'gate closed');

    assert.strictEqual((await postJson(`${dash.base}/api/control`, { capability: 'adlar_silent_mode', value: '3' })).status, 400);
    assert.strictEqual((await postJson(`${dash.base}/api/control`, { capability: 'adlar_dhw_enabled', value: 'on' })).status, 400);
    assert.strictEqual((await postJson(`${dash.base}/api/control`, { capability: 'target_temperature', value: 50 })).status, 400);

    assert.deepStrictEqual(calls, [['adlar_silent_mode', '2'], ['adlar_dhw_enabled', false]]);
  } finally {
    await dash.close();
  }
});

test('/api/capabilities includes enum value titles', async () => {
  const dash = await startDashboard((service) => {
    service.setGetCapabilityValuesCallback(() => ({ adlar_silent_mode: '1', adlar_mode_aurora3: '2' }));
  });
  try {
    const caps = await (await fetch(`${dash.base}/api/capabilities`)).json();
    const silent = caps.find((c) => c.id === 'adlar_silent_mode');
    assert.strictEqual(silent.values[silent.value], 'Level 1');
    const mode = caps.find((c) => c.id === 'adlar_mode_aurora3');
    assert.strictEqual(mode.values[mode.value], 'Heating');
  } finally {
    await dash.close();
  }
});

test('/api/register-changelog uses the current poll groups', async () => {
  const entry = {
    intervals: [],
    firstSeen: 1,
    lastChanged: 1,
    previousChangedAt: null,
    changeCount: 0,
    pollChangeCount: 0,
    actionChangeCount: 0,
    cacheChangeCount: 0,
    lastSource: 'poll',
    lastValue: 1,
    previousValue: null,
  };
  const dash = await startDashboard((service) => {
    service.setGetChangeLogCallback(() => new Map([[9, entry], [67, entry], [2103, entry]]));
  });
  try {
    const rows = await (await fetch(`${dash.base}/api/register-changelog`)).json();
    const group = (addr) => rows.find((r) => r.address === addr).pollGroup;
    assert.strictEqual(group(9), 'medium');
    assert.strictEqual(group(67), 'slow');
    assert.strictEqual(group(2103), 'medium');
  } finally {
    await dash.close();
  }
});
