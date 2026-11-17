/**
 * R31: Kp, Ki and the dead zone of the Classic controller reach the controller at construction
 * (so they survive a restart) and when changed, in all three drivers.
 * R30: the dead zone setting counts while the building model is switched off; with the model on,
 * the controller derives the dead zone from UA.
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
  resolvePiKp,
  resolvePiKi,
  resolvePiDeadband,
  resolvePiControllerSettings,
} = require('../../.homeybuild/lib/shared/adaptive/pi-controller-settings');
const { HeatingController } = require('../../.homeybuild/lib/modbus/adaptive/heating-controller');
const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

const DRIVERS = [['Tuya', TuyaService], ['Aurora II', ModbusService], ['Aurora III', Aurora3Service]];
const CUSTOM = { adaptive_pi_kp: 8, adaptive_pi_ki: 0.5, adaptive_pi_deadband: 0.6 };

function createDevice(settings = {}, extraCapabilities = {}) {
  const store = {};
  const capabilities = { target_temperature: 35, ...extraCapabilities };
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
}

/** What the Classic controller of a service works with. */
function piValues(service) {
  const { Kp, Ki, deadband } = service.heatingController.getStatus();
  return { Kp, Ki, deadband };
}

test('a missing or unusable setting falls back to the default', () => {
  assert.strictEqual(resolvePiKp(undefined), 5);
  assert.strictEqual(resolvePiKp(null), 5);
  assert.strictEqual(resolvePiKp(Number.NaN), 5);
  assert.strictEqual(resolvePiKp('8'), 5, 'only numbers count');
  assert.strictEqual(resolvePiKp(0), 5, 'below the range of the controller');
  assert.strictEqual(resolvePiKp(8), 8);
  assert.strictEqual(resolvePiKi(undefined), 1.5);
  assert.strictEqual(resolvePiKi(11), 1.5, 'above the range of the controller');
  assert.strictEqual(resolvePiKi(0.5), 0.5);
  assert.strictEqual(resolvePiDeadband(undefined), 0.3);
  assert.strictEqual(resolvePiDeadband(0.05), 0.3);
  assert.strictEqual(resolvePiDeadband(0.6), 0.6);
  assert.deepStrictEqual(resolvePiControllerSettings((key) => CUSTOM[key]), { Kp: 8, Ki: 0.5, deadband: 0.6 });
  assert.deepStrictEqual(resolvePiControllerSettings(() => undefined), { Kp: 5, Ki: 1.5, deadband: 0.3 });
});

test('the controller uses the dead zone setting only without a UA', async () => {
  const controller = new HeatingController({ deadband: 0.6 });
  const data = { indoorTemp: 20.5, targetTemp: 21, timestamp: Date.now() };
  assert.strictEqual(await controller.calculateAction(data), null, '0.5 °C lies within the set 0.6 °C');
  controller.setDynamicDeadbandUA(0.19); // derived: max(0.3, 0.19 × 0.5 + 0.25) = 0.345
  assert.ok(await controller.calculateAction(data), '0.5 °C lies outside the derived 0.345 °C');
  controller.setDynamicDeadbandUA(0);
  assert.strictEqual(await controller.calculateAction(data), null, 'UA 0: the setting again');
});

for (const [name, Service] of DRIVERS) {
  test(`${name}: the settings reach the controller at start, survive a restart and follow a change`, async () => {
    const settings = { ...CUSTOM };
    const service = new Service({ device: createDevice(settings), logger: () => {} });
    assert.deepStrictEqual(piValues(service), { Kp: 8, Ki: 0.5, deadband: 0.6 }, 'at construction');

    const restarted = new Service({ device: createDevice(settings), logger: () => {} });
    assert.deepStrictEqual(piValues(restarted), { Kp: 8, Ki: 0.5, deadband: 0.6 }, 'after a restart');

    await service.onSettings({}, { ...settings, adaptive_pi_kp: 3 }, ['adaptive_pi_kp']);
    assert.deepStrictEqual(piValues(service), { Kp: 3, Ki: 0.5, deadband: 0.6 }, 'after a change');

    const fresh = new Service({ device: createDevice({}), logger: () => {} });
    assert.deepStrictEqual(piValues(fresh), { Kp: 5, Ki: 1.5, deadband: 0.3 }, 'without settings: the defaults');
  });
}

/** Stubs so that one control cycle reaches the building model step (pattern of adaptive-control-service.test.js). */
function prepareCycle(service, enabled) {
  service.isEnabled = true;
  service.externalTemperature = { getIndoorTemperature: () => 20, getIndoorStaleness: () => 'fresh' };
  service.weatherForecast = {
    getTempAt: () => null, isLocationUserSet: () => false, hasFreshForecast: () => true, updateForecast: async () => {}, calculateAdvice: () => null,
  };
  service.buildingModel = {
    getDiagnosticStatus: async () => ({ enabled, confidence: 80 }),
    getLearner: () => ({
      getModel: () => ({
        C: 15, UA: 0.19, g: 0.5, pInt: 0.3, tau: 79, confidence: 80,
      }),
    }),
    calculateThermalAdjustment: () => ({ adjustment: 0, reason: 'test thermal', priority: 'low' }),
    applyLearningSettings: async () => {},
  };
  service.energyOptimizer = { getPriceData: () => [], calculateAction: () => null, setThermalCapacity: () => {} };
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
        minAcceptableCOP: 2.5, targetCOP: 3.5, strategy: 'balanced', tempRange: 'test',
      },
    }),
  };
  service.decisionMaker = {
    combineActionsWithThermal: () => ({
      finalAdjustment: 0,
      priority: 'low',
      reasoning: ['test decision'],
      breakdown: {
        comfort: 0, efficiency: 0, cost: 0, thermal: 0, coast: 0, wind: 0,
      },
      effectiveWeights: {
        comfort: 0.6, efficiency: 0, cost: 0, thermal: 0, coast: 0,
      },
    }),
  };
  const passed = [];
  const original = service.heatingController.setDynamicDeadbandUA.bind(service.heatingController);
  service.heatingController.setDynamicDeadbandUA = (UA) => {
    passed.push(UA);
    original(UA);
  };
  return passed;
}

for (const [name, Service] of DRIVERS) {
  test(`${name}: the UA reaches the controller only while the building model is on`, async () => {
    for (const enabled of [true, false]) {
      const device = createDevice({
        adaptive_min_setpoint: 18,
        price_optimizer_enabled: false,
        cop_optimizer_enabled: false,
        wind_correction_enabled: false,
        enable_weather_forecast: false,
      }, { 'target_temperature.indoor': 20, 'measure_temperature.outlet': 43.5, adlar_simulated_target: 35 });
      const service = new Service({ device, logger: () => {} });
      const passed = prepareCycle(service, enabled);
      // eslint-disable-next-line no-await-in-loop
      await service.executeControlCycle();
      assert.deepStrictEqual(passed, [enabled ? 0.19 : 0], `building model ${enabled ? 'on' : 'off'}`);
    }
  });
}
