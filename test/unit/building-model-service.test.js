/**
 * Service-level tests for BuildingModelService guard rails.
 *
 * These tests exercise the production collectAndLearn() path through the
 * compiled service, using a small Homey/device test double.
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

const { BuildingModelService } = require('../../.homeybuild/lib/services/building-model-service');

function createHomey() {
  return {
    __: (key) => key,
    i18n: { getLanguage: () => 'en' },
    setInterval: () => ({ mocked: true }),
    clearInterval: () => {},
    flow: {
      getDeviceTriggerCard: () => ({ trigger: async () => {} }),
    },
  };
}

function createDevice(overrides = {}) {
  const settings = {
    building_model_enabled: true,
    building_model_forgetting_factor: 0.999,
    enable_dynamic_pint: false,
    ...overrides.settings,
  };
  const capabilities = {
    adlar_enum_mode: 'heating',
    adlar_state_defrost_state: false,
    adlar_cop: 3,
    ...overrides.capabilities,
  };
  const store = { ...overrides.store };
  const externalTemperatureService = {
    getIndoorTemperature: () => (
      Object.prototype.hasOwnProperty.call(overrides, 'indoorTemp') ? overrides.indoorTemp : 20
    ),
  };
  const adaptiveControl = {
    getExternalTemperatureService: () => externalTemperatureService,
  };
  const energyTracking = {
    getCurrentPowerMeasurement: () => (
      Object.prototype.hasOwnProperty.call(overrides, 'powerMeasurement')
        ? overrides.powerMeasurement
        : { value: 2000 }
    ),
  };

  return {
    homey: createHomey(),
    store,
    serviceCoordinator: {
      getAdaptiveControl: () => adaptiveControl,
      getEnergyTracking: () => energyTracking,
    },
    getSetting: (key) => settings[key],
    getStoreValue: (key) => store[key],
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: () => false,
    setCapabilityValue: async () => {},
    setCapabilityOptions: async () => {},
    getOutdoorTemperatureWithFallback: () => (
      Object.prototype.hasOwnProperty.call(overrides, 'outdoorTemp')
        ? overrides.outdoorTemp
        : 5
    ),
  };
}

async function runCollect(overrides) {
  const service = new BuildingModelService({
    device: createDevice(overrides),
    enableDynamicPInt: false,
    logger: () => {},
  });
  await service.collectAndLearn();
  return {
    service,
    count: service.getLearner().getState().sampleCount,
    status: await service.getDiagnosticStatus(),
    store: service.device.store,
  };
}

test('BuildingModelService skips when indoor temperature is missing', async () => {
  const result = await runCollect({ indoorTemp: null });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /No indoor temperature/);
});

test('BuildingModelService skips when outdoor temperature is missing', async () => {
  const result = await runCollect({ outdoorTemp: null });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /No outdoor temperature/);
});

test('BuildingModelService skips non-heating/DHW modes', async () => {
  const result = await runCollect({ capabilities: { adlar_enum_mode: 'hot_water' } });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /Not in heating mode/);
});

test('BuildingModelService skips defrost samples', async () => {
  const result = await runCollect({ capabilities: { adlar_state_defrost_state: true } });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /Defrost cycle active/);
});

test('BuildingModelService skips missing power measurement', async () => {
  const result = await runCollect({ powerMeasurement: null });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /No valid power measurement/);
});

test('BuildingModelService skips missing or invalid COP', async () => {
  const result = await runCollect({ capabilities: { adlar_cop: 0 } });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /No valid COP/);
});

test('BuildingModelService accepts a complete valid learning sample', async () => {
  const result = await runCollect({});
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.store.building_model_state.sampleCount, 1);
  assert.match(result.status.blockingReason, /Collecting initial samples/);
});
