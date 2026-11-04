/**
 * External outdoor temperature. Tuya driver: the flow-card value expires after 1 hour,
 * is restored after a restart only when younger than 4 hours, and the fallback reads the
 * heat pump's own ambient sensor (measure_temperature.around_temp). Aurora drivers: after a
 * restart the 1-hour TTL counts on from the stored flow-card timestamp.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return { Device: class {} };
  return originalLoad.call(this, request, parent, isMain);
};

const { isExternalValueFresh } = require('../../.homeybuild/lib/shared/utils/external-value-age');
const { DeviceConstants } = require('../../.homeybuild/lib/tuya/constants');
const TuyaDevice = require('../../.homeybuild/drivers/intelligent-heat-pump/device');

const HOUR = 60 * 60 * 1000;
const DeviceClass = TuyaDevice.default || TuyaDevice;

function fakeDevice({ capabilities = {}, store = {} } = {}) {
  const caps = { ...capabilities };
  return {
    caps,
    hasCapability: (id) => id in caps,
    getCapabilityValue: (id) => caps[id] ?? null,
    setCapabilityValue: async (id, value) => { caps[id] = value; },
    getStoreValue: (key) => store[key] ?? null,
    debugLog: () => {},
    logger: { info: () => {} },
  };
}

test('a value within the TTL is fresh, an older one is stale', () => {
  const now = 10 * HOUR;
  assert.strictEqual(isExternalValueFresh(now - 59 * 60 * 1000, now, HOUR), true);
  assert.strictEqual(isExternalValueFresh(now - HOUR, now, HOUR), true);
  assert.strictEqual(isExternalValueFresh(now - HOUR - 1, now, HOUR), false);
});

test('a missing or invalid timestamp counts as stale', () => {
  assert.strictEqual(isExternalValueFresh(null, Date.now(), HOUR), false);
  assert.strictEqual(isExternalValueFresh(undefined, Date.now(), HOUR), false);
  assert.strictEqual(isExternalValueFresh('123', Date.now(), HOUR), false);
  assert.strictEqual(isExternalValueFresh(Number.NaN, Date.now(), HOUR), false);
});

test('the Tuya TTLs match the Aurora drivers', () => {
  assert.strictEqual(DeviceConstants.EXTERNAL_DATA_TTL_MS, HOUR);
  assert.strictEqual(DeviceConstants.EXTERNAL_DATA_RESTORE_TTL_MS, 4 * HOUR);
});

test('expireStaleExternalAmbient clears a value older than 1 hour', async () => {
  const device = fakeDevice({
    capabilities: { adlar_external_ambient: 20 },
    store: { external_outdoor_temp_timestamp: Date.now() - 3 * 7 * 24 * HOUR },
  });
  await DeviceClass.prototype.expireStaleExternalAmbient.call(device);
  assert.strictEqual(device.caps.adlar_external_ambient, null);
});

test('expireStaleExternalAmbient keeps a recent value', async () => {
  const device = fakeDevice({
    capabilities: { adlar_external_ambient: 12.3 },
    store: { external_outdoor_temp_timestamp: Date.now() - 10 * 60 * 1000 },
  });
  await DeviceClass.prototype.expireStaleExternalAmbient.call(device);
  assert.strictEqual(device.caps.adlar_external_ambient, 12.3);
});

test('the fallback reads the Tuya ambient sensor when the external value is empty', () => {
  const device = fakeDevice({
    capabilities: { adlar_external_ambient: null, 'measure_temperature.around_temp': 12.4 },
  });
  assert.strictEqual(DeviceClass.prototype.getOutdoorTemperatureWithFallback.call(device), 12.4);
});

test('the external value has priority over the ambient sensor', () => {
  const device = fakeDevice({
    capabilities: { adlar_external_ambient: 12.0, 'measure_temperature.around_temp': 12.4 },
  });
  assert.strictEqual(DeviceClass.prototype.getOutdoorTemperatureWithFallback.call(device), 12.0);
});

const ModbusDevice = require('../../.homeybuild/drivers/intelligent-heatpump-modbus/device');
const Aurora3Device = require('../../.homeybuild/drivers/intelligent-heatpump-aurora3/device');

for (const [name, mod] of [['Aurora I/II', ModbusDevice], ['Aurora III', Aurora3Device]]) {
  const Klass = mod.default || mod;

  test(`${name}: after a restart the outdoor-temperature TTL uses the stored timestamp`, () => {
    const storedTs = Date.now() - 3 * HOUR;
    const device = { externalDataTimestamps: new Map(), ...fakeDevice({ store: { external_outdoor_temp_timestamp: storedTs } }) };
    assert.strictEqual(Klass.prototype.getExternalDataTimestamp.call(device, 'adlar_external_ambient'), storedTs);
  });

  test(`${name}: a flow update in this session has priority over the stored timestamp`, () => {
    const now = Date.now();
    const device = {
      externalDataTimestamps: new Map([['adlar_external_ambient', now]]),
      ...fakeDevice({ store: { external_outdoor_temp_timestamp: now - 3 * HOUR } }),
    };
    assert.strictEqual(Klass.prototype.getExternalDataTimestamp.call(device, 'adlar_external_ambient'), now);
  });

  test(`${name}: other external values without a flow update count as stale`, () => {
    const device = { externalDataTimestamps: new Map(), ...fakeDevice({ store: { external_outdoor_temp_timestamp: Date.now() } }) };
    assert.strictEqual(Klass.prototype.getExternalDataTimestamp.call(device, 'adlar_external_flow'), 0);
  });
}
