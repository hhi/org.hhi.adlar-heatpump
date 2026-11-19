/**
 * Live monitoring address (v3.13.0): the read-only device setting shows where the local live
 * monitoring page can be opened, or that its port is already in use.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const {
  formatLiveMonitoringAddress, updateLiveMonitoringAddress, LIVE_MONITORING_ADDRESS_SETTING,
} = require('../../.homeybuild/lib/shared/live-monitoring-address');

const APP_DIR = path.join(__dirname, '..', '..');

test('the address uses the Homey host with the dashboard port', () => {
  assert.equal(formatLiveMonitoringAddress('192.168.1.10:80', 8090), 'http://192.168.1.10:8090/');
  assert.equal(formatLiveMonitoringAddress('192.168.1.10', 8091), 'http://192.168.1.10:8091/');
  assert.equal(formatLiveMonitoringAddress('[fd00::5]:80', 8092), 'http://[fd00::5]:8092/');
  assert.equal(formatLiveMonitoringAddress('fd00::5', 8092), 'http://[fd00::5]:8092/');
});

test('no address without a usable host or port', () => {
  assert.equal(formatLiveMonitoringAddress(null, 8090), null);
  assert.equal(formatLiveMonitoringAddress('', 8090), null);
  assert.equal(formatLiveMonitoringAddress(':80', 8090), null);
  assert.equal(formatLiveMonitoringAddress('192.168.1.10:80', 0), null);
  assert.equal(formatLiveMonitoringAddress('192.168.1.10:80', 70000), null);
});

/** A device stand-in with the parts Homey.Device offers. */
function fakeDevice(localAddress, current = '') {
  const settings = { [LIVE_MONITORING_ADDRESS_SETTING]: current };
  const writes = [];
  return {
    writes,
    homey: {
      cloud: {
        getLocalAddress: () => (localAddress instanceof Error
          ? Promise.reject(localAddress) : Promise.resolve(localAddress)),
      },
      __: (key, tags) => `${key}:${tags.port}`,
    },
    getSetting: (key) => settings[key],
    setSettings: async (values) => {
      writes.push(values);
      Object.assign(settings, values);
    },
  };
}

test('a listening dashboard shows its address; an unchanged value is not written again', async () => {
  const device = fakeDevice('192.168.1.10:80');
  assert.equal(await updateLiveMonitoringAddress(device, 8090, 8090), 'http://192.168.1.10:8090/');
  await updateLiveMonitoringAddress(device, 8090, 8090);
  assert.deepEqual(device.writes, [{ live_monitoring_address: 'http://192.168.1.10:8090/' }]);
});

test('a dashboard that did not start shows the configured port as unavailable', async () => {
  const device = fakeDevice('192.168.1.10:80');
  assert.equal(await updateLiveMonitoringAddress(device, null, 8095), 'live_monitoring.not_available:8095');
});

test('an unknown Homey address falls back to a text with the port', async () => {
  const device = fakeDevice(new Error('no address'));
  assert.equal(await updateLiveMonitoringAddress(device, 8090, 8090), 'live_monitoring.address_unknown:8090');
});

test('every language has both texts', () => {
  for (const lang of ['en', 'nl', 'de', 'fr']) {
    const texts = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'locales', `${lang}.json`), 'utf8')).live_monitoring;
    for (const key of ['not_available', 'address_unknown']) {
      assert.match(texts?.[key] ?? '', /__port__/, `${lang}: live_monitoring.${key}`);
    }
  }
});

for (const driver of ['modbus', 'aurora3']) {
  const modulePath = path.join(APP_DIR, '.homeybuild', 'lib', driver, 'services', 'dashboard-service.js');
  // Standalone apps contain only their own Modbus service.
  if (!fs.existsSync(modulePath)) continue;
  const { DashboardService } = require(modulePath);

  test(`${driver}: start() reports the listening port, or null when the port is in use`, async () => {
    const blocker = http.createServer();
    await new Promise((resolve) => blocker.listen(0, resolve));
    const busyPort = blocker.address().port;
    const options = { appDir: APP_DIR, publicDir: path.join(APP_DIR, 'public', driver === 'aurora3' ? 'aurora3' : ''), logger: () => {} };
    const busy = new DashboardService({ ...options, port: busyPort });
    const free = new DashboardService({ ...options, port: 0 });
    try {
      await busy.start();
      assert.equal(busy.listeningPort, null);
      await free.start();
      assert.ok(free.listeningPort > 0);
    } finally {
      await busy.destroy();
      await free.destroy();
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
}
