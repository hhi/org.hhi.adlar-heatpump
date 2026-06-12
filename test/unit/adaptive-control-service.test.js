/**
 * Service-level tests for AdaptiveControlService accumulator/settlement and
 * coast state helpers. Uses compiled output with Homey/device test doubles.
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

const { AdaptiveControlService } = require('../../.homeybuild/lib/services/adaptive-control-service');

function createHomey(flowEvents) {
  return {
    __: (key) => key,
    i18n: { getLanguage: () => 'en' },
    setInterval: () => ({ mocked: true }),
    clearInterval: () => {},
    setTimeout: (fn) => {
      if (typeof fn === 'function') fn();
      return { mocked: true };
    },
    flow: {
      getDeviceTriggerCard: (id) => ({
        trigger: async (_device, tokens) => {
          flowEvents.push({ id, tokens });
        },
      }),
    },
  };
}

function createDevice() {
  const flowEvents = [];
  const settings = {
    adaptive_min_setpoint: 18,
    adaptive_cooldown_hysteresis: 0.3,
    adaptive_cooldown_offset: 1.0,
    adaptive_cooldown_strength: 0.8,
    adaptive_cooldown_max_cycles: 24,
    price_optimizer_enabled: false,
    cop_optimizer_enabled: false,
    wind_correction_enabled: false,
    enable_weather_forecast: false,
  };
  const capabilities = {
    target_temperature: 35,
    'target_temperature.indoor': 20,
    'measure_temperature.outlet': 43.5,
    adlar_simulated_target: 35,
  };
  const store = {};

  const device = {
    homey: createHomey(flowEvents),
    flowEvents,
    settings,
    capabilities,
    store,
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
  return device;
}

function createService(device, adjustments = []) {
  const logs = [];
  const service = new AdaptiveControlService({
    device,
    logger: (...args) => { logs.push(args); },
  });
  service.__testLogs = logs;
  service.isEnabled = true;
  service.externalTemperature = { getIndoorTemperature: () => 20 };
  service.weatherForecast = {
    getTempAt: () => null,
    hasFreshForecast: () => true,
    updateForecast: async () => {},
    calculateAdvice: () => null,
  };
  service.buildingModel = {
    getDiagnosticStatus: async () => ({ confidence: 0 }),
    getLearner: () => ({
      getModel: () => ({
        C: 15, UA: 0.3, g: 0.5, pInt: 0.3, tau: 50, confidence: 0,
      }),
    }),
    calculateThermalAdjustment: () => ({ adjustment: 0, reason: 'test thermal', priority: 'low' }),
  };
  service.energyOptimizer = {
    getPriceData: () => [],
    calculateAction: () => null,
    setThermalCapacity: () => {},
  };
  service.windCorrection = {
    calculateCorrection: () => ({ correction: 0, windSpeed: 0, deltaT: 0, alpha: 0, alphaSource: 'test', capped: false }),
  };
  service.copOptimizer = {
    calculateAction: () => null,
    addMeasurement: () => {},
    getDiagnostics: () => ({
      samplesCollected: 0,
      historyCapacity: 1000,
      fillPercentage: 0,
      bucketsLearned: 0,
      bucketDetails: [],
      configuration: {
        minAcceptableCOP: 2.5,
        targetCOP: 3.5,
        strategy: 'balanced',
        tempRange: 'test',
      },
    }),
  };

  let i = 0;
  service.decisionMaker = {
    combineActionsWithThermal: () => {
      const finalAdjustment = adjustments[Math.min(i, adjustments.length - 1)] ?? 0;
      i++;
      return {
        finalAdjustment,
        priority: 'medium',
        reasoning: ['test decision'],
        breakdown: {
          comfort: finalAdjustment, efficiency: 0, cost: 0, thermal: 0, coast: 0, wind: 0,
        },
        effectiveWeights: {
          comfort: 0.6, efficiency: 0, cost: 0, thermal: 0, coast: 0,
        },
      };
    },
  };
  return service;
}

test('AdaptiveControlService accumulates fractional advice and settles applied recommendations', async () => {
  const device = createDevice();
  const service = createService(device, [0.4, 0.4, 0]);

  await service.executeControlCycle();
  assert.ok(Math.abs(service.accumulatedAdjustment - 0.4) < 1e-9,
    `expected accumulator 0.4 after first cycle, got ${service.accumulatedAdjustment}; logs=${JSON.stringify(service.__testLogs)}`);
  assert.strictEqual(service.lastRecommendedTemp, 35);

  await service.executeControlCycle();
  assert.ok(Math.abs(service.accumulatedAdjustment - 0.8) < 1e-9,
    `expected accumulator 0.8 after second cycle, got ${service.accumulatedAdjustment}`);
  assert.strictEqual(service.lastRecommendedTemp, 36);
  assert.strictEqual(device.capabilities.adlar_simulated_target, 36);

  device.capabilities.target_temperature = 36;
  await service.executeControlCycle();
  assert.ok(Math.abs(service.accumulatedAdjustment + 0.2) < 1e-9,
    `settled accumulator should be -0.2, got ${service.accumulatedAdjustment}`);
});

test('AdaptiveControlService leaves accumulator untouched on manual setpoint changes', async () => {
  const device = createDevice();
  const service = createService(device, [0]);
  service.accumulatedAdjustment = 1.2;
  service.lastObservedSetpoint = 35;
  service.lastRecommendedTemp = 36;
  device.capabilities.target_temperature = 38;

  await service.executeControlCycle();
  assert.ok(Math.abs(service.accumulatedAdjustment - 1.2) < 1e-9,
    `manual change must not settle accumulator, got ${service.accumulatedAdjustment}`);
});

test('AdaptiveControlService coast helpers enforce activation, step limit and exits', () => {
  const device = createDevice();
  const service = createService(device, [0]);

  service._recordIndoorTemp(21.35);
  assert.strictEqual(service._isCooldownConfirmed(21.35, 21.0), false, 'first hot cycle only arms cooldown');
  service._recordIndoorTemp(21.42);
  assert.strictEqual(service._isCooldownConfirmed(21.42, 21.0), true, 'second hot/rising cycle confirms cooldown');

  device.capabilities.target_temperature = 45;
  device.capabilities['measure_temperature.outlet'] = 60;
  const coast = service._computeCoastAdjustment(45);
  assert.ok(coast.adj <= 0, 'coast adjustment must never heat');
  assert.ok(coast.adj >= -1.5, `coast step limit must hold, got ${coast.adj}`);

  assert.strictEqual(service._isCooldownExitCondition(21.1, 21.0), true, 'hard exit below half hysteresis');

  service._indoorTempHistory = [21.6, 21.4, 21.2];
  assert.strictEqual(service._isStaleCoast(-0.2), true, 'falling room + negligible coast triggers soft exit');
  assert.strictEqual(service._isStaleCoast(-0.8), false, 'large coast adjustment is not stale');
});
