/**
 * Unit tests for the emitter delay (ADR-066, 3.7.0)
 *
 * D1: first-order filter in the learner; D2: start value from emitter type and buffer tank;
 * D3: estimator that learns the delay from hourly rows.
 * Run via: npm test (builds first, then node --test)
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { BuildingModelLearner } = require('../../.homeybuild/lib/shared/adaptive/building-model-learner');
const {
  EmitterDelayEstimator,
  emitterDelayStartMinutes,
  resolveEmitterType,
} = require('../../.homeybuild/lib/shared/adaptive/emitter-delay');

const T0 = Date.UTC(2026, 10, 2, 0, 0);
const FIVE_MIN = 5 * 60000;

function learner(emitterDelayMinutes) {
  return new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: false,
    timeZone: 'UTC',
    emitterDelayMinutes,
  });
}

const sample = (k, pHeating) => ({
  timestamp: T0 + k * FIVE_MIN, tIndoor: 21, tOutdoor: 5, pHeating, solarRadiation: 0, deltaTPerHour: 0,
});

// --- D1: filter in the learner ----------------------------------------------

test('D1: without a delay the learner keeps the measured power', () => {
  const L = learner(0);
  L.addMeasurement(sample(0, 0));
  L.addMeasurement(sample(1, 4));
  assert.strictEqual(L.getState().lastMeasurement.pHeating, 4);
});

test('D1: a step in power reaches 63% after one delay', () => {
  const L = learner(60);
  L.addMeasurement(sample(0, 0));
  for (let k = 1; k <= 12; k++) L.addMeasurement(sample(k, 4)); // 60 minutes
  const p = L.getState().lastMeasurement.pHeating;
  assert.ok(Math.abs(p - 4 * (1 - Math.exp(-1))) < 1e-9, `filtered ${p}`);
});

test('D1: after a gap above 60 minutes the filter restarts at the measured power', () => {
  const L = learner(120);
  L.addMeasurement(sample(0, 0));
  L.addMeasurement(sample(1, 0));
  L.addMeasurement(sample(20, 3)); // 95 minutes later
  assert.strictEqual(L.getState().lastMeasurement.pHeating, 3);
});

test('D1: the filter continues after a restore (filtered power is in lastMeasurement)', () => {
  const L = learner(60);
  L.addMeasurement(sample(0, 0));
  L.addMeasurement(sample(1, 4));
  const restored = learner(60);
  restored.restoreState(JSON.parse(JSON.stringify(L.getState())));
  restored.addMeasurement(sample(2, 4));
  L.addMeasurement(sample(2, 4));
  assert.strictEqual(restored.getState().lastMeasurement.pHeating, L.getState().lastMeasurement.pHeating);
});

test('D4: setEmitterDelay clamps to 0–360 and keeps θ', () => {
  const L = learner(0);
  const theta = [...L.getState().theta];
  L.setEmitterDelay(500);
  assert.strictEqual(L.getEmitterDelay(), 360);
  L.setEmitterDelay(-5);
  assert.strictEqual(L.getEmitterDelay(), 0);
  assert.deepStrictEqual(L.getState().theta, theta);
});

// --- D2: start value ----------------------------------------------------------

test('D2: emitter type from setting, control mode and heat-pump mode', () => {
  assert.strictEqual(resolveEmitterType('floor', 'positional_radiator', '1'), 'floor');
  assert.strictEqual(resolveEmitterType('auto', 'positional_floor', '1'), 'floor');
  assert.strictEqual(resolveEmitterType('auto', 'classic', '7'), 'floor');
  assert.strictEqual(resolveEmitterType('auto', 'classic', '5'), 'radiator');
  assert.strictEqual(resolveEmitterType('auto', 'classic', 'floor_heatign_and_hot_water'), 'floor');
  assert.strictEqual(resolveEmitterType('auto', 'classic', 'heating'), 'radiator');
  assert.strictEqual(resolveEmitterType('auto', 'classic', null), 'unknown');
  assert.strictEqual(resolveEmitterType(undefined, undefined, '2'), 'unknown');
});

test('D2: start value = base + 1 min per litre, at most 360', () => {
  assert.strictEqual(emitterDelayStartMinutes('radiator', 0), 30);
  assert.strictEqual(emitterDelayStartMinutes('radiator', 120), 150);
  assert.strictEqual(emitterDelayStartMinutes('floor', 0), 180);
  assert.strictEqual(emitterDelayStartMinutes('unknown', null), 60);
  assert.strictEqual(emitterDelayStartMinutes('floor', 500), 360);
  assert.strictEqual(emitterDelayStartMinutes('radiator', -10), 30);
});

// --- D3: estimator ------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1R1C house (C 20, UA 0.14) with a modulating heat pump and a first-order emitter */
function house({ days, lagMin, seed = 7 }) {
  const rnd = mulberry32(seed);
  const samples = [];
  let tIn = 21.6; let integ = 0.8; let emitter = 0.8; let drift = 0; let cloud = 0.5;
  for (let m = 0; m <= days * 1440; m++) {
    const h = (m / 60) % 24;
    if (m % 60 === 0) drift = 0.97 * drift + (rnd() - 0.5) * 0.5;
    if (m % 1440 === 0) cloud = 0.1 + 0.9 * rnd();
    const tOut = 10 + drift * 2 + 3 * Math.sin((2 * Math.PI * (h - 9)) / 24);
    const solar = h > 8 && h < 17 ? 450 * cloud * Math.sin((Math.PI * (h - 8)) / 9) : 0;
    const err = 21.6 - tIn;
    integ = Math.max(0, Math.min(6, integ + (err * 1.5) / 120));
    const p = Math.max(0, Math.min(6, 3 * err + integ));
    emitter += (p - emitter) / Math.max(1, lagMin);
    if (m % 5 === 0) {
      samples.push({
        timestamp: T0 + m * 60000, tIndoor: Math.round(tIn * 10) / 10, tOutdoor: tOut, pHeating: p, solarRadiation: solar,
      });
    }
    tIn += ((emitter + 0.14 * (tOut - tIn) + solar / 1000 + 0.35) / 20) / 60;
  }
  return samples;
}

test('D3: the estimator learns a long delay (150 min → 120–180)', () => {
  const est = new EmitterDelayEstimator(60);
  for (const s of house({ days: 7, lagMin: 150 })) est.addSample(s);
  const d = est.getDiagnostics();
  assert.strictEqual(d.source, 'learned');
  assert.ok(d.delayMinutes >= 120 && d.delayMinutes <= 180, `learned ${d.delayMinutes}`);
});

test('D3: the estimator learns a short delay (30 min → at most 90)', () => {
  const est = new EmitterDelayEstimator(180);
  for (const s of house({ days: 7, lagMin: 30 })) est.addSample(s);
  const d = est.getDiagnostics();
  assert.strictEqual(d.source, 'learned');
  assert.ok(d.delayMinutes <= 90, `learned ${d.delayMinutes}`);
});

test('D3: below 72 usable hours the start value stays', () => {
  const est = new EmitterDelayEstimator(150);
  for (const s of house({ days: 2, lagMin: 30 })) est.addSample(s);
  assert.strictEqual(est.getSource(), 'start');
  assert.strictEqual(est.getDelayMinutes(), 150);
});

test('D3: without heating (mean power below 0.3 kW) nothing is learned', () => {
  const est = new EmitterDelayEstimator(60);
  for (const s of house({ days: 5, lagMin: 150 })) est.addSample({ ...s, pHeating: 0.1 });
  assert.strictEqual(est.getSource(), 'start');
  assert.strictEqual(est.getDiagnostics().lastEvaluation.reason, 'low_power');
});

test('D3: an interrupted hour is not stored', () => {
  const est = new EmitterDelayEstimator(60);
  const samples = house({ days: 1, lagMin: 30 });
  samples.slice(0, 13).forEach((s) => est.addSample(s)); // hour 0 complete at the first sample of hour 1
  assert.strictEqual(est.getDiagnostics().usableHours, 1);
  est.interrupt();
  samples.slice(13, 25).forEach((s) => est.addSample(s));
  assert.strictEqual(est.getDiagnostics().usableHours, 1);
});

test('D5: a new start value drops the learned delay and keeps the hours', () => {
  const est = new EmitterDelayEstimator(60);
  for (const s of house({ days: 7, lagMin: 150 })) est.addSample(s);
  const hours = est.getDiagnostics().usableHours;
  assert.strictEqual(est.getSource(), 'learned');
  est.setStartMinutes(240);
  assert.strictEqual(est.getSource(), 'start');
  assert.strictEqual(est.getDelayMinutes(), 240);
  assert.strictEqual(est.getDiagnostics().usableHours, hours);
});

test('D3: state survives a save and restore; a corrupt state is ignored', () => {
  const est = new EmitterDelayEstimator(60);
  for (const s of house({ days: 4, lagMin: 150 })) est.addSample(s);
  const copy = new EmitterDelayEstimator(60);
  assert.strictEqual(copy.restoreState(JSON.parse(JSON.stringify(est.getState()))), true);
  assert.strictEqual(copy.getDelayMinutes(), est.getDelayMinutes());
  assert.strictEqual(copy.getDiagnostics().usableHours, est.getDiagnostics().usableHours);
  const fresh = new EmitterDelayEstimator(60);
  assert.strictEqual(fresh.restoreState({ version: 1, rows: [{ hour: 1, p: [1], d: 0, s: 0, dT: 0 }] }), false);
  assert.strictEqual(fresh.restoreState(null), false);
  assert.strictEqual(fresh.getDiagnostics().usableHours, 0);
});

// --- D7: restart from the profile on a large jump or a pinned model from before 3.7.0 ------

const PROFILE_THETA0 = 1 / 15; // average profile: C 15
const identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
const pinnedTheta = [1 / 39.9, 0.2 / 39.9, 4.8 / 39.9, 1.4 / 39.9]; // C at the bound, P_int 1.4 kW
const healthyTheta = [1 / 18, 0.14 / 18, 1 / 18, 0.35 / 18];

function restored(theta, extra = {}) {
  const L = learner(0);
  const result = L.restoreState({
    theta, P: identity, sampleCount: 1000, lastMeasurement: null, ...extra,
  });
  assert.strictEqual(result.restored, true);
  return L;
}

test('D7: a model from before 3.7.0 pinned at the bounds restarts from the profile', () => {
  const L = restored(pinnedTheta);
  assert.strictEqual(L.applyEmitterDelay(30, 'average'), 'legacy_suspect');
  assert.ok(Math.abs(L.getState().theta[0] - PROFILE_THETA0) < 1e-12);
  assert.strictEqual(L.getState().sampleCount, 500, 'soft reset keeps half of the samples');
  assert.strictEqual(L.getState().emitterDelayMinutes, 30);
});

test('D7: a healthy model from before 3.7.0 keeps θ with a small delay', () => {
  const L = restored(healthyTheta);
  assert.strictEqual(L.applyEmitterDelay(30, 'average'), null);
  assert.deepStrictEqual(L.getState().theta, healthyTheta);
});

test('D7: a jump of 60 minutes or more restarts, a smaller step does not', () => {
  const L = restored(healthyTheta, { emitterDelayMinutes: 120 });
  assert.strictEqual(L.applyEmitterDelay(150, 'average'), null, 'one grid step');
  assert.deepStrictEqual(L.getState().theta, healthyTheta);
  assert.strictEqual(L.applyEmitterDelay(240, 'average'), 'jump', '150 → 240');
  assert.ok(Math.abs(L.getState().theta[0] - PROFILE_THETA0) < 1e-12);
});

test('D7: an old model gets a jump when the buffer tank is filled in before the upgrade', () => {
  const L = restored(healthyTheta); // learned without a filter (0)
  assert.strictEqual(L.applyEmitterDelay(150, 'average'), 'jump');
});

test('D7: the pinned check applies only once, at the first start of 3.7.0', () => {
  const L = restored(pinnedTheta, { emitterDelayMinutes: 150 }); // already a 3.7.0 state
  assert.strictEqual(L.applyEmitterDelay(150, 'average'), null);
  assert.deepStrictEqual(L.getState().theta, pinnedTheta);
});
