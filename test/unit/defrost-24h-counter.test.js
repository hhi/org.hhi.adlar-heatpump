/**
 * Tests for R17 (v3.7.1): the Aurora I/II defrost counters of the past 24 hours
 * (adlar_defrost_count_24h, adlar_defrost_minutes_24h) are filled from the defrost bit.
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

const { Defrost24hCounter } = require('../../.homeybuild/lib/shared/defrost-24h-counter');
const { ServiceCoordinator: ModbusCoordinator } = require('../../.homeybuild/lib/modbus/services/service-coordinator');

const HOUR = 3600 * 1000;
const T0 = Date.UTC(2026, 10, 8, 12, 0, 0);

test('counter gives number and minutes of the past 24 hours', () => {
  const counter = new Defrost24hCounter();
  counter.record(300, T0 - 2 * HOUR);
  counter.record(150, T0 - HOUR);
  assert.deepStrictEqual(counter.getStats(T0), { count: 2, minutes: 7.5 });
});

test('events older than 24 hours drop out', () => {
  const counter = new Defrost24hCounter();
  counter.record(300, T0 - 25 * HOUR);
  counter.record(120, T0 - HOUR);
  assert.deepStrictEqual(counter.getStats(T0), { count: 1, minutes: 2 });
  assert.deepStrictEqual(counter.getStats(T0 + 24 * HOUR), { count: 0, minutes: 0 });
});

test('restore keeps valid recent events and drops invalid ones', () => {
  const raw = [
    { timestamp: T0 - HOUR, durationSec: 240 },
    { timestamp: T0 - 30 * HOUR, durationSec: 240 },
    { timestamp: 'x', durationSec: 60 },
    { timestamp: T0, durationSec: -5 },
    null,
  ];
  const counter = Defrost24hCounter.restore(raw, T0);
  assert.deepStrictEqual(counter.getEvents(), [{ timestamp: T0 - HOUR, durationSec: 240 }]);
  assert.deepStrictEqual(Defrost24hCounter.restore(undefined, T0).getStats(T0), { count: 0, minutes: 0 });
});

test('an invalid duration is not recorded', () => {
  const counter = new Defrost24hCounter();
  counter.record(Number.NaN, T0);
  counter.record(-1, T0);
  assert.strictEqual(counter.getStats(T0).count, 0);
});

test('Aurora I/II: a completed defrost cycle updates both capabilities and the store', async () => {
  const capabilities = { adlar_defrost_count_24h: null, adlar_defrost_minutes_24h: null };
  const store = {};
  const coordinator = Object.create(ModbusCoordinator.prototype);
  coordinator.logger = () => {};
  coordinator.defrost24h = new Defrost24hCounter();
  coordinator.device = {
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => { capabilities[key] = value; },
    setStoreValue: async (key, value) => { store[key] = value; },
  };
  coordinator._recordDefrost24h(360);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(capabilities.adlar_defrost_count_24h, 1);
  assert.strictEqual(capabilities.adlar_defrost_minutes_24h, 6);
  assert.strictEqual(store.defrost_24h_history.length, 1);
});
