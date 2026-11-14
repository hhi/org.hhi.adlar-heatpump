/**
 * Tests for ADR-067 D2 (R27): an indoor temperature that stays the same value is reported after 12 h;
 * after 24 h the control stops correcting on it and the building model stops learning.
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
  classifyIndoorStaleness, sameIndoorReading, STORE_KEY_INDOOR_CHANGED_AT,
} = require('../../.homeybuild/lib/shared/adaptive/indoor-staleness');
const { ExternalTemperatureService: TuyaTemperature } = require('../../.homeybuild/lib/tuya/services/external-temperature-service');
const { ExternalTemperatureService: ModbusTemperature } = require('../../.homeybuild/lib/modbus/services/external-temperature-service');
const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

const HOUR = 60 * 60 * 1000;

test('classifyIndoorStaleness: fresh below 12 h, warn from 12 h, stale from 24 h', () => {
  assert.strictEqual(classifyIndoorStaleness(null), 'fresh');
  assert.strictEqual(classifyIndoorStaleness(0), 'fresh');
  assert.strictEqual(classifyIndoorStaleness(12 * HOUR - 1), 'fresh');
  assert.strictEqual(classifyIndoorStaleness(12 * HOUR), 'warn');
  assert.strictEqual(classifyIndoorStaleness(24 * HOUR - 1), 'warn');
  assert.strictEqual(classifyIndoorStaleness(24 * HOUR), 'stale');
});

test('sameIndoorReading: equal values are the same reading, 0.1 °C apart is not', () => {
  assert.strictEqual(sameIndoorReading(21.4, 21.4), true);
  assert.strictEqual(sameIndoorReading(21.4, 21.5), false);
  assert.strictEqual(sameIndoorReading(null, 21.4), false);
});

function createTemperatureDevice(store = {}) {
  const capabilities = { 'measure_temperature.indoor': null };
  return {
    store,
    capabilities,
    homey: { clock: { getTimezone: () => 'UTC' }, i18n: { getLanguage: () => 'en' } },
    getStoreValue: (key) => store[key] ?? null,
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => { capabilities[key] = value; },
  };
}

for (const [name, Temperature] of [['Tuya', TuyaTemperature], ['Aurora I/II and III', ModbusTemperature]]) {
  test(`${name}: a repeated value does not move the time of the last change, a different value does`, async () => {
    const device = createTemperatureDevice();
    const service = new Temperature({ device });

    await service.receiveExternalTemperature(21.4);
    const first = device.store[STORE_KEY_INDOOR_CHANGED_AT];
    assert.ok(first > 0, 'first reading sets the time of change');

    device.store[STORE_KEY_INDOOR_CHANGED_AT] = first - 13 * HOUR;
    service.lastChangedTimestamp = first - 13 * HOUR;
    await service.receiveExternalTemperature(21.4);
    assert.strictEqual(device.store[STORE_KEY_INDOOR_CHANGED_AT], first - 13 * HOUR, 'same value: unchanged');
    assert.strictEqual(service.getIndoorStaleness(), 'warn');

    await service.receiveExternalTemperature(21.5);
    assert.ok(device.store[STORE_KEY_INDOOR_CHANGED_AT] >= first, 'different value: time of change moves');
    assert.strictEqual(service.getIndoorStaleness(), 'fresh');
  });

  test(`${name}: the time of the last change survives a restart`, () => {
    const device = createTemperatureDevice({ [STORE_KEY_INDOOR_CHANGED_AT]: Date.now() - 25 * HOUR });
    device.capabilities['measure_temperature.indoor'] = 21.4;
    const service = new Temperature({ device });
    assert.strictEqual(service.getIndoorStaleness(), 'stale');
  });

  test(`${name}: without a known time of change the clock starts now`, () => {
    const device = createTemperatureDevice();
    device.capabilities['measure_temperature.indoor'] = 21.4;
    const service = new Temperature({ device });
    const now = Date.now();
    assert.strictEqual(service.getIndoorStaleness(now), 'fresh');
    assert.strictEqual(service.getIndoorStaleness(now + 25 * HOUR), 'stale');
  });

  test(`${name}: without an indoor temperature the state is fresh (the missing value is reported elsewhere)`, () => {
    const service = new Temperature({ device: createTemperatureDevice({ [STORE_KEY_INDOOR_CHANGED_AT]: 1 }) });
    assert.strictEqual(service.getIndoorStaleness(), 'fresh');
  });
}

function createControl(Service, settings = {}) {
  const store = {};
  const capabilities = {
    target_temperature: 35, 'target_temperature.indoor': 21, adaptive_control_diagnostics: '', adlar_simulated_target: null,
  };
  const diagnostics = [];
  const triggers = [];
  const notifications = [];
  const device = {
    homey: {
      __: (key) => key,
      i18n: { getLanguage: () => 'en' },
      setInterval: () => ({}),
      clearInterval: () => {},
      setTimeout: () => ({}),
      flow: { getDeviceTriggerCard: (id) => ({ trigger: async (_device, tokens) => { triggers.push({ id, tokens }); } }) },
      notifications: { createNotification: async ({ excerpt }) => { notifications.push(excerpt); } },
    },
    getName: () => 'Heat pump',
    getSetting: (key) => settings[key],
    getSettings: () => settings,
    getStoreValue: (key) => store[key] ?? null,
    setStoreValue: async (key, value) => { store[key] = value; },
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => {
      capabilities[key] = value;
      if (key === 'adaptive_control_diagnostics') diagnostics.push(JSON.parse(value));
    },
    setCapabilityOptions: async () => {},
    getOutdoorTemperatureWithFallback: () => 5,
    error: () => {},
  };
  const service = new Service({ device, logger: () => {} });
  service.isEnabled = true;
  let staleness = 'stale';
  service.externalTemperature = { getIndoorTemperature: () => 21.4, getIndoorStaleness: () => staleness };
  service.getEffectiveTargetTemp = () => 35;
  service.getEffectiveOutdoorTemp = async () => 5;
  return {
    service, store, capabilities, diagnostics, triggers, notifications, setStaleness: (value) => { staleness = value; },
  };
}

const POSITIONAL = {
  adaptive_control_mode: 'positional_manual', adaptive_curve_source: 'app', adaptive_curve_at_minus15: 40, adaptive_curve_at_plus15: 25,
};

for (const [name, Service] of [['Tuya', TuyaService], ['Aurora II', ModbusService], ['Aurora III', Aurora3Service]]) {
  test(`${name}: classic with an unchanged indoor temperature skips the cycle with its own reason`, async () => {
    const {
      service, diagnostics, triggers, capabilities,
    } = createControl(Service);
    await service.executeControlCycle();
    await service.executeControlCycle();
    assert.deepStrictEqual(diagnostics.map((d) => d.cycleSkipped), ['indoor_temperature_unchanged'], 'reason written once');
    assert.strictEqual(triggers.length, 0, 'no recommendation');
    assert.strictEqual(capabilities.adlar_simulated_target, null, 'advice untouched');
  });

  test(`${name}: positional with an unchanged indoor temperature follows the bare curve`, async () => {
    const {
      service, store, capabilities, diagnostics, triggers,
    } = createControl(Service, POSITIONAL);
    service.positionalPI.restoreIntegral(2);

    await service.executeControlCycle();
    // app curve 40 → 25 over −15 → +15 °C, outdoor 5 °C: 40 − 0.5·20 = 30; no correction although the room is 0.4 °C too warm
    assert.strictEqual(capabilities.adlar_simulated_target, 30);
    assert.strictEqual(service.lastRecommendedTemp, 30);
    assert.strictEqual(service.positionalPI.getIntegral(), 0, 'integral reset');
    assert.strictEqual(store.adaptive_positional_integral, 0, 'reset integral persisted');
    assert.strictEqual(diagnostics[0].cycleSkipped, 'indoor_temperature_unchanged');
    assert.strictEqual(triggers.length, 1, 'the curve value is recommended');
    assert.strictEqual(triggers[0].tokens.recommended_temperature, 30);
    assert.strictEqual(triggers[0].tokens.adjustment, 0);

    await service.executeControlCycle();
    assert.strictEqual(triggers.length, 1, 'same curve value: not recommended again');

    service.getEffectiveOutdoorTemp = async () => -5;
    await service.executeControlCycle();
    assert.strictEqual(capabilities.adlar_simulated_target, 35, 'the advice keeps following the outdoor temperature');
    assert.strictEqual(triggers.length, 2);
  });

  test(`${name}: one notification at 12 h, one at 24 h and one on recovery`, async () => {
    const {
      service, notifications, setStaleness, store,
    } = createControl(Service);
    setStaleness('fresh');
    await service.executeControlCycle();
    assert.strictEqual(notifications.length, 0);

    setStaleness('warn');
    await service.executeControlCycle();
    await service.executeControlCycle();
    assert.deepStrictEqual(notifications, ['Heat pump: adaptive_control.indoor_unchanged_warn']);

    setStaleness('stale');
    await service.executeControlCycle();
    await service.executeControlCycle();
    assert.strictEqual(notifications.length, 2);
    assert.strictEqual(notifications[1], 'Heat pump: adaptive_control.indoor_unchanged_stale');
    assert.strictEqual(store.adaptive_indoor_staleness, 'stale');

    setStaleness('fresh');
    await service.executeControlCycle();
    assert.strictEqual(notifications[2], 'Heat pump: adaptive_control.indoor_changed_again');
  });

  test(`${name}: a restart while stale does not repeat the notification`, async () => {
    const { service, notifications, store } = createControl(Service);
    store.adaptive_indoor_staleness = 'stale';
    await service.executeControlCycle();
    assert.strictEqual(notifications.length, 0);
  });
}
