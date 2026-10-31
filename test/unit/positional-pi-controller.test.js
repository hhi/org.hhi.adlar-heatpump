/**
 * ADR-065: positional PI (integral, limits, anti-windup), emitter presets and the heating curve basis.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  PositionalPIController,
  resolveControlParams,
  resolveBasis,
  CURVE_PRESETS,
  APP_CURVE_DEFAULTS,
  appCurveValue,
  plausibleCurveValue,
} = require('../../.homeybuild/lib/shared/adaptive/positional-pi-controller');

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} ≠ ${expected}`);

/** Input for a cycle in which nothing blocks integration. */
const free = (error) => ({
  error, currentSetpoint: 35, lastRecommendation: 35, lastRawRecommendation: 35, range: { min: 20, max: 60 },
});

test('Ki is Kp divided by Ti in 5-minute cycles', () => {
  near(new PositionalPIController({ kp: 3, tiHours: 3 }).ki, 3 / 36, 'Kp 3, Ti 3 h');
  near(new PositionalPIController({ kp: 3, tiHours: 6 }).ki, 3 / 72, 'Kp 3, Ti 6 h');
});

test('u = Kp·e + I, with the integral updated before the output', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  const step = pi.step(free(0.5));
  near(step.p, 1.5, 'P-term');
  near(step.i, 0.5 * 3 / 36, 'I-term after one cycle');
  near(step.u, 1.5 + 0.5 * 3 / 36, 'output');
  assert.strictEqual(step.integrated, true);
  assert.strictEqual(step.holdReason, null);
});

test('integral and output are clamped to ±Imax and ±Umax', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 0.1 });
  let step;
  for (let i = 0; i < 200; i++) step = pi.step(free(2));
  near(step.i, 6, 'Imax');
  near(step.u, 8, 'Umax');
  for (let i = 0; i < 400; i++) step = pi.step(free(-2));
  near(step.i, -6, '−Imax');
  near(step.u, -8, '−Umax');
});

test('no dead zone except the integration threshold of 0.1 °C', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  const small = pi.step(free(0.1));
  assert.strictEqual(small.holdReason, 'small_error');
  near(small.u, 0.3, 'P-term still acts inside the threshold');
  assert.strictEqual(pi.step(free(0.2)).integrated, true, 'just above the threshold integrates');
});

test('anti-windup: no integration while the flow lags behind the recommendation', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  const step = pi.step({ ...free(1), currentSetpoint: 40, lastRecommendation: 38 });
  assert.strictEqual(step.holdReason, 'flow_behind');
  near(step.i, 0, 'integral unchanged');
  assert.strictEqual(pi.step({ ...free(1), currentSetpoint: 39, lastRecommendation: 38 }).integrated, true,
    'within 1 °C counts as applied');
});

test('anti-windup: no integration at a setpoint limit in the direction of the error', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  assert.strictEqual(pi.step({ ...free(1), lastRawRecommendation: 61 }).holdReason, 'at_limit');
  assert.strictEqual(pi.step({ ...free(-1), lastRawRecommendation: 19 }).holdReason, 'at_limit');
  assert.strictEqual(pi.step({ ...free(-1), lastRawRecommendation: 61 }).integrated, true,
    'error away from the limit integrates');
});

test('the caller can pause the integral (coast, defrost, hot water)', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  for (const pause of ['coast', 'defrost', 'dhw']) {
    const step = pi.step({ ...free(1), pause });
    assert.strictEqual(step.holdReason, pause);
    near(step.i, 0, `integral frozen during ${pause}`);
  }
});

test('restoreIntegral clamps and rejects invalid values; output() does not integrate', () => {
  const pi = new PositionalPIController({ kp: 3, tiHours: 3 });
  pi.restoreIntegral(10);
  near(pi.getIntegral(), 6, 'clamped to Imax');
  pi.restoreIntegral(Number.NaN);
  near(pi.getIntegral(), 0, 'NaN resets');
  pi.restoreIntegral(1);
  near(pi.output(0.5), 2.5, 'Kp·e + I');
  near(pi.getIntegral(), 1, 'output() leaves the integral alone');
});

test('the control setting selects the preset; positional_manual uses the fields', () => {
  assert.deepStrictEqual(resolveControlParams({ adaptive_control_mode: 'positional_radiator', adaptive_pos_kp: 5 }), {
    mode: 'positional', emitter: 'radiator', source: 'preset', kp: 3, tiHours: 3, coastEnabled: false,
  });
  assert.deepStrictEqual(resolveControlParams({ adaptive_control_mode: 'positional_floor', adaptive_coast_enabled: false }), {
    mode: 'positional', emitter: 'floor', source: 'preset', kp: 3, tiHours: 6, coastEnabled: true,
  });
  assert.deepStrictEqual(resolveControlParams({
    adaptive_control_mode: 'positional_manual', adaptive_pos_kp: 4, adaptive_pos_ti: 1.5, adaptive_coast_enabled: false,
  }), {
    mode: 'positional', emitter: 'manual', source: 'manual', kp: 4, tiHours: 1.5, coastEnabled: false,
  });
});

test('classic keeps its own coast switch; missing or unknown values give classic with coast on', () => {
  assert.deepStrictEqual(resolveControlParams({}), {
    mode: 'classic', emitter: 'manual', source: 'manual', kp: 3, tiHours: 3, coastEnabled: true,
  });
  assert.deepStrictEqual(resolveControlParams({ adaptive_control_mode: 'classic', adaptive_coast_enabled: false }), {
    mode: 'classic', emitter: 'manual', source: 'manual', kp: 3, tiHours: 3, coastEnabled: false,
  });
  assert.strictEqual(resolveControlParams({ adaptive_control_mode: 'positional' }).mode, 'classic', 'unknown value');
});

test('app curve runs through the two points, like the DIY form k·(T + 15) + b', () => {
  near(appCurveValue(40, 25, -15), 40, 'at −15 °C');
  near(appCurveValue(40, 25, 15), 25, 'at +15 °C');
  near(appCurveValue(40, 25, 0), 32.5, 'halfway');
});

test('curve presets per emitter and the generic default', () => {
  assert.deepStrictEqual(CURVE_PRESETS.radiator, { atMinus15: 50, atPlus15: 35 });
  assert.deepStrictEqual(CURVE_PRESETS.floor, { atMinus15: 35, atPlus15: 27 });
  assert.deepStrictEqual(APP_CURVE_DEFAULTS, { atMinus15: 45, atPlus15: 30 });
  near(appCurveValue(50, 35, 0), 42.5, 'radiators at 0 °C');
  near(appCurveValue(35, 27, 0), 31, 'floor at 0 °C');
});

test('basis: heat pump curve, app curve or flat fallback', () => {
  const inputs = {
    curveSource: 'auto', heatPumpCurve: 36, appCurve: { atMinus15: 40, atPlus15: 25 }, outdoorTemp: 0, flatBasis: 38,
  };
  assert.deepStrictEqual(resolveBasis(inputs), { value: 36, source: 'heat_pump_curve' });
  assert.deepStrictEqual(resolveBasis({ ...inputs, heatPumpCurve: 3.6 }), { value: 32.5, source: 'app_curve' }, 'implausible → app curve');
  assert.deepStrictEqual(resolveBasis({ ...inputs, curveSource: 'app' }), { value: 32.5, source: 'app_curve' });
  assert.deepStrictEqual(resolveBasis({ ...inputs, curveSource: 'app', outdoorTemp: null }), { value: 38, source: 'flat' });
  assert.deepStrictEqual(resolveBasis({ ...inputs, heatPumpCurve: null, outdoorTemp: null }), { value: 38, source: 'flat' });
  assert.strictEqual(resolveBasis({
    ...inputs, heatPumpCurve: null, outdoorTemp: null, flatBasis: null,
  }), null);
  assert.strictEqual(plausibleCurveValue(80), null);
});
