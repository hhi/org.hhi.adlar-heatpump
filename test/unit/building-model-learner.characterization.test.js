/**
 * Characterization tests for BuildingModelLearner (ADR-062 phase 1a).
 *
 * Group I — invariants: must stay green throughout ADR-062 phase 1.
 * Group K — current behaviour that ADR-062 changes on purpose. Each test names
 * its decision (B1–B5, §2.8, A5); when that decision is implemented the test is
 * replaced by one for the new behaviour, so every change in behaviour is visible.
 * Group N — new behaviour, replacing the K tests of the decisions implemented so far
 * (phase 1b: N1–N7 for B1/B2).
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

test('I2: a JSON round trip of the state gives the same model and the same state', () => {
  // The dT/dt window is not persisted (ADR-062 B1), so the next update may differ.
  const original = createLearner();
  feed(original, 300);
  const copy = createLearner();
  copy.restoreState(JSON.parse(JSON.stringify(original.getState())));
  assert.deepStrictEqual(copy.getModel(), original.getModel());
  assert.deepStrictEqual(copy.getState(), original.getState());
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

/** Feed `n` measurements five minutes apart; values per index come from the callbacks. */
function regular(learner, n, {
  start = T0, step = FIVE_MIN_MS, tIndoor = () => 20, pHeating = () => 2, tOutdoor = () => 5,
} = {}) {
  for (let i = 0; i < n; i++) {
    learner.addMeasurement(measurement(start + i * step, tIndoor(i), tOutdoor(i), pHeating(i)));
  }
  return start + n * step;
}

/** Record the private updateRLS() calls (the update itself may still be reverted). */
function spyUpdates(learner) {
  const calls = [];
  const original = learner.updateRLS.bind(learner);
  learner.updateRLS = (X, y) => { calls.push({ X: [...X], y }); original(X, y); };
  return calls;
}

test('N1 (ADR-062 B1): no update before 60 minutes; then dT/dt over the window with time-weighted inputs', () => {
  const learner = createLearner();
  const calls = spyUpdates(learner);
  regular(learner, 12, { tIndoor: (i) => 20 + 0.01 * i, pHeating: (i) => 1 + 0.1 * i });
  assert.strictEqual(calls.length, 0, 'no update while the window spans less than 60 minutes');
  regular(learner, 1, { start: T0 + 12 * FIVE_MIN_MS, tIndoor: () => 20.12, pHeating: () => 2.2 });
  assert.strictEqual(calls.length, 1);
  assert.ok(Math.abs(calls[0].y - 0.12) < 1e-9, `y = ${calls[0].y}`); // 0.12 °C over 1 h
  assert.ok(Math.abs(calls[0].X[0] - 1.55) < 1e-9, `X[0] = ${calls[0].X[0]}`); // mean power of samples 0..11
  assert.ok(Math.abs(calls[0].X[1] - (5 - 20.055)) < 1e-9, `X[1] = ${calls[0].X[1]}`);
  assert.strictEqual(calls[0].X[3], 1);
  assert.strictEqual(learner.getState().sampleCount, 13);
});

test('N2 (ADR-062 B2): a 7.5-minute gap continues the window, a 10-minute gap starts a new one', () => {
  const kept = createLearner();
  kept.addMeasurement(measurement(T0, 20));
  kept.addMeasurement(measurement(T0 + 7.5 * 60000, 20.01));
  assert.strictEqual(kept.getState().sampleCount, 2);

  const restarted = createLearner();
  const calls = spyUpdates(restarted);
  restarted.addMeasurement(measurement(T0, 20));
  const ref = T0 + 10 * 60000;
  restarted.addMeasurement(measurement(ref, 20.01));
  assert.strictEqual(restarted.getState().sampleCount, 1, 'the gap measurement is a reference, not counted');
  assert.strictEqual(restarted.getState().lastMeasurement.timestamp, ref);
  regular(restarted, 11, { start: ref + FIVE_MIN_MS });
  assert.strictEqual(calls.length, 0, '55 minutes after the new reference: no update yet');
  regular(restarted, 1, { start: ref + 12 * FIVE_MIN_MS });
  assert.strictEqual(calls.length, 1, '60 minutes after the new reference: first update');
});

test('N3 (ADR-062 B2): interruptWindow() makes the next measurement a new reference', () => {
  const learner = createLearner();
  const calls = spyUpdates(learner);
  const next = regular(learner, 12);
  learner.interruptWindow();
  const countBefore = learner.getState().sampleCount;
  learner.addMeasurement(measurement(next, 20));
  assert.strictEqual(learner.getState().sampleCount, countBefore, 'reference after an interrupt is not counted');
  regular(learner, 11, { start: next + FIVE_MIN_MS });
  assert.strictEqual(calls.length, 0);
  regular(learner, 1, { start: next + 12 * FIVE_MIN_MS });
  assert.strictEqual(calls.length, 1);
});

test('N4 (ADR-062 B1): inputs are weighted by the length of each sub-interval', () => {
  // Alternating 4- and 6-minute steps; power 1 kW before a 4-minute step, 3 kW before a 6-minute step.
  const learner = createLearner();
  const calls = spyUpdates(learner);
  let t = T0;
  for (let i = 0; i <= 12; i++) {
    learner.addMeasurement(measurement(t, 20, 5, i % 2 === 0 ? 1 : 3));
    t += (i % 2 === 0 ? 4 : 6) * 60000;
  }
  assert.strictEqual(calls.length, 1);
  assert.ok(Math.abs(calls[0].X[0] - 2.2) < 1e-9, `X[0] = ${calls[0].X[0]}`); // (6·4·1 + 6·6·3) / 60
});

test('N5 (ADR-062 B2): a measurement outside the bounds restarts the window', () => {
  const learner = createLearner();
  const next = regular(learner, 6);
  const before = JSON.stringify(learner.getState());
  learner.addMeasurement(measurement(next, 20, 5, 25)); // 25 kW > 20 kW
  assert.strictEqual(JSON.stringify(learner.getState()), before);
  const countBefore = learner.getState().sampleCount;
  learner.addMeasurement(measurement(next + FIVE_MIN_MS, 20));
  assert.strictEqual(learner.getState().sampleCount, countBefore, 'next valid measurement is a new reference');
});

test('N6 (ADR-062 B1): a jump above 10 °C/h over five minutes is rejected and restarts the window', () => {
  const learner = createLearner();
  const next = regular(learner, 6);
  const before = JSON.stringify(learner.getState());
  learner.addMeasurement(measurement(next, 21)); // +1 °C in 5 min = 12 °C/h
  assert.strictEqual(JSON.stringify(learner.getState()), before);
  const countBefore = learner.getState().sampleCount;
  learner.addMeasurement(measurement(next + FIVE_MIN_MS, 20));
  assert.strictEqual(learner.getState().sampleCount, countBefore);
});

test('N7 (ADR-062 B1): after a restore the window continues from lastMeasurement, unless the gap is too large', () => {
  const source = createLearner();
  const next = regular(source, 20);
  const state = JSON.parse(JSON.stringify(source.getState()));

  const soon = createLearner();
  soon.restoreState(state);
  soon.addMeasurement(measurement(next, 20));
  assert.strictEqual(soon.getState().sampleCount, state.sampleCount + 1);

  const late = createLearner();
  late.restoreState(state);
  late.addMeasurement(measurement(next + 25 * 60000, 20));
  assert.strictEqual(late.getState().sampleCount, state.sampleCount, 'gap after restore: new reference');
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
  // Calls the private updateRLS() at a milestone sample count, where it logs the effective lambda.
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  learner.sampleCount = 100;
  learner.updateRLS([2, -15, 0, 1], 9); // prediction ≈ 0, error ≈ 9 °C/h
  const vff = lines.find((l) => l.includes('VFF λ='));
  assert.ok(vff, 'no VFF log line at sample 100');
  assert.match(vff, /VFF λ=0\.9990 /);
  const error = Number(/error=([\d.]+)/.exec(vff)[1]);
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
