/**
 * Tests for R9 (v3.7.1): the desired indoor temperature from a flow card is limited to 15–25 °C
 * instead of failing the flow (e.g. a thermostat in frost protection sends 7 °C).
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

const { clampIndoorTarget } = require('../../.homeybuild/lib/shared/utils/indoor-target');
const { registerSimpleActions, FLOW_PATTERNS } = require('../../.homeybuild/lib/tuya/flow-helpers');

test('clampIndoorTarget keeps values within 15–25 °C', () => {
  assert.deepStrictEqual(clampIndoorTarget(20.5), { value: 20.5, clamped: false });
  assert.deepStrictEqual(clampIndoorTarget(15), { value: 15, clamped: false });
  assert.deepStrictEqual(clampIndoorTarget(25), { value: 25, clamped: false });
});

test('clampIndoorTarget limits frost protection and too high values', () => {
  assert.deepStrictEqual(clampIndoorTarget(7), { value: 15, clamped: true });
  assert.deepStrictEqual(clampIndoorTarget(28), { value: 25, clamped: true });
});

test('clampIndoorTarget rejects a non-numeric value', () => {
  assert.throws(() => clampIndoorTarget(Number.NaN), /Invalid desired indoor temperature/);
});

function registerTuyaCard(cardId) {
  const listeners = {};
  const logs = [];
  const app = {
    homey: {
      flow: {
        getActionCard: (id) => ({ registerRunListener: (fn) => { listeners[id] = fn; } }),
      },
    },
    log: (msg) => logs.push(msg),
    error: () => {},
  };
  const pattern = FLOW_PATTERNS.simpleActions.find((p) => p.cardId === cardId);
  registerSimpleActions(app, [pattern]);
  return { run: listeners[cardId], logs };
}

function fakeDevice() {
  const calls = [];
  return {
    calls,
    getName: () => 'test',
    hasCapability: () => true,
    setCapabilityValue: async () => {},
    triggerCapabilityListener: async (capability, value) => { calls.push({ capability, value }); },
  };
}

test('Tuya set_desired_indoor_temperature limits 7 °C to 15 °C', async () => {
  const { run, logs } = registerTuyaCard('set_desired_indoor_temperature');
  const device = fakeDevice();
  const result = await run({ device, temperature: 7 }, {});
  assert.strictEqual(result, true);
  assert.deepStrictEqual(device.calls, [{ capability: 'target_temperature.indoor', value: 15 }]);
  assert.ok(logs.some((l) => l.includes('limited to 15')));
});

test('Tuya set_desired_indoor_temperature passes a value within range unchanged', async () => {
  const { run } = registerTuyaCard('set_desired_indoor_temperature');
  const device = fakeDevice();
  await run({ device, temperature: 21 }, {});
  assert.deepStrictEqual(device.calls, [{ capability: 'target_temperature.indoor', value: 21 }]);
});

test('Tuya set_target_temperature is not limited to the indoor range', async () => {
  const { run } = registerTuyaCard('set_target_temperature');
  const device = fakeDevice();
  await run({ device, temperature: 45 }, {});
  assert.deepStrictEqual(device.calls, [{ capability: 'target_temperature', value: 45 }]);
});
