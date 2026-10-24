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

const { BuildingModelService } = require('../../.homeybuild/lib/tuya/services/building-model-service');

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
    setStoreValue: async (key, value) => {
      store[key] = value;
    },
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

test('ADR-060: BuildingModelService skips invalid COP while the compressor runs', async () => {
  const result = await runCollect({ capabilities: { adlar_cop: 0, adlar_state_compressor_state: true } });
  assert.strictEqual(result.count, 0);
  assert.strictEqual(result.status.blockingReasonKey, 'building_model.blocked_no_cop');
});

test('ADR-060: BuildingModelService learns with thermal power 0 when the compressor is off', async () => {
  const result = await runCollect({
    capabilities: { adlar_cop: 0, adlar_state_compressor_state: false },
    powerMeasurement: { value: 60 },
  });
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.status.blockingReasonKey, null);
});

test('ADR-060: BuildingModelService skips auxiliary heating when the compressor is off', async () => {
  const result = await runCollect({
    capabilities: { adlar_cop: 0, adlar_state_compressor_state: false },
    powerMeasurement: { value: 3000 },
  });
  assert.strictEqual(result.count, 0);
  assert.strictEqual(result.status.blockingReasonKey, 'building_model.blocked_aux_heating');
});

test('BuildingModelService accepts a complete valid learning sample', async () => {
  const result = await runCollect({});
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.store.building_model_state.sampleCount, 1);
  assert.match(result.status.blockingReason, /Collecting initial samples/);
});

test('ADR-062 B2: a blocked sample interrupts the learning window, an accepted one does not', async () => {
  for (const [capabilities, expected] of [[{ adlar_state_defrost_state: true }, 1], [{}, 0]]) {
    const service = new BuildingModelService({
      device: createDevice({ capabilities }),
      enableDynamicPInt: false,
      logger: () => {},
    });
    const learner = service.getLearner();
    const original = learner.interruptWindow.bind(learner);
    let calls = 0;
    learner.interruptWindow = () => { calls++; original(); };
    await service.collectAndLearn();
    assert.strictEqual(calls, expected, JSON.stringify(capabilities));
  }
});

/** Homey double that tracks active intervals (ADR-062 A7). */
function trackIntervals(device) {
  const active = new Set();
  device.homey.setInterval = () => {
    const handle = { id: active.size + 1 };
    active.add(handle);
    return handle;
  };
  device.homey.clearInterval = (handle) => { active.delete(handle); };
  return active;
}

test('ADR-062 A7: initialize() twice keeps one interval and destroy() clears it via homey.clearInterval', async () => {
  const device = createDevice({});
  const active = trackIntervals(device);
  const service = new BuildingModelService({ device, enableDynamicPInt: false, logger: () => {} });
  await service.initialize();
  await service.initialize();
  assert.strictEqual(active.size, 1);
  await service.destroy();
  assert.strictEqual(active.size, 0);
});

test('ADR-062 §2.5: restore logs RESTORED or REJECTED from the learner result, also for 0 samples', async () => {
  const identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const cases = [
    [{ theta: [0.1, 0.16, 0.04, 0.03], P: identity, sampleCount: 0, lastMeasurement: null },
      /State REJECTED on restore \(was 0 samples\): UA 1\.600 kW\/°C outside \[0\.03, 1\.5\]/],
    [{ theta: [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15], P: identity, sampleCount: 5, lastMeasurement: null },
      /State RESTORED from store — 5 samples/],
  ];
  for (const [state, expected] of cases) {
    const lines = [];
    const device = createDevice({ store: { building_model_state: state } });
    trackIntervals(device);
    const service = new BuildingModelService({ device, enableDynamicPInt: false, logger: (msg) => lines.push(String(msg)) });
    await service.initialize();
    await service.destroy();
    assert.match(lines.join('\n'), expected);
  }
});

test('ADR-062 B6: getDiagnosticStatus() reports the prediction RMSE (null before enough updates)', async () => {
  const result = await runCollect({});
  assert.ok(Object.prototype.hasOwnProperty.call(result.status, 'predictionRmse24h'));
  assert.strictEqual(result.status.predictionRmse24h, null);
});
