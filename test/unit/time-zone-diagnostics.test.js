/**
 * Unit tests for times shown to the user and the Time Schedule flow card in Homey's timezone.
 *
 * The Homey app process runs in UTC. "Last received" diagnostics and the Time Schedule card
 * must use the timezone configured on the Homey, not the process timezone. The tests use a
 * timezone different from the machine's (America/New_York besides Europe/Amsterdam), so they
 * also fail on a development machine that happens to run in Europe/Amsterdam.
 *
 * DST changes in 2026 (Europe/Amsterdam): 29 March and 25 October.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') return { Device: class {}, App: class {} };
  return originalLoad.call(this, request, parent, isMain);
};

const {
  formatDateTimeMinutes, getZonedMinuteOfDay, getZonedDate,
} = require('../../.homeybuild/lib/shared/utils/time-format');
const { TimeScheduleCalculator } = require('../../.homeybuild/lib/shared/time-schedule-calculator');

const AMS = 'Europe/Amsterdam';
const NYC = 'America/New_York';
const SCHEDULE = '06:00-09:00: 22, 09:00-17:00: 19, default: 18';

test('formatDateTimeMinutes shows the wall-clock time of the Homey timezone', () => {
  // Winter time (CET, UTC+1)
  assert.strictEqual(formatDateTimeMinutes(new Date('2026-11-02T16:45:00Z'), AMS), '2026-11-02 17:45');
  // Summer time (CEST, UTC+2)
  assert.strictEqual(formatDateTimeMinutes(new Date('2026-10-11T11:37:00Z'), AMS), '2026-10-11 13:37');
  // Date change: 23:30 UTC is already the next day in Amsterdam
  assert.strictEqual(formatDateTimeMinutes(new Date('2026-10-31T23:30:00Z'), AMS), '2026-11-01 00:30');
  assert.strictEqual(formatDateTimeMinutes(new Date('2026-11-02T16:45:00Z'), NYC), '2026-11-02 11:45');
});

test('getZonedMinuteOfDay and getZonedDate use the Homey timezone', () => {
  assert.strictEqual(getZonedMinuteOfDay(new Date('2026-11-02T05:30:00Z'), AMS), 6 * 60 + 30);
  assert.strictEqual(getZonedMinuteOfDay(new Date('2026-11-02T23:15:00Z'), AMS), 15);
  assert.deepStrictEqual(getZonedDate(new Date('2026-11-02T23:15:00Z'), AMS), { year: 2026, month: 11, day: 3 });
});

test('Time Schedule: 06:00 Amsterdam winter time switches at 05:00 UTC', () => {
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, new Date('2026-11-02T04:59:00Z'), AMS), 18);
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, new Date('2026-11-02T05:00:00Z'), AMS), 22);
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, new Date('2026-11-02T08:30:00Z'), AMS), 19); // 09:30
});

test('Time Schedule: 06:00 Amsterdam summer time switches at 04:00 UTC', () => {
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, new Date('2026-07-01T03:59:00Z'), AMS), 18);
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, new Date('2026-07-01T04:00:00Z'), AMS), 22);
});

test('Time Schedule: the same instant gives a different value per timezone', () => {
  const instant = new Date('2026-11-02T12:00:00Z'); // 13:00 Amsterdam, 07:00 New York
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, instant, AMS), 19);
  assert.strictEqual(TimeScheduleCalculator.evaluate(SCHEDULE, instant, NYC), 22);
});

test('Time Schedule: overnight range in local time', () => {
  const overnight = '22:00-06:00: 17, default: 20';
  assert.strictEqual(TimeScheduleCalculator.evaluate(overnight, new Date('2026-11-02T21:30:00Z'), AMS), 17); // 22:30
  assert.strictEqual(TimeScheduleCalculator.evaluate(overnight, new Date('2026-11-02T20:30:00Z'), AMS), 20); // 21:30
});

test('Time Schedule: the error message shows the local time', () => {
  assert.throws(
    () => TimeScheduleCalculator.evaluate('06:00-09:00: 22', new Date('2026-11-02T12:00:00Z'), AMS),
    /current time: 13:00/,
  );
});

test('the "last received" diagnostics of all drivers use the Homey timezone', () => {
  const fake = { device: { homey: { clock: { getTimezone: () => NYC } } } };
  const instant = new Date('2026-11-02T16:45:00Z');
  for (const driver of ['tuya', 'modbus', 'aurora3']) {
    const mod = require(`../../.homeybuild/lib/${driver}/services/flow-card-manager-service`);
    const Service = mod.FlowCardManagerService || mod.default;
    assert.strictEqual(Service.prototype.formatDiagnosticTimestamp.call(fake, instant), '2026-11-02 11:45', driver);
  }
});
