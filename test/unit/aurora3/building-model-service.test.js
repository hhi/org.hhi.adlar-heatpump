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

const { BuildingModelService } = require('../../../.homeybuild/lib/aurora3/services/building-model-service');

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
    adlar_mode: '2',
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
  const device = createDevice(overrides);
  const service = new BuildingModelService({
    device,
    enableDynamicPInt: false,
    logger: () => {},
  });
  await service.collectAndLearn();
  return {
    device,
    service,
    count: service.getLearner().getState().sampleCount,
    status: await service.getDiagnosticStatus(),
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

test('BuildingModelService skips non-heating/cooling modes', async () => {
  const result = await runCollect({ capabilities: { adlar_mode: '1' } });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /Not in heating mode/);
});

test('BuildingModelService skips samples while hot water is being heated', async () => {
  const result = await runCollect({ capabilities: { adlar_dhw_active: true } });
  assert.strictEqual(result.count, 0);
  assert.match(result.status.blockingReason, /Hot water heating active/);
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
  assert.match(result.status.blockingReason, /Collecting initial samples/);
});

test('ADR-061: BuildingModelService persists state after the first accepted sample', async () => {
  const result = await runCollect({});
  assert.ok(result.device.store.building_model_state, 'building_model_state should be written after sample 1');
  assert.strictEqual(result.device.store.building_model_state.sampleCount, 1);
});

test('ADR-061: BuildingModelService restores persisted state before 10 samples', async () => {
  const first = await runCollect({});
  const second = await runCollect({ store: first.device.store });
  assert.strictEqual(second.service.getLearner().getState().sampleCount, 1);
});

test('BuildingModelService writes capability options only when they change and keeps other keys', async () => {
  const device = createDevice({ capabilities: { adlar_state_defrost_state: true } });
  const options = { adlar_building_ua: { insights: true } };
  const writes = [];
  device.hasCapability = (cap) => cap.startsWith('adlar_building_');
  device.getCapabilityOptions = (cap) => {
    if (!options[cap]) throw new Error('no options');
    return options[cap];
  };
  device.setCapabilityOptions = async (cap, value) => {
    writes.push(cap);
    options[cap] = value;
  };
  const service = new BuildingModelService({ device, enableDynamicPInt: false, logger: () => {} });

  await service.collectAndLearn();
  const firstWrites = writes.length;
  assert.ok(firstWrites > 0, 'first blocked cycle writes the titles');
  assert.strictEqual(options.adlar_building_ua.insights, true, 'existing option keys are kept');

  await service.collectAndLearn();
  assert.strictEqual(writes.length, firstWrites, 'unchanged titles are not written again');
});
