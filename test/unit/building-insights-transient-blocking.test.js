/**
 * v3.4.3: transient blocking reasons (no COP, defrost, hot water, aux heating) are shown in
 * building insights only once they persist (6 consecutive blocked cycles = 30 min). Reasons
 * that need user action (missing source, learning disabled) are shown immediately.
 * Runs against the compiled building model and insights services of all three drivers.
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
  shouldShowBlocked, isTransientBlockingKey, TRANSIENT_BLOCK_CYCLES,
} = require('../../.homeybuild/lib/shared/adaptive/building-model-blocking');

// Heating-mode capability value per driver (see the mode gate in building-model-service.ts)
const HEATING_MODE = {
  tuya: { adlar_enum_mode: 'heating' },
  modbus: { adlar_mode: '1' },
  aurora3: { adlar_mode_aurora3: '2', adlar_dhw_active: false },
};

/** Device mock with mutable capabilities and indoor temperature for collectAndLearn() */
function mockDevice(driver) {
  const env = {
    indoor: 20.1,
    capabilities: {
      ...HEATING_MODE[driver],
      adlar_state_defrost_state: false,
      adlar_state_compressor_state: true,
      adlar_cop: 3.5,
    },
  };
  const store = {};
  const device = {
    serviceCoordinator: {
      getAdaptiveControl: () => ({
        getExternalTemperatureService: () => ({ getIndoorTemperature: () => env.indoor }),
      }),
      getEnergyTracking: () => ({ getCurrentPowerMeasurement: () => ({ value: 1200 }) }),
    },
    getSetting: (key) => ({ building_model_enabled: true, building_model_forgetting_factor: 0.999 })[key] ?? null,
    getStoreValue: async (key) => store[key] ?? null,
    setStoreValue: async (key, value) => {
      store[key] = value;
    },
    getCapabilityValue: (key) => env.capabilities[key] ?? null,
    hasCapability: () => false,
    getOutdoorTemperatureWithFallback: () => 5.0,
    homey: {
      setInterval: () => 0,
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
  };
  return { device, env };
}

function createModelService(driver) {
  const { BuildingModelService } = require(`../../.homeybuild/lib/${driver}/services/building-model-service`);
  const { device, env } = mockDevice(driver);
  const service = new BuildingModelService({ device, buildingProfile: 'average', logger: () => {} });
  return { service, env };
}

function createInsightsService(driver) {
  const { BuildingInsightsService } = require(`../../.homeybuild/lib/${driver}/services/building-insights-service`);
  const model = {
    C: 21.6, UA: 0.3, g: 0.5, pInt: 0.3, tau: 72, confidence: 90,
  };
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'nl' },
      setInterval: () => ({ mocked: true }),
      clearInterval: () => {},
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
    getSetting: (key) => ({ building_insights_enabled: true, insights_min_confidence: 70, building_profile: 'average' })[key],
    getCapabilityValue: () => null,
  };
  return new BuildingInsightsService({
    device,
    buildingModelService: { getLearner: () => ({ getModel: () => model }) },
    adaptiveControlService: { hasDynamicPricing: () => false },
    logger: () => {},
  });
}

const diag = (blockingReasonKey, blockingStreak, blockingReason = 'blocked') => ({
  confidence: 90, sampleCount: 500, blockingReason, blockingReasonKey, blockingStreak,
});
const BLOCKED = (key) => `🚫 building_model.blocked_prefix: ${key}`;

test('shared: classification and threshold', () => {
  assert.strictEqual(TRANSIENT_BLOCK_CYCLES, 6);
  for (const key of ['no_cop', 'defrost', 'dhw_active', 'dhw_mode', 'aux_heating']) {
    assert.ok(isTransientBlockingKey(`building_model.blocked_${key}`), key);
  }
  for (const key of ['no_indoor_temp', 'no_outdoor_temp', 'no_power', 'disabled']) {
    assert.ok(!isTransientBlockingKey(`building_model.blocked_${key}`), key);
  }
  assert.ok(!isTransientBlockingKey(null));
  assert.strictEqual(shouldShowBlocked(diag('building_model.blocked_no_cop', 5)), false);
  assert.strictEqual(shouldShowBlocked(diag('building_model.blocked_no_cop', 6)), true);
  assert.strictEqual(shouldShowBlocked(diag('building_model.blocked_no_indoor_temp', 1)), true);
  assert.strictEqual(shouldShowBlocked(diag(null, 0, null)), false);
  assert.strictEqual(shouldShowBlocked(diag(null, 0, 'Collecting initial samples (500/10)')), false);
});

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  test(`${driver}: blocking streak counts blocked cycles and an accepted sample resets it`, async () => {
    const { service, env } = createModelService(driver);

    env.capabilities.adlar_cop = 0; // compressor runs, no COP (start without flow)
    await service.collectAndLearn();
    let status = await service.getDiagnosticStatus();
    assert.strictEqual(status.blockingReasonKey, 'building_model.blocked_no_cop');
    assert.strictEqual(status.blockingStreak, 1);
    assert.strictEqual(status.blockingTransient, true);

    for (let i = 0; i < 5; i++) await service.collectAndLearn();
    status = await service.getDiagnosticStatus();
    assert.strictEqual(status.blockingStreak, 6);

    env.capabilities.adlar_cop = 3.5;
    await service.collectAndLearn();
    status = await service.getDiagnosticStatus();
    assert.strictEqual(status.blockingStreak, 0);
    assert.strictEqual(status.blockingReasonKey, null);
  });

  test(`${driver}: changing transient reasons stay one streak`, async () => {
    const { service, env } = createModelService(driver);
    env.capabilities.adlar_cop = 0;
    await service.collectAndLearn();
    env.capabilities.adlar_state_defrost_state = true;
    await service.collectAndLearn();
    const status = await service.getDiagnosticStatus();
    assert.strictEqual(status.blockingReasonKey, 'building_model.blocked_defrost');
    assert.strictEqual(status.blockingStreak, 2);
    assert.strictEqual(status.blockingTransient, true);
  });

  test(`${driver}: a missing source is not transient`, async () => {
    const { service, env } = createModelService(driver);
    env.indoor = null;
    await service.collectAndLearn();
    const status = await service.getDiagnosticStatus();
    assert.strictEqual(status.blockingReasonKey, 'building_model.blocked_no_indoor_temp');
    assert.strictEqual(status.blockingTransient, false);
  });

  test(`${driver}: diagnostics JSON contains streak and transient flag`, async () => {
    const { service, env } = createModelService(driver);
    env.capabilities.adlar_cop = 0;
    await service.collectAndLearn();
    const json = await service.getDiagnostics();
    assert.strictEqual(json.learning.blockingStreak, 1);
    assert.strictEqual(json.learning.blockingTransient, true);
  });

  test(`${driver}: insights hide a short transient block and show a persistent one`, () => {
    const insights = createInsightsService(driver);
    const short = insights.detectInsulationInsights(diag('building_model.blocked_no_cop', 1));
    assert.ok(!short.insight.startsWith('🚫'), short.insight);

    const longDefrost = insights.detectInsulationInsights(diag('building_model.blocked_defrost', 6));
    assert.strictEqual(longDefrost.insight, BLOCKED('building_model.blocked_defrost'));
    const storage = insights.detectThermalStorageInsights(diag('building_model.blocked_defrost', 6));
    assert.strictEqual(storage.insight, BLOCKED('building_model.blocked_defrost'));
  });

  test(`${driver}: insights show a missing source immediately`, () => {
    const insights = createInsightsService(driver);
    const insight = insights.detectInsulationInsights(diag('building_model.blocked_no_indoor_temp', 1));
    assert.strictEqual(insight.insight, BLOCKED('building_model.blocked_no_indoor_temp'));
  });
}

// v3.4.3 (G12): diagnostics status follows the insights rule and the confidence threshold
// v3.4.3 (G12b): the performance report reads confidence from learning.confidence
const T = {
  domainNames: { building: 'building' },
  ratings: {
    excellent: 'excellent', good: 'good', fair: 'fair', poor: 'poor',
  },
};

for (const driver of ['tuya', 'modbus', 'aurora3']) {
  // A learned model: past the initial phase, with a fixed confidence (private in TS; isolates the status rule)
  const learnedService = (confidence) => {
    const { service, env } = createModelService(driver);
    service.learner.sampleCount = 300;
    service.learner.calculateConfidence = () => confidence;
    return { service, env };
  };

  test(`${driver}: diagnostics status is 'learning' below the confidence threshold`, async () => {
    const { service } = learnedService(40);
    assert.strictEqual((await service.getDiagnostics()).status, 'learning');
  });

  test(`${driver}: diagnostics status is 'converged' from the confidence threshold`, async () => {
    const { service } = learnedService(85);
    assert.strictEqual((await service.getDiagnostics()).status, 'converged');
  });

  test(`${driver}: a single transient block does not make the status 'insufficient_data'`, async () => {
    const { service, env } = learnedService(85);
    env.capabilities.adlar_cop = 0;
    await service.collectAndLearn();
    assert.strictEqual((await service.getDiagnostics()).status, 'converged');
    for (let i = 0; i < 5; i++) await service.collectAndLearn();
    assert.strictEqual((await service.getDiagnostics()).status, 'insufficient_data');
  });

  test(`${driver}: performance report uses the confidence from learning.confidence`, () => {
    const { PerformanceReportService } = require(`../../.homeybuild/lib/${driver}/services/performance-report-service`);
    const caps = {
      adlar_building_ua: 0.2,
      adlar_building_tau: 130,
      building_model_diagnostics: JSON.stringify({ learning: { confidence: 99 } }),
    };
    const device = {
      getSetting: (key) => ({ adaptive_control_enabled: true, building_profile: 'average' })[key] ?? null,
      hasCapability: (key) => key in caps,
      getCapabilityValue: (key) => caps[key] ?? null,
      homey: { i18n: { getLanguage: () => 'en' } },
    };
    const report = new PerformanceReportService({ device, logger: () => {} });
    assert.strictEqual(report.scoreBuilding(T).score, 99);

    caps.building_model_diagnostics = JSON.stringify({ learning: { confidence: 20 } });
    assert.strictEqual(report.scoreBuilding(T).status, 'learning');
  });
}
