/**
 * ADR-067 D1: the settings of the COP optimizer and the highest pre-heat of the price optimizer
 * reach the optimizers at construction (so they survive a restart) and when changed, in all
 * three drivers.
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

const {
  resolveCopMinAcceptable,
  resolveCopTarget,
  resolveCopStrategy,
  resolveMaxPreHeatOffset,
  resolveCopOptimizerSettings,
} = require('../../.homeybuild/lib/shared/adaptive/optimizer-settings');
const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

const DRIVERS = [['Tuya', TuyaService], ['Aurora II', ModbusService], ['Aurora III', Aurora3Service]];

function createDevice(settings = {}) {
  const store = {};
  const capabilities = { target_temperature: 35 };
  return {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      setInterval: () => ({ mocked: true }),
      clearInterval: () => {},
      setTimeout: () => ({ mocked: true }),
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
    getSetting: (key) => settings[key],
    getStoreValue: (key) => store[key],
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => { capabilities[key] = value; },
    setCapabilityOptions: async () => {},
    getOutdoorTemperatureWithFallback: () => 5,
    error: () => {},
  };
}

/** What the optimizers of a service work with. */
function optimizerValues(service) {
  const { minAcceptableCOP, targetCOP, strategy } = service.copOptimizer.getDiagnostics().configuration;
  return {
    minAcceptableCOP, targetCOP, strategy, maxPreHeatOffset: service.energyOptimizer.config.maxPreHeatOffset,
  };
}

test('a missing or unusable setting falls back to the default', () => {
  assert.strictEqual(resolveCopMinAcceptable(undefined), 2.5);
  assert.strictEqual(resolveCopMinAcceptable(null), 2.5);
  assert.strictEqual(resolveCopMinAcceptable(Number.NaN), 2.5);
  assert.strictEqual(resolveCopMinAcceptable(3.1), 3.1);
  assert.strictEqual(resolveCopTarget(undefined), 3.5);
  assert.strictEqual(resolveCopTarget('4'), 3.5, 'only numbers count');
  assert.strictEqual(resolveCopTarget(4.2), 4.2);
  assert.strictEqual(resolveCopStrategy(undefined), 'balanced');
  assert.strictEqual(resolveCopStrategy('fast'), 'balanced');
  assert.strictEqual(resolveCopStrategy('aggressive'), 'aggressive');
  assert.strictEqual(resolveCopStrategy('conservative'), 'conservative');
  assert.strictEqual(resolveMaxPreHeatOffset(undefined), 1.5);
  assert.strictEqual(resolveMaxPreHeatOffset(0), 0, 'zero is a real choice: no pre-heat');
  assert.strictEqual(resolveMaxPreHeatOffset(3), 3);
  assert.strictEqual(resolveMaxPreHeatOffset(-1), 0);
});

test('resolveCopOptimizerSettings reads the three COP settings', () => {
  const settings = { cop_min_acceptable: 2.0, cop_target: 4.0, cop_strategy: 'conservative' };
  assert.deepStrictEqual(resolveCopOptimizerSettings((key) => settings[key]), {
    minAcceptableCOP: 2.0, targetCOP: 4.0, strategy: 'conservative',
  });
  assert.deepStrictEqual(resolveCopOptimizerSettings(() => undefined), {
    minAcceptableCOP: 2.5, targetCOP: 3.5, strategy: 'balanced',
  });
});

for (const [name, Service] of DRIVERS) {
  test(`${name}: a new service starts with the stored settings`, () => {
    const service = new Service({
      device: createDevice({
        cop_min_acceptable: 2.1, cop_target: 4.4, cop_strategy: 'aggressive', price_max_preheat_offset: 2.5,
      }),
      logger: () => {},
    });
    assert.deepStrictEqual(optimizerValues(service), {
      minAcceptableCOP: 2.1, targetCOP: 4.4, strategy: 'aggressive', maxPreHeatOffset: 2.5,
    });
  });

  test(`${name}: a device without these settings starts with the defaults`, () => {
    const service = new Service({ device: createDevice(), logger: () => {} });
    assert.deepStrictEqual(optimizerValues(service), {
      minAcceptableCOP: 2.5, targetCOP: 3.5, strategy: 'balanced', maxPreHeatOffset: 1.5,
    });
  });

  test(`${name}: a changed setting reaches the optimizer, read from the new settings`, async () => {
    // getSetting keeps returning the old values, as Homey does while onSettings runs
    const service = new Service({ device: createDevice(), logger: () => {} });
    await service.onSettings(
      {},
      {
        cop_min_acceptable: 3.0, cop_target: 4.5, cop_strategy: 'conservative', price_max_preheat_offset: 0.5,
      },
      ['cop_min_acceptable', 'cop_target', 'cop_strategy', 'price_max_preheat_offset'],
    );
    assert.deepStrictEqual(optimizerValues(service), {
      minAcceptableCOP: 3.0, targetCOP: 4.5, strategy: 'conservative', maxPreHeatOffset: 0.5,
    });
  });

  test(`${name}: the strategy sets the step below the minimum COP`, async () => {
    const service = new Service({ device: createDevice({ cop_strategy: 'aggressive' }), logger: () => {} });
    const action = await service.copOptimizer.calculateAction(2.0, 2.0, 5, 40);
    assert.strictEqual(action.magnitude, 3, 'aggressive: 3 °C lower');
    await service.onSettings({}, { cop_strategy: 'balanced' }, ['cop_strategy']);
    const balanced = await service.copOptimizer.calculateAction(2.0, 2.0, 5, 40);
    assert.strictEqual(balanced.magnitude, 2, 'balanced: 2 °C lower');
  });
}

// ADR-067 D3: all three services round the positional recommendation with hysteresis
for (const [name, Service] of DRIVERS) {
  test(`${name}: the positional recommendation holds around a half and still respects the range`, () => {
    const ctx = { lastRecommendedTemp: 41, lastRawRecommendation: null, _clampRecommendation: (value) => Math.min(value, 45) };
    const recommend = (basis, correction) => Service.prototype._positionalRecommendation.call(ctx, { value: basis, source: 'app_curve' }, correction);
    assert.strictEqual(recommend(45.6, -4.0), 41, '41.6 stays 41 (plain rounding gave 42)');
    assert.strictEqual(ctx.lastRawRecommendation, 45.6 - 4.0, 'the unrounded value is kept for the at-limit rule');
    assert.strictEqual(recommend(45.6, -3.8), 42, '41.8 moves to 42');
    ctx.lastRecommendedTemp = undefined;
    assert.strictEqual(recommend(45.6, -4.0), 42, 'first cycle: plain rounding');
    ctx.lastRecommendedTemp = 47;
    assert.strictEqual(recommend(50, -3.4), 45, 'a kept value above the range is clamped');
  });
}

