/**
 * Unit tests for BuildingModelLearner (ADR-057 W4/E6)
 *
 * Tests the pure RLS learner against the compiled output in .homeybuild/.
 * Run via: npm test (builds first, then node --test)
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  BuildingModelLearner,
  BUILDING_PROFILES,
  getDynamicPInt,
} = require('../../.homeybuild/lib/adaptive/building-model-learner');

const FIVE_MIN_MS = 5 * 60 * 1000;

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

function measurement(timestamp, tIndoor, tOutdoor, pHeating, solarRadiation = 0) {
  return {
    timestamp, tIndoor, tOutdoor, pHeating, solarRadiation, deltaTPerHour: 0,
  };
}

/**
 * Simulate a building with known parameters and feed the learner.
 * Returns the final indoor temperature.
 */
function simulate(learner, {
  C, UA, pInt, samples, startIndoor = 20, startTime = 1700000000000,
}) {
  let tIndoor = startIndoor;
  for (let i = 0; i < samples; i++) {
    const t = startTime + i * FIVE_MIN_MS;
    // Excitation: vary heating power and outdoor temperature
    // (clamped to ≥0 so no samples are rejected by the pHeating bound)
    const pHeating = Math.max(0, 2.0 + 1.5 * Math.sin(i / 20) + 0.8 * Math.sin(i / 7));
    const tOutdoor = 5 + 5 * Math.sin(i / 60);
    learner.addMeasurement(measurement(t, tIndoor, tOutdoor, pHeating));
    // Truth model: dT/dt = (1/C) × [P - UA×(Tin-Tout) + pInt]
    const dTdt = (pHeating - UA * (tIndoor - tOutdoor) + pInt) / C;
    tIndoor += dTdt * (5 / 60);
  }
  return tIndoor;
}

test('converges towards true parameters from a different profile', () => {
  const learner = createLearner({ buildingProfile: 'light' }); // init C=7
  simulate(learner, {
    C: 15, UA: 0.3, pInt: 0.3, samples: 8000,
  });
  const model = learner.getModel();
  // Convergence is deliberately slow: the defensive layers (bounds-revert +
  // 5%/sample rate limit) pin theta against the C lower bound for the first
  // ~1500 samples before it climbs towards the truth (ADR-057 bevinding D).
  assert.ok(model.C > 10 && model.C < 28, `C=${model.C.toFixed(1)} should move towards 15`);
  assert.ok(model.UA > 0.1 && model.UA < 0.8, `UA=${model.UA.toFixed(2)} should be physically plausible`);
  assert.ok(model.tau > 1.25 && model.tau < 500, `tau=${model.tau.toFixed(1)} within bounds`);

  // ADR-057 W3: the excitation counters must have registered the pinning phase
  const excitation = learner.getExcitationDiagnostics();
  assert.ok(excitation.totalReverts > 0, 'bound-pinning phase must be visible in revert counter');
});

test('ADR-057 W2a: gap larger than dt_max refreshes baseline without learning', () => {
  const learner = createLearner();
  const t0 = 1700000000000;
  learner.addMeasurement(measurement(t0, 20, 5, 2)); // first sample stored
  learner.addMeasurement(measurement(t0 + FIVE_MIN_MS, 20.05, 5, 2)); // learned
  const countBefore = learner.getState().sampleCount;

  // 3-hour gap: must be skipped, baseline refreshed
  const tGap = t0 + FIVE_MIN_MS + 3 * 3600 * 1000;
  learner.addMeasurement(measurement(tGap, 21, 5, 2));
  assert.strictEqual(learner.getState().sampleCount, countBefore, 'gap sample must not increment count');

  // Next 5-min sample must be accepted against the refreshed baseline
  learner.addMeasurement(measurement(tGap + FIVE_MIN_MS, 21.02, 5, 2));
  assert.strictEqual(learner.getState().sampleCount, countBefore + 1, 'post-gap sample must learn again');
});

test('ADR-057 E1: outdoor temperature bound widened to -25', () => {
  const learner = createLearner();
  const t0 = 1700000000000;
  learner.addMeasurement(measurement(t0, 20, -20, 2));
  learner.addMeasurement(measurement(t0 + FIVE_MIN_MS, 19.98, -20, 2));
  assert.strictEqual(learner.getState().sampleCount, 2, '-20°C outdoor must be accepted');

  learner.addMeasurement(measurement(t0 + 2 * FIVE_MIN_MS, 19.96, -30, 2));
  assert.strictEqual(learner.getState().sampleCount, 2, '-30°C outdoor must be rejected');
});

test('ADR-057 W1: covariance trace stays within RLS_COVARIANCE bounds after updates', () => {
  const learner = createLearner();
  simulate(learner, {
    C: 15, UA: 0.3, pInt: 0.3, samples: 50,
  });
  const state = learner.getState();
  const trace = state.P.reduce((sum, row, i) => sum + row[i], 0);
  const { TRACE_MAX } = BuildingModelLearner.RLS_COVARIANCE;
  assert.ok(trace > 0 && trace <= TRACE_MAX, `trace=${trace.toFixed(3)} must be in (0, ${TRACE_MAX}]`);
});

test('confidence is 0 without samples and grows with data', () => {
  const learner = createLearner();
  assert.strictEqual(learner.getModel().confidence, 0, 'fresh learner has 0 confidence');

  simulate(learner, {
    C: 15, UA: 0.3, pInt: 0.3, samples: 300,
  });
  const conf = learner.getModel().confidence;
  assert.ok(conf > 20 && conf <= 100, `confidence=${conf.toFixed(1)} should be substantial after 300 samples`);
});

test('ADR-057 E5: restoreState rejects theta outside THETA_BOUNDS', () => {
  const learner = createLearner();
  const valid = learner.getState();

  // C=50 (theta0 = 1/50 = 0.02) is outside theta0_min (1/40)
  const corrupt = {
    ...valid,
    theta: [1 / 50, 0.3 / 50, 0.5 / 50, 0.3 / 50],
    P: valid.P,
    sampleCount: 500,
    lastMeasurement: null,
  };
  learner.restoreState(corrupt);
  assert.strictEqual(learner.getState().sampleCount, 0, 'out-of-bounds state must be rejected (count reset)');
});

test('restoreState accepts a valid state and restores counters', () => {
  const source = createLearner();
  simulate(source, {
    C: 15, UA: 0.3, pInt: 0.3, samples: 100,
  });
  const saved = source.getState();

  const target = createLearner();
  target.restoreState(saved);
  assert.strictEqual(target.getState().sampleCount, saved.sampleCount, 'sample count restored');
  assert.deepStrictEqual(target.getState().theta, saved.theta, 'theta restored');
  const excitation = target.getExcitationDiagnostics();
  assert.strictEqual(typeof excitation.totalReverts, 'number', 'counters present after restore');
});

test('softReset halves sample count and re-initializes profile parameters', () => {
  const learner = createLearner();
  simulate(learner, {
    C: 15, UA: 0.3, pInt: 0.3, samples: 200,
  });
  const before = learner.getState().sampleCount;

  learner.softReset('passive');
  const state = learner.getState();
  const model = learner.getModel();
  assert.strictEqual(state.sampleCount, Math.floor(before / 2), 'sample count halved');
  assert.ok(Math.abs(model.C - BUILDING_PROFILES.passive.C) < 0.01, `C=${model.C.toFixed(1)} must equal passive profile`);
});

test('predictTemperature approaches equilibrium for large horizons', () => {
  const learner = createLearner(); // average profile: C=15, UA=0.3, g=0.5, pInt=0.3
  const model = learner.getModel();
  const heating = 2.0;
  const outdoor = 5;
  const expectedEq = outdoor + (heating + model.pInt) / model.UA;
  const predicted = learner.predictTemperature(20, outdoor, 0, heating, 1000);
  assert.ok(Math.abs(predicted - expectedEq) < 0.1, `predicted=${predicted.toFixed(1)} should approach equilibrium ${expectedEq.toFixed(1)}`);
});

test('ADR-057 E2: getDynamicPInt windows (night ×0.4, day ×1.0, evening ×1.8)', () => {
  assert.strictEqual(getDynamicPInt(3, 0.3), 0.3 * 0.4, 'night');
  assert.strictEqual(getDynamicPInt(12, 0.3), 0.3, 'day');
  assert.strictEqual(getDynamicPInt(19, 0.3), 0.3 * 1.8, 'evening starts at 18h');
  assert.strictEqual(getDynamicPInt(17, 0.3), 0.3, '17h is still day (not evening)');
  assert.strictEqual(getDynamicPInt(23, 0.3), 0.3 * 0.4, '23h is night');
});

test('ADR-057 W3: excitation counters start at zero and are exported in state', () => {
  const learner = createLearner();
  const excitation = learner.getExcitationDiagnostics();
  assert.deepStrictEqual(excitation, { consecutiveReverts: 0, totalReverts: 0, rateLimitActivations: 0 });
  const state = learner.getState();
  assert.strictEqual(state.consecutiveReverts, 0);
  assert.strictEqual(state.totalReverts, 0);
  assert.strictEqual(state.rateLimitActivations, 0);
});
