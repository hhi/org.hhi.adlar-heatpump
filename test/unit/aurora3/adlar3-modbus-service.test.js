/**
 * Aurora III register decoding and write paths from the extended HA register map
 * (fault bit fields, Reg 2101 on/off, Reg 2103 read-modify-write, dynamic setpoint limits,
 * thermal power filtering, medium-group snapshots).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  decodeCodeBits,
  setBitFlag,
  encodeSilentMode,
  SilentMode,
} = require('../../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-registers');
const { Adlar3ModbusService } = require('../../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-service');

/** Service with a pre-filled register cache and recorded writes; never opens a socket. */
function createService(registers = {}) {
  const service = new Adlar3ModbusService({ transport: { host: '127.0.0.1' } });
  const cache = service.getRegisterCache();
  for (const [addr, value] of Object.entries(registers)) cache.set(Number(addr), value);
  const writes = [];
  const reads = [];
  service.tcp.writeSingleRegister = async (addr, value) => {
    writes.push([addr, value]);
    cache.set(addr, value & 0xFFFF);
  };
  service.tcp.readHoldingRegisters = async (addr, count) => {
    reads.push([addr, count]);
  };
  return {
    service, cache, writes, reads,
  };
}

test('decodeCodeBits maps bit n of register k to code k*16+n+1', () => {
  assert.deepStrictEqual(decodeCodeBits('E', [0x0004, 0x0001]), ['E03', 'E17']);
  assert.deepStrictEqual(decodeCodeBits('P', [0, 0, 0, 0, 0, 0x8000]), ['P96']);
  assert.deepStrictEqual(decodeCodeBits('E', [0, 0]), []);
});

test('setBitFlag and encodeSilentMode preserve unrelated bits', () => {
  assert.strictEqual(setBitFlag(0x0040, 0x0008, true), 0x0048);
  assert.strictEqual(setBitFlag(0x0048, 0x0008, false), 0x0040);
  assert.strictEqual(encodeSilentMode(0x0068, SilentMode.Level1), 0x0058);
});

test('faults are decoded per bit from Reg 90-101', () => {
  const { service } = createService({ 90: 0x0004, 97: 0x0001 });
  assert.deepStrictEqual(service.getSnapshot().status.activeFaults, ['E03', 'P17']);
});

test('control snapshot decodes Reg 2101/2102/2103 and Reg 9', () => {
  const { service } = createService({
    9: 0x0004, 2100: 2, 2101: 0, 2102: 1, 2103: 0x0068,
  });
  const snap = service.getSnapshot();
  assert.strictEqual(snap.control.on, false);
  assert.strictEqual(snap.control.dhwEnabled, true);
  assert.strictEqual(snap.control.silentMode, 2);
  assert.strictEqual(snap.control.backupHeaterForced, true);
  assert.strictEqual(snap.control.disinfectionEnabled, true);
  assert.strictEqual(snap.status.dhwActive, true);
});

test('on/off falls back to Reg 2100 until Reg 2101 has been read', () => {
  const { service } = createService({ 2100: 2 });
  assert.strictEqual(service.getSnapshot().control.on, true);
});

test('setMainSwitch writes 0 for off and restores the last non-zero zone value', async () => {
  const { service, writes } = createService({ 2101: 2 });
  service.getSnapshot();
  await service.setMainSwitch(false);
  await service.setMainSwitch(true);
  assert.deepStrictEqual(writes, [[2101, 0], [2101, 2]]);
});

test('setMainSwitch defaults to zone 1 or both zones depending on Reg 2', async () => {
  const single = createService({ 2: 0, 2101: 0 });
  await single.service.setMainSwitch(true);
  const dual = createService({ 2: 1, 2101: 0 });
  await dual.service.setMainSwitch(true);
  assert.deepStrictEqual(single.writes, [[2101, 1]]);
  assert.deepStrictEqual(dual.writes, [[2101, 3]]);
});

test('Reg 2103 features re-read the register and keep other bits', async () => {
  const { service, writes, reads } = createService({ 2103: 0x0048 });
  await service.setFeature('silent_mode', 1);
  await service.setFeature('backup_heater_forced', 0);
  assert.deepStrictEqual(reads, [[2103, 1], [2103, 1]]);
  assert.deepStrictEqual(writes, [[2103, 0x0058], [2103, 0x0050]]);
  await assert.rejects(() => service.setFeature('silent_mode', 3));
});

test('DHW on/off writes Reg 2102', async () => {
  const { service, writes } = createService();
  await service.setFeature('dhw_enabled', 1);
  await service.setFeature('dhw_enabled', 0);
  assert.deepStrictEqual(writes, [[2102, 1], [2102, 0]]);
});

test('DHW setpoint follows active limits Reg 14/15, with static fallback', async () => {
  const limited = createService({ 14: 550, 15: 300 });
  await assert.rejects(() => limited.service.setTemperature('dhw', 60), /actief bereik 30–55/);
  await limited.service.setTemperature('dhw', 50);
  await assert.rejects(() => limited.service.writeRegister(2105, 600), /actief bereik/);
  assert.deepStrictEqual(limited.writes, [[2105, 500]]);

  const fallback = createService();
  await fallback.service.setTemperature('dhw', 70);
  await assert.rejects(() => fallback.service.setTemperature('dhw', 80));
});

test('implausible limit registers are ignored', async () => {
  const { service, writes } = createService({ 14: 0, 15: 0 });
  await service.setTemperature('dhw', 50);
  assert.deepStrictEqual(writes, [[2105, 500]]);
});

test('thermal power is 0 during defrost and with low flow', () => {
  const base = {
    42: 300, 43: 350, 64: 12, 74: 230, 75: 50, 79: 50,
  };
  const heating = createService(base).service.getSnapshot().cop;
  assert.strictEqual(heating.thermalMode, 'heating');
  assert.ok(heating.thermalPowerKw > 6.9 && heating.thermalPowerKw < 7.0);
  assert.strictEqual(heating.valid, true);

  const defrost = createService({
    ...base, 38: 0x0002, 42: 350, 43: 300,
  }).service.getSnapshot().cop;
  assert.strictEqual(defrost.thermalPowerKw, 0);
  assert.strictEqual(defrost.valid, false);

  const lowFlow = createService({ ...base, 64: 2 }).service.getSnapshot().cop;
  assert.strictEqual(lowFlow.thermalPowerKw, 0);
  assert.strictEqual(lowFlow.valid, false);
});

test('zero AC voltage/current while compressor runs invalidates COP with a reason', () => {
  const { cop } = createService({
    42: 300, 43: 350, 64: 12, 74: 0, 75: 0, 79: 50,
  }).service.getSnapshot();
  assert.strictEqual(cop.valid, false);
  assert.match(cop.reason, /74\/75/);
});

test('medium poll emits a medium snapshot once a fast snapshot exists', () => {
  const { service } = createService({ 2101: 1 });
  const sources = [];
  service.on('data', (snap) => sources.push(snap.sourcePollGroup));
  service.on('poll-group-succeeded', () => {});
  service.tcp.emit('poll-complete', 'medium');
  service.tcp.emit('poll-complete', 'fast');
  service.tcp.emit('poll-complete', 'medium');
  service.tcp.emit('poll-partial', 'medium');
  assert.deepStrictEqual(sources, ['fast', 'medium', 'medium']);
});

test('control snapshot reports the allowed DHW setpoint range', () => {
  assert.deepStrictEqual(createService({ 14: 550, 15: 300 }).service.getSnapshot().control.dhwSetpointRange, { min: 30, max: 55 });
  assert.deepStrictEqual(createService().service.getSnapshot().control.dhwSetpointRange, { min: 20, max: 75 });
});

test('silent mode level 2 is only written on R290 units (Reg 7 = 1)', async () => {
  const r32 = createService({ 7: 0, 2103: 0 });
  await assert.rejects(() => r32.service.setFeature('silent_mode', 2), /R290/);
  await r32.service.setFeature('silent_mode', 1);
  assert.deepStrictEqual(r32.writes, [[2103, 0x0010]]);
  assert.strictEqual(r32.service.getSnapshot().control.silentLevel2Allowed, false);

  const unknown = createService({ 2103: 0 });
  await assert.rejects(() => unknown.service.setFeature('silent_mode', 2), /R290/);

  const r290 = createService({ 7: 1, 2103: 0 });
  await r290.service.setFeature('silent_mode', 2);
  assert.deepStrictEqual(r290.writes, [[2103, 0x0020]]);
  assert.strictEqual(r290.service.getSnapshot().control.silentLevel2Allowed, true);
});
