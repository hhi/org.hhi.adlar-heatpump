/**
 * Tests for R24 (v3.7.1): a skipped adaptive control cycle is visible in
 * adaptive_control_diagnostics (e.g. no 'Desired indoor temperature' set), written once per reason.
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

const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

function createService(ServiceClass, { indoorTemp, desired }) {
  const capabilities = { 'target_temperature.indoor': desired, adaptive_control_diagnostics: '' };
  const writes = [];
  const device = {
    homey: {
      __: (key) => key,
      setInterval: () => ({}),
      clearInterval: () => {},
      setTimeout: () => ({}),
    },
    getSetting: () => undefined,
    getSettings: () => ({}),
    getStoreValue: () => null,
    setStoreValue: async () => {},
    getCapabilityValue: (key) => capabilities[key] ?? null,
    hasCapability: (key) => Object.prototype.hasOwnProperty.call(capabilities, key),
    setCapabilityValue: async (key, value) => {
      capabilities[key] = value;
      if (key === 'adaptive_control_diagnostics') writes.push(JSON.parse(value));
    },
    error: () => {},
  };
  const service = new ServiceClass({ device, logger: () => {} });
  service.isEnabled = true;
  service.externalTemperature = { getIndoorTemperature: () => indoorTemp };
  service.getEffectiveTargetTemp = () => 35;
  return { service, writes, capabilities };
}

const drivers = [['Tuya', TuyaService], ['Aurora II', ModbusService], ['Aurora III', Aurora3Service]];

for (const [name, ServiceClass] of drivers) {
  test(`${name}: no desired indoor temperature → reason in the diagnostics`, async () => {
    const { service, writes } = createService(ServiceClass, { indoorTemp: 20, desired: null });
    await service.executeControlCycle();
    assert.strictEqual(writes.length, 1);
    assert.strictEqual(writes[0].cycleSkipped, 'no_desired_indoor_temperature');
    assert.ok(writes[0].timestamp);
  });

  test(`${name}: the same reason is written only once`, async () => {
    const { service, writes } = createService(ServiceClass, { indoorTemp: 20, desired: null });
    await service.executeControlCycle();
    await service.executeControlCycle();
    await service.executeControlCycle();
    assert.strictEqual(writes.length, 1);
  });

  test(`${name}: a different reason is written again`, async () => {
    const { service, writes } = createService(ServiceClass, { indoorTemp: null, desired: null });
    await service.executeControlCycle();
    service.externalTemperature = { getIndoorTemperature: () => 20 };
    await service.executeControlCycle();
    assert.deepStrictEqual(writes.map((w) => w.cycleSkipped), ['no_indoor_temperature', 'no_desired_indoor_temperature']);
  });
}
