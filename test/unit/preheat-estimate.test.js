/**
 * G14 (ADR-062 B7): pre-heat duration from the building model, the outdoor temperature and the
 * highest hourly mean heating power of the past week.
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

const {
  calculatePreHeatDuration, estimatePreHeatDuration, PREHEAT_GOAL_MARGIN,
} = require('../../.homeybuild/lib/shared/utils/preheat-calculator');
const { HeatingPowerHistory } = require('../../.homeybuild/lib/shared/adaptive/heating-power-history');
const { BuildingModelService: TuyaBuildingModel } = require('../../.homeybuild/lib/tuya/services/building-model-service');
const { BuildingModelService: ModbusBuildingModel } = require('../../.homeybuild/lib/modbus/services/building-model-service');
const { BuildingModelService: Aurora3BuildingModel } = require('../../.homeybuild/lib/aurora3/services/building-model-service');

const HOUR = 3600 * 1000;

// Reference house: C 15 kWh/°C, UA 0.3 kW/°C → τ 50 h; 8 kW measured, 5 °C outside
const TAU = 50;
const CONDITIONS = {
  UA: 0.3, pInt: 0.3, outdoorTemp: 5, maxHeatingPowerKw: 8,
};

function physicalHours(tIn, target, c = CONDITIONS) {
  const tEq = c.outdoorTemp + (c.maxHeatingPowerKw + c.pInt) / c.UA;
  const goal = target - PREHEAT_GOAL_MARGIN;
  return TAU * Math.log((tEq - tIn) / (tEq - goal));
}

// ==================== estimatePreHeatDuration ====================

test('without conditions the empirical classes apply', () => {
  assert.strictEqual(estimatePreHeatDuration(TAU, 19, 21, null), calculatePreHeatDuration(TAU, 2));
  assert.strictEqual(estimatePreHeatDuration(15, 20, 21, null), 4);
});

test('invalid conditions fall back to the classes', () => {
  for (const bad of [{ ...CONDITIONS, UA: 0 }, { ...CONDITIONS, maxHeatingPowerKw: 0 }, { ...CONDITIONS, outdoorTemp: NaN }]) {
    assert.strictEqual(estimatePreHeatDuration(TAU, 19, 21, bad), calculatePreHeatDuration(TAU, 2));
  }
});

test('no rise needed gives 0 hours', () => {
  assert.strictEqual(estimatePreHeatDuration(TAU, 21, 21, CONDITIONS), 0);
  assert.strictEqual(estimatePreHeatDuration(TAU, 22, 21, CONDITIONS), 0);
});

test('up to 0.5 °C the classes alone apply', () => {
  assert.strictEqual(estimatePreHeatDuration(TAU, 20.75, 21, CONDITIONS), calculatePreHeatDuration(TAU, 0.25));
  assert.strictEqual(estimatePreHeatDuration(TAU, 20.5, 21, CONDITIONS), calculatePreHeatDuration(TAU, 0.5));
});

test('from 1.5 °C the physical estimate applies when it exceeds every smaller rise', () => {
  // Classes would say 48 h for 4 °C; with 8 kW the house reaches 20.7 °C in about 13.5 h
  const hours = estimatePreHeatDuration(TAU, 17, 21, CONDITIONS);
  assert.ok(Math.abs(hours - physicalHours(17, 21)) < 1e-9, `got ${hours}`);
  assert.ok(hours > 13 && hours < 14);
});

test('between 0.5 and 1.5 °C the estimate blends classes and physics', () => {
  // Δ 1.0: w = 0.5 → half of 12 h (classes) plus half of the physical time
  const blend = 0.5 * calculatePreHeatDuration(TAU, 1) + 0.5 * physicalHours(20, 21);
  const hours = estimatePreHeatDuration(TAU, 20, 21, CONDITIONS);
  assert.ok(hours >= blend - 1e-9, `never below the blend itself (got ${hours}, blend ${blend})`);
  assert.ok(hours < calculatePreHeatDuration(TAU, 1));
});

test('a larger rise never gives a shorter time', () => {
  const cases = [];
  for (const UA of [0.15, 0.3, 0.6]) {
    for (const outdoorTemp of [-5, 5, 12]) {
      for (const maxHeatingPowerKw of [3, 6, 10]) cases.push({ ...CONDITIONS, UA, outdoorTemp, maxHeatingPowerKw });
    }
  }
  for (const c of cases) {
    for (const tau of [5, 25, 60]) {
      let previous = 0;
      for (let delta = 0.1; delta <= 4.001; delta += 0.1) {
        const hours = estimatePreHeatDuration(tau, 21 - delta, 21, c);
        assert.ok(hours >= previous - 1e-9, `drop at Δ ${delta.toFixed(1)} (τ ${tau}, ${JSON.stringify(c)}): ${previous} → ${hours}`);
        previous = hours;
      }
    }
  }
});

test('a goal the measured power cannot reach gives the maximum', () => {
  // T_eq = 5 + (1 + 0.3) / 0.3 ≈ 9.3 °C, far below the target
  const weak = { ...CONDITIONS, maxHeatingPowerKw: 1 };
  assert.strictEqual(estimatePreHeatDuration(TAU, 18, 21, weak), 48);
  assert.strictEqual(estimatePreHeatDuration(TAU, 18, 21, weak, 24), 24);
});

// ==================== HeatingPowerHistory ====================

function fillHours(history, startMs, hours, kwAt = () => 4) {
  for (let h = 0; h < hours; h++) {
    for (let i = 0; i < 12; i++) history.addSample(startMs + h * HOUR + i * 5 * 60 * 1000, kwAt(h, i));
  }
}

test('history keeps the hourly mean, including compressor-off samples as 0 kW', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  // Each hour: 6 samples at 6 kW, 6 samples off → mean 3 kW
  fillHours(history, start, 25, (_h, i) => (i < 6 ? 6 : 0));
  history.addSample(start + 25 * HOUR, 0); // closes hour 24
  assert.strictEqual(history.getHourCount(), 25);
  assert.strictEqual(history.getMaxHourlyMeanKw(start + 25 * HOUR), 3);
});

test('history gives null below one day of hours', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  fillHours(history, start, 23);
  history.addSample(start + 23 * HOUR, 4);
  assert.strictEqual(history.getHourCount(), 23);
  assert.strictEqual(history.getMaxHourlyMeanKw(start + 23 * HOUR), null);
});

test('an hour with fewer than 6 samples does not count', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  for (let i = 0; i < 5; i++) history.addSample(start + i * 5 * 60 * 1000, 9);
  assert.strictEqual(history.addSample(start + HOUR, 1), false);
  assert.strictEqual(history.getHourCount(), 0);
});

test('addSample reports a completed hour', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  fillHours(history, start, 1);
  assert.strictEqual(history.addSample(start + HOUR, 4), true);
  assert.strictEqual(history.addSample(start + HOUR + 5 * 60 * 1000, 4), false);
});

test('hours older than a week drop out', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  // First day at 9 kW, then a week at 4 kW
  fillHours(history, start, 200, (h) => (h < 24 ? 9 : 4));
  const now = start + 200 * HOUR;
  history.addSample(now, 4);
  assert.strictEqual(history.getMaxHourlyMeanKw(now), 4);
  assert.ok(history.getHourCount() <= HeatingPowerHistory.MAX_HOURS);
});

test('thermal power is capped at a plausible COP and power', () => {
  assert.strictEqual(HeatingPowerHistory.thermalPowerKw(1000, 3.5), 3.5);
  assert.strictEqual(HeatingPowerHistory.thermalPowerKw(1000, 25), 8, 'COP capped at 8');
  assert.strictEqual(HeatingPowerHistory.thermalPowerKw(4000, 7), 20, 'power capped at 20 kW');
  assert.strictEqual(HeatingPowerHistory.thermalPowerKw(1000, null), 0, 'compressor off');
  assert.strictEqual(HeatingPowerHistory.thermalPowerKw(1000, 0), 0);
});

test('history state survives a round trip and invalid state is rejected', () => {
  const history = new HeatingPowerHistory();
  const start = 1000 * HOUR;
  fillHours(history, start, 30);
  const restored = new HeatingPowerHistory();
  assert.strictEqual(restored.restoreState(JSON.parse(JSON.stringify(history.getState()))), true);
  assert.deepStrictEqual(restored.getState(), history.getState());

  const empty = new HeatingPowerHistory();
  assert.strictEqual(empty.restoreState(null), false);
  assert.strictEqual(empty.restoreState({ hours: [{ hour: 'x', meanKw: 3 }, { hour: 5, meanKw: -1 }] }), false);
  assert.strictEqual(empty.getHourCount(), 0);
});

// ==================== BuildingModelService ====================

function mockDevice(store, outdoor = 5) {
  const settings = { building_model_enabled: true, building_model_forgetting_factor: 0.999 };
  const capabilities = { adlar_enum_mode: 'heating', adlar_state_defrost_state: false, adlar_cop: 3.5 };
  return {
    serviceCoordinator: {
      getAdaptiveControl: () => ({ getExternalTemperatureService: () => ({ getIndoorTemperature: () => 20.1, getIndoorStaleness: () => 'fresh' }) }),
      getEnergyTracking: () => ({ getCurrentPowerMeasurement: () => ({ value: 1200 }) }),
    },
    getSetting: (key) => settings[key] ?? null,
    getStoreValue: async (key) => store[key] ?? null,
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: () => false,
    getOutdoorTemperatureWithFallback: () => outdoor,
    homey: {
      setInterval: () => 0,
      clearInterval: () => {},
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
  };
}

test('Tuya: accepted samples fill the power history, which is persisted and restored', async () => {
  const store = {};
  const start = Date.UTC(2026, 10, 2, 0, 0, 0);
  mock.timers.enable({ apis: ['Date'], now: start });
  try {
    const service = new TuyaBuildingModel({ device: mockDevice(store), buildingProfile: 'average', logger: () => {} });
    assert.strictEqual(service.getPreHeatConditions(), null, 'no history yet');
    for (let i = 0; i <= 24 * 12; i++) {
      mock.timers.setTime(start + i * 5 * 60 * 1000);
      // eslint-disable-next-line no-await-in-loop
      await service.collectAndLearn();
    }
    assert.strictEqual(store.preheat_power_history.hours.length, 24);
    const conditions = service.getPreHeatConditions();
    assert.ok(conditions, 'a day of hours gives conditions');
    assert.ok(Math.abs(conditions.maxHeatingPowerKw - 4.2) < 1e-9, '1200 W × COP 3.5');
    assert.strictEqual(conditions.outdoorTemp, 5);

    const restarted = new TuyaBuildingModel({ device: mockDevice(store), buildingProfile: 'average', logger: () => {} });
    await restarted.initialize();
    assert.ok(Math.abs(restarted.getPreHeatConditions().maxHeatingPowerKw - 4.2) < 1e-9);
  } finally {
    mock.timers.reset();
  }
});

for (const [name, Service] of [['Tuya', TuyaBuildingModel], ['Aurora II', ModbusBuildingModel], ['Aurora III', Aurora3BuildingModel]]) {
  test(`${name}: pre-heat conditions combine the model, the outdoor temperature and the history`, () => {
    const powerHistory = new HeatingPowerHistory();
    const now = Math.floor(Date.now() / HOUR) * HOUR; // samples on whole clock hours
    fillHours(powerHistory, now - 30 * HOUR, 30, (h) => (h === 10 ? 7 : 3));
    const ctx = {
      powerHistory,
      device: mockDevice({}, -2),
      learner: { getModel: () => ({ UA: 0.25, pInt: 0.4 }) },
    };
    assert.deepStrictEqual(Service.prototype.getPreHeatConditions.call(ctx), {
      UA: 0.25, pInt: 0.4, outdoorTemp: -2, maxHeatingPowerKw: 7,
    });
    ctx.device = mockDevice({}, null);
    assert.strictEqual(Service.prototype.getPreHeatConditions.call(ctx), null, 'no outdoor temperature');
  });
}
