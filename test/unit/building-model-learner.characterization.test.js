/**
 * Characterization tests for BuildingModelLearner (ADR-062 phase 1a).
 *
 * Group I — invariants: must stay green throughout ADR-062 phase 1.
 * Group K — current behaviour that ADR-062 changes on purpose. Each test names
 * its decision (B1–B5, §2.8, A5); when that decision is implemented the test is
 * replaced by one for the new behaviour, so every change in behaviour is visible.
 * Group N — new behaviour, replacing the K tests of the decisions implemented so far
 * (phase 1b: N1–N7 for B1/B2; phase 1c: N8–N10 for B3; phase 1d: N11–N13 for B4/B5;
 * phase 1e: N14–N16 for §2.8, §2.5 and B6; N17 for B6 after a soft reset; phase 1g: N18–N20 for B12).
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

/** Eigenvalues of a symmetric 4×4 matrix (cyclic Jacobi), independent of the learner's own code. */
function eigenvalues(M) {
  const n = M.length;
  const a = M.map((row, i) => row.map((x, j) => (x + M[j][i]) / 2));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (a[p][q] === 0) continue;
        const phi = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]; const akq = a[k][q];
          a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]; const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return a.map((row, i) => row[i]);
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const { P_FLOOR, P_CEILING } = BuildingModelLearner.RLS_COVARIANCE;

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

test('N8 (ADR-062 B3): the review §2.6 counterexample now leaves P positive semi-definite', () => {
  const learner = createLearner();
  const theta = learner.getState().theta;
  const X = [5, -15, 0.2, 1];
  const y = X.reduce((sum, x, i) => sum + x * theta[i], 0);
  learner.updateRLS(X, y);
  const { P } = learner.getState();
  assert.ok(quadForm(P, [1, -1, 1, 1]) >= 0, 'vᵀPv must be ≥ 0');
  const eig = eigenvalues(P);
  assert.ok(Math.min(...eig) >= P_FLOOR * (1 - 1e-6), `min eigenvalue ${Math.min(...eig)}`);
  assert.ok(Math.max(...eig) <= P_CEILING * (1 + 1e-6), `max eigenvalue ${Math.max(...eig)}`);
});

test('N9 (ADR-062 B3): P stays symmetric with eigenvalues in [P_FLOOR, P_CEILING] over 2000 updates', () => {
  const learner = createLearner({ buildingProfile: 'light' });
  const rnd = mulberry32(42);
  let negativeXPX = 0;
  let applied = 0;
  for (let i = 0; i < 2000; i++) {
    const X = [rnd() * 8, -5 - rnd() * 25, rnd() * 0.8, 0.4 + rnd() * 1.4];
    const revertsBefore = learner.getState().totalReverts;
    learner.updateRLS(X, (rnd() - 0.5) * 4);
    const reverted = learner.getState().totalReverts > revertsBefore; // a revert leaves P unchanged
    if (!reverted) applied++;
    const { P } = learner.getState();
    for (let r = 0; r < 4; r++) {
      for (let c = r + 1; c < 4; c++) assert.ok(Math.abs(P[r][c] - P[c][r]) < 1e-12, `asymmetric at update ${i}`);
    }
    const eig = eigenvalues(P);
    assert.ok(Math.min(...eig) >= P_FLOOR * (1 - 1e-6), `update ${i}: min eigenvalue ${Math.min(...eig)}`);
    if (!reverted) assert.ok(Math.max(...eig) <= P_CEILING * (1 + 1e-6), `update ${i}: max eigenvalue ${Math.max(...eig)}`);
    if (quadForm(P, X) <= 0) negativeXPX++;
  }
  assert.strictEqual(negativeXPX, 0);
  assert.ok(applied > 500, `only ${applied} of 2000 updates applied`);
});

test('N10 (ADR-062 B3/B5): restore projects a P that is not positive semi-definite and keeps a valid P', () => {
  const theta = [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15];
  // Diagonal ≤ 1 and pairwise |Pij| ≤ √(Pii·Pjj), yet indefinite: the old corrections allowed this.
  const indefinite = [[1, 0.9, 0.9, 0], [0.9, 1, -0.9, 0], [0.9, -0.9, 1, 0], [0, 0, 0, 1]];
  assert.ok(Math.min(...eigenvalues(indefinite)) < 0);
  const projected = createLearner();
  projected.restoreState({ theta, P: indefinite, sampleCount: 100, lastMeasurement: null });
  assert.strictEqual(projected.getState().sampleCount, 100);
  assert.ok(Math.min(...eigenvalues(projected.getState().P)) >= P_FLOOR * (1 - 1e-6));

  const fresh = [[100, 0, 0, 0], [0, 100, 0, 0], [0, 0, 100, 0], [0, 0, 0, 100]]; // before the first update
  const kept = createLearner();
  kept.restoreState({ theta, P: fresh, sampleCount: 1, lastMeasurement: null });
  assert.deepStrictEqual(kept.getState().P, fresh);
});

/** Restore a theta with valid g/C and P_int/C; returns the learner and its log lines. */
function restoreTheta(theta0, theta1) {
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  learner.restoreState({ theta: [theta0, theta1, 0.04, 0.03], P: IDENTITY, sampleCount: 100, lastMeasurement: null });
  return { learner, text: lines.join('\n') };
}

test('N11 (ADR-062 B4/B5): restore checks tau = 1/θ[1] in [1.25, 800] h and UA = θ[1]/θ[0] in [0.03, 1.5]', () => {
  const accepted = [
    ['tau 800 h, UA 0.05', 1 / 40, 0.05 / 40],
    ['UA 0.85', 0.1, 0.085],
    ['UA 1.2', 0.1, 0.12],
  ];
  for (const [label, theta0, theta1] of accepted) {
    const { learner } = restoreTheta(theta0, theta1);
    assert.strictEqual(learner.getState().sampleCount, 100, `${label} should be accepted`);
  }
  assert.ok(Math.abs(restoreTheta(1 / 40, 0.05 / 40).learner.getModel().tau - 800) < 1e-6);

  const rejected = [
    ['UA 1.6', 0.1, 0.16, /UA 1\.600 kW\/°C outside \[0\.03, 1\.5\]/],
    ['UA 0.018', 0.2, 0.0036, /UA 0\.018 kW\/°C outside \[0\.03, 1\.5\]/],
    ['tau 1000 h', 1 / 40, 0.001, /τ 1000\.0h outside \[1\.25, 800\]/],
  ];
  for (const [label, theta0, theta1, reason] of rejected) {
    const { learner, text } = restoreTheta(theta0, theta1);
    assert.strictEqual(learner.getState().sampleCount, 0, `${label} should be rejected`);
    assert.match(text, reason, `${label}: the log names the violated bound`);
  }

  const passive = createLearner({ buildingProfile: 'passive' });
  feed(passive, 48);
  const copy = createLearner({ buildingProfile: 'passive' });
  copy.restoreState(JSON.parse(JSON.stringify(passive.getState())));
  assert.strictEqual(copy.getState().sampleCount, 48);
});

test('N12 (ADR-062 B4): the "tau estimate" log line on a revert shows 1/θ[1] and the bound 1.25 - 800', () => {
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  const thetaBefore = [...learner.getState().theta];
  // Same step as the learner takes, to know the candidate θ[1] that is reverted
  const X = [5, -15, 0.2, 1];
  const y = 9.5;
  const { P } = learner.getState();
  const PX = P.map((row) => row.reduce((s, pij, j) => s + pij * X[j], 0));
  const den = 0.999 + X.reduce((s, xi, i) => s + xi * PX[i], 0);
  const err = y - X.reduce((s, xi, i) => s + xi * thetaBefore[i], 0);
  const candidateTheta1 = thetaBefore[1] + (PX[1] / den) * err;

  learner.updateRLS(X, y); // large error → step out of bounds → revert
  const text = lines.join('\n');
  assert.match(text, /RLS DIVERGENCE DETECTED/);
  assert.deepStrictEqual(learner.getState().theta, thetaBefore);
  const logged = Number(/τ estimate: ([\d.e+-]+)h \[valid: 1\.25 - 800\]/.exec(text)[1]);
  const expected = 1 / candidateTheta1;
  assert.ok(Math.abs(logged - expected) <= Math.max(0.1, Math.abs(expected) * 1e-3), `logged ${logged}, 1/θ1 ${expected}`);
});

test('N13 (ADR-062 B4/B12): a poorly insulated house (UA 1.0, C 10) converges from \'light\', beyond the old UA limit of 0.8', () => {
  // From 'light' (C 7, close to C_min 5) this excitation used to stay stuck in whole-step
  // reverts; B12 shortens the step to the bounds after 12 reverts in a row.
  const learner = createLearner({ buildingProfile: 'light' });
  const C = 10;
  const UA = 1.0;
  const pInt = 0.3;
  let tIndoor = 20;
  for (let i = 0; i < 8000; i++) {
    const pHeating = Math.max(0, 15 + 5 * Math.sin(i / 20) + 3 * Math.sin(i / 7));
    const tOutdoor = 5 + 5 * Math.sin(i / 60);
    learner.addMeasurement(measurement(T0 + i * FIVE_MIN_MS, tIndoor, tOutdoor, pHeating));
    tIndoor += ((pHeating - UA * (tIndoor - tOutdoor) + pInt) / C) * (5 / 60);
  }
  const model = learner.getModel();
  assert.ok(Math.abs(model.C - C) / C < 0.1, `C=${model.C.toFixed(2)} should be within 10% of ${C}`);
  assert.ok(Math.abs(model.UA - UA) / UA < 0.1, `UA=${model.UA.toFixed(3)} should be within 10% of ${UA}`);
});

test('N14 (ADR-062 §2.8): λ is the configured value, also with a large error; values below 0.9985 are clamped', () => {
  // Calls the private updateRLS() at a milestone sample count, where it logs the effective lambda.
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  learner.sampleCount = 100;
  learner.updateRLS([2, -15, 0, 1], 9); // prediction ≈ 0, error ≈ 9 °C/h
  const lambdaLine = lines.find((l) => l.startsWith('BuildingModelLearner: λ='));
  assert.ok(lambdaLine, 'no λ log line at sample 100');
  assert.match(lambdaLine, /λ=0\.9990 /);
  assert.ok(!lines.some((l) => l.includes('VFF')), 'no VFF log line any more');

  for (const [configured, expected] of [[0.99, 0.9985], [0.995, 0.9985], [0.9985, 0.9985], [0.9995, 0.9995], [undefined, 0.999]]) {
    const log = [];
    const clamped = createLearner({ forgettingFactor: configured, logger: (msg) => log.push(String(msg)) });
    assert.strictEqual(clamped.lambda, expected, `configured ${configured}`);
    // A missing setting takes the default without a clamp log line
    assert.strictEqual(log.some((l) => l.includes('clamped')), configured !== undefined && configured !== expected, `clamp log for ${configured}`);
  }
});

test('N15 (ADR-062 §2.5): restoreState() returns the outcome explicitly', () => {
  const theta = [1 / 15, 0.3 / 15, 0.5 / 15, 0.3 / 15];
  const valid = createLearner().restoreState({ theta, P: IDENTITY, sampleCount: 100, lastMeasurement: null });
  assert.deepStrictEqual(valid, { restored: true, reasons: [], covarianceProjected: false });

  // A rejected state with 0 samples: the sample count does not change, the result still says rejected
  const rejected = createLearner().restoreState({ theta: [0.1, 0.16, 0.04, 0.03], P: IDENTITY, sampleCount: 0, lastMeasurement: null });
  assert.strictEqual(rejected.restored, false);
  assert.strictEqual(rejected.covarianceProjected, false);
  assert.match(rejected.reasons.join('; '), /UA 1\.600 kW\/°C outside/);

  const indefinite = [[1, 0.9, 0.9, 0], [0.9, 1, -0.9, 0], [0.9, -0.9, 1, 0], [0, 0, 0, 1]];
  const projected = createLearner().restoreState({ theta, P: indefinite, sampleCount: 100, lastMeasurement: null });
  assert.deepStrictEqual(projected, { restored: true, reasons: [], covarianceProjected: true });
});

test('N16 (ADR-062 B6): prediction RMSE over 24 hours of a-priori errors, null before 12 updates', () => {
  const learner = createLearner();
  assert.strictEqual(learner.getPredictionRmse24h(), null);
  const spy = [];
  const original = learner.recordResidual.bind(learner);
  learner.recordResidual = (error) => { spy.push({ timestamp: learner.currentTimestamp, error }); original(error); };

  feed(learner, 23); // the 60-minute window spans 12 intervals: 11 updates (samples 13–23)
  assert.strictEqual(spy.length, 11);
  assert.strictEqual(learner.getPredictionRmse24h(), null);

  feed(learner, 600, T0 + 23 * FIVE_MIN_MS); // about 52 hours in total
  const last = spy[spy.length - 1].timestamp;
  const recent = spy.filter((r) => r.timestamp >= last - 24 * 3600 * 1000);
  assert.ok(recent.length < spy.length, 'older errors are dropped');
  const expected = Math.sqrt(recent.reduce((sum, r) => sum + r.error ** 2, 0) / recent.length);
  assert.ok(Math.abs(learner.getPredictionRmse24h() - expected) < 1e-12);

  learner.restoreState(learner.getState());
  assert.strictEqual(learner.getPredictionRmse24h(), null, 'not persisted: empty after a restore');
});

test('N17 (ADR-062 B6): softReset() empties the prediction errors of the old theta', () => {
  const learner = createLearner();
  feed(learner, 60);
  assert.notStrictEqual(learner.getPredictionRmse24h(), null);
  learner.softReset('heavy');
  assert.strictEqual(learner.getPredictionRmse24h(), null);
});

/** A learner after `reverts` reverts in a row, plus an update that leaves the bounds. */
function stuckLearner(reverts) {
  const lines = [];
  const learner = createLearner({ logger: (msg) => lines.push(String(msg)) });
  learner.consecutiveReverts = reverts;
  return { learner, lines, X: [5, -15, 0.2, 1], y: 9.5 }; // large error → step out of bounds (see N12)
}

test('N18 (ADR-062 B12): below 12 reverts in a row a step outside the bounds is still reverted', () => {
  const { learner, X, y } = stuckLearner(11);
  const before = JSON.parse(JSON.stringify(learner.getState()));
  learner.updateRLS(X, y);
  const after = learner.getState();
  assert.deepStrictEqual(after.theta, before.theta);
  assert.deepStrictEqual(after.P, before.P);
  assert.strictEqual(learner.getExcitationDiagnostics().consecutiveReverts, 12);
  assert.strictEqual(learner.getExcitationDiagnostics().boundedSteps, 0);
});

test('N19 (ADR-062 B12): after 12 reverts in a row the step is shortened to the bounds and P is updated', () => {
  const { learner, lines, X, y } = stuckLearner(12);
  const before = JSON.parse(JSON.stringify(learner.getState()));
  learner.updateRLS(X, y);
  const after = learner.getState();
  assert.notDeepStrictEqual(after.theta, before.theta, 'theta moves');
  assert.deepStrictEqual(BuildingModelLearner.thetaViolations(after.theta), [], 'theta stays within the bounds');
  assert.notDeepStrictEqual(after.P, before.P, 'P is updated');
  const excitation = learner.getExcitationDiagnostics();
  assert.strictEqual(excitation.consecutiveReverts, 0);
  assert.strictEqual(excitation.boundedSteps, 1);
  assert.strictEqual(excitation.totalReverts, 0, 'a bounded step is not a revert');
  assert.ok(lines.some((l) => /Bounded step \(α=0\.\d{3}\) after 12 reverts in a row/.test(l)));
});

test('N20 (ADR-062 B12): boundedSteps survives a round trip; an older state restores it as 0', () => {
  const { learner, X, y } = stuckLearner(12);
  learner.updateRLS(X, y);
  const copy = createLearner();
  copy.restoreState(JSON.parse(JSON.stringify(learner.getState())));
  assert.strictEqual(copy.getExcitationDiagnostics().boundedSteps, 1);

  const legacy = createLearner();
  const { boundedSteps, ...older } = JSON.parse(JSON.stringify(learner.getState()));
  assert.strictEqual(boundedSteps, 1);
  legacy.restoreState(older);
  assert.strictEqual(legacy.getExcitationDiagnostics().boundedSteps, 0);
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
