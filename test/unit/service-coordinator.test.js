/**
 * Lifecycle tests for ServiceCoordinator destroy ordering (ADR-061).
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

const { ServiceCoordinator } = require('../../.homeybuild/lib/modbus/services/service-coordinator');

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

async function waitUntil(predicate) {
  for (let i = 0; i < 10; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('ADR-061: ServiceCoordinator.destroy awaits AdaptiveControlService.destroy', async () => {
  const gate = deferred();
  const calls = [];
  const coordinator = Object.create(ServiceCoordinator.prototype);
  coordinator.logger = () => {};
  coordinator.device = {
    homey: {
      clearTimeout: () => {},
    },
    removeListener: () => {},
  };
  coordinator.healthCheckInterval = null;
  coordinator._disconnectStatusTimer = null;
  coordinator._disconnectDailyResetTimer = null;
  coordinator._degradedSinceTimer = null;
  coordinator.serviceHealth = new Map();
  coordinator.isInitialized = true;
  coordinator.settingsManager = { destroy: () => calls.push('settings') };
  coordinator.capabilityHealth = { destroy: () => calls.push('capability') };
  coordinator.energyTracking = { destroy: () => calls.push('energy') };
  coordinator.flowCardManager = { destroy: () => calls.push('flowcard') };
  coordinator.buildingInsights = { destroy: async () => calls.push('insights') };
  coordinator.adaptiveControl = {
    saveEnergyOptimizerState: async () => calls.push('energy-state'),
    destroy: async () => {
      calls.push('adaptive-start');
      await gate.promise;
      calls.push('adaptive-done');
    },
  };
  coordinator.modbusConnection = { destroy: async () => calls.push('modbus') };

  let resolved = false;
  const destroyPromise = coordinator.destroy().then(() => { resolved = true; });
  await waitUntil(() => calls.includes('adaptive-start'));

  assert.strictEqual(resolved, false, 'destroy must not resolve before adaptive cleanup resolves');
  assert.strictEqual(calls.includes('modbus'), false, 'modbus cleanup must wait for adaptive cleanup');

  gate.resolve();
  await destroyPromise;

  assert.strictEqual(resolved, true);
  assert.ok(calls.indexOf('adaptive-done') < calls.indexOf('modbus'), 'modbus cleanup runs after adaptive cleanup');
});

test('poll timeout marks Homey connection visibly offline without socket disconnect and recovers on snapshot', () => {
  let degradedTimeout;
  const capabilityWrites = [];
  const unavailableReasons = [];
  const availableCalls = [];
  const warningWrites = [];
  const appliedSnapshots = [];
  const connectionStates = [];
  const reconnectReasons = [];
  const restoreCalls = [];
  const order = [];
  const coordinator = Object.create(ServiceCoordinator.prototype);

  coordinator.logger = () => {};
  coordinator._connectionQuality = 'online';
  coordinator._visibleConnectionConnected = true;
  coordinator._degradedSinceTimer = null;
  coordinator._lastDisconnectCountMs = 0;
  coordinator._lastSuccessfulFastPollAt = null;
  coordinator._lastErrorContext = null;
  coordinator._consecutiveFastPollFailures = 0;
  coordinator._consecutiveSuperfastPollFailures = 0;
  coordinator._consecutiveNonFastRequiredFailures = 0;
  coordinator._structurallyUnsupportedFast = false;
  coordinator._errorCountByContext = new Map();
  coordinator._prevDefrosting = false;
  coordinator.snapshotTrigger = { detect: () => {} };
  coordinator.capabilityHealth = { updateCapabilityHealth: () => {} };
  coordinator.energyTracking = {
    setConnectionState: async (connected) => {
      connectionStates.push(connected);
    },
    updateIntelligentPowerMeasurement: async () => {},
  };
  coordinator.adaptiveControl = {
    onConnectionRestored: () => {
      restoreCalls.push(true);
      order.push('restored');
    },
  };
  coordinator.device = {
    homey: {
      setTimeout: (fn) => {
        degradedTimeout = fn;
        return 'degraded-timeout';
      },
      clearTimeout: () => {},
    },
    hasCapability: () => true,
    getCapabilityValue: (capability) => (capability === 'adlar_daily_disconnect_count' ? 0 : null),
    setCapabilityValue: (capability, value) => {
      capabilityWrites.push([capability, value]);
      if (capability === 'adlar_connection_active' || capability === 'adlar_connection_status') {
        order.push(`cap:${capability}:${value}`);
      }
      return Promise.resolve();
    },
    setWarning: (warning) => {
      warningWrites.push(warning);
      order.push(`warning:${warning}`);
      return Promise.resolve();
    },
    setAvailable: () => {
      availableCalls.push(true);
      order.push('available');
      return Promise.resolve();
    },
    setUnavailable: (reason) => {
      unavailableReasons.push(reason);
      return Promise.resolve();
    },
    applyModbusSnapshot: (snapshot) => {
      appliedSnapshots.push(snapshot);
      order.push('snapshot');
    },
  };
  coordinator.modbusConnection = {
    forceReconnect: async (reason) => {
      reconnectReasons.push(reason);
    },
  };

  coordinator._setConnectionQuality('degraded');
  assert.strictEqual(typeof degradedTimeout, 'function', 'degraded timer is scheduled');

  degradedTimeout();

  assert.strictEqual(coordinator._connectionQuality, 'offline');
  assert.deepStrictEqual(
    capabilityWrites.find(([capability]) => capability === 'adlar_connection_active'),
    ['adlar_connection_active', false],
  );
  assert.ok(
    capabilityWrites.some(([capability, value]) => capability === 'adlar_connection_status' && String(value).includes('poll timeout')),
    'connection status includes poll timeout reason',
  );
  assert.deepStrictEqual(
    capabilityWrites.find(([capability]) => capability === 'adlar_daily_disconnect_count'),
    ['adlar_daily_disconnect_count', 1],
  );
  assert.deepStrictEqual(unavailableReasons, ['Modbus reageert niet op polling']);
  assert.deepStrictEqual(reconnectReasons, ['poll timeout']);

  coordinator._handleModbusData({
    sourcePollGroup: 'fast',
    sensors: {
      outletT7: { value: 30 },
      inletT6: { value: 27 },
      ambientT1: { value: 8 },
    },
    power: {
      inputPowerKw: 1.2,
    },
    control: {
      on: true,
    },
    status: {
      defrosting: false,
      activeFaults: [],
    },
  });

  assert.strictEqual(coordinator._connectionQuality, 'online');
  assert.ok(availableCalls.length >= 1, 'poll recovery must make the Homey device available again');
  assert.ok(warningWrites.includes(null), 'poll recovery clears the Modbus warning');
  assert.deepStrictEqual(
    capabilityWrites.filter(([capability]) => capability === 'adlar_connection_active').at(-1),
    ['adlar_connection_active', true],
  );
  assert.ok(
    capabilityWrites.some(([capability, value]) => capability === 'adlar_connection_status' && String(value).startsWith('Connected:')),
    'connection status is restored to Connected',
  );
  assert.strictEqual(appliedSnapshots.length, 1, 'snapshot is still forwarded after recovery');
  assert.deepStrictEqual(connectionStates, [true]);
  assert.deepStrictEqual(restoreCalls, [true]);
  assert.ok(order.indexOf('available') !== -1 && order.indexOf('available') < order.indexOf('snapshot'), 'availability is restored before values are applied');
  assert.ok(order.some((entry) => entry.startsWith('cap:adlar_connection_active:true')), 'connection capability is restored before snapshot');
  assert.ok(
    order.findIndex((entry) => entry.startsWith('cap:adlar_connection_active:true')) < order.indexOf('snapshot'),
    'connection capability is restored before values are applied',
  );
});

test('TCP reconnect does not mark Homey visibly connected before a valid Modbus snapshot', () => {
  const capabilityWrites = [];
  const availableCalls = [];
  const connectionStates = [];
  const restoredCalls = [];
  const coordinator = Object.create(ServiceCoordinator.prototype);

  coordinator.logger = () => {};
  coordinator._connectionQuality = 'offline';
  coordinator._visibleConnectionConnected = false;
  coordinator._disconnectStatusTimer = null;
  coordinator._consecutiveFastPollFailures = 3;
  coordinator._consecutiveSuperfastPollFailures = 2;
  coordinator._consecutiveNonFastRequiredFailures = 1;
  coordinator._errorCountByContext = new Map([['poll:fast:block:0x0', 1]]);
  coordinator.serviceHealth = new Map();
  coordinator.device = {
    homey: {
      clearTimeout: () => {},
    },
    hasCapability: () => true,
    setCapabilityValue: (capability, value) => {
      capabilityWrites.push([capability, value]);
      return Promise.resolve();
    },
    setAvailable: () => {
      availableCalls.push(true);
      return Promise.resolve();
    },
  };
  coordinator.energyTracking = {
    setConnectionState: async (connected) => {
      connectionStates.push(connected);
    },
  };
  coordinator.adaptiveControl = {
    onConnectionRestored: () => restoredCalls.push(true),
  };

  coordinator._handleConnected();

  assert.strictEqual(coordinator._connectionQuality, 'offline');
  assert.strictEqual(coordinator._visibleConnectionConnected, false);
  assert.deepStrictEqual(capabilityWrites, []);
  assert.deepStrictEqual(availableCalls, []);
  assert.deepStrictEqual(connectionStates, []);
  assert.deepStrictEqual(restoredCalls, []);
  assert.strictEqual(coordinator._consecutiveFastPollFailures, 0);
  assert.strictEqual(coordinator._consecutiveSuperfastPollFailures, 0);
  assert.strictEqual(coordinator._consecutiveNonFastRequiredFailures, 0);
  assert.strictEqual(coordinator._errorCountByContext.size, 0);
});
