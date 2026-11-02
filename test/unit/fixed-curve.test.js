/**
 * G15: Adlar's fixed climate curves (HH1–HH8, HL1–HL8) fill the two app-curve fields once.
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

const { FIXED_CURVES, fixedCurveFor } = require('../../.homeybuild/lib/shared/adaptive/positional-pi-controller');
const { AdaptiveControlService: TuyaService } = require('../../.homeybuild/lib/tuya/services/adaptive-control-service');
const { AdaptiveControlService: ModbusService } = require('../../.homeybuild/lib/modbus/services/adaptive-control-service');

/**
 * Staircases read from the heat pump manual (§4.10.1): value when cold, value in mild weather,
 * outdoor temperature where the cold flat part ends and where the mild flat part begins.
 */
const STAIRCASES = {
  hh1: [55, 50, -17, 15],
  hh2: [55, 45, -19, 17],
  hh3: [55, 40, -19, 18],
  hh4: [50, 45, -18, 17],
  hh5: [50, 40, -19, 17],
  hh6: [45, 40, -18, 15],
  hh7: [45, 35, -19, 17],
  hh8: [40, 35, -17, 15],
  hl1: [38, 32, -17, 16],
  hl2: [35, 30, -18, 16],
  hl3: [33, 30, -17, 14],
  hl4: [35, 28, -18, 17],
  hl5: [33, 28, -17, 16],
  hl6: [31, 26, -17, 16],
  hl7: [29, 26, -17, 15],
  hl8: [29, 24, -18, 16],
};

test('fixed curves are the middle line of each staircase, rounded to whole degrees', () => {
  assert.deepStrictEqual(Object.keys(FIXED_CURVES).sort(), Object.keys(STAIRCASES).sort());
  for (const [id, [cold, mild, from, to]] of Object.entries(STAIRCASES)) {
    // The first step comes right after the cold corner and the last one at the mild corner,
    // so the middle line runs half a degree inside both flat parts.
    const middle = (t) => (cold - 0.5) + ((mild + 0.5) - (cold - 0.5)) * ((t - from) / (to - from));
    assert.deepStrictEqual(FIXED_CURVES[id], {
      atMinus15: Math.floor(middle(-15) + 0.5),
      atPlus15: Math.floor(middle(15) + 0.5),
    }, id);
  }
});

test('fixedCurveFor returns the values of a known curve and null otherwise', () => {
  assert.deepStrictEqual(fixedCurveFor('hh8'), { atMinus15: 39, atPlus15: 36 });
  assert.deepStrictEqual(fixedCurveFor('hl4'), { atMinus15: 34, atPlus15: 29 });
  assert.strictEqual(fixedCurveFor('none'), null);
  assert.strictEqual(fixedCurveFor('toString'), null, 'no inherited properties');
  assert.strictEqual(fixedCurveFor(undefined), null);
});

/** Minimal `this` for onSettings: only the curve branch runs for these keys. */
function createContext(store = {}) {
  const settings = {};
  return {
    settings,
    store,
    STORE_KEY_CURVE_USER_SET: 'adaptive_curve_user_set',
    logger: () => {},
    device: {
      homey: { setTimeout: (fn) => { fn(); return { mocked: true }; } },
      getStoreValue: (key) => store[key],
      setStoreValue: async (key, value) => { store[key] = value; },
      setSettings: async (values) => { Object.assign(settings, values); },
      error: () => {},
    },
  };
}

for (const [name, Service] of [['Tuya', TuyaService], ['Aurora II', ModbusService]]) {
  test(`${name}: a chosen fixed curve fills both fields and the list returns to "—"`, async () => {
    const ctx = createContext();
    await Service.prototype.onSettings.call(ctx, {}, { adaptive_curve_fixed: 'hh7' }, ['adaptive_curve_fixed']);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual(ctx.settings, {
      adaptive_curve_at_minus15: 44, adaptive_curve_at_plus15: 36, adaptive_curve_fixed: 'none',
    });
    assert.strictEqual(ctx.store.adaptive_curve_user_set, true, 'a later mode change keeps these values');
  });

  test(`${name}: the fixed curve wins over a mode preset and over fields changed in the same save`, async () => {
    const ctx = createContext();
    await Service.prototype.onSettings.call(
      ctx,
      {},
      { adaptive_curve_fixed: 'hl8', adaptive_control_mode: 'positional_radiator', adaptive_curve_at_minus15: 50 },
      ['adaptive_curve_fixed', 'adaptive_control_mode', 'adaptive_curve_at_minus15'],
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(ctx.settings.adaptive_curve_at_minus15, 28);
    assert.strictEqual(ctx.settings.adaptive_curve_at_plus15, 25);
  });

  test(`${name}: "—" changes nothing`, async () => {
    const ctx = createContext();
    await Service.prototype.onSettings.call(ctx, {}, { adaptive_curve_fixed: 'none' }, ['adaptive_curve_fixed']);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual(ctx.settings, {});
    assert.strictEqual(ctx.store.adaptive_curve_user_set, undefined);
  });
}
