/**
 * G16: fill the app curve from the Aurora I/II DIY heating curve k·(T + 15) + b (L28 = k, L29 = b).
 * At −15 °C = b, at +15 °C = b + 30·k; rejected when k is not negative or a value falls outside
 * the app-curve settings (20–65 °C at −15 °C, 15–50 °C at +15 °C).
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

const { diyCurveToAppCurve, FIXED_CURVES } = require('../../.homeybuild/lib/shared/adaptive/positional-pi-controller');
const { ServiceCoordinator } = require('../../.homeybuild/lib/modbus/services/service-coordinator');
const { AdaptiveControlService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');
const ModbusDevice = require('../../.homeybuild/drivers/intelligent-heatpump-modbus/device');

const DeviceClass = ModbusDevice.default || ModbusDevice;

test('the DIY curve converts to the two app-curve values', () => {
  assert.deepStrictEqual(diyCurveToAppCurve(-0.5, 55), { atMinus15: 55, atPlus15: 40 });
  assert.deepStrictEqual(diyCurveToAppCurve(-0.3, 45), { atMinus15: 45, atPlus15: 36 });
  assert.deepStrictEqual(diyCurveToAppCurve(-0.35, 52.4), { atMinus15: 52, atPlus15: 42 }); // rounded like the settings
});

test('a slope that is not negative counts as leftover values', () => {
  assert.strictEqual(diyCurveToAppCurve(0, 40), null);
  assert.strictEqual(diyCurveToAppCurve(0.5, 40), null);
  assert.strictEqual(diyCurveToAppCurve(Number.NaN, 40), null);
});

test('values outside the app-curve settings are rejected', () => {
  assert.strictEqual(diyCurveToAppCurve(-5, 55), null); // +15 °C: −95 °C
  assert.strictEqual(diyCurveToAppCurve(-0.5, 70), null); // −15 °C: 70 > 65
  assert.strictEqual(diyCurveToAppCurve(-0.1, 55), null); // +15 °C: 52 > 50
  assert.strictEqual(diyCurveToAppCurve(-0.3, 20), null); // +15 °C: 11 < 15
});

test('coordinator: pending before L27–L29 were read, null when not supported, values otherwise', () => {
  const read = (state) => ServiceCoordinator.prototype.getDiyAppCurve.call(state);
  assert.strictEqual(read({ _latestSnapshot: null, _diyPolled: false }), 'pending');
  assert.strictEqual(read({ _latestSnapshot: { diy: undefined }, _diyPolled: true }), null);
  assert.deepStrictEqual(
    read({ _latestSnapshot: { diy: { active: false, slopeK: -0.5, interceptB: 55 } }, _diyPolled: true }),
    { atMinus15: 55, atPlus15: 40 },
  );
});

test('adaptive control: "diy" uses the DIY curve, other ids the fixed curves', () => {
  const pick = (curveId, diy) => AdaptiveControlService.prototype._fixedCurveFrom.call({ resolveDiyAppCurve: () => diy }, curveId);
  assert.deepStrictEqual(pick('diy', { atMinus15: 55, atPlus15: 40 }), { atMinus15: 55, atPlus15: 40 });
  assert.strictEqual(pick('diy', 'pending'), null);
  assert.strictEqual(pick('diy', null), null);
  assert.deepStrictEqual(pick('hh1', null), FIXED_CURVES.hh1);
  assert.strictEqual(pick('none', null), null);
});

function fakeDevice(diyCurve) {
  return {
    logger: { info: () => {} },
    homey: { __: (key) => key },
    coordinator: { getDiyAppCurve: () => diyCurve },
  };
}

test('device: saving "diy" is rejected while the curve is not read or not usable', async () => {
  const save = (diyCurve) => DeviceClass.prototype.onSettings.call(fakeDevice(diyCurve), {
    newSettings: { adaptive_curve_fixed: 'diy' },
    changedKeys: ['adaptive_curve_fixed'],
  });
  await assert.rejects(save('pending'), /errors\.diy_curve_not_read/);
  await assert.rejects(save(null), /errors\.diy_curve_unusable/);
});

test('the error texts exist in all four languages', () => {
  for (const lang of ['en', 'nl', 'de', 'fr']) {
    const locale = require(`../../locales/${lang}.json`);
    assert.ok(locale.errors.diy_curve_not_read, `${lang}: errors.diy_curve_not_read`);
    assert.ok(locale.errors.diy_curve_unusable, `${lang}: errors.diy_curve_unusable`);
  }
});
