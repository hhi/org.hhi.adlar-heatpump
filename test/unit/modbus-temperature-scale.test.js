/**
 * Temperature scale from two sources: P119 = R32 decides x1, the heating setpoint (0x0301) checks it.
 * With another refrigerant the setpoint decides. When R32 meets a setpoint in tenths, x1 stays for
 * reading and temperature writes are blocked until the next connection.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { Adlar2ModbusService } = require('../../.homeybuild/lib/modbus/protocol/adlar2-modbus-service');
const {
  resolveTemperatureScale,
  temperatureScaleFromSetpoint,
} = require('../../.homeybuild/lib/modbus/protocol/adlar-modbus-registers');

test('temperatureScaleFromSetpoint: whole degrees, tenths, or unknown', () => {
  assert.strictEqual(temperatureScaleFromSetpoint(45), 'x1');
  assert.strictEqual(temperatureScaleFromSetpoint(450), 'x10');
  assert.strictEqual(temperatureScaleFromSetpoint(0), null);
  assert.strictEqual(temperatureScaleFromSetpoint(95), null);
});

test('resolveTemperatureScale: R32 decides x1, the setpoint checks', () => {
  assert.deepStrictEqual(resolveTemperatureScale(2, 45, 'x1'), {
    scale: 'x1', source: 'refrigerant', conflict: false, setpointScale: 'x1',
  });
  assert.deepStrictEqual(resolveTemperatureScale(2, 450, 'x1'), {
    scale: 'x1', source: 'refrigerant', conflict: true, setpointScale: 'x10',
  });
  assert.deepStrictEqual(resolveTemperatureScale(2, null, 'x10'), {
    scale: 'x1', source: 'refrigerant', conflict: false, setpointScale: null,
  });
});

test('resolveTemperatureScale: another refrigerant follows the setpoint, else keeps the scale', () => {
  assert.strictEqual(resolveTemperatureScale(3, 450, 'x1').scale, 'x10');
  assert.strictEqual(resolveTemperatureScale(3, 45, 'x10').scale, 'x1');
  assert.deepStrictEqual(resolveTemperatureScale(1, 0, 'x1'), {
    scale: 'x1', source: 'unchanged', conflict: false, setpointScale: null,
  });
});

function createService(setpointRaw, { readFails = false } = {}) {
  const service = new Adlar2ModbusService({ transport: { host: '127.0.0.1' } });
  const writes = [];
  service.tcp.writeSingleRegister = async (addr, value) => {
    writes.push([addr, value]);
  };
  service.tcp.readHoldingRegisters = async () => {
    if (readFails) throw new Error('timeout');
  };
  if (setpointRaw !== null) service.tcp.cache.set(0x0301, setpointRaw);
  const errors = [];
  service.on('error', (err, ctx) => errors.push([ctx, err.message]));
  return { service, writes, errors };
}

test('R32 with a setpoint in whole degrees: x1, writes allowed, no message', async () => {
  const { service, writes, errors } = createService(45);
  await service.detectTemperatureScale(2);
  assert.strictEqual(service.activeTemperatureScale, 'x1');
  assert.strictEqual(service.temperatureScaleBlocked, null);
  await service.setTemperature('heating', 40);
  assert.deepStrictEqual(writes, [[0x0301, 40]]);
  assert.deepStrictEqual(errors, []);
});

test('R32 with a setpoint in tenths: x1 for reading, temperature writes blocked', async () => {
  const { service, writes, errors } = createService(450);
  await service.detectTemperatureScale(2);
  assert.strictEqual(service.activeTemperatureScale, 'x1');
  assert.match(service.temperatureScaleBlocked, /P119=2/);
  await assert.rejects(() => service.setTemperature('heating', 40), /geblokkeerd/);
  await assert.rejects(() => service.setDiyHeatingCurve(-0.5, 55), /geblokkeerd/);
  await assert.rejects(() => service.writeRegister(0x0301, 40), /geblokkeerd/);
  await service.writeRegister(0x0304, 1); // not a temperature register: still allowed
  assert.deepStrictEqual(writes, [[0x0304, 1]]);
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0][0], 'validate:temperature-scale');
});

test('the block lifts when the next connection finds both sources in agreement', async () => {
  const { service, writes } = createService(450);
  await service.detectTemperatureScale(2);
  service.tcp.cache.set(0x0301, 45);
  await service.detectTemperatureScale(2);
  assert.strictEqual(service.temperatureScaleBlocked, null);
  await service.setTemperature('heating', 40);
  assert.deepStrictEqual(writes, [[0x0301, 40]]);
});

test('R32 with an unreadable setpoint: x1 on P119 alone, with a message', async () => {
  const { service, errors } = createService(null, { readFails: true });
  await service.detectTemperatureScale(2);
  assert.strictEqual(service.activeTemperatureScale, 'x1');
  assert.strictEqual(service.temperatureScaleBlocked, null);
  assert.deepStrictEqual(errors.map(([ctx]) => ctx), ['validate:temperature-scale']);
});

test('R290 follows the setpoint: tenths give x10 without a block', async () => {
  const { service, writes } = createService(450);
  await service.detectTemperatureScale(3);
  assert.strictEqual(service.activeTemperatureScale, 'x10');
  assert.strictEqual(service.temperatureScaleBlocked, null);
  await service.setTemperature('heating', 40);
  assert.deepStrictEqual(writes, [[0x0301, 400]]);
});
