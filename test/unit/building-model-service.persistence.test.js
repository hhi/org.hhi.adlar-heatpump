/**
 * Persistence tests for BuildingModelService (ADR-061)
 *
 * Acceptance criteria:
 * - After 1 accepted sample, building_model_state.sampleCount >= 1 is in store.
 * - After n < 10 samples and a simulated restart, sampleCount n is restored, not 0.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { BuildingModelService } = require('../../.homeybuild/lib/services/building-model-service');

/**
 * Minimal Homey.Device mock — just enough surface for collectAndLearn(),
 * initialize() and persistState(). The shared `store` object simulates the
 * device store surviving a restart.
 */
function mockDevice(store) {
  const settings = {
    building_model_enabled: true,
    building_model_forgetting_factor: 0.999,
  };
  const capabilities = {
    adlar_enum_mode: 'heating',
    adlar_state_defrost_state: false,
    adlar_cop: 3.5,
  };
  const serviceCoordinator = {
    getAdaptiveControl: () => ({
      getExternalTemperatureService: () => ({ getIndoorTemperature: () => 20.1 }),
    }),
    getEnergyTracking: () => ({ getCurrentPowerMeasurement: () => ({ value: 1200 }) }),
  };
  return {
    serviceCoordinator,
    getSetting: (key) => settings[key] ?? null,
    getStoreValue: async (key) => store[key] ?? null,
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: () => false, // skip all capability UI updates in tests
    getOutdoorTemperatureWithFallback: () => 5.0,
    homey: {
      setInterval: () => 0,
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
  };
}

function createService(store) {
  return new BuildingModelService({
    device: mockDevice(store),
    buildingProfile: 'average',
    logger: () => {},
  });
}

test('ADR-061: building_model_state is persisted after the very first sample', async () => {
  const store = {};
  const service = createService(store);

  await service.collectAndLearn(); // private in TS, callable in JS

  assert.ok(store.building_model_state, 'state must be in store after sample 1');
  assert.ok(store.building_model_state.sampleCount >= 1,
    `sampleCount must be >= 1 (got ${store.building_model_state.sampleCount})`);
});

test('ADR-061: restart with fewer than 10 samples restores the sample count, not 0', async () => {
  const store = {};
  const serviceA = createService(store);

  for (let i = 0; i < 3; i++) {
    // eslint-disable-next-line no-await-in-loop
    await serviceA.collectAndLearn();
  }
  const persistedCount = store.building_model_state.sampleCount;
  assert.ok(persistedCount >= 1 && persistedCount < 10,
    `precondition: persisted count below old 10-sample checkpoint (got ${persistedCount})`);

  // Simulated restart: new service instance against the same store
  const serviceB = createService(store);
  await serviceB.initialize();

  const restored = serviceB.getLearner().getState();
  assert.strictEqual(restored.sampleCount, persistedCount,
    `restored sampleCount must equal persisted count (got ${restored.sampleCount}, expected ${persistedCount})`);
});
