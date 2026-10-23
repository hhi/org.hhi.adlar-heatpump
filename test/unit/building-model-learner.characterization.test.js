/**
 * Characterization tests for BuildingModelLearner (ADR-062 phase 1a).
 *
 * Group I — invariants: must stay green throughout ADR-062 phase 1.
 * Group K — current behaviour that ADR-062 changes on purpose. Each test names
 * its decision (B1–B5, §2.8, A5); when that decision is implemented the test is
 * replaced by one for the new behaviour, so every change in behaviour is visible.
 *
 * Runs against the compiled output in .homeybuild/ (npm test builds first).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { BuildingModelLearner } = require('../../.homeybuild/lib/shared/adaptive/building-model-learner');

const FIVE_MIN_MS = 5 * 60 * 1000;
const T0 = 1700000000000;

function createLearner(overrides = {}) {
  return new BuildingModelLearner({
    forgettingFactor: 0.999,
    initialCovariance: 100,
    minSamplesForConfidence: 288,
    buildingProfile: 'average',
    enableDynamicPInt: false,
    ...overrides,
  });
}

function measurement(timestamp, tIndoor, tOutdoor = 5, pHeating = 2, solarRadiation = 0) {
  return {
    timestamp, tIndoor, tOutdoor, pHeating, solarRadiation, deltaTPerHour: 0,
  };
}

/** Feed a simple 1R1C building (C=15, UA=0.3, Pint=0.3) for `samples` five-minute steps. */
function feed(learner, samples, startTime = T0) {
  let tIndoor = 20;
  for (let i = 0; i < samples; i++) {
    const t = startTime + i * FIVE_MIN_MS;
    const pHeating = Math.max(0, 2.0 + 1.5 * Math.sin(i / 20) + 0.8 * Math.sin(i / 7));
    const tOutdoor = 5 + 5 * Math.sin(i / 60);
    learner.addMeasurement(measurement(t, tIndoor, tOutdoor, pHeating));
    tIndoor += ((pHeating - 0.3 * (tIndoor - tOutdoor) + 0.3) / 15) * (5 / 60);
  }
  return startTime + samples * FIVE_MIN_MS;
}

const IDENTITY_SMALL = [[1e-4, 0, 0, 0], [0, 1e-4, 0, 0], [0, 0, 1e-4, 0], [0, 0, 0, 1e-4]];
const IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

function quadForm(P, v) {
  return v.reduce((sum, vi, i) => sum + vi * P[i].reduce((s, pij, j) => s + pij * v[j], 0), 0);
}

// ---------------------------------------------------------------------------
// Group I — invariants
// ---------------------------------------------------------------------------

test('I1: getState() keeps the persisted state fields', () => {
  const learner = createLearner();
  feed(learner, 20);
  const state = learner.getState();
  for (const key of ['theta', 'P', 'sampleCount', 'lastMeasurement', 'basePInt', 'enableDynamicPInt',
    'consecutiveReverts', 'totalReverts', 'rateLimitActivations']) {
    assert.ok(Object.prototype.hasOwnProperty.call(state, key), `state.${key} missing`);
  }
  assert.strictEqual(state.theta.length, 4);
  assert.strictEqual(state.P.length, 4);
});

test('I2: a JSON round trip of the state gives the same model and the same next update', () => {
  const original = createLearner();
  const next = feed(original, 300);
  const copy = createLearner();
  copy.restoreState(JSON.parse(JSON.stringify(original.getState())));
  assert.deepStrictEqual(copy.getModel(), original.getModel());

  const m = measurement(next, original.getState().lastMeasurement.tIndoor + 0.02, 6, 2.5);
  original.addMeasurement(m);
  copy.addMeasurement({ ...m });
  assert.deepStrictEqual(copy.getState().theta, original.getState().theta);
  assert.strictEqual(copy.getState().sampleCount, original.getState().sampleCount);
});

test('I3: the first measurement is only stored', () => {
  const learner = createLearner();
  const before = [...learner.getState().theta];
  learner.addMeasurement(measurement(T0, 20));
  assert.strictEqual(learner.getState().sampleCount, 1);
  assert.deepStrictEqual(learner.getState().theta, before);
});

test('I4: a measurement outside the bounds changes nothing', () => {
  const cases = [
    ['dT/dt > 10 °C/h', measurement(T0, 20), measurement(T0 + FIVE_MIN_MS, 21)],
    ['heating power > 20 kW', measurement(T0, 20), measurement(T0 + FIVE_MIN_MS, 20.01, 5, 25)],
    ['indoor temperature < 5 °C', measurement(T0, 4.95), measurement(T0 + FIVE_MIN_MS, 4.9)],
    ['outdoor temperature < −25 °C', measurement(T0, 20), measurement(T0 + FIVE_MIN_MS, 20.01, -26)],
  ];
  for (const [label, first, second] of cases) {
    const learner = createLearner();
    learner.addMeasurement(first);
    const before = JSON.stringify(learner.getState());
    learner.addMeasurement(second);
    assert.strictEqual(JSON.stringify(learner.getState()), before, label);
  }
});

test('I5: a time step of zero or less is ignored', () => {
  const learner = createLearner();
  learner.addMeasurement(measurement(T0, 20));
  const before = JSON.stringify(learner.getState());
  learner.addMeasurement(measurement(T0, 20.1));
  learner.addMeasurement(measurement(T0 - FIVE_MIN_MS, 20.1));
  assert.strictEqual(JSON.stringify(learner.getState()), before);
});

test('I6: restoreState rejects a corrupt state', () => {
  const valid = { theta: [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15], P: IDENTITY, sampleCount: 50, lastMeasurement: null };
  const corrupt = [
    ['theta of length 3', { ...valid, theta: valid.theta.slice(0, 3) }],
    ['P of 3×3', { ...valid, P: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }],
    ['trace above 400', { ...valid, P: IDENTITY.map((r) => r.map((x) => x * 100.25)) }],
    ['trace of 0', { ...valid, P: IDENTITY.map((r) => r.map(() => 0)) }],
  ];
  for (const [label, state] of corrupt) {
    const learner = createLearner();
    feed(learner, 2);
    learner.restoreState(state);
    assert.strictEqual(learner.getState().sampleCount, 0, label);
    assert.strictEqual(learner.getState().lastMeasurement, null, label);
  }
});

test('I7: after a restore without lastMeasurement the next measurement counts as the first', () => {
  const learner = createLearner();
  const theta = [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15];
  learner.restoreState({ theta, P: IDENTITY, sampleCount: 100, lastMeasurement: null });
  learner.addMeasurement(measurement(T0, 20));
  assert.strictEqual(learner.getState().sampleCount, 101);
  assert.deepStrictEqual(learner.getState().theta, theta);
});

test('I8: getModel() converts theta to C, UA, g, P_int and tau', () => {
  const learner = createLearner();
  learner.restoreState({
    theta: [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15], P: IDENTITY_SMALL, sampleCount: 300, lastMeasurement: null,
  });
  const m = learner.getModel();
  assert.ok(Math.abs(m.C - 15) < 1e-9);
  assert.ok(Math.abs(m.UA - 0.3) < 1e-9);
  assert.ok(Math.abs(m.g - 0.5) < 1e-9);
  assert.ok(Math.abs(m.pInt - 0.3) < 1e-9);
  assert.ok(Math.abs(m.tau - 50) < 1e-9);
});

// ---------------------------------------------------------------------------
// Group K — current behaviour that ADR-062 changes on purpose
// ---------------------------------------------------------------------------

test('K1 (ADR-062 B1): each measurement feeds dT/dt over 5 minutes with the inputs of that measurement', () => {
  // Spies on the private updateRLS(): the update itself may be reverted by the bounds check.
  const learner = createLearner();
  const calls = [];
  const original = learner.updateRLS.bind(learner);
  learner.updateRLS = (X, y) => { calls.push({ X: [...X], y }); original(X, y); };
  learner.addMeasurement(measurement(T0, 20, 5, 2));
  learner.addMeasurement(measurement(T0 + FIVE_MIN_MS, 20.05, 4, 3.5));
  assert.strictEqual(calls.length, 1);
  assert.ok(Math.abs(calls[0].y - 0.6) < 1e-9, `y = ${calls[0].y}`); // 0.05 °C over 5 min
  assert.strictEqual(calls[0].X[0], 3.5); // power of the second (current) measurement
  assert.ok(Math.abs(calls[0].X[1] - (4 - 20.05)) < 1e-9); // Tout − Tin of the current measurement
  assert.strictEqual(learner.getState().sampleCount, 2);
});

test('K2 (ADR-062 B1/B2): a 15-minute gap is still learned, a 16-minute gap resets the reference', () => {
  const learned = createLearner();
  learned.addMeasurement(measurement(T0, 20));
  learned.addMeasurement(measurement(T0 + 15 * 60000, 20.1));
  assert.strictEqual(learned.getState().sampleCount, 2);

  const reset = createLearner();
  reset.addMeasurement(measurement(T0, 20));
  reset.addMeasurement(measurement(T0 + 16 * 60000, 20.1));
  assert.strictEqual(reset.getState().sampleCount, 1);
  assert.strictEqual(reset.getState().lastMeasurement.timestamp, T0 + 16 * 60000);
});

test('K3 (ADR-062 B3): the covariance corrections can leave P not positive semi-definite', () => {
  // Counterexample from BUILDING_MODEL_REVIEW.md §2.6 (calls the private updateRLS()).
  const learner = createLearner();
  const theta = learner.getState().theta;
  const X = [5, -15, 0.2, 1];
  const y = X.reduce((sum, x, i) => sum + x * theta[i], 0);
  learner.updateRLS(X, y);
  const q = quadForm(learner.getState().P, [1, -1, 1, 1]);
  assert.ok(Math.abs(q - -4.95694) < 1e-3, `vᵀPv = ${q}`);
});

test('K4 (ADR-062 B4): restore accepts tau = 800 h, rejects UA = 0.85 and accepts the passive profile', () => {
  const tau800 = createLearner();
  tau800.restoreState({ theta: [0.025, 0.00125, 0.01, 0.0075], P: IDENTITY, sampleCount: 100, lastMeasurement: null });
  assert.strictEqual(tau800.getState().sampleCount, 100);
  assert.ok(Math.abs(tau800.getModel().tau - 800) < 1e-6);

  const ua085 = createLearner();
  ua085.restoreState({ theta: [0.1, 0.085, 0.04, 0.03], P: IDENTITY, sampleCount: 100, lastMeasurement: null });
  assert.strictEqual(ua085.getState().sampleCount, 0);

  const passive = createLearner({ buildingProfile: 'passive' });
  feed(passive, 2);
  const copy = createLearner({ buildingProfile: 'passive' });
  copy.restoreState(JSON.parse(JSON.stringify(passive.getState())));
  assert.strictEqual(copy.getState().sampleCount, 2);
});

test('K5 (ADR-062 B4): the "tau estimate" log line on a revert shows 1/UA', () => {
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  learner.updateRLS([5, -15, 0.2, 1], 9.5); // large error → step out of bounds → revert
  const text = lines.join('\n');
  const theta0 = Number(/θ\[0\] \(1\/C\):\s+([\d.]+)/.exec(text)[1]);
  const theta1 = Number(/θ\[1\] \(UA\/C\):\s+([\d.e-]+)/.exec(text)[1]);
  const logged = Number(/τ estimate: ([\d.e+-]+)h/.exec(text)[1]);
  assert.ok(Math.abs(logged - theta0 / theta1) <= Math.max(0.1, Math.abs(theta0 / theta1) * 1e-3), `logged ${logged}, θ0/θ1 ${theta0 / theta1}`);
});

test('K6 (review §2.8): VFF lambda stays at the configured 0.999, also with a large error', () => {
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  for (let i = 0; i < 100; i++) learner.addMeasurement(measurement(T0 + i * FIVE_MIN_MS, 20, 5, 1.5));
  learner.addMeasurement(measurement(T0 + 100 * FIVE_MIN_MS, 20.75, 5, 1.5)); // dT/dt = 9 °C/h
  const vff = lines.filter((l) => l.includes('VFF λ='));
  assert.ok(vff.length > 0, 'no VFF log line at sample 100');
  const last = vff[vff.length - 1];
  assert.match(last, /VFF λ=0\.9990 /);
  const error = Number(/error=([\d.]+)/.exec(last)[1]);
  assert.ok(error > 2, `error ${error} should be large`);
});

test('K7 (ADR-062 A5): restore takes enableDynamicPInt from the state', () => {
  const fromState = createLearner({ enableDynamicPInt: true });
  fromState.restoreState({
    theta: [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15], P: IDENTITY, sampleCount: 10, lastMeasurement: null, enableDynamicPInt: false,
  });
  assert.strictEqual(fromState.getState().enableDynamicPInt, false);

  const legacy = createLearner({ enableDynamicPInt: true });
  legacy.restoreState({ theta: [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15], P: IDENTITY, sampleCount: 10, lastMeasurement: null });
  assert.strictEqual(legacy.getState().enableDynamicPInt, false);
});
