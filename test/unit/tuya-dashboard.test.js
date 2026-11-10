'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: schedule } = require('node:timers');
const { TuyaDashboardDevice } = require('../../.homeybuild/lib/tuya/services/dashboard-device');
const { TuyaDashboardService } = require('../../.homeybuild/lib/tuya/services/dashboard-service');
const { buildLiveOperationWidgetState } = require('../../.homeybuild/lib/tuya/services/widget-state-service');

const appDir = path.resolve(__dirname, '../..');
const metadata = require('../../app.json').capabilities;
const timers = { setTimeout: schedule };
function fixture(name = 'Tuya A') {
  const values = {
    onoff: true,
    target_temperature: 35,
    adlar_hotwater: 45,
    adlar_enum_mode: 'heating',
    adlar_picker_countdown_set: 'H1',
    adlar_enum_countdown_set: 'H1',
    adlar_enum_capacity_set: 'H1',
    adlar_sensor_capacity_set: 'H1',
    'measure_power.internal': 1500,
    measure_power: 1500,
    adlar_state_compressor_state: true,
    adlar_state_defrost_state: false,
  };
  const writes = [];
  const reader = { getName: () => name, hasCapability: (id) => id in values, getCapabilityValue: (id) => values[id] };
  const adapter = {
    name: () => name, values: () => values, options: () => ({}), adaptiveEnabled: () => false,
    snapshot: () => buildLiveOperationWidgetState({ device: reader, connected: true, lastDataAt: Date.now() }),
    write: async (id, value) => { writes.push({ id, value }); values[id] = value; },
  };
  return { values, writes, adapter };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('partial DPS updates preserve reception age, scaling and all capability mappings', () => {
  const f = fixture(); const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  try {
    state.receive({ 104: 15000, 11: 'H1', 250: 9 }, 100);
    state.receive({ 11: 'H2' }, 200);
    state.receive({ 11: 'H2' }, 300);
    const power = state.datapoints().find((dp) => dp.id === 104);
    assert.equal(power.raw, 15000); assert.equal(power.value, 1500); assert.equal(power.receivedAt, 100);
    const curve = state.datapoints().find((dp) => dp.id === 11);
    assert.equal(curve.receivedAt, 300); assert.equal(curve.changedAt, 200);
    assert.deepEqual(curve.capabilities, ['adlar_enum_capacity_set', 'adlar_sensor_capacity_set']);
    assert.deepEqual(state.datapoints().find((dp) => dp.id === 250).writable, []);
    assert.equal(state.getEvents().filter((e) => e.key === '11').length, 2);
    assert.equal(state.getEvents()[0].kind, 'initial');
    assert.equal(state.capabilities().find((cap) => cap.id === 'measure_power').receivedAt, null);
  } finally { state.destroy(); }
});

test('unknown states and missing curve parameters remain unknown', () => {
  const f = fixture(); delete f.values.onoff; delete f.values.adlar_state_defrost_state;
  const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  try {
    assert.equal(state.snapshot().status.running, null);
    assert.equal(state.snapshot().status.faultActive, null);
    assert.equal(state.snapshot().process.thermalPowerKw, null);
    assert.equal(state.heatingCurve().appCurve, null);
    f.values.heating_curve_slope = -0.5; f.values.heating_curve_intercept = 47.5;
    assert.deepEqual(state.heatingCurve().appCurve, { slope: -0.5, intercept: 47.5 });
    assert.equal(state.heatingCurve().presetCurve, null);
  } finally { state.destroy(); }
});

test('server validation rejects unsafe controls, invalid types, ranges, steps and enums', () => {
  const f = fixture(); const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  try {
    for (const [cap, value] of [['onoff', 'false'], ['target_temperature', 35.5], ['target_temperature', 76],
      ['adlar_hotwater', 20], ['adlar_enum_mode', 'invalid'], ['measure_power', 2], ['target_temperature', NaN]]) {
      assert.throws(() => state.command(cap, value), { status: 400 });
    }
    assert.equal(f.writes.length, 0);
    f.adapter.snapshot = () => ({ status: { connectionState: 'offline' } });
    assert.throws(() => state.command('onoff', false), { status: 503 });
  } finally { state.destroy(); }
});

test('optimistic capability updates never count as received device feedback', async () => {
  const f = fixture(); const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  try {
    state.receive({ 4: 35 });
    const command = state.command('target_temperature', 40);
    assert.equal(command.status, 'requested');
    assert.throws(() => state.command('target_temperature', 42), { status: 409 });
    await flush();
    assert.equal(f.values.target_temperature, 40);
    assert.equal(command.status, 'sent');
    state.receive({ 4: 39 }); assert.equal(command.status, 'sent');
    state.receive({ 4: 40 }); assert.equal(command.status, 'observed');
    assert.equal(f.writes.length, 1);
  } finally { state.destroy(); }
});

test('feedback during send is retained; send rejection and timeout are separate terminal outcomes', async () => {
  const f = fixture(); let expire;
  const clock = { setTimeout: (fn) => { expire = fn; return schedule(fn, 60000); } };
  const state = new TuyaDashboardDevice(f.adapter, metadata, clock);
  try {
    f.adapter.write = async () => { state.receive({ 4: 41 }); };
    const observed = state.command('target_temperature', 41); await flush();
    assert.equal(observed.status, 'observed');
    f.adapter.write = async () => { throw new Error('transport error containing secret'); };
    const failed = state.command('onoff', false); await flush();
    assert.equal(failed.status, 'failed');
    assert.ok(!JSON.stringify(state.getEvents()).includes('secret'));
    f.adapter.write = async () => {};
    const timedOut = state.command('onoff', false); await flush(); expire();
    assert.equal(timedOut.status, 'unconfirmed');
    state.receive({ 1: false }); assert.equal(timedOut.status, 'unconfirmed');
  } finally { state.destroy(); }
});

test('bounded logs, bounded command history and disposal', async () => {
  const f = fixture(); const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  for (let i = 0; i < 600; i += 1) state.receive({ 104: i }, i + 1);
  assert.equal(state.getEvents().length, 500);
  state.connection(true); state.connection(false); state.connection(false);
  assert.equal(state.getEvents().filter((e) => e.kind === 'connection').length, 2);
  for (let i = 0; i < 105; i += 1) {
    const cmd = state.command('onoff', true); await flush(); state.receive({ 1: true });
    assert.equal(cmd.status, 'observed');
  }
  assert.equal(state.commands.size, 100);
  const pending = state.command('onoff', false);
  state.destroy(); await flush();
  assert.equal(f.writes.length, 105); // Disposed before the queued write started.
  assert.equal(state.getCommand(pending.id), undefined);
  state.receive({ 4: 55 }); assert.deepEqual(state.getEvents(), []);
});

async function server() {
  const service = new TuyaDashboardService({ appDir, timers, logger: () => {} });
  const a = fixture('A'); const b = fixture('B');
  const stateA = service.register('a', a.adapter); const stateB = service.register('b', b.adapter);
  await service.start(0);
  return { service, a, b, stateA, stateB, base: `http://127.0.0.1:${service.listeningPort}` };
}
const post = (base, route, body) => fetch(base + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('HTTP routes serve all pages, metadata and translations; commands are device-scoped', async () => {
  const s = await server();
  try {
    for (const route of ['/', '/live', '/interactive', '/expert', '/changelog', '/heating-curve', '/dashboard.js', '/dashboard.css']) {
      const res = await fetch(s.base + route); assert.equal(res.status, 200, route); await res.text();
    }
    const texts = await (await fetch(`${s.base}/api/texts`)).json();
    assert.equal(texts.nl.interactive, 'Interactief'); assert.equal(texts.en.interactive, 'Controls');
    const caps = await (await fetch(`${s.base}/api/devices/a/capabilities`)).json();
    assert.equal(caps.find((cap) => cap.id === 'adlar_hotwater').min, 35);
    s.stateA.receive({ 104: 10000 }); s.stateB.receive({ 104: 20000 });
    const response = await post(s.base, '/api/devices/a/commands', { capability: 'target_temperature', value: 40 });
    assert.equal(response.status, 202); const cmd = await response.json(); await flush();
    assert.equal(s.a.writes.length, 1); assert.equal(s.b.writes.length, 0);
    s.stateB.receive({ 4: 40 }); assert.equal(s.stateA.getCommand(cmd.id).status, 'sent');
    assert.equal((await fetch(`${s.base}/api/devices/b/commands/${cmd.id}`)).status, 404);
    s.stateA.receive({ 4: 40 });
    const observed = await (await fetch(`${s.base}/api/devices/a/commands/${cmd.id}`)).json();
    assert.equal(observed.status, 'observed');
    assert.equal((await post(s.base, '/api/devices/missing/commands', { capability: 'onoff', value: false })).status, 404);
    assert.equal((await post(s.base, '/api/devices/a/commands', { capability: 'onoff', value: 'false' })).status, 400);
    assert.equal((await post(s.base, '/api/devices/a/commands', null)).status, 400);
    assert.equal((await post(s.base, '/api/devices/a/commands', { extra: 'a'.repeat(5000) })).status, 413);
    assert.equal((await fetch(`${s.base}/api/devices/a/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elsewhere.invalid' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${s.base}/api/devices/a/commands`, { method: 'POST', body: '{}' })).status, 415);
    await s.service.unregister('a'); assert.notEqual(s.service.listeningPort, null);
    assert.equal((await fetch(`${s.base}/api/devices/a/snapshot`)).status, 404);
    await s.service.unregister('b'); assert.equal(s.service.listeningPort, null);
  } finally { await s.service.destroy(); }
});

test('occupied port leaves existing dashboard running and registrations intact', async () => {
  const s = await server(); const blocker = http.createServer();
  await new Promise((resolve) => blocker.listen(0, resolve));
  try {
    const port = s.service.listeningPort;
    await assert.rejects(s.service.start(blocker.address().port), { code: 'EADDRINUSE' });
    assert.equal(s.service.listeningPort, port);
    assert.equal((await fetch(`${s.base}/api/devices`)).status, 200);
    const replaced = s.service.register('a', fixture('Replacement').adapter);
    assert.notEqual(replaced, s.stateA); assert.deepEqual(s.stateA.getEvents(), []);
  } finally { await s.service.destroy(); await new Promise((resolve) => blocker.close(resolve)); }
});


test('missing runtime capability options fall back to manifest without breaking the dashboard', async () => {
  const s = await server();
  try {
    s.a.adapter.options = (id) => {
      if (id === 'adlar_enum_mode' || id === 'onoff') throw new Error('Capability options not found');
      return id === 'target_temperature' ? { title: { en: 'Water target' } } : {};
    };
    const response = await fetch(`${s.base}/api/devices/a/capabilities`);
    assert.equal(response.status, 200);
    const caps = await response.json();
    const mode = caps.find((cap) => cap.id === 'adlar_enum_mode');
    assert.equal(mode.optionsUnavailable, true);
    assert.equal(mode.type, 'enum');
    assert.ok(mode.values.some((option) => option.id === 'heating'));
    assert.equal(caps.find((cap) => cap.id === 'target_temperature').title.en, 'Water target');
    assert.equal((await fetch(`${s.base}/api/devices/a/dps`)).status, 200);
    const rejected = await post(s.base, '/api/devices/a/commands', { capability: 'adlar_enum_mode', value: 'invalid' });
    assert.equal(rejected.status, 400);
    assert.equal(s.a.writes.length, 0);
  } finally { await s.service.destroy(); }
});

test('parameter overview tracks all DPS, previous values and bounded change intervals', () => {
  const f = fixture(); const state = new TuyaDashboardDevice(f.adapter, metadata, timers);
  const row = (id) => state.changeOverview().find((dp) => dp.id === id);
  try {
    assert.equal(row(104).raw, null);
    assert.equal(row(104).firstSeen, null);
    assert.equal(row(104).changeCount, 0);
    state.receive({ 104: 10000, 250: false }, 1000);
    assert.equal(row(104).firstSeen, 1000);
    assert.equal(row(104).lastChanged, null);
    state.receive({ 104: 10000 }, 1500);
    assert.equal(row(104).changeCount, 0);
    assert.equal(row(104).receivedAt, 1500);
    state.receive({ 104: 0, 250: true }, 2000);
    assert.equal(row(104).previousRaw, 10000);
    assert.equal(row(104).previousValue, 1000);
    assert.equal(row(104).raw, 0);
    assert.equal(row(104).value, 0);
    assert.equal(row(104).previousChangedAt, 1000);
    assert.equal(row(250).previousRaw, false);
    assert.deepEqual(row(250).writable, []);
    f.values['measure_power.internal'] = 9000;
    assert.equal(row(104).value, 0); // Optimistic capability changes are not DPS observations.
    state.receive({ 104: 20000 }, 4000);
    assert.equal(row(104).previousRaw, 0);
    assert.equal(row(104).changeCount, 2);
    assert.equal(row(104).avgInterval, 1500);
    assert.equal(row(104).minInterval, 1000);
    assert.equal(row(104).maxInterval, 2000);
    for (let i = 1; i <= 50; i += 1) state.receive({ 104: 20000 + i }, 4000 + i * 3000);
    assert.equal(row(104).changeCount, 52);
    assert.equal(row(104).avgInterval, 3000);
    assert.equal(row(104).minInterval, 3000);
    assert.equal(row(104).maxInterval, 3000);
    assert.equal(row(250).receivedAt, 2000); // Partial updates preserve other rows.
    state.destroy();
    assert.equal(row(104).firstSeen, null);
    assert.equal(row(250), undefined);
  } finally { state.destroy(); }
});

test('change overview API keeps observations isolated between devices', async () => {
  const s = await server();
  try {
    s.stateA.receive({ 104: 10000 }, 1000);
    s.stateA.receive({ 104: 20000 }, 2000);
    s.stateB.receive({ 104: 30000 }, 3000);
    for (const [id, value, count] of [['a', 2000, 1], ['b', 3000, 0]]) {
      const response = await fetch(`${s.base}/api/devices/${id}/changes`);
      assert.equal(response.status, 200);
      const rows = await response.json();
      const dp = rows.find((item) => item.id === 104);
      assert.equal(dp.value, value);
      assert.equal(dp.changeCount, count);
    }
  } finally { await s.service.destroy(); }
});
