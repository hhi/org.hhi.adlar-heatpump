// Tests intentionally load compiled TypeScript and the inline expert dashboard script.
/* eslint-disable node/no-unpublished-require, global-require, import/no-dynamic-require, mocha/handle-done-callback */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { default: ParameterBankService, parameterBankAddresses } = require('../../.homeybuild/lib/modbus/protocol/parameter-bank-service');
const { Adlar2ModbusService } = require('../../.homeybuild/lib/modbus/protocol/adlar2-modbus-service');
const { DashboardService } = require('../../.homeybuild/lib/modbus/services/dashboard-service');
const fixture = require('../fixtures/modbus/p-l-433-143.json');

function bankReader() {
  const words = new Map();
  for (const p of fixture.parameters) {
    words.set(p.minAddress, p.minRaw);
    words.set(p.maxAddress, p.maxRaw);
  }
  const calls = [];
  const read = async (start, count) => {
    calls.push([start, count]);
    return Array.from({ length: count }, (_, i) => words.get(start + i) ?? 0);
  };
  return {
    words, calls, read, banks: new ParameterBankService(read),
  };
}

test('on-demand P and L banks use their own offsets and signed values', async () => {
  const { banks, calls } = bankReader();
  assert.deepEqual(banks.getRanges(), []);
  const ranges = await banks.readRanges([0x100, 0x101, 0x811, 0x812]);
  assert.deepEqual(calls, [[0x600, 2], [0x400, 2], [0x891, 2], [0x851, 2]]);
  assert.deepEqual(ranges.map((r) => [r.address, r.min, r.max]), [[0x100, 0, 10], [0x101, 0, 1], [0x811, -50, 0], [0x812, 30, 80]]);
  assert.equal(ranges[2].minRaw, 65486);
  assert.ok(ranges.every((r) => r.status === 'available' && r.readAt > 0));
});

test('cached and concurrent overlapping reads do not issue duplicate Modbus reads', async () => {
  const { banks, calls, words } = bankReader();
  await Promise.all([banks.readRanges([0x100, 0x101]), banks.readRanges([0x101])]);
  assert.equal(calls.length, 2);
  const first = banks.getRanges();
  first[0].max = -100;
  assert.equal(banks.getRanges()[0].max, 10, 'callers cannot change the cache');
  words.set(0x400, 20);
  assert.equal((await banks.readRanges([0x100]))[0].max, 10);
  assert.equal((await banks.readRanges([0x100], true))[0].max, 20);
  assert.equal(calls.length, 4);
});

test('unavailable banks fall back and do not walk the remaining groups on unsupported firmware', async () => {
  let reads = 0;
  const banks = new ParameterBankService(async () => {
    reads++; throw new Error('Illegal data address');
  });
  const ranges = await banks.readRanges([0x100, 0x106, 0x811]);
  assert.equal(reads, 1);
  assert.ok(ranges.every((r) => r.status === 'unavailable' && r.min === undefined && r.max === undefined));
  await banks.readRanges([0x100]);
  assert.equal(reads, 1, 'failed reads are cached until retry or reconnect');
  await banks.readRanges([0x100], true);
  assert.equal(reads, 2);
});

test('inverted or incomplete bank pairs are rejected; 0xFFFF is not a universal invalid value', async () => {
  const { banks, words } = bankReader();
  words.set(0x600, 10); words.set(0x400, 1);
  words.set(0x601, 65535); words.set(0x401, 65535);
  const [invalid, fixedMinusOne] = await banks.readRanges([0x100, 0x101]);
  assert.equal(invalid.status, 'invalid');
  assert.equal(fixedMinusOne.status, 'available');
  assert.deepEqual([fixedMinusOne.min, fixedMinusOne.max], [-1, -1]);
  const incomplete = new ParameterBankService(async () => []);
  assert.equal((await incomplete.readRanges([0x100]))[0].status, 'unavailable');
});

test('stale bank reads cannot repopulate cache after reconnect or destroy', async () => {
  let resolve;
  const banks = new ParameterBankService(() => new Promise((done) => {
    resolve = done;
  }));
  const pending = assert.rejects(banks.readRanges([0x100]), /session closed/);
  await new Promise((done) => setImmediate(done));
  banks.clear();
  resolve([0]);
  await pending;
  assert.deepEqual(banks.getRanges(), []);
});

test('bank API accepts at most 32 P/L addresses and no sensor or metadata-bank writes', async () => {
  const { banks, calls } = bankReader();
  for (const addresses of [[], [0x40], [0x600], [1.5], ['256'], Array.from({ length: 33 }, (_, i) => 0x100 + i)]) {
    await assert.rejects(banks.readRanges(addresses), /Invalid/);
  }
  assert.equal(calls.length, 0);
  assert.equal(parameterBankAddresses(0xFFF), null);
});

test('cache belongs to each runtime and clears on disconnect', async (t) => {
  const a = new Adlar2ModbusService({ transport: { host: 'unused.invalid' } });
  const b = new Adlar2ModbusService({ transport: { host: 'unused.invalid' } });
  t.after(async () => {
    await a.destroy(); await b.destroy();
  });
  const fixtureReader = bankReader();
  a.tcp._connected = true;
  a.tcp.readHoldingRegisterValues = fixtureReader.read;
  await a.readParameterRanges([0x100]);
  assert.equal(a.getParameterRanges().length, 1);
  assert.equal(b.getParameterRanges().length, 0);
  a.tcp.cache.set(0x400, 10);
  a.tcp.cache.set(0x600, 0);
  a.tcp.cache.set(0x100, 1);
  a.tcp.emit('disconnected', 'test');
  assert.deepEqual(a.getParameterRanges(), []);
  assert.equal(a.getRegisterCache().has(0x400), false);
  assert.equal(a.getRegisterCache().has(0x600), false);
  assert.equal(a.getRegisterCache().get(0x100), 1, 'operational cache is preserved');
});

async function api(dashboard, method, body, lang = 'nl') {
  let status;
  let json;
  dashboard._readBody = async () => body;
  await dashboard._handleRequest({ method, url: '/api/parameter-ranges', headers: { 'accept-language': lang } }, {
    setHeader: () => {},
    writeHead: (code) => {
      status = code;
    },
    end: (text) => {
      json = JSON.parse(text);
    },
  });
  return { status, json };
}

test('dashboard GET uses only cached bank data, POST reads live, GET returns refreshed cache in four languages', async () => {
  const reader = bankReader();
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  dashboard.setParameterBankCallbacks((addresses, refresh) => reader.banks.readRanges(addresses, refresh), () => reader.banks.getRanges());
  const before = await api(dashboard, 'GET');
  assert.deepEqual(before.json.ranges, []);
  assert.equal(reader.calls.length, 0);
  const loaded = await api(dashboard, 'POST', { addresses: [0x100, 0x811] });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.json.ranges[0].max, 10);
  assert.equal(reader.calls.length, 4);
  for (const lang of ['nl', 'en', 'de', 'fr']) {
    const response = await api(dashboard, 'GET', undefined, lang);
    assert.equal(response.json.ranges.length, 2);
    assert.deepEqual(response.json.texts, require(`../../locales/${lang}.json`).modbusParameterBanks);
  }
  assert.equal(reader.calls.length, 4, 'GET polling never polls the device');
});

test('dashboard validates addresses and uses fallback when disconnected', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  assert.equal((await api(dashboard, 'GET')).json.supported, false);
  assert.equal((await api(dashboard, 'POST', { addresses: [0x100] })).status, 503);
  let calls = 0;
  dashboard.setParameterBankCallbacks(async () => {
    calls++; throw new Error('Disconnected');
  }, () => []);
  for (const addresses of [[0x40], [0x600], [0x236], [256.5], ['256'], []]) {
    assert.equal((await api(dashboard, 'POST', { addresses })).status, 400);
  }
  assert.equal(calls, 0);
  assert.equal((await api(dashboard, 'POST', { addresses: [0x100] })).status, 503);
});

async function expertRead(dashboard, body) {
  let status;
  let json;
  dashboard._readBody = async () => body;
  await dashboard._handleRequest({ method: 'POST', url: '/api/expert/read', headers: {} }, {
    setHeader() {},
    writeHead(code) { status = code; },
    end(text) { json = JSON.parse(text); },
  });
  return { status, json };
}

test('manual P/L reads fetch missing limits once and reuse the runtime cache; other reads do not fetch limits', async () => {
  const reader = bankReader();
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  dashboard.setReadRegisterCallback(async (address) => (address === 0x811 ? -5 : 1));
  dashboard.setParameterBankCallbacks((addresses, refresh) => reader.banks.readRanges(addresses, refresh), () => reader.banks.getRanges());
  const first = await expertRead(dashboard, { address: 0x100 });
  assert.equal(first.status, 200);
  assert.equal(first.json.rawValue, 1);
  assert.deepEqual([first.json.parameterRange.min, first.json.parameterRange.max], [0, 10]);
  assert.deepEqual(reader.calls, [[0x600, 1], [0x400, 1]]);
  await expertRead(dashboard, { address: 0x100 });
  await expertRead(dashboard, { address: 0x101, includeParameterRange: false });
  for (const body of [{ address: 0x40 }, { address: 0x100, isCoil: true }, { address: 0x600 }]) {
    assert.equal((await expertRead(dashboard, body)).json.parameterRange, undefined);
  }
  assert.equal(reader.calls.length, 2);
  const l28 = await expertRead(dashboard, { address: 0x811 });
  assert.equal(l28.json.rawValue, -5);
  assert.equal(l28.json.scaledValue, -5);
  assert.deepEqual([l28.json.parameterRange.min, l28.json.parameterRange.max], [-50, 0]);
  assert.equal(reader.calls.length, 4);
  assert.equal((await expertRead(dashboard, { address: 0x100, includeParameterRange: false })).json.parameterRange.max, 10);
  await api(dashboard, 'GET');
  assert.equal(reader.calls.length, 4, 'dashboard cache polling never reads metadata from hardware');
});

test('limit failures preserve a successful value; failed value reads never trigger metadata reads', async () => {
  let bankReads = 0;
  const banks = new ParameterBankService(async () => { bankReads++; throw new Error('Illegal data address'); });
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  dashboard.setReadRegisterCallback(async () => 5);
  dashboard.setParameterBankCallbacks((addresses, refresh) => banks.readRanges(addresses, refresh), () => banks.getRanges());
  for (let i = 0; i < 2; i++) {
    const response = await expertRead(dashboard, { address: 0x100 });
    assert.equal(response.status, 200);
    assert.equal(response.json.rawValue, 5);
    assert.equal(response.json.parameterRange.status, 'unavailable');
  }
  assert.equal(bankReads, 1, 'unavailable limits are cached too');
  dashboard.setReadRegisterCallback(async () => { throw new Error('Value read failed'); });
  assert.equal((await expertRead(dashboard, { address: 0x101 })).status, 500);
  assert.equal(bankReads, 1);
  dashboard.setReadRegisterCallback(async () => 5);
  dashboard.setParameterBankCallbacks(async () => { throw new Error('Session closed'); }, () => []);
  const stale = await expertRead(dashboard, { address: 0x100 });
  assert.equal(stale.status, 200);
  assert.equal(stale.json.rawValue, 5);
  assert.equal(stale.json.parameterRange.status, 'unavailable');
});

function expertContext() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: '', innerHTML: '', style: {}, disabled: false, setAttribute() {}, removeAttribute() {}, addEventListener() {}, classList: { add() {}, remove() {} },
      });
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    document: { getElementById: element }, Date, setTimeout, clearTimeout, setInterval, clearInterval,
  });
  const html = fs.readFileSync(path.join(__dirname, '../../public/dashboard-expert.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/i)[1].replace(/\ninit\(\);\s*$/, '\n');
  vm.runInContext(script, context);
  context.texts = require('../../locales/nl.json').modbusParameterBanks;
  vm.runInContext('bankTexts = texts;', context);
  return { context, element, run: (code) => vm.runInContext(code, context) };
}

test('a manual row read immediately shows returned limits and checks against them', async () => {
  const { context, element, run } = expertContext();
  const requests = [];
  context.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { json: async () => ({ ok: true, rawValue: 5, wireRawValue: 5, scaledValue: 5,
      parameterRange: { address: 0x100, min: 0, max: 10, status: 'available', readAt: 1 } }) };
  };
  run(`const p = {address:0x100,name:'P000',min:0,max:1}; blocks=[{id:'p',registers:[p]}]; visibleBlocks=blocks; flashRow=()=>{};`);
  await run('readRow(0x100, false, 1)');
  assert.equal(requests[0].includeParameterRange, true);
  assert.match(element('range-device-256').innerHTML, />0–10</);
  assert.equal(element('scaled-256').textContent, '5');
  assert.equal(run('outOfRangeRegisters.has(0x100)'), false);
  assert.match(run('reportRange(p)'), /0–10.*Warmtepomp/);
  run('bankFingerprint=JSON.stringify([]);');
  run('acceptParameterRanges([{address:0x100,min:0,max:10,status:"available"}]);');
  context.fetch = async () => ({ ok: true, json: async () => ({ ranges: [], texts: context.texts }) });
  await run('loadParameterLimits(false)');
  assert.equal(run('bankRanges.size'), 0, 'an empty cache after reconnect clears directly returned ranges too');
});

test('block limits are requested in batches and cached by the runtime; failures do not prevent value reads', async () => {
  const { context, run } = expertContext();
  const reader = bankReader();
  const batches = [];
  context.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    batches.push(body);
    return { ok: true, json: async () => ({ ranges: await reader.banks.readRanges(body.addresses, body.refresh) }) };
  };
  context.sleep = async () => {};
  run('const parameters=Array.from({length:33},(_,i)=>({address:0x100+i}));');
  await run('prepareParameterLimits([...parameters,parameters[0],{address:0x40},{address:0x100,isCoil:true}])');
  assert.deepEqual(batches.map((batch) => batch.addresses.length), [32, 1]);
  assert.ok(batches.every((batch) => batch.refresh === false));
  assert.equal(reader.calls.length, 4);
  await run('prepareParameterLimits(parameters)');
  assert.equal(reader.calls.length, 4, 'cached block limits generate no additional Modbus reads');
  const valueReads = [];
  context.fetch = async () => ({ ok: false });
  context.readRow = async (...args) => { valueReads.push(args); };
  context.setActiveReadRow = () => {};
  context.finishReadProgress = () => {};
  run('blocks=[{id:"p",registers:parameters.slice(0,2)}]; visibleBlocks=blocks;');
  await run('readBlock("p")');
  assert.deepEqual(valueReads, [[0x100, false, 1, false], [0x101, false, 1, false]]);
});

test('heat pump clock shows byte-encoded time in the table and report without changing raw values', () => {
  const { run, element } = expertContext();
  run(`const clock = { address: 0x309, name: 'Kloktijd warmtepomp', readOnly: true, valueFormat: 'hourMinute' };
    blocks = [{ id: 'clock', readOnly: false, registers: [clock] }]; visibleBlocks = blocks;`);
  for (const [word, expected] of [[0, '00:00'], [0x0905, '09:05'], [5411, '21:35'], [5412, '21:36'], [0x153B, '21:59'], [0x1600, '22:00'], [0x173B, '23:59']]) {
    run(`applyRegisterValue(0x309, ${word}, ${word}, false, 'direct', ${word})`);
    const display = `0x${word.toString(16).toUpperCase().padStart(4, '0')} = ${expected}`;
    assert.equal(element('scaled-777').textContent, display);
    assert.equal(element('wire-777').textContent, String(word));
    assert.equal(run('readRegisters.get(0x309).rawValue'), word);
    assert.equal(run('reportValue({ reg: clock, read: readRegisters.get(0x309) })'), display);
  }
  for (const word of [0x153C, 0x1800, 0xFFFF, -1, 65536]) {
    assert.equal(run(`formatRegisterValue(clock, ${word}, ${word})`), String(word), 'invalid hour/minute bytes must stay numeric');
  }
  assert.equal(run('formatRegisterValue({address:0x301}, 5411, 5411)'), '5411', 'other registers remain numeric');
  assert.doesNotMatch(run('renderRow(blocks[0], clock)'), /openWriteDialog/);
});

test('heat pump clock metadata is localized and remains readable while expert writes are refused', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  let writes = 0;
  dashboard.setReadRegisterCallback(async () => 5411);
  dashboard.setWriteExpertCallback(async () => { writes++; });
  async function request(method, url, body, lang = 'nl') {
    let status;
    let json;
    dashboard._readBody = async () => body;
    await dashboard._handleRequest({ method, url, headers: { 'accept-language': lang } }, {
      setHeader() {},
      writeHead(code) { status = code; },
      end(text) { json = JSON.parse(text); },
    });
    return { status, json };
  }
  for (const lang of ['nl', 'en', 'de', 'fr']) {
    const { json } = await request('GET', '/api/registers', undefined, lang);
    const clock = json.flatMap((block) => block.registers).find((reg) => reg.address === 0x309);
    assert.equal(clock.name, require(`../../locales/${lang}.json`).modbusRegisterDescriptions.heat_pump_clock);
    assert.equal(clock.valueFormat, 'hourMinute');
    assert.equal(clock.readOnly, true);
    assert.match(clock.desc, /0x1523 = 21:35/);
  }
  assert.equal(dashboard._buildWritableAddressSet().has(0x309), false);
  const read = await request('POST', '/api/expert/read', { address: 0x309 });
  assert.equal(read.status, 200);
  assert.equal(read.json.rawValue, 5411);
  const write = await request('POST', '/api/expert/write', { address: 0x309, rawValue: 5412 });
  assert.equal(write.status, 403);
  assert.equal(writes, 0);
});

test('User Control covers every address through 0x032F, preserving known definitions and exposing unknowns read-only', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  const writes = [];
  const reads = [];
  dashboard.setReadRegisterCallback(async (address) => { reads.push(address); return 1234; });
  dashboard.setWriteExpertCallback(async (...args) => { writes.push(args); });
  async function request(method, url, body, lang = 'nl') {
    let status;
    let json;
    dashboard._readBody = async () => body;
    await dashboard._handleRequest({ method, url, headers: { 'accept-language': lang } }, {
      setHeader() {},
      writeHead(code) { status = code; },
      end(text) { json = JSON.parse(text); },
    });
    return { status, json };
  }
  const { CONTROL_REGISTERS } = require('../../.homeybuild/lib/modbus/protocol/adlar-modbus-registers');
  const known = new Map(Object.values(CONTROL_REGISTERS).map((register) => [register.address, register]));
  const unknownAddresses = Array.from({ length: 48 }, (_, i) => 0x300 + i).filter((address) => !known.has(address) && address !== 0x309);
  for (const lang of ['nl', 'en', 'de', 'fr']) {
    const { json } = await request('GET', '/api/registers', undefined, lang);
    const control = json.find((block) => block.id === 'blok3_control');
    assert.match(control.label, /0x0300–0x032F/);
    assert.deepEqual(control.registers.map((reg) => reg.address), Array.from({ length: 48 }, (_, i) => 0x300 + i));
    const texts = require(`../../locales/${lang}.json`).modbusRegisterDescriptions;
    for (const reg of control.registers) {
      if (known.has(reg.address)) {
        const definition = known.get(reg.address);
        assert.equal(reg.name, definition.name);
        assert.equal(reg.min, definition.min);
        assert.equal(reg.max, definition.max);
        assert.equal(reg.multiply, definition.multiply);
        assert.ok(!reg.readOnly);
      } else if (reg.address === 0x309) {
        assert.equal(reg.valueFormat, 'hourMinute');
      } else {
        assert.equal(reg.name, texts.unknown_control_register);
        assert.equal(reg.readOnly, true);
        assert.equal(reg.min, undefined);
        assert.equal(reg.multiply, undefined);
      }
    }
    assert.ok(control.registers.find((reg) => reg.address === 0x30A).pollGroups.includes('medium'));
    assert.deepEqual(control.registers.find((reg) => reg.address === 0x32F).pollGroups, []);
  }
  assert.deepEqual(reads, [], 'enumerating all addresses does not read hardware');
  const writable = dashboard._buildWritableAddressSet();
  for (const address of unknownAddresses) {
    assert.equal(writable.has(address), false);
    assert.equal((await request('POST', '/api/expert/write', { address, rawValue: 1 })).status, 403);
  }
  assert.deepEqual(writes, []);
  const read = await request('POST', '/api/expert/read', { address: 0x30A });
  assert.equal(read.status, 200);
  assert.equal(read.json.rawValue, 1234);
  assert.deepEqual(reads, [0x30A]);
  assert.equal((await request('POST', '/api/expert/write', { address: 0x301, rawValue: 460 })).status, 200);
  assert.deepEqual(writes, [[0x301, 460, false]], 'existing control writes remain available');
});

test('expert range display and warnings use the device bank, while write validation uses the app definition', () => {
  const { run, element } = expertContext();
  run(`const p = { address: 0x100, min: 0, max: 1, name: 'P000' };
    blocks = [{ id: 'p', registers: [p] }]; visibleBlocks = blocks;
    bankRanges.set(0x100, { address: 0x100, min: 0, max: 10, status: 'available', readAt: 1 });`);
  assert.equal(run('rangeStr(p)'), '0–10');
  assert.equal(run('rangeStr(p, false)'), '0–1');
  assert.match(run('renderParameterRange(p)'), />0–10<\/span>/);
  assert.match(run('renderRow(blocks[0], p)'), /<td class="unit">0–1<\/td>/);
  assert.doesNotMatch(run('renderParameterRange(p)'), /Appdefinitie/);
  run('updateRangeWarning(0x100, 5)');
  assert.equal(run('outOfRangeRegisters.has(0x100)'), false);
  run('updateRangeWarning(0x100, 11)');
  assert.equal(run('outOfRangeRegisters.has(0x100)'), true);
  assert.match(run('reportRange(p)'), /0–10.*Warmtepomp/);
  run('pendingWrite = { reg: p };');
  element('dlg-input').value = '5';
  run('validateDlgOk()');
  assert.equal(element('dlg-ok').disabled, true, 'bank range does not widen write input limits');
  run('bankRanges.set(0x100, { address: 0x100, status: \'unavailable\' }); updateRangeWarning(0x100, 5);');
  assert.equal(run('rangeStr(p)'), '0–1');
  assert.match(run('renderParameterRange(p)'), /Niet beschikbaar/);
  run("bankRanges.set(0x100, {status:'partial',max:10})");
  assert.match(run('renderParameterRange(p)'), /minimum: Niet gelezen.*maximum: 10/);
  assert.equal(run('outOfRangeRegisters.has(0x100)'), true);
});

test('negative bank ranges decode wire values for diagnostics; L28 remains raw and L55 is not clamped', () => {
  const { run } = expertContext();
  run(`const l28 = { address: 0x811, min: -50, max: 0 }; const l55 = { address: 0x82C };
    bankRanges.set(0x811, { min: -50, max: 0, status: 'available' });
    bankRanges.set(0x82C, { min: 0, max: 240, status: 'available' });`);
  assert.equal(run('parameterValue(l28, 65531, 65531, 65531).rawValue'), -5);
  assert.equal(run('parameterValue(l28, 65531, 65531, 65531).scaledValue'), -5, 'no new L28 scaling');
  assert.equal(run('parameterValue(l55, 65531, 65531, 65531).scaledValue'), -5, 'outlying value is preserved');
  assert.equal(run('rangeStr(l55)'), '0–240');
});

test('each definition bank has its own complete read-only block with explicit parameter references', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  let blocks;
  await dashboard._handleRequest({ method: 'GET', url: '/api/registers', headers: { 'accept-language': 'nl' } }, {
    setHeader() {},
    writeHead() {},
    end(body) {
      blocks = JSON.parse(body);
    },
  });
  const banks = blocks.filter((block) => block.definitionBank);
  assert.deepEqual(banks.map((block) => [block.definitionBank.start, block.registers.length]), [[0x400, 512], [0x600, 512], [0x840, 64], [0x880, 64]]);
  const writable = dashboard._buildWritableAddressSet();
  for (const bank of banks) {
    assert.equal(bank.readOnly, true);
    assert.ok(bank.registers.every((r) => r.readOnly && r.signed && !writable.has(r.address)));
    assert.equal(bank.registers[0].parameterAddress, bank.definitionBank.parameterStart);
    assert.equal(bank.registers[bank.registers.length - 1].address, bank.definitionBank.start + bank.definitionBank.count - 1);
  }
  const p208max = banks[0].registers.find((r) => r.address === 0x4D0);
  assert.equal(p208max.parameterAddress, 0x1D0);
  assert.equal(p208max.registerId, 'P208');
  assert.match(p208max.name, /maximum/);
  assert.equal(p208max.bankRole, 'max');
});

test('reading individual min/max blocks populates the same range cache used by parameter rows', async (t) => {
  const service = new Adlar2ModbusService({ transport: { host: 'unused.invalid' } });
  t.after(() => service.destroy());
  const reader = bankReader();
  service.tcp.readHoldingRegisterValues = reader.read;
  assert.deepEqual(await service.readParameterBankWords(0x4D0, 1), [500]);
  assert.equal(service.getParameterRanges()[0].status, 'partial', 'maximum alone is not a complete range');
  assert.equal(service.getParameterRanges()[0].max, 500);
  assert.equal(service.getParameterRanges()[0].min, undefined);
  assert.deepEqual(await service.readParameterBankWords(0x6D0, 1), [65526]);
  assert.deepEqual(service.getParameterRanges().map((r) => [r.address, r.min, r.max]), [[0x1D0, -10, 500]]);
  service.tcp.readHoldingRegisterValues = async () => {
    throw new Error('timeout');
  };
  await assert.rejects(service.readParameterBankWords(0x4D0, 1));
  assert.equal(service.getParameterRanges()[0].status, 'unavailable');
});

test('definition bank API permits bounded reads and refuses writes to the exposed limit registers', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  const reads = [];
  let writes = 0;
  dashboard.setParameterBankCallbacks(async () => [], () => [], async (start, count) => {
    reads.push([start, count]); return Array(count).fill(65526);
  });
  dashboard.setWriteExpertCallback(async () => {
    writes++;
  });
  async function request(url, body) {
    let status;
    let json;
    dashboard._readBody = async () => body;
    await dashboard._handleRequest({ method: 'POST', url, headers: { 'accept-language': 'nl' } }, {
      setHeader() {},
      writeHead(code) {
        status = code;
      },
      end(text) {
        json = JSON.parse(text);
      },
    });
    return { status, json };
  }
  assert.deepEqual(await request('/api/parameter-bank-block', { start: 0x600, count: 32 }), { status: 200, json: { words: Array(32).fill(65526) } });
  for (const [start, count] of [[0x100, 1], [0x400, 33], [0x5FF, 2], [0x840, 0], [0x83F, 2], [0x880, 1.5]]) {
    assert.equal((await request('/api/parameter-bank-block', { start, count })).status, 400);
  }
  assert.deepEqual(reads, [[0x600, 32]]);
  for (const address of [0x400, 0x600, 0x840, 0x880]) {
    const response = await request('/api/expert/write', { address, rawValue: 1 });
    assert.equal(response.status, 403);
    assert.match(response.json.error, /alleen-lezen/);
  }
  assert.equal(writes, 0);
});

test('raw adapter writes cannot modify limit banks, but ordinary parameter writes are preserved', async (t) => {
  const service = new Adlar2ModbusService({ transport: { host: 'unused.invalid' } });
  t.after(() => service.destroy());
  const writes = [];
  service.tcp.writeSingleRegister = async (...args) => {
    writes.push(args);
  };
  for (const address of [0x400, 0x600, 0x840, 0x880]) await assert.rejects(service.writeRegister(address, 1), /read-only/);
  assert.deepEqual(writes, []);
  await service.writeRegister(0x100, 1);
  assert.deepEqual(writes, [[0x100, 1]]);
});

test('definition bank blocks remain separate when regrouping by function or unit', () => {
  const { context, run } = expertContext();
  context.banks = [{
    id: 'definition_pMax', label: 'P maxima', readOnly: true, definitionBank: { role: 'max' }, registers: [{ address: 0x400, name: 'P000 max' }],
  }];
  for (const build of ['buildFunctionalBlocks', 'buildUnitBlocks']) {
    assert.equal(run(`${build}([{id:'p',registers:[{address:0x100,name:'mode'}]}, ...banks]).filter(b=>b.definitionBank).length`), 1);
    assert.equal(run(`${build}([{id:'p',registers:[{address:0x100,name:'mode'}]}, ...banks]).filter(b=>!b.definitionBank).flatMap(b=>b.registers).some(r=>r.address===0x400)`), false);
  }
});

test('shared connection wrapper restricts bank writes only for a runtime that supports these banks', async () => {
  const { ModbusConnectionService } = require('../../.homeybuild/lib/modbus/services/modbus-connection-service');
  const connection = new ModbusConnectionService({
    device: { homey: { __: (key) => key } },
    createService: () => {},
    onData: () => {},
    onConnected: () => {},
    onDisconnected: () => {},
    onError: () => {},
  });
  const writes = [];
  connection.service = {
    writeRegister: async (...args) => {
      writes.push(args);
    },
  };
  await connection.writeRaw(0x840, 1, false);
  assert.deepEqual(writes, [[0x840, 1]], 'same address may be writable for another register model');
  connection.service.readParameterBankWords = async () => [];
  await assert.rejects(connection.writeRaw(0x840, 2, false), /modbusParameterBanks.readOnly/);
  assert.equal(writes.length, 1);
});
