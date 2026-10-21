/**
 * Contract tests for the Aurora II SnapshotTriggerService threshold triggers.
 *
 * The run-listeners in FlowCardManagerService read `state[stateField]`. Since v3.0.0
 * the CARD_PROFILES keys lacked the `_modbus` suffix, so the profile fell back to
 * stateField 'currentValue' and 15 of the 17 threshold cards never started a flow.
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

const { SnapshotTriggerService } = require('../../.homeybuild/lib/modbus/services/snapshot-trigger-service');
const { THRESHOLD_TRIGGER_CARDS } = require('../../.homeybuild/lib/modbus/services/flow-card-manager-service');

const SENSOR_KEYS = [
  'ambientT1', 'inletT6', 'outletT7', 'dhwTankTemp', 'outerCoilT2', 'innerCoilT3',
  'suctionT4', 'exhaustT5', 'econInT8', 'econOutT9', 'hpSatTemp', 'lpSatTemp',
  'eevStep', 'eviStep', 'waterFlow', 'compRunningFreq', 'fanSpeed',
];

function snapshot(sensorValues) {
  const sensors = {};
  for (const key of SENSOR_KEYS) {
    if (sensorValues[key] !== undefined) sensors[key] = { value: sensorValues[key] };
  }
  return {
    sensors,
    control: { mode: 1, userMode: 0 },
    status: { activeFaults: [] },
  };
}

function uniform(value) {
  return Object.fromEntries(SENSOR_KEYS.map((key) => [key, value]));
}

function collect(service, snap) {
  const fired = [];
  service.detect(snap, (cardId, tokens, state) => fired.push({ cardId, tokens, state }));
  return fired;
}

test('every threshold card carries the state field its run-listener reads', () => {
  const service = new SnapshotTriggerService();
  collect(service, snapshot(uniform(10)));
  const fired = collect(service, snapshot(uniform(60)));

  assert.strictEqual(THRESHOLD_TRIGGER_CARDS.length, 17);
  for (const { cardId, stateField } of THRESHOLD_TRIGGER_CARDS) {
    const hit = fired.find((entry) => entry.cardId === cardId);
    assert.ok(hit, `${cardId} was not triggered`);
    assert.strictEqual(hit.state[stateField], 60, `${cardId} state.${stateField}`);
    assert.strictEqual(hit.state.condition, 'above', `${cardId} condition`);
  }
});

test('temperature alerts use the 2 °C profile threshold', () => {
  const service = new SnapshotTriggerService();
  collect(service, snapshot({ dhwTankTemp: 45 }));

  assert.deepStrictEqual(collect(service, snapshot({ dhwTankTemp: 46.5 })), []);

  const fired = collect(service, snapshot({ dhwTankTemp: 48.5 }));
  assert.strictEqual(fired.length, 1);
  assert.strictEqual(fired[0].cardId, 'tank_temperature_alert_modbus');
  assert.strictEqual(fired[0].state.temperature, 48.5);
  assert.strictEqual(fired[0].state.condition, 'above');
});

test('pulse-step alerts use the 20-step profile threshold', () => {
  const service = new SnapshotTriggerService();
  collect(service, snapshot({ eevStep: 300 }));

  assert.deepStrictEqual(collect(service, snapshot({ eevStep: 290 })), []);

  const fired = collect(service, snapshot({ eevStep: 260 }));
  assert.strictEqual(fired.length, 1);
  assert.strictEqual(fired[0].cardId, 'eev_pulse_steps_alert_modbus');
  assert.strictEqual(fired[0].state.pulse_steps, 260);
  assert.strictEqual(fired[0].state.condition, 'below');
});
