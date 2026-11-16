/**
 * v3.11.0: existing devices keep the fixed price thresholds, newly paired devices get 'auto'.
 * Homey runs onInit (migration) before onAdded (new device).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  migratePriceThresholdMode,
  useAutoThresholdsForNewDevice,
  PRICE_THRESHOLD_MIGRATION_FLAG,
} = require('../../.homeybuild/lib/shared/adaptive/price-threshold-mode-migration');

function createDevice({ settings = {}, store = {}, failSettings = false } = {}) {
  return {
    settings: { price_threshold_mode: 'auto', ...settings }, // Homey fills in the default of a new setting
    store: { ...store },
    getStoreValue(key) {
      return this.store[key];
    },
    async setStoreValue(key, value) {
      this.store[key] = value;
    },
    async setSettings(values) {
      if (failSettings) throw new Error('settings save failed');
      Object.assign(this.settings, values);
    },
  };
}

test('an existing device is set to fixed once', async () => {
  const device = createDevice();
  assert.strictEqual(await migratePriceThresholdMode(device), true);
  assert.strictEqual(device.settings.price_threshold_mode, 'fixed');
  assert.strictEqual(device.store[PRICE_THRESHOLD_MIGRATION_FLAG], true);
});

test('a later choice of the user survives a restart', async () => {
  const device = createDevice();
  await migratePriceThresholdMode(device);
  device.settings.price_threshold_mode = 'auto'; // user switches to automatic
  assert.strictEqual(await migratePriceThresholdMode(device), false);
  assert.strictEqual(device.settings.price_threshold_mode, 'auto');
});

test('a new device ends with auto: onInit first, then onAdded, then a restart', async () => {
  const device = createDevice();
  await migratePriceThresholdMode(device); // onInit
  await useAutoThresholdsForNewDevice(device); // onAdded
  assert.strictEqual(device.settings.price_threshold_mode, 'auto');
  assert.strictEqual(await migratePriceThresholdMode(device), false); // next start
  assert.strictEqual(device.settings.price_threshold_mode, 'auto');
});

test('a failed settings save leaves the flag unset, so the next start retries', async () => {
  const device = createDevice({ failSettings: true });
  await assert.rejects(() => migratePriceThresholdMode(device));
  assert.strictEqual(device.store[PRICE_THRESHOLD_MIGRATION_FLAG], undefined);
});
