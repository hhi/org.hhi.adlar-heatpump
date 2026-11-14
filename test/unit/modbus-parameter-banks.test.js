// Tests intentionally load the TypeScript build output.
/* eslint-disable node/no-unpublished-require */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const data = require('../fixtures/modbus/p-l-433-143.json');
const { report, signed } = require('../../scripts/validation/p-l-parameter-banks');
const defs = require('../../.homeybuild/lib/modbus/protocol/adlar-modbus-registers');

const {
  P_PARAMETERS: P, L_PARAMETERS: L, POLL_GROUP_FAST, POLL_GROUP_MEDIUM, POLL_GROUP_SLOW, POLL_GROUP_ONCE,
} = defs;
const { DashboardService } = require('../../.homeybuild/lib/modbus/services/dashboard-service');
const { default: parameterDescription } = require('../../.homeybuild/lib/modbus/protocol/parameter-descriptions');
const { Adlar2ModbusService } = require('../../.homeybuild/lib/modbus/protocol/adlar2-modbus-service');

const row = (parameter) => data.parameters.find((p) => p.parameter === parameter);

test('recorded baseline reproduces 60 P and 7 L differences', () => {
  const result = report();
  assert.equal(result.baseline.P.compared, 263);
  assert.equal(result.baseline.P.equal, 203);
  assert.equal(result.baseline.P.differences.length, 60);
  assert.equal(result.baseline.L.compared, 26);
  assert.equal(result.baseline.L.equal, 19);
  assert.deepEqual(result.baseline.L.differences, ['L13', 'L14', 'L15', 'L19', 'L20', 'L23', 'L30']);
  assert.equal(result.current.P.differences.length, 56);
  assert.equal(result.current.L.differences.length, 6);
  assert.deepEqual(result.alignment.P, {
    exact: 203, minusOne: 89, plusOne: 88, swapped: 0,
  });
  assert.equal(result.alignment.L.exact, 19);
  assert.deepEqual(result.directions.P, {
    wider: 39, narrower: 20, shifted: 1, missingBaseline: 0,
  });
  assert.equal(result.writeLimitsEnforced, null);
  assert.equal(row('P183').currentRaw, null, 'no password in reference data');
});

test('bank offsets, uint16 encoding and signed decoding are consistent for every row', () => {
  for (const p of data.parameters) {
    const isP = p.parameter.startsWith('P');
    assert.equal(p.maxAddress - p.address, isP ? 0x300 : 0x40, p.parameter);
    assert.equal(p.minAddress - p.address, isP ? 0x500 : 0x80, p.parameter);
    for (const raw of [p.minRaw, p.maxRaw, p.currentRaw].filter((v) => v !== null)) {
      assert.ok(Number.isInteger(raw) && raw >= 0 && raw <= 65535, p.parameter);
      assert.equal(signed(raw) & 0xFFFF, raw, p.parameter);
    }
  }
  assert.equal(signed(0xFFFF), -1, 'not a universal invalid sentinel');
  assert.equal(signed(row('L28').currentRaw), -5);
  assert.equal(signed(row('L55').currentRaw), -5);
  assert.ok(signed(row('L55').currentRaw) < signed(row('L55').minRaw), 'anomaly remains visible');
});

test('mask measurements contain 301 P bits and 50 L bits without assigning meaning', () => {
  const count = (blocks) => blocks.flatMap((b) => b.raw).reduce((sum, raw) => sum + raw.toString(2).replace(/0/g, '').length, 0);
  assert.equal(count(data.flags.filter((b) => b.start < 0x800)), 301);
  assert.equal(count(data.flags.filter((b) => b.start >= 0x800)), 50);
  assert.ok(data.unknowns.includes('individual flag meaning'));
});

test('only the four P metadata ranges and L14 change from the reference definitions', () => {
  const all = new Map([P, defs.P_PARAMETERS_EXTRA, defs.P_WORKING_CONDITIONS, L].flatMap((group) => Object.values(group)).map((d) => [d.address, d]));
  const changed = data.parameters.filter((p) => {
    if (!p.baselineKey) return false;
    const def = all.get(p.address);
    return (def.min ?? null) !== p.baselineRange.min || (def.max ?? null) !== p.baselineRange.max;
  });
  assert.deepEqual(changed.map((p) => p.parameter), ['P006', 'P049', 'P083', 'P145', 'L14']);
  for (const [name, def] of [['P006', all.get(0x106)], ['P049', all.get(0x131)], ['P083', all.get(0x153)], ['P145', all.get(0x191)]]) {
    const measured = row(name);
    assert.equal(def.min, signed(measured.minRaw));
    assert.equal(def.max, signed(measured.maxRaw));
    assert.ok(signed(measured.currentRaw) >= def.min && signed(measured.currentRaw) <= def.max);
  }
  assert.match(P.P06_fanType.desc, /3=unknown/);
  assert.deepEqual([L.L14_sterilizationStartTime.min, L.L14_sterilizationStartTime.max, L.L14_sterilizationStartTime.default, L.L14_sterilizationStartTime.unit], [0, 23, 23, 'h']);
});

test('L28 decodes raw -5 to k=-0.5 and encodes k=-0.5 once when writing', async () => {
  const service = new Adlar2ModbusService({ transport: { host: 'unused.invalid' } });
  try {
    service.tcp.cache.set(0x810, 0);
    service.tcp.cache.set(0x811, row('L28').currentRaw);
    service.tcp.cache.set(0x812, 55);
    const { diy } = service.getSnapshot();
    assert.equal(diy.slopeK, -0.5);
    assert.equal(diy.calcSetpoint(0), 47.5);
    const writes = [];
    service.tcp.writeSingleRegister = async (address, raw) => writes.push([address, raw]);
    await service.setDiyHeatingCurve(-0.5, 55);
    assert.deepEqual(writes, [[0x810, 0], [0x811, -5], [0x812, 55]]);
    await assert.rejects(service.setDiyHeatingCurve(-5.1, 55));
    await assert.rejects(service.setDiyHeatingCurve(-0.5, 81));
    assert.equal(writes.length, 3, 'invalid curve writes nothing');
    assert.deepEqual([L.L28_heatingCurveCoeffK.min, L.L28_heatingCurveCoeffK.max], [-50, 0]);
    assert.equal(L.L28_heatingCurveCoeffK.multiply, undefined, 'expert raw range is not scaled twice');
  } finally {
    await service.destroy();
  }
});

test('parameter metadata banks are never added to periodic or once polling', () => {
  for (const group of [POLL_GROUP_FAST, POLL_GROUP_MEDIUM, POLL_GROUP_SLOW, POLL_GROUP_ONCE]) {
    for (const block of group.reads) {
      for (let address = block.start; address < block.start + block.count; address++) {
        assert.ok(!(address >= 0x370 && address <= 0x7FF) && !(address >= 0x840 && address <= 0x8CF), `${group.name}: ${address.toString(16)}`);
      }
    }
  }
});

test('expert metadata localizes unknown enums and hours and preserves the original L28 explanation', async () => {
  const dashboard = new DashboardService({ appDir: process.cwd(), logger: () => {} });
  for (const lang of ['en', 'nl', 'de', 'fr']) {
    const locale = require(`../../locales/${lang}.json`); // eslint-disable-line global-require, import/no-dynamic-require
    const texts = locale.modbusRegisterDescriptions;
    let blocks;
    await dashboard._handleRequest(
      { method: 'GET', url: '/api/registers', headers: { 'accept-language': `${lang}-XX,en;q=0.8` } },
      {
        setHeader: () => {},
        writeHead: () => {},
        end: (body) => {
          blocks = JSON.parse(body);
        },
      },
    );
    const registers = new Map(blocks.flatMap((block) => block.registers).map((reg) => [reg.address, reg]));
    assert.equal(registers.get(0x106).desc, texts.fan_type);
    assert.equal(registers.get(0x803).desc, texts.sterilization_start_hour);
    assert.equal(registers.get(0x811).desc, L.L28_heatingCurveCoeffK.desc);
    assert.equal(parameterDescription(0x811, lang), undefined);
    assert.equal(registers.get(0x811).multiply, undefined);
    for (const block of blocks.filter((b) => ['blok10_p_uncharted', 'blok11_l_uncharted'].includes(b.id))) {
      assert.equal(block.readOnly, true);
      const writable = dashboard._buildWritableAddressSet();
      assert.ok(block.registers.every((reg) => !writable.has(reg.address)));
    }
  }
  assert.equal(parameterDescription(0x106, 'es-ES'), parameterDescription(0x106, 'en'));
  assert.equal(parameterDescription(0x1234, 'nl'), undefined);
});
