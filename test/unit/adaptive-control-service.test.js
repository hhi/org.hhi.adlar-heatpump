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

const { AdaptiveControlService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');

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
    setStoreValue: async (key, value) => {
      store[key] = value;
    },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => {
      capabilities[key] = value;
    },
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
    logger: (...args) => {
      logs.push(args);
    },
  });
  service.__testLogs = logs;
  service.isEnabled = true;
  service.externalTemperature = { getIndoorTemperature: () => 20, getIndoorStaleness: () => 'fresh' };
  service.weatherForecast = {
    getTempAt: () => null,
    isLocationUserSet: () => false, // v3.7.1 (R21)
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
    applyLearningSettings: async () => {}, // ADR-066: a control-mode change updates the emitter delay
  };
  service.energyOptimizer = {
    getPriceData: () => [],
    calculateAction: () => null,
    setThermalCapacity: () => {},
  };
  service.windCorrection = {
    calculateCorrection: () => ({
      correction: 0, windSpeed: 0, deltaT: 0, alpha: 0, alphaSource: 'test', capped: false,
    }),
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

test('AdaptiveControlService caps recommendations at adaptive_max_setpoint', async () => {
  const device = createDevice();
  device.settings.adaptive_max_setpoint = 36;
  const service = createService(device, [2, 0]);

  await service.executeControlCycle();
  assert.strictEqual(service.lastRecommendedTemp, 36, 'advice 35 + 2 must be capped at the configured maximum');
  assert.strictEqual(device.capabilities.adlar_simulated_target, 36);
});

test('AdaptiveControlService falls back to the hard maximum without adaptive_max_setpoint', async () => {
  const device = createDevice();
  device.capabilities.target_temperature = 64;
  const service = createService(device, [2, 0]);

  await service.executeControlCycle();
  assert.strictEqual(service.lastRecommendedTemp, 65, 'without the setting the Tuya hard maximum of 65°C applies');
});

test('AdaptiveControlService passes a changed adaptive_max_setpoint to the COP optimizer', async () => {
  const device = createDevice();
  const service = createService(device, [0]);
  const received = [];
  service.copOptimizer.updateMaxSupplyTemp = (value) => received.push(value);

  await service.onSettings({}, { adaptive_max_setpoint: 32 }, ['adaptive_max_setpoint']);
  await service.onSettings({}, { adaptive_max_setpoint: 65 }, ['adaptive_max_setpoint']);
  assert.deepStrictEqual(received, [32, 55], 'COP optimizer range follows the maximum, never above 55°C');
});

// ADR-065: positional mode

/** Decision maker that passes the comfort share through, as the real one does without optimizers or coast. */
function passThroughDecisionMaker() {
  return {
    getComfortAnchor: () => 0.6,
    combineActionsWithThermal: (heating) => {
      const comfort = (heating?.temperatureAdjustment ?? 0) * 0.6;
      return {
        finalAdjustment: comfort,
        priority: 'medium',
        reasoning: ['test decision'],
        breakdown: {
          comfort, efficiency: 0, cost: 0, thermal: 0, coast: 0, wind: 0,
        },
        effectiveWeights: {
          comfort: 0.6, efficiency: 0, cost: 0, thermal: 0, coast: 0,
        },
      };
    },
  };
}

function createPositionalService(device, indoor) {
  device.settings.adaptive_control_mode ??= 'positional_manual';
  const service = createService(device, [0]);
  service.decisionMaker = passThroughDecisionMaker();
  service.externalTemperature = { getIndoorTemperature: () => indoor, getIndoorStaleness: () => 'fresh' };
  return service;
}

test('ADR-065: positional advice is basis + PI output, without the accumulator', async () => {
  const device = createDevice();
  device.settings.adaptive_control_mode = 'positional_radiator';
  const service = createPositionalService(device, 19.5);
  service.getEffectiveOutdoorTemp = async () => null; // no outdoor temperature: flat basis

  await service.executeControlCycle();
  // flat basis = setpoint 35 at activation; u = 3·0.5 + 0.5·3/36 ≈ 1.54 → 36.54 → 37
  assert.strictEqual(service.lastRecommendedTemp, 37);
  assert.strictEqual(device.capabilities.adlar_simulated_target, 37);
  assert.strictEqual(device.store.adaptive_positional_flat_basis, 35);
  assert.ok(Math.abs(device.store.adaptive_positional_integral - (0.5 * 3) / 36) < 1e-9, 'integral persisted');
  assert.strictEqual(service.accumulatedAdjustment, 0, 'accumulator untouched');
});

test('ADR-065: switching from classic to positional resets the accumulator', async () => {
  const device = createDevice();
  const service = createService(device, [0.4]);
  await service.executeControlCycle();
  assert.ok(service.accumulatedAdjustment > 0.39, 'classic cycle accrued');

  device.settings.adaptive_control_mode = 'positional_manual';
  service.decisionMaker = passThroughDecisionMaker();
  await service.executeControlCycle();
  assert.strictEqual(service.accumulatedAdjustment, 0);
  assert.strictEqual(device.store.adaptive_accumulated_adjustment, 0);
  assert.strictEqual(device.store.adaptive_control_mode_last, 'positional');
});

test('ADR-065: both presets keep coast off (3.5.2), Manual follows the coast switch', async () => {
  for (const [emitter, expected] of [['radiator', false], ['floor', false], ['manual', true]]) {
    const device = createDevice();
    device.settings.adaptive_control_mode = `positional_${emitter}`;
    const service = createPositionalService(device, 21.5);
    for (let i = 0; i < 3; i++) await service.executeControlCycle();
    assert.strictEqual(service._coastActive, expected, emitter);
  }
});

test('ADR-065: app heating curve as basis', async () => {
  const device = createDevice();
  Object.assign(device.settings, {
    adaptive_curve_source: 'app', adaptive_curve_at_minus15: 40, adaptive_curve_at_plus15: 25,
  });
  const service = createPositionalService(device, 20);

  await service.executeControlCycle();
  // outdoor 5 °C: 40 − 0.5·20 = 30; no error, so no correction
  assert.strictEqual(service.lastRecommendedTemp, 30);
  assert.strictEqual(service.lastBasis.source, 'app_curve');
});

/** Decision maker with a fixed weighted price contribution; records every call. */
function priceDecisionMaker(cost, calls) {
  return {
    getComfortAnchor: () => 0.6,
    combineActionsWithThermal: (heating, cop, price, thermal, metrics) => {
      calls.push({ heating, thermal, metrics });
      const comfort = (heating?.temperatureAdjustment ?? 0) * 0.6;
      return {
        finalAdjustment: comfort + cost,
        priority: 'medium',
        reasoning: [],
        breakdown: {
          comfort, efficiency: 0, cost, thermal: 0, coast: 0, wind: 0,
        },
        effectiveWeights: {
          comfort: 0.6, efficiency: 0, cost: 0.4, thermal: 0, coast: 0,
        },
      };
    },
  };
}

test('ADR-065 O14/O16: price shifts the room target, the basis follows and the thermal component stays out', async () => {
  const device = createDevice();
  Object.assign(device.settings, {
    adaptive_curve_source: 'app', adaptive_curve_at_minus15: 40, adaptive_curve_at_plus15: 25,
  });
  const service = createPositionalService(device, 20);
  const calls = [];
  service.decisionMaker = priceDecisionMaker(-0.4, calls);
  // ADR-067 D10: a new shift is approached at 0.24 °C per hour
  await service.executeControlCycle();
  assert.ok(Math.abs(service.lastTargetShift + 0.02) < 1e-9, 'first cycle: 0.02 °C of the −0.4');
  assert.ok(Math.abs(service.lastFeedforward + 0.03) < 1e-9, 'the basis follows the limited shift');

  // The shift reached: the state after 100 minutes at this price
  service.lastTargetShift = -0.4;
  service.lastRecommendedTemp = undefined;
  service.lastRawRecommendation = null;
  device.store.adaptive_positional_integral = 0;
  service.positionalPI.reset();
  calls.length = 0;
  await service.executeControlCycle();
  // basis 30 (outdoor 5 °C); room target 20 − 0.4: P 3·(−0.4) = −1.2, I −0.4·3/36;
  // the basis follows (1 + 15/30)·(−0.4) = −0.6 → 30 − 0.6 − 1.233 = 28.17 → 28
  assert.strictEqual(service.lastRecommendedTemp, 28);
  assert.ok(Math.abs(service.lastTargetShift + 0.4) < 1e-9, 'room target shift');
  assert.ok(Math.abs(service.lastFeedforward + 0.6) < 1e-9, 'basis feed-forward');
  assert.ok(Math.abs(device.store.adaptive_positional_integral + (0.4 * 3) / 36) < 1e-9, 'integral on the shifted target');
  assert.strictEqual(calls.length, 2, 'optimizers first, then with the PI');
  assert.strictEqual(calls[0].heating, null);
  assert.ok(calls.every((c) => c.thermal === null && c.metrics.thermalExcluded === true), 'thermal component left out');
  const control = service._getControlDiagnostics();
  assert.strictEqual(control.targetShift, -0.4);
  assert.strictEqual(control.feedforward, -0.6);
});

test('ADR-065 O14: classic keeps the optimizers on the recommendation and the thermal component', async () => {
  const device = createDevice();
  const service = createService(device, [0]);
  const calls = [];
  service.decisionMaker = priceDecisionMaker(-0.4, calls);

  await service.executeControlCycle();
  assert.strictEqual(calls.length, 1);
  assert.notStrictEqual(calls[0].thermal, null);
  assert.strictEqual(calls[0].metrics.thermalExcluded, undefined);
  assert.strictEqual(service.lastTargetShift, 0);
});

test('ADR-062 A4: model parameters reach the PI and the price optimizer only from 50% confidence', async () => {
  const { BUILDING_PROFILES } = require('../../.homeybuild/lib/shared/adaptive/building-model-learner');
  for (const [confidence, expectedC] of [[30, BUILDING_PROFILES.average.C], [80, 15]]) {
    const device = createDevice();
    const service = createService(device, [0]);
    service.buildingModel.getDiagnosticStatus = async () => ({ confidence });
    let capacity = null;
    service.energyOptimizer.setThermalCapacity = (c) => { capacity = c; };
    await service.executeControlCycle();
    assert.strictEqual(capacity, expectedC, `confidence ${confidence}`);
  }
});

test('ADR-065: choosing a positional preset prefills the app curve until the user sets it himself', async () => {
  const device = createDevice();
  device.setSettings = async (values) => { Object.assign(device.settings, values); };
  const service = createService(device, [0]);

  await service.onSettings({}, { adaptive_control_mode: 'positional_floor' }, ['adaptive_control_mode']);
  assert.strictEqual(device.settings.adaptive_curve_at_minus15, 35);
  assert.strictEqual(device.settings.adaptive_curve_at_plus15, 27);

  await service.onSettings({}, { adaptive_control_mode: 'positional_radiator' }, ['adaptive_control_mode']);
  assert.strictEqual(device.settings.adaptive_curve_at_minus15, 50, 'a new preset replaces the prefilled values');

  await service.onSettings({}, { adaptive_curve_at_minus15: 55 }, ['adaptive_curve_at_minus15']);
  device.settings.adaptive_curve_at_minus15 = 55;
  await service.onSettings({}, { adaptive_control_mode: 'positional_floor' }, ['adaptive_control_mode']);
  assert.strictEqual(device.settings.adaptive_curve_at_minus15, 55, 'the user value stays');
  assert.strictEqual(device.store.adaptive_curve_user_set, true);
});

test('v3.5.1: without a valid COP measurement the COP optimizer gives no advice', async () => {
  const device = createDevice();
  device.settings.cop_optimizer_enabled = true;
  const service = createService(device, [0, 0, 0]);
  service.getEffectiveOutdoorTemp = async () => 5;
  const calls = [];
  service.copOptimizer.calculateAction = (...args) => { calls.push(args); return null; };

  await service.executeControlCycle(); // adlar_cop not calculated yet (null)
  device.capabilities.adlar_cop = 0; // compressor off, outlier or failed calculation
  await service.executeControlCycle();
  assert.strictEqual(calls.length, 0);

  device.capabilities.adlar_cop = 3.1; // valid COP, daily COP still unknown
  await service.executeControlCycle();
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].slice(0, 2), [3.1, 3.1]);
});
