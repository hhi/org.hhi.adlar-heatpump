'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.join(__dirname, '../../.homeybuild/lib');
const drivers = ['tuya', 'modbus', 'aurora3'].filter((driver) => fs.existsSync(path.join(base, driver, 'services/energy-tracking-service.js')));

function createEnergyHarness(Service, now, initialStore = {}) {
  const store = { cumulative_energy_kwh: 1000, external_cumulative_energy_kwh: 500, ...initialStore };
  const values = { adlar_external_power: null, measure_power: null, 'measure_power.internal': null };
  const intervals = new Set();
  const timeouts = new Set();
  let timer = 0;
  let internal = null;
  let price = null;
  let accumulatedCost = 0;
  let costCalls = 0;
  const optimizer = {
    getCurrentPrice: () => (price === null ? null : { price }),
    getEffectivePrice: () => price ?? 0,
    accumulateCost: (energy) => {
      costCalls += 1; accumulatedCost += energy * price;
    },
    getAccumulatedDailyCost: () => accumulatedCost,
    accumulateHourlyCost: (total) => (total - 1000) * price,
    getState: () => ({}),
    resetDailyCost: () => {
      accumulatedCost = 0;
    },
  };
  const device = {
    homey: {
      clock: { getTimezone: () => 'Europe/Amsterdam' },
      setInterval: () => {
        timer += 1; intervals.add(timer); return timer;
      },
      clearInterval: (id) => intervals.delete(id),
      setTimeout: () => {
        timer += 1; timeouts.add(timer); return timer;
      },
      clearTimeout: (id) => timeouts.delete(id),
      flow: { getDeviceTriggerCard: () => ({ trigger: async () => {} }) },
    },
    getSetting: (id) => (id === 'enable_intelligent_energy_tracking' ? false : undefined),
    getSettings: () => ({}),
    hasCapability: () => true,
    getCapabilityValue: (id) => values[id] ?? null,
    setCapabilityValue: async (id, value) => {
      values[id] = value;
    },
    getStoreValue: (id) => store[id],
    setStoreValue: async (id, value) => {
      store[id] = value;
    },
    triggerFlowCard: async () => {},
  };
  const service = new Service({ device, energyPriceOptimizer: optimizer, readInternalPower: () => internal });
  return {
    service,
    store,
    values,
    intervals,
    timeouts,
    internal(value, timestamp = now()) {
      internal = value === null ? null : { value, timestamp };
    },
    price(value) {
      price = value;
    },
    costCalls: () => costCalls,
  };
}

for (const driver of drivers) {
  const { EnergyTrackingService } = require(path.join(base, driver, 'services/energy-tracking-service'));

  test(`${driver}: always on despite old false setting; totals survive and inactive periods are not backfilled`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now, { last_energy_update: now - 86400000, daily_consumption_kwh: 20 });
    try {
      h.internal(1000);
      await h.service.initialize();
      await h.service.initialize();
      assert.equal(h.intervals.size, 1);
      assert.equal(h.timeouts.size, 1);
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      assert.equal(h.store.external_cumulative_energy_kwh, 500);
      assert.equal(h.store.daily_consumption_kwh, 0);
      await h.service.setConnectionState(true);
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      now += 10000;
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.ok(Math.abs(h.store.cumulative_energy_kwh - (1000 + 1 / 360)) < 1e-9);
    } finally {
      h.service.destroy();
      Date.now = originalNow;
    }
    assert.equal(h.intervals.size, 0);
    assert.equal(h.timeouts.size, 0);
  });

  test(`${driver}: absent readings never create standby consumption; return of data starts a new interval`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now);
    try {
      await h.service.initialize();
      await h.service.setConnectionState(true);
      now += 600000;
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.service.getCurrentPowerMeasurement(), null);
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      now += 10000;
      h.internal(1000);
      await Promise.all(Array.from({ length: 4 }, () => h.service.updateIntelligentPowerMeasurement()));
      assert.ok(Math.abs(h.store.cumulative_energy_kwh - (1000 + 1 / 360)) < 1e-9);
      h.internal(null);
      now += 10000;
      await h.service.updateIntelligentPowerMeasurement();
      const before = h.store.cumulative_energy_kwh;
      now += 600000;
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.store.cumulative_energy_kwh, before);
    } finally {
      h.service.destroy(); Date.now = originalNow;
    }
  });

  test(`${driver}: external measurement works offline and zero stays valid without adding internal power`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now);
    try {
      await h.service.initialize();
      h.internal(800);
      await h.service.receiveExternalPowerData(1420);
      assert.equal(h.service.getCurrentPowerMeasurement().source, 'external');
      assert.equal(h.service.getCurrentPowerMeasurement().value, 1420);
      assert.equal(h.values.measure_power, 1420);
      now += 10000;
      await h.service.updateIntelligentPowerMeasurement();
      assert.ok(Math.abs(h.store.cumulative_energy_kwh - (1000 + 1.42 / 360)) < 1e-9);
      assert.ok(Math.abs(h.store.external_cumulative_energy_kwh - (500 + 1.42 / 360)) < 1e-9);
      await h.service.receiveExternalPowerData(0);
      const total = h.store.cumulative_energy_kwh;
      now += 60000;
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.service.getCurrentPowerMeasurement().value, 0);
      assert.equal(h.store.cumulative_energy_kwh, total);
      now += 3600001;
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.service.getCurrentPowerMeasurement(), null);
      assert.equal(h.values.adlar_external_power, null);
      assert.equal(h.store.cumulative_energy_kwh, total);
      await assert.rejects(h.service.receiveExternalPowerData(-1), /non-negative/);
      await assert.rejects(h.service.receiveExternalPowerData(NaN), /finite/);
    } finally {
      h.service.destroy(); Date.now = originalNow;
    }
  });

  test(`${driver}: stale internal readings are unknown; long gaps are not charged at a later power value`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now);
    try {
      h.internal(1000, now - 60001);
      await h.service.initialize();
      await h.service.setConnectionState(true);
      assert.equal(h.service.getCurrentPowerMeasurement(), null);
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      now += 3600000;
      h.internal(2000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      now += 10000;
      h.internal(0);
      await h.service.updateIntelligentPowerMeasurement();
      const total = h.store.cumulative_energy_kwh;
      assert.ok(Math.abs(total - (1000 + 2 / 360)) < 1e-9);
      assert.equal(h.service.getCurrentPowerMeasurement().value, 0);
      now += 10000;
      h.internal(0);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.store.cumulative_energy_kwh, total);
    } finally {
      h.service.destroy(); Date.now = originalNow;
    }
  });

  test(`${driver}: expired external reading switches to a fresh internal reading without reusing external watts`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now);
    try {
      h.internal(800);
      await h.service.initialize();
      await h.service.setConnectionState(true);
      await h.service.receiveExternalPowerData(1420);
      now += 3600001;
      h.internal(800);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.service.getCurrentPowerMeasurement().source, 'internal');
      assert.equal(h.values.measure_power, 800);
      assert.equal(h.values.adlar_external_power, null);
      assert.equal(h.store.cumulative_energy_kwh, 1000);
      now += 10000;
      h.internal(800);
      await h.service.updateIntelligentPowerMeasurement();
      assert.ok(Math.abs(h.store.cumulative_energy_kwh - (1000 + 0.8 / 360)) < 1e-9);
    } finally {
      h.service.destroy(); Date.now = originalNow;
    }
  });

  test(`${driver}: missing prices do not become free energy; zero and negative prices are valid`, async () => {
    const originalNow = Date.now;
    let now = Date.UTC(2026, 10, 19, 12);
    Date.now = () => now;
    const h = createEnergyHarness(EnergyTrackingService, () => now);
    try {
      h.internal(1000);
      await h.service.initialize();
      await h.service.setConnectionState(true);
      now += 10000;
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.costCalls(), 0);
      h.price(0);
      now += 10000;
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.costCalls(), 1);
      h.price(-0.1);
      now += 10000;
      h.internal(1000);
      await h.service.updateIntelligentPowerMeasurement();
      assert.equal(h.costCalls(), 2);
      assert.ok(h.values.adlar_energy_cost_daily < 0);
    } finally {
      h.service.destroy(); Date.now = originalNow;
    }
  });
}
