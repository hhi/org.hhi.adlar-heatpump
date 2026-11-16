/**
 * G19: the pre-heat estimate uses the mean of the learned model (C, UA, P_int) over the past day,
 * so its outcome does not follow the daily pattern of the learned values.
 */

'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { ModelHistory } = require('../../.homeybuild/lib/shared/adaptive/model-history');
const { BuildingModelService: TuyaBuildingModel } = require('../../.homeybuild/lib/tuya/services/building-model-service');
const { BuildingModelService: ModbusBuildingModel } = require('../../.homeybuild/lib/modbus/services/building-model-service');
const { BuildingModelService: Aurora3BuildingModel } = require('../../.homeybuild/lib/aurora3/services/building-model-service');

const HOUR = 3600 * 1000;
const START = Date.UTC(2026, 10, 2, 0, 0, 0);
const close = (a, b) => Math.abs(a - b) < 1e-9;

function fillHours(history, startMs, hours, modelAt, samplesPerHour = 12) {
  for (let h = 0; h < hours; h++) {
    for (let i = 0; i < samplesPerHour; i++) history.addSample(startMs + h * HOUR + i * 5 * 60 * 1000, modelAt(h, i));
  }
}

// ==================== ModelHistory ====================

test('the mean covers C, UA and P_int over the completed hours', () => {
  const history = new ModelHistory();
  // Afternoon dip: three hours with a higher UA and a lower P_int
  fillHours(history, START, 25, (h) => (h >= 15 && h < 18 ? { C: 12, UA: 0.2, pInt: 0.2 } : { C: 12, UA: 0.16, pInt: 0.3 }));
  const mean = history.getMean(START + 24 * HOUR);
  assert.ok(close(mean.C, 12));
  assert.ok(close(mean.UA, (21 * 0.16 + 3 * 0.2) / 24));
  assert.ok(close(mean.pInt, (21 * 0.3 + 3 * 0.2) / 24));
});

test('an hour holds the mean of its samples', () => {
  const history = new ModelHistory();
  fillHours(history, START, 19, (h, i) => ({ C: 10 + (i % 2) * 2, UA: 0.2, pInt: 0.3 }));
  assert.ok(close(history.getMean(START + 18 * HOUR).C, 11));
});

test('fewer than 18 hours gives null', () => {
  const history = new ModelHistory();
  fillHours(history, START, 18, () => ({ C: 12, UA: 0.16, pInt: 0.3 })); // 17 completed, the 18th still runs
  assert.strictEqual(history.getMean(START + 17 * HOUR), null);
  history.addSample(START + 18 * HOUR, { C: 12, UA: 0.16, pInt: 0.3 });
  assert.ok(history.getMean(START + 18 * HOUR));
});

test('an hour with fewer than 6 samples does not count', () => {
  const history = new ModelHistory();
  fillHours(history, START, 30, () => ({ C: 12, UA: 0.16, pInt: 0.3 }), 5);
  assert.strictEqual(history.getHourCount(), 0);
  assert.strictEqual(history.getMean(START + 30 * HOUR), null);
});

test('hours older than a day drop out', () => {
  const history = new ModelHistory();
  fillHours(history, START, 24, () => ({ C: 20, UA: 0.5, pInt: 1 }));
  fillHours(history, START + 24 * HOUR, 26, () => ({ C: 12, UA: 0.16, pInt: 0.3 }));
  assert.ok(history.getHourCount() <= 25);
  const mean = history.getMean(START + 49 * HOUR);
  assert.ok(close(mean.C, 12) && close(mean.UA, 0.16) && close(mean.pInt, 0.3));
});

test('after a gap the old hours no longer give a mean', () => {
  const history = new ModelHistory();
  fillHours(history, START, 25, () => ({ C: 12, UA: 0.16, pInt: 0.3 }));
  assert.strictEqual(history.getMean(START + 60 * HOUR), null);
});

test('addSample reports a completed hour and ignores an invalid model', () => {
  const history = new ModelHistory();
  const model = { C: 12, UA: 0.16, pInt: 0.3 };
  for (let i = 0; i < 12; i++) assert.strictEqual(history.addSample(START + i * 5 * 60 * 1000, model), false);
  assert.strictEqual(history.addSample(START + HOUR, model), true);
  for (const bad of [{ C: 0, UA: 0.16, pInt: 0.3 }, { C: 12, UA: -1, pInt: 0.3 }, { C: 12, UA: 0.16, pInt: NaN }, null]) {
    assert.strictEqual(history.addSample(START + HOUR + 60000, bad), false);
  }
  assert.strictEqual(history.getState().current.count, 1);
});

test('clear forgets every hour', () => {
  const history = new ModelHistory();
  fillHours(history, START, 25, () => ({ C: 12, UA: 0.16, pInt: 0.3 }));
  history.clear();
  assert.strictEqual(history.getHourCount(), 0);
  assert.strictEqual(history.getState().current, null);
});

test('state survives a round trip and invalid state is rejected', () => {
  const history = new ModelHistory();
  fillHours(history, START, 25, (h) => ({ C: 12 + h / 10, UA: 0.16, pInt: 0.3 }));
  const copy = new ModelHistory();
  assert.strictEqual(copy.restoreState(JSON.parse(JSON.stringify(history.getState()))), true);
  assert.deepStrictEqual(copy.getMean(START + 24 * HOUR), history.getMean(START + 24 * HOUR));
  assert.deepStrictEqual(copy.getState(), history.getState());

  const empty = new ModelHistory();
  assert.strictEqual(empty.restoreState(null), false);
  assert.strictEqual(empty.restoreState({
    hours: [{
      hour: 'x', C: 12, UA: 0.16, pInt: 0.3,
    }, {
      hour: 5, C: 12, UA: 0, pInt: 0.3,
    }],
    current: {
      hour: 6, C: 0, UA: 0, pInt: 0, count: 3,
    },
  }), false);
  assert.strictEqual(empty.getHourCount(), 0);
});

// ==================== BuildingModelService ====================

function mockDevice(store) {
  const settings = { building_model_enabled: true, building_model_forgetting_factor: 0.999 };
  // Heating mode as each driver reads it: Tuya adlar_enum_mode, Aurora II adlar_mode, Aurora III adlar_mode_aurora3
  const capabilities = {
    adlar_enum_mode: 'heating', adlar_mode: '1', adlar_mode_aurora3: '2', adlar_state_defrost_state: false, adlar_cop: 3.5,
  };
  return {
    serviceCoordinator: {
      getAdaptiveControl: () => ({ getExternalTemperatureService: () => ({ getIndoorTemperature: () => 20.1, getIndoorStaleness: () => 'fresh' }) }),
      getEnergyTracking: () => ({ getCurrentPowerMeasurement: () => ({ value: 1200 }) }),
    },
    getSetting: (key) => settings[key] ?? null,
    getStoreValue: async (key) => store[key] ?? null,
    setStoreValue: async (key, value) => {
      store[key] = value;
    },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: () => false,
    getOutdoorTemperatureWithFallback: () => 5,
    homey: {
      setInterval: () => 0,
      clearInterval: () => {},
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
  };
}

const DRIVERS = [['Tuya', TuyaBuildingModel], ['Aurora II', ModbusBuildingModel], ['Aurora III', Aurora3BuildingModel]];

for (const [name, Service] of DRIVERS) {
  const newService = (store) => new Service({ device: mockDevice(store), buildingProfile: 'average', logger: () => {} });

  test(`${name}: the pre-heat model is the momentary model until the day fills, then the day mean`, async () => {
    const store = {};
    mock.timers.enable({ apis: ['Date'], now: START });
    try {
      const service = newService(store);
      const momentary = () => {
        const { C, UA, pInt } = service.getLearner().getModel();
        return { C, UA, pInt };
      };
      for (let i = 0; i <= 12 * 12; i++) {
        mock.timers.setTime(START + i * 5 * 60 * 1000);
        // eslint-disable-next-line no-await-in-loop
        await service.collectAndLearn();
      }
      assert.deepStrictEqual(service.getPreHeatModel(), momentary(), '12 hours: not enough for a mean');

      for (let i = 12 * 12 + 1; i <= 24 * 12; i++) {
        mock.timers.setTime(START + i * 5 * 60 * 1000);
        // eslint-disable-next-line no-await-in-loop
        await service.collectAndLearn();
      }
      const { hours } = store.preheat_model_history;
      assert.strictEqual(hours.length, 24);
      const mean = (key) => hours.reduce((sum, h) => sum + h[key], 0) / hours.length;
      const model = service.getPreHeatModel();
      assert.ok(close(model.C, mean('C')) && close(model.UA, mean('UA')) && close(model.pInt, mean('pInt')));
      const conditions = service.getPreHeatConditions();
      assert.ok(close(conditions.UA, model.UA) && close(conditions.pInt, model.pInt), 'conditions use the same model');

      const restarted = newService(store);
      await restarted.initialize();
      assert.deepStrictEqual(restarted.getPreHeatModel(), model, 'the history survives a restart');
    } finally {
      mock.timers.reset();
    }
  });

  test(`${name}: a model reset and a profile change clear the history`, async () => {
    for (const act of [(s) => s.reset(), (s) => s.softReset('heavy')]) {
      const store = {};
      mock.timers.enable({ apis: ['Date'], now: START });
      try {
        const service = newService(store);
        for (let i = 0; i <= 24 * 12; i++) {
          mock.timers.setTime(START + i * 5 * 60 * 1000);
          // eslint-disable-next-line no-await-in-loop
          await service.collectAndLearn();
        }
        assert.strictEqual(store.preheat_model_history.hours.length, 24);
        // eslint-disable-next-line no-await-in-loop
        await act(service);
        assert.deepStrictEqual(store.preheat_model_history, { hours: [], current: null });
        const { C, UA, pInt } = service.getLearner().getModel();
        assert.deepStrictEqual(service.getPreHeatModel(), { C, UA, pInt });
      } finally {
        mock.timers.reset();
      }
    }
  });
}
