/**
 * Tests for the adaptive water temperature range (adaptive_min_setpoint / adaptive_max_setpoint):
 * the shared range helpers and the recommendation clamp of the Aurora II and Aurora III services.
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
  isSetpointRangeValid,
  resolveMaxSetpoint,
  SETPOINT_RANGE_MIN_GAP,
} = require('../../.homeybuild/lib/shared/adaptive/setpoint-range');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');

test('isSetpointRangeValid requires the maximum to lie at least the gap above the minimum', () => {
  assert.strictEqual(SETPOINT_RANGE_MIN_GAP, 2);
  assert.strictEqual(isSetpointRangeValid(25, 27), true);
  assert.strictEqual(isSetpointRangeValid(25, 26), false);
  assert.strictEqual(isSetpointRangeValid(30, 25), false);
});

test('resolveMaxSetpoint uses the setting but never exceeds the hard maximum', () => {
  assert.strictEqual(resolveMaxSetpoint(32, 60), 32);
  assert.strictEqual(resolveMaxSetpoint(65, 60), 60);
  assert.strictEqual(resolveMaxSetpoint(undefined, 60), 60);
  assert.strictEqual(resolveMaxSetpoint(null, 65), 65);
});

/** Calls the private clamp of a service prototype with a minimal device and active setpoint range. */
function clamp(Service, settings, activeSetpoint, value) {
  const self = {
    device: { getSetting: (key) => settings[key] },
    activeSetpoint,
    _getMinSetpoint: Service.prototype._getMinSetpoint,
    _getMaxSetpoint: Service.prototype._getMaxSetpoint,
  };
  return Service.prototype._clampRecommendation.call(self, value);
}

for (const [name, Service] of [['Aurora II', ModbusService], ['Aurora III', Aurora3Service]]) {
  test(`${name} clamps recommendations to the configured minimum and maximum`, () => {
    const settings = { adaptive_min_setpoint: 25, adaptive_max_setpoint: 32 };
    const floor = { min: 20, max: 60 };
    assert.strictEqual(clamp(Service, settings, floor, 44), 32, 'above the maximum');
    assert.strictEqual(clamp(Service, settings, floor, 20), 25, 'below the minimum');
    assert.strictEqual(clamp(Service, settings, floor, 29), 29, 'inside the range');
  });

  test(`${name} keeps the active setpoint range and the hard maximum as outer limits`, () => {
    assert.strictEqual(clamp(Service, { adaptive_max_setpoint: 60 }, { min: 20, max: 45 }, 50), 45,
      'active setpoint maximum below the setting wins');
    assert.strictEqual(clamp(Service, {}, { min: 20, max: 60 }, 70), 60,
      'without the setting the hard maximum of 60°C applies');
  });
}
