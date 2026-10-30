/**
 * Tests for the adaptive water temperature range (adaptive_min_setpoint / adaptive_max_setpoint):
 * the shared range helpers, the heating limits read from the heat pump (Aurora II 0x00FA/0x00FB,
 * Aurora III Reg 12/13), the setpoint resolvers and the recommendation clamp of both Modbus services.
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
  plausibleHeatingLimits,
  resolveEffectiveRange,
  resolveMaxSetpoint,
  SETPOINT_RANGE_MIN_GAP,
} = require('../../.homeybuild/lib/shared/adaptive/setpoint-range');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const { AdaptiveControlService: Aurora3Service } = require('../../.homeybuild/lib/aurora3/services/adaptive-control-service');
const { ServiceCoordinator: ModbusCoordinator } = require('../../.homeybuild/lib/modbus/services/service-coordinator');
const { ServiceCoordinator: Aurora3Coordinator } = require('../../.homeybuild/lib/aurora3/services/service-coordinator');
const { Adlar2ModbusService } = require('../../.homeybuild/lib/modbus/protocol/adlar2-modbus-service');
const { Adlar3ModbusService } = require('../../.homeybuild/lib/aurora3/protocol/adlar3-modbus-service');

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

test('plausibleHeatingLimits accepts read limits and rejects missing or implausible values', () => {
  assert.deepStrictEqual(plausibleHeatingLimits(15, 50), { min: 15, max: 50 });
  assert.strictEqual(plausibleHeatingLimits(null, 50), null, 'not read yet');
  assert.strictEqual(plausibleHeatingLimits(0, 0), null, 'empty registers');
  assert.strictEqual(plausibleHeatingLimits(1.5, 5), null, 'wrong temperature scale (x10 read as x1)');
  assert.strictEqual(plausibleHeatingLimits(150, 500), null, 'wrong temperature scale (x1 read as x10)');
  assert.strictEqual(plausibleHeatingLimits(50, 15), null, 'min above max');
});

test('resolveEffectiveRange intersects the three layers and names the binding one', () => {
  const register = { min: 20, max: 60 };
  assert.deepStrictEqual(resolveEffectiveRange(register, { min: 15, max: 50 }, { min: 18, max: 60 }), {
    min: 20, max: 50, minSource: 'register', maxSource: 'heat_pump',
  });
  assert.deepStrictEqual(resolveEffectiveRange(register, { min: 15, max: 50 }, { min: 25, max: 32 }), {
    min: 25, max: 32, minSource: 'setting', maxSource: 'setting',
  });
  assert.deepStrictEqual(resolveEffectiveRange(register, null, { min: 18, max: 60 }), {
    min: 20, max: 60, minSource: 'register', maxSource: 'setting',
  }, 'without heat pump limits, equal values report the innermost layer');
});

test('Aurora II snapshot reports the active heating limits 0x00FB..0x00FA for both temperature scales', () => {
  for (const [scale, lower, upper] of [['x1', 15, 50], ['x10', 150, 500]]) {
    const service = new Adlar2ModbusService({ transport: { host: '127.0.0.1' }, temperatureRegisterScale: scale });
    const { cache } = service.tcp; // getRegisterCache() returns a copy on Aurora II
    assert.strictEqual(service.getSnapshot().control.heatingLimits, null, 'null until the registers are read');
    cache.set(0x00FA, upper);
    cache.set(0x00FB, lower);
    assert.deepStrictEqual(service.getSnapshot().control.heatingLimits, { min: 15, max: 50 }, scale);
  }
});

test('Aurora III snapshot reports the zone 1 heating limits Reg 13..12', () => {
  const service = new Adlar3ModbusService({ transport: { host: '127.0.0.1' } });
  assert.strictEqual(service.getSnapshot().control.heatingLimits, null);
  service.getRegisterCache().set(12, 450);
  service.getRegisterCache().set(13, 200);
  assert.deepStrictEqual(service.getSnapshot().control.heatingLimits, { min: 20, max: 45 });
});

test('Aurora II resolver passes the heat pump limits for heating and floor heating modes', () => {
  for (const [mode, capability] of [[1, 'target_temperature'], [3, 'target_temperature.floor']]) {
    const coordinator = Object.create(ModbusCoordinator.prototype);
    coordinator.device = { getCapabilityValue: () => mode };
    coordinator._latestSnapshot = { control: { heatingLimits: { min: 15, max: 50 } } };
    const setpoint = coordinator._resolveAdaptiveSetpoint();
    assert.strictEqual(setpoint.capability, capability);
    assert.deepStrictEqual(setpoint.heatPumpLimits, { min: 15, max: 50 });
  }
  const coordinator = Object.create(ModbusCoordinator.prototype);
  coordinator.device = { getCapabilityValue: () => 1 };
  coordinator._latestSnapshot = null;
  assert.strictEqual(coordinator._resolveAdaptiveSetpoint().heatPumpLimits, null, 'no snapshot yet');
});

test('Aurora III resolver passes the zone 1 heating limits', () => {
  const coordinator = Object.create(Aurora3Coordinator.prototype);
  coordinator._heatingLimits = { min: 20, max: 45 };
  assert.deepStrictEqual(coordinator._resolveAdaptiveSetpoint().heatPumpLimits, { min: 20, max: 45 });
});

/** Calls the private clamp of a service prototype with a minimal device and active setpoint range. */
function clamp(Service, settings, activeSetpoint, value) {
  const self = {
    device: { getSetting: (key) => settings[key] },
    activeSetpoint,
    _getMinSetpoint: Service.prototype._getMinSetpoint,
    _getMaxSetpoint: Service.prototype._getMaxSetpoint,
    _effectiveRange: Service.prototype._effectiveRange,
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

  test(`${name} keeps recommendations within the heat pump's own heating limits`, () => {
    const floor = { min: 20, max: 60, heatPumpLimits: { min: 15, max: 50 } };
    assert.strictEqual(clamp(Service, { adaptive_min_setpoint: 18, adaptive_max_setpoint: 60 }, floor, 55), 50,
      'heat pump upper limit below the setting wins');
    assert.strictEqual(clamp(Service, { adaptive_min_setpoint: 25, adaptive_max_setpoint: 32 }, floor, 44), 32,
      'a narrower setting stays the innermost bound');
    assert.strictEqual(clamp(Service, { adaptive_min_setpoint: 18 }, { ...floor, heatPumpLimits: null }, 55), 55,
      'without heat pump limits the previous behaviour applies');
  });
}
