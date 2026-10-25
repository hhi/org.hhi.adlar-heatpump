/**
 * Unit tests for local-time scheduling in Homey's timezone.
 *
 * The Homey app process runs in UTC, so daily resets and user-entered clock
 * times must be resolved in the timezone configured on the Homey:
 * - Daily resets fire at local midnight, also on days of 23 or 25 hours (DST).
 * - The pre-heat flow card resolves the target clock time in local time.
 *
 * All tests use Europe/Amsterdam; DST changes in 2026 are 29 March and 25 October.
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
  zonedTimeToUtc, startOfLocalDay, nextLocalMidnight, nextLocalTime,
} = require('../../.homeybuild/lib/shared/utils/time-format');
const { calculatePreHeatDuration } = require('../../.homeybuild/lib/shared/utils/preheat-calculator');
const { EnergyTrackingService: TuyaEnergyTracking } = require('../../.homeybuild/lib/tuya/services/energy-tracking-service');
const { EnergyTrackingService: ModbusEnergyTracking } = require('../../.homeybuild/lib/modbus/services/energy-tracking-service');
const { EnergyTrackingService: Aurora3EnergyTracking } = require('../../.homeybuild/lib/aurora3/services/energy-tracking-service');
const { ServiceCoordinator: ModbusCoordinator } = require('../../.homeybuild/lib/modbus/services/service-coordinator');
const { ServiceCoordinator: Aurora3Coordinator } = require('../../.homeybuild/lib/aurora3/services/service-coordinator');
const { FlowCardManagerService: TuyaFlowCards } = require('../../.homeybuild/lib/tuya/services/flow-card-manager-service');
const { FlowCardManagerService: ModbusFlowCards } = require('../../.homeybuild/lib/modbus/services/flow-card-manager-service');
const { FlowCardManagerService: Aurora3FlowCards } = require('../../.homeybuild/lib/aurora3/services/flow-card-manager-service');

const TZ = 'Europe/Amsterdam';
const HOUR_MS = 3600000;
const iso = (date) => date.toISOString();

function withNow(isoString, fn) {
  mock.timers.enable({ apis: ['Date'], now: new Date(isoString) });
  try {
    return fn();
  } finally {
    mock.timers.reset();
  }
}

/**
 * Homey mock that records scheduled timeouts instead of running them
 */
function createHomey() {
  const timeouts = [];
  return {
    timeouts,
    clock: { getTimezone: () => TZ },
    setTimeout: (fn, ms) => {
      const handle = { fn, ms };
      timeouts.push(handle);
      return handle;
    },
    clearTimeout: (handle) => {
      const index = timeouts.indexOf(handle);
      if (index >= 0) timeouts.splice(index, 1);
    },
    // Run the oldest pending timeout, as Homey would when it expires
    fireNext: () => timeouts.shift().fn(),
  };
}

// ==================== Helpers ====================

test('zonedTimeToUtc: winter and summer time', () => {
  assert.strictEqual(iso(zonedTimeToUtc(2026, 1, 15, 7, 0, TZ)), '2026-01-15T06:00:00.000Z');
  assert.strictEqual(iso(zonedTimeToUtc(2026, 7, 15, 7, 0, TZ)), '2026-07-15T05:00:00.000Z');
});

test('zonedTimeToUtc: day overflow gives the next calendar day', () => {
  assert.strictEqual(iso(zonedTimeToUtc(2026, 12, 32, 0, 0, TZ)), '2026-12-31T23:00:00.000Z');
});

test('zonedTimeToUtc: non-existent time (spring forward) moves past the gap', () => {
  // 29 March 2026 02:30 does not exist in Amsterdam; it resolves to 03:30 CEST
  assert.strictEqual(iso(zonedTimeToUtc(2026, 3, 29, 2, 30, TZ)), '2026-03-29T01:30:00.000Z');
});

test('startOfLocalDay: uses the local date, not the UTC date', () => {
  // 23:30Z on 24 Oct is already 25 Oct 01:30 CEST
  assert.strictEqual(iso(startOfLocalDay(new Date('2026-10-24T23:30:00Z'), TZ)), '2026-10-24T22:00:00.000Z');
  assert.strictEqual(iso(startOfLocalDay(new Date('2026-10-24T21:30:00Z'), TZ)), '2026-10-23T22:00:00.000Z');
});

test('nextLocalMidnight: summer time, winter time and both DST changes', () => {
  assert.strictEqual(iso(nextLocalMidnight(new Date('2026-07-15T12:00:00Z'), TZ)), '2026-07-15T22:00:00.000Z');
  assert.strictEqual(iso(nextLocalMidnight(new Date('2026-01-15T12:00:00Z'), TZ)), '2026-01-15T23:00:00.000Z');
  // Day of 25 hours: from midnight 25 Oct (CEST) to midnight 26 Oct (CET)
  assert.strictEqual(iso(nextLocalMidnight(new Date('2026-10-24T22:00:00Z'), TZ)), '2026-10-25T23:00:00.000Z');
  // Day of 23 hours: from midnight 29 Mar (CET) to midnight 30 Mar (CEST)
  assert.strictEqual(iso(nextLocalMidnight(new Date('2026-03-28T23:00:00Z'), TZ)), '2026-03-29T22:00:00.000Z');
});

test('nextLocalMidnight: an instant exactly at midnight gives the next midnight', () => {
  assert.strictEqual(iso(nextLocalMidnight(new Date('2026-07-15T22:00:00Z'), TZ)), '2026-07-16T22:00:00.000Z');
});

test('nextLocalTime: later today, already passed, and exactly now', () => {
  const now = new Date('2026-07-15T12:00:00Z'); // 14:00 CEST
  assert.strictEqual(iso(nextLocalTime(18, 30, TZ, now)), '2026-07-15T16:30:00.000Z');
  assert.strictEqual(iso(nextLocalTime(7, 0, TZ, now)), '2026-07-16T05:00:00.000Z');
  assert.strictEqual(iso(nextLocalTime(14, 0, TZ, now)), '2026-07-16T12:00:00.000Z');
});

test('nextLocalTime: local date differs from the UTC date', () => {
  // 22:30Z on 24 Oct is 00:30 CEST on 25 Oct; 07:00 the same local morning is after the DST change
  assert.strictEqual(iso(nextLocalTime(7, 0, TZ, new Date('2026-10-24T22:30:00Z'))), '2026-10-25T06:00:00.000Z');
});

// ==================== Daily resets ====================

const energyTrackingDrivers = [
  ['Tuya', TuyaEnergyTracking],
  ['Aurora II', ModbusEnergyTracking],
  ['Aurora III', Aurora3EnergyTracking],
];

for (const [driver, EnergyTrackingService] of energyTrackingDrivers) {
  test(`${driver}: energy tracking reset fires at local midnight and reschedules over DST`, () => {
    const homey = createHomey();
    const fakeService = {
      device: { homey },
      dailyResetTimeout: null,
      logger: () => {},
      performDailyReset: async () => {},
    };
    const schedule = EnergyTrackingService.prototype.scheduleMidnightReset;
    fakeService.scheduleMidnightReset = schedule;

    withNow('2026-10-24T18:00:00Z', () => schedule.call(fakeService)); // 20:00 CEST
    assert.strictEqual(homey.timeouts.length, 1);
    assert.strictEqual(homey.timeouts[0].ms, 4 * HOUR_MS, 'until 00:00 CEST = 22:00Z');

    // Fire 5 ms early: the next reset must still be the following midnight (day of 25 hours)
    withNow('2026-10-24T21:59:59.995Z', () => homey.fireNext());
    assert.strictEqual(homey.timeouts.length, 1, 'old timeout replaced, not stacked');
    assert.strictEqual(homey.timeouts[0].ms, 25 * HOUR_MS + 5);
  });
}

const coordinatorDrivers = [
  ['Aurora II', ModbusCoordinator],
  ['Aurora III', Aurora3Coordinator],
];

for (const [driver, ServiceCoordinator] of coordinatorDrivers) {
  test(`${driver}: disconnect count resets at local midnight, also on a day of 23 hours`, () => {
    const homey = createHomey();
    const values = {};
    const fakeCoordinator = {
      _disconnectDailyResetTimer: null,
      logger: () => {},
      device: {
        homey,
        hasCapability: (id) => id === 'adlar_daily_disconnect_count',
        setCapabilityValue: async (id, value) => { values[id] = value; },
      },
    };
    const schedule = ServiceCoordinator.prototype._scheduleDailyDisconnectReset;
    fakeCoordinator._scheduleDailyDisconnectReset = schedule;

    withNow('2026-03-28T20:00:00Z', () => schedule.call(fakeCoordinator)); // 21:00 CET
    assert.strictEqual(homey.timeouts[0].ms, 3 * HOUR_MS, 'until 00:00 CET = 23:00Z');

    withNow('2026-03-28T23:00:00Z', () => homey.fireNext());
    assert.strictEqual(values.adlar_daily_disconnect_count, 0);
    assert.strictEqual(homey.timeouts.length, 1);
    assert.strictEqual(homey.timeouts[0].ms, 23 * HOUR_MS, 'next midnight is 00:00 CEST = 22:00Z');
  });
}

// ==================== Pre-heat flow card ====================

const preHeatDrivers = [
  ['Tuya', TuyaFlowCards, 'calculate_preheat_time'],
  ['Aurora II', ModbusFlowCards, 'calculate_preheat_time_modbus'],
  ['Aurora III', Aurora3FlowCards, 'calculate_preheat_time_aurora3'],
];

/**
 * Register the building insights cards on a mock device and return the pre-heat run listener
 */
async function getPreHeatListener(FlowCardManagerService, cardId) {
  const listeners = {};
  const card = (id) => ({
    registerRunListener: (fn) => { listeners[id] = fn; return card(id); },
    registerArgumentAutocompleteListener: () => card(id),
    trigger: async () => {},
  });
  const homey = {
    ...createHomey(),
    setInterval: () => ({}),
    clearInterval: () => {},
    flow: {
      getActionCard: card,
      getConditionCard: card,
      getTriggerCard: card,
      getDeviceTriggerCard: card,
    },
  };
  const device = {
    homey,
    hasCapability: () => false,
    getSetting: () => null,
    getCapabilityValue: () => null,
    serviceCoordinator: {
      getAdaptiveControl: () => ({
        // tau = C / UA = 15 h → 8 h per 2 °C
        getBuildingModelService: () => ({ getLearner: () => ({ getModel: () => ({ C: 15, UA: 1, confidence: 80 }) }) }),
        getExternalTemperatureService: () => ({ getIndoorTemperature: () => 19 }),
      }),
    },
  };
  const service = new FlowCardManagerService({ device, buildingInsightsService: {} });
  await service.registerBuildingInsightsCards();
  assert.ok(listeners[cardId], `${cardId} listener registered`);
  return listeners[cardId];
}

for (const [driver, FlowCardManagerService, cardId] of preHeatDrivers) {
  test(`${driver}: pre-heat start time uses Homey timezone`, async () => {
    const listener = await getPreHeatListener(FlowCardManagerService, cardId);

    // 14:00 CEST, target 23:00 local, 1 °C to go → 4 h → start 19:00
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-15T12:00:00Z') });
    try {
      const result = await listener({ target_clock_time: '23:00', target_indoor_temp: 20 });
      assert.strictEqual(calculatePreHeatDuration(15, 1), 4);
      assert.strictEqual(result.start_time, '19:00');
      assert.strictEqual(result.duration_hours, 4);
    } finally {
      mock.timers.reset();
    }
  });

  test(`${driver}: pre-heat start time across the DST change`, async () => {
    const listener = await getPreHeatListener(FlowCardManagerService, cardId);

    // 24 Oct 22:00 CEST, target 07:00 CET next morning, 2 °C to go → 8 h before 06:00Z = 22:00Z = 00:00 CEST
    // (the clock goes back an hour in between, so 8 h before 07:00 is 00:00, not 23:00)
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-24T20:00:00Z') });
    try {
      const result = await listener({ target_clock_time: '07:00', target_indoor_temp: 21 });
      assert.strictEqual(result.start_time, '00:00');
      assert.strictEqual(result.duration_hours, 8);
    } finally {
      mock.timers.reset();
    }
  });
}
